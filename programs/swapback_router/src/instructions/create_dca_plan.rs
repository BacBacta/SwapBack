use crate::error::SwapbackError;
use crate::CreateDcaPlan;
use crate::MAX_SINGLE_SWAP_LAMPORTS;
use anchor_lang::prelude::*;

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

    validate_plan_args(
        token_in,
        token_out,
        amount_per_swap,
        total_swaps,
        interval_seconds,
        min_out_per_swap,
        expires_at,
        clock.unix_timestamp,
    )?;

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
    msg!("Token pair: {} → {}", token_in, token_out);
    msg!("Amount per swap: {}", amount_per_swap);
    msg!("Total swaps: {}", total_swaps);
    msg!("Interval: {} seconds", interval_seconds);
    msg!("Next execution: {}", dca_plan.next_execution);

    Ok(())
}

pub fn validate_plan_args(
    token_in: Pubkey,
    token_out: Pubkey,
    amount_per_swap: u64,
    total_swaps: u32,
    interval_seconds: i64,
    min_out_per_swap: u64,
    expires_at: i64,
    current_ts: i64,
) -> Result<()> {
    require!(amount_per_swap > 0, SwapbackError::InvalidAmount);
    require!(
        amount_per_swap <= MAX_SINGLE_SWAP_LAMPORTS,
        SwapbackError::AmountExceedsLimit
    );
    require!(total_swaps > 0, SwapbackError::InvalidSwapCount);
    require!(total_swaps <= 10000, SwapbackError::TooManySwaps);
    require!(token_in != token_out, SwapbackError::IdenticalMints);
    require!(interval_seconds >= 3600, SwapbackError::IntervalTooShort);
    require!(interval_seconds <= 31536000, SwapbackError::IntervalTooLong);
    require!(min_out_per_swap > 0, SwapbackError::InvalidMinOutput);

    if expires_at > 0 {
        require!(expires_at > current_ts, SwapbackError::InvalidExpiry);
    }

    Ok(())
}
