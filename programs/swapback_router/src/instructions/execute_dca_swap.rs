use crate::error::SwapbackError;
use crate::state::{DcaPlan, RouterState};
use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

/// Arguments for DCA swap execution
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ExecuteDcaSwapArgs {
    /// Jupiter swap instruction data (built off-chain by keeper)
    pub jupiter_instruction: Vec<u8>,
    /// Expected input amount (must match plan's amount_per_swap)
    pub expected_input: u64,
    /// Actual amount received from Jupiter (reported by keeper after simulation)
    pub amount_received: u64,
}

#[derive(Accounts)]
pub struct ExecuteDcaSwap<'info> {
    #[account(
        mut,
        seeds = [b"dca_plan", dca_plan.user.as_ref(), &dca_plan.plan_id],
        bump = dca_plan.bump
    )]
    pub dca_plan: Account<'info, DcaPlan>,

    #[account(
        mut,
        seeds = [b"router_state"],
        bump = state.bump
    )]
    pub state: Account<'info, RouterState>,

    /// User's input token account (source)
    #[account(
        mut,
        constraint = user_token_in.owner == dca_plan.user @ SwapbackError::InvalidTokenAccount,
        constraint = user_token_in.mint == dca_plan.token_in @ SwapbackError::InvalidTokenAccount
    )]
    pub user_token_in: Account<'info, TokenAccount>,

    /// User's output token account (destination)
    #[account(
        mut,
        constraint = user_token_out.owner == dca_plan.user @ SwapbackError::InvalidTokenAccount,
        constraint = user_token_out.mint == dca_plan.token_out @ SwapbackError::InvalidTokenAccount
    )]
    pub user_token_out: Account<'info, TokenAccount>,

    /// CHECK: User that owns the DCA plan (for CPI signing if needed)
    #[account(
        constraint = user.key() == dca_plan.user @ SwapbackError::Unauthorized
    )]
    pub user: AccountInfo<'info>,

    /// Executor that calls this instruction (keeper bot or user)
    pub executor: Signer<'info>,

    /// CHECK: Jupiter program for CPI
    #[account(address = crate::JUPITER_PROGRAM_ID)]
    pub jupiter_program: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// DCA swap execution event
#[event]
pub struct DcaSwapExecuted {
    pub plan_id: [u8; 32],
    pub user: Pubkey,
    pub swap_number: u64,
    pub amount_in: u64,
    pub amount_out: u64,
    pub slippage_bps: u16,
    pub timestamp: i64,
}

pub fn handler(ctx: Context<ExecuteDcaSwap>, args: ExecuteDcaSwapArgs) -> Result<()> {
    let dca_plan = &mut ctx.accounts.dca_plan;
    let clock = Clock::get()?;

    // Validation
    require!(dca_plan.is_active, SwapbackError::PlanNotActive);
    require!(!dca_plan.is_completed(), SwapbackError::PlanCompleted);
    require!(
        !dca_plan.is_expired(clock.unix_timestamp),
        SwapbackError::PlanExpired
    );
    require!(
        dca_plan.is_ready_for_execution(clock.unix_timestamp),
        SwapbackError::NotReadyForExecution
    );

    // Verify input amount matches plan
    require!(
        args.expected_input == dca_plan.amount_per_swap,
        SwapbackError::InvalidAmount
    );

    // Verify user has sufficient balance
    require!(
        ctx.accounts.user_token_in.amount >= dca_plan.amount_per_swap,
        SwapbackError::InsufficientBalance
    );

    msg!("🔄 Executing DCA swap #{}", dca_plan.executed_swaps + 1);
    msg!("Amount in: {}", dca_plan.amount_per_swap);
    msg!("Min output: {}", dca_plan.min_out_per_swap);

    // Record balance before swap for verification
    let balance_before = ctx.accounts.user_token_out.amount;

    // Execute Jupiter swap via CPI if instruction data provided
    if !args.jupiter_instruction.is_empty() {
        let remaining_accounts = ctx.remaining_accounts;
        
        // Build account metas for Jupiter CPI
        let account_metas: Vec<AccountMeta> = remaining_accounts
            .iter()
            .map(|acc| {
                if acc.is_writable {
                    AccountMeta::new(*acc.key, acc.is_signer)
                } else {
                    AccountMeta::new_readonly(*acc.key, acc.is_signer)
                }
            })
            .collect();

        let instruction = anchor_lang::solana_program::instruction::Instruction {
            program_id: crate::JUPITER_PROGRAM_ID,
            accounts: account_metas,
            data: args.jupiter_instruction.clone(),
        };

        anchor_lang::solana_program::program::invoke(
            &instruction,
            remaining_accounts,
        ).map_err(|_| SwapbackError::SwapExecutionFailed)?;
    }

    // Reload token account to get actual received amount
    ctx.accounts.user_token_out.reload()?;
    let balance_after = ctx.accounts.user_token_out.amount;
    
    // Calculate actual amount received
    let amount_received = balance_after
        .checked_sub(balance_before)
        .ok_or(SwapbackError::MathOverflow)?;

    // If no Jupiter CPI was executed (keeper reports amount), use reported value
    // This allows flexibility for keepers that execute Jupiter externally
    let final_amount = if amount_received > 0 {
        amount_received
    } else {
        args.amount_received
    };

    // Verify slippage protection
    require!(
        final_amount >= dca_plan.min_out_per_swap,
        SwapbackError::SlippageExceeded
    );

    // Calculate actual slippage for metrics
    let slippage_bps = if dca_plan.amount_per_swap > 0 && final_amount < dca_plan.amount_per_swap {
        ((dca_plan.amount_per_swap - final_amount) as u128 * 10_000 / dca_plan.amount_per_swap as u128) as u16
    } else {
        0
    };

    // Update plan state
    dca_plan.executed_swaps += 1;
    dca_plan.total_invested += dca_plan.amount_per_swap;
    dca_plan.total_received += final_amount;
    dca_plan.next_execution = dca_plan.calculate_next_execution();

    // If all swaps completed, mark as inactive
    if dca_plan.is_completed() {
        dca_plan.is_active = false;
        msg!("✅ DCA Plan completed!");
    }

    // Emit event for keeper monitoring
    emit!(DcaSwapExecuted {
        plan_id: dca_plan.plan_id,
        user: dca_plan.user,
        swap_number: dca_plan.executed_swaps as u64,
        amount_in: dca_plan.amount_per_swap,
        amount_out: final_amount,
        slippage_bps,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Progress: {}/{} swaps",
        dca_plan.executed_swaps,
        dca_plan.total_swaps
    );
    msg!("Amount received: {}", final_amount);
    msg!("Next execution: {}", dca_plan.next_execution);
    msg!("Total invested: {}", dca_plan.total_invested);
    msg!("Total received: {}", dca_plan.total_received);

    Ok(())
}
