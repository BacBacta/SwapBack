use anchor_lang::prelude::*;
use anchor_spl::token::Token;
use crate::state::{DcaPlan, RouterState};
use crate::error::SwapbackError;

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
        constraint = user_token_in.owner == dca_plan.user,
        constraint = user_token_in.mint == dca_plan.token_in
    )]
    pub user_token_in: Account<'info, anchor_spl::token::TokenAccount>,
    
    /// User's output token account (destination)
    #[account(
        mut,
        constraint = user_token_out.owner == dca_plan.user,
        constraint = user_token_out.mint == dca_plan.token_out
    )]
    pub user_token_out: Account<'info, anchor_spl::token::TokenAccount>,
    
    /// CHECK: User that owns the DCA plan (for CPI signing if needed)
    #[account(
        constraint = user.key() == dca_plan.user
    )]
    pub user: AccountInfo<'info>,
    
    /// Executor that calls this instruction (can be bot or user)
    pub executor: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ExecuteDcaSwap>) -> Result<()> {
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
    
    // Verify user has sufficient balance
    require!(
        ctx.accounts.user_token_in.amount >= dca_plan.amount_per_swap,
        SwapbackError::InsufficientBalance
    );
    
    msg!("🔄 Executing DCA swap #{}", dca_plan.executed_swaps + 1);
    msg!("Amount: {}", dca_plan.amount_per_swap);
    msg!("Min output: {}", dca_plan.min_out_per_swap);
    
    // TODO: Actual swap logic will go here
    // For now, this is a placeholder that will be integrated with the router
    // The actual implementation will:
    // 1. Call swap_toc with the plan parameters
    // 2. Verify min_out_per_swap slippage protection
    // 3. Update total_invested and total_received
    
    // For demonstration, we'll just transfer tokens
    // In production, this would be replaced with actual swap logic
    let amount_received = dca_plan.amount_per_swap; // Placeholder: 1:1 swap
    
    require!(
        amount_received >= dca_plan.min_out_per_swap,
        SwapbackError::SlippageExceeded
    );
    
    // Update plan state
    dca_plan.executed_swaps += 1;
    dca_plan.total_invested += dca_plan.amount_per_swap;
    dca_plan.total_received += amount_received;
    dca_plan.next_execution = dca_plan.calculate_next_execution();
    
    // If all swaps completed, mark as inactive
    if dca_plan.is_completed() {
        dca_plan.is_active = false;
        msg!("✅ DCA Plan completed!");
    }
    
    msg!("Progress: {}/{} swaps", dca_plan.executed_swaps, dca_plan.total_swaps);
    msg!("Next execution: {}", dca_plan.next_execution);
    msg!("Total invested: {}", dca_plan.total_invested);
    msg!("Total received: {}", dca_plan.total_received);
    
    Ok(())
}
