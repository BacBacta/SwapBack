use crate::error::SwapbackError;
use crate::state::{DcaPlan, RouterState};
use crate::MAX_SINGLE_SWAP_LAMPORTS;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(plan_id: [u8; 32])]
pub struct CreateDcaPlan<'info> {
    #[account(
        init,
        payer = user,
        space = DcaPlan::LEN,
        seeds = [b"dca_plan", user.key().as_ref(), &plan_id],
        bump
    )]
    pub dca_plan: Account<'info, DcaPlan>,

    #[account(
        seeds = [b"router_state"],
        bump = state.bump
    )]
    pub state: Account<'info, RouterState>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateDcaPlanArgs {
    /// Input token mint
    pub token_in: Pubkey,

    /// Output token mint
    pub token_out: Pubkey,

    /// Amount per swap (in lamports/smallest unit)
    pub amount_per_swap: u64,

    /// Total number of swaps
    pub total_swaps: u32,

    /// Interval between swaps (in seconds)
    pub interval_seconds: i64,

    /// Minimum output per swap (slippage protection)
    pub min_out_per_swap: u64,

    /// Optional expiry timestamp (0 = no expiry)
    pub expires_at: i64,
}

pub fn handler(
    ctx: Context<CreateDcaPlan>,
    plan_id: [u8; 32],
    token_in: Pubkey,
    token_out: Pubkey,
    amount_per_swap: u64,
    total_swaps: u32,
    interval_seconds: i64,
    min_out_per_swap: u64,
    expires_at: i64,
) -> Result<()> {
    let dca_plan = &mut ctx.accounts.dca_plan;
    let clock = Clock::get()?;

    // Create args struct for validation
    let args = CreateDcaPlanArgs {
        token_in,
        token_out,
        amount_per_swap,
        total_swaps,
        interval_seconds,
        min_out_per_swap,
        expires_at,
    };
    
    validate_plan_args(&args, clock.unix_timestamp)?;

    // Initialize DCA plan
    dca_plan.plan_id = plan_id;
    dca_plan.user = ctx.accounts.user.key();
    dca_plan.token_in = token_in;
    dca_plan.token_out = token_out;
    dca_plan.amount_per_swap = amount_per_swap;
    dca_plan.total_swaps = total_swaps;
    dca_plan.executed_swaps = 0;
    dca_plan.interval_seconds = interval_seconds;
    dca_plan.next_execution = clock.unix_timestamp + interval_seconds;
    dca_plan.min_out_per_swap = min_out_per_swap;
    dca_plan.created_at = clock.unix_timestamp;
    dca_plan.expires_at = expires_at;
    dca_plan.is_active = true;
    dca_plan.total_invested = 0;
    dca_plan.total_received = 0;
    dca_plan.bump = ctx.bumps.dca_plan;

    msg!("✅ DCA Plan created successfully!");
    msg!("Plan ID: {:?}", plan_id);
    msg!("Token pair: {} → {}", args.token_in, args.token_out);
    msg!("Amount per swap: {}", args.amount_per_swap);
    msg!("Total swaps: {}", args.total_swaps);
    msg!("Interval: {} seconds", args.interval_seconds);
    msg!("Next execution: {}", dca_plan.next_execution);

    Ok(())
}

pub fn validate_plan_args(args: &CreateDcaPlanArgs, current_ts: i64) -> Result<()> {
    require!(args.amount_per_swap > 0, SwapbackError::InvalidAmount);
    require!(args.amount_per_swap <= MAX_SINGLE_SWAP_LAMPORTS, SwapbackError::AmountExceedsLimit);
    require!(args.total_swaps > 0, SwapbackError::InvalidSwapCount);
    require!(args.total_swaps <= 10000, SwapbackError::TooManySwaps);
    require!(args.token_in != args.token_out, SwapbackError::IdenticalMints);
    require!(args.interval_seconds >= 3600, SwapbackError::IntervalTooShort);
    require!(args.interval_seconds <= 31536000, SwapbackError::IntervalTooLong);
    require!(args.min_out_per_swap > 0, SwapbackError::InvalidMinOutput);

    if args.expires_at > 0 {
        require!(
            args.expires_at > current_ts,
            SwapbackError::InvalidExpiry
        );
    }

    Ok(())
}
