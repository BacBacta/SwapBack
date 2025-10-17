use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token};


// Program ID generated locally for deployment
declare_id!("Gws21om1MSeL9fnZq5yc3tsMMdQDTwHDvE7zARG8rQBa");

#[program]
pub mod swapback_router {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.authority = ctx.accounts.authority.key();
        state.bump = ctx.bumps.state;
        Ok(())
    }

    pub fn create_plan(ctx: Context<CreatePlan>, plan_id: [u8; 32], plan_data: CreatePlanArgs) -> Result<()> {
        create_plan_processor::process_create_plan(ctx, plan_id, plan_data)
    }

    pub fn swap_toc(ctx: Context<SwapToC>, args: SwapArgs) -> Result<()> {
        swap_toc_processor::process_swap_toc(ctx, args)
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 1,
        seeds = [b"router_state"],
        bump
    )]
    pub state: Account<'info, RouterState>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreatePlan<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 32 + 32 + 8 + 8 + (4 + 10 * (32 + 2)) + (4 + 5 * (4 + 10 * (32 + 2) + 8)) + 8 + 8 + 1,
        seeds = [b"swap_plan", user.key().as_ref()],
        bump
    )]
    pub plan: Account<'info, SwapPlan>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CreatePlanArgs {
    pub plan_id: [u8; 32],
    pub token_in: Pubkey,
    pub token_out: Pubkey,
    pub amount_in: u64,
    pub min_out: u64,
    pub venues: Vec<VenueWeight>,
    pub fallback_plans: Vec<FallbackPlan>,
    pub expires_at: i64,
}

#[derive(Accounts)]
pub struct SwapToC<'info> {
    #[account(mut)]
    pub state: Account<'info, RouterState>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: Oracle account (Pyth price feed)
    pub oracle: AccountInfo<'info>,

    #[account(mut)]
    pub user_token_account_a: Account<'info, token::TokenAccount>,

    #[account(mut)]
    pub user_token_account_b: Account<'info, token::TokenAccount>,

    #[account(mut)]
    pub vault_token_account_a: Account<'info, token::TokenAccount>,

    #[account(mut)]
    pub vault_token_account_b: Account<'info, token::TokenAccount>,

    /// CHECK: Optional swap plan account when using dynamic plans
    pub plan: Option<Account<'info, SwapPlan>>,

    pub token_program: Program<'info, token::Token>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SwapArgs {
    pub amount_in: u64,
    pub min_out: u64,
    pub slippage_tolerance: Option<u16>, // In basis points (e.g., 50 = 0.5%)
    pub twap_slices: Option<u8>,         // Number of slices for TWAP
    pub use_dynamic_plan: bool,         // Whether to use a dynamic plan from plan_account
    pub plan_account: Option<Pubkey>,   // Account containing AtomicSwapPlan (if use_dynamic_plan)
    pub use_bundle: bool,               // Whether to use MEV bundling
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct VenueWeight {
    pub venue: Pubkey,    // DEX venue program ID
    pub weight: u16,      // Weight in basis points (0-10000)
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct FallbackPlan {
    pub venues: Vec<VenueWeight>,
    pub min_out: u64,
}

#[account]
pub struct SwapPlan {
    pub plan_id: [u8; 32],              // Unique plan identifier
    pub user: Pubkey,                   // User who created the plan
    pub token_in: Pubkey,               // Input token mint
    pub token_out: Pubkey,              // Output token mint
    pub amount_in: u64,                 // Total input amount
    pub min_out: u64,                   // Minimum output amount
    pub venues: Vec<VenueWeight>,       // Primary venues with weights
    pub fallback_plans: Vec<FallbackPlan>, // Fallback plans if primary fails
    pub expires_at: i64,                // Plan expiration timestamp
    pub created_at: i64,                // Plan creation timestamp
    pub bump: u8,                       // PDA bump
}

#[account]
pub struct RouterState {
    pub authority: Pubkey,
    pub bump: u8,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Oracle price data is stale")]
    StaleOracleData,
    #[msg("Invalid oracle price")]
    InvalidOraclePrice,
    #[msg("TWAP slice amount too small")]
    TwapSliceTooSmall,
    #[msg("Swap plan has expired")]
    PlanExpired,
    #[msg("Invalid plan weights - must sum to 10000")]
    InvalidPlanWeights,
    #[msg("Plan amount mismatch")]
    PlanAmountMismatch,
}

pub mod create_plan_processor {
    use super::*;

    pub fn process_create_plan(ctx: Context<CreatePlan>, _plan_id: [u8; 32], plan_data: CreatePlanArgs) -> Result<()> {
        let clock = Clock::get()?;
        let plan = &mut ctx.accounts.plan;

        // Validate plan weights sum to 10000 (100%)
        let total_weight: u16 = plan_data.venues.iter().map(|v| v.weight).sum();
        if total_weight != 10000 {
            return err!(ErrorCode::InvalidPlanWeights);
        }

        // Initialize plan account
        plan.plan_id = plan_data.plan_id;
        plan.user = ctx.accounts.user.key();
        plan.token_in = plan_data.token_in;
        plan.token_out = plan_data.token_out;
        plan.amount_in = plan_data.amount_in;
        plan.min_out = plan_data.min_out;
        plan.venues = plan_data.venues;
        plan.fallback_plans = plan_data.fallback_plans;
        plan.expires_at = plan_data.expires_at;
        plan.created_at = clock.unix_timestamp;
        plan.bump = ctx.bumps.plan;

        Ok(())
    }
}

pub mod swap_toc_processor {
    use super::*;

    pub fn process_swap_toc(ctx: Context<SwapToC>, args: SwapArgs) -> Result<()> {
        let clock = Clock::get()?;

        // Handle dynamic plan execution
        if args.use_dynamic_plan {
            return process_dynamic_plan_swap(ctx, args, clock);
        }

        // Legacy flow: Consult oracle for reference price
        let oracle_price = get_oracle_price(&ctx.accounts.oracle, clock.unix_timestamp)?;

        // Calculate expected output based on oracle price
        let expected_out = calculate_expected_output(args.amount_in, oracle_price)?;

        // Apply slippage tolerance if provided
        let min_out = if let Some(slippage_tolerance) = args.slippage_tolerance {
            calculate_min_output_with_slippage(expected_out, slippage_tolerance)?
        } else {
            args.min_out
        };

        // Check if TWAP is requested
        if let Some(twap_slices) = args.twap_slices {
            if twap_slices > 1 {
                return process_twap_swap(ctx, args, min_out, twap_slices, clock);
            }
        }

        // Process single swap
        process_single_swap(&ctx, args.amount_in, min_out)
    }

    fn process_dynamic_plan_swap(ctx: Context<SwapToC>, args: SwapArgs, clock: Clock) -> Result<()> {
        // Handle MEV bundling if requested
        if args.use_bundle {
            return process_bundled_swap(ctx, args, clock);
        }

        // Validate that plan account is provided
        let plan_account = ctx.accounts.plan.as_ref().ok_or(ErrorCode::InvalidOraclePrice)?;
        let plan = &plan_account;

        // Validate plan ownership and expiration
        if plan.user != ctx.accounts.user.key() {
            return err!(ErrorCode::InvalidOraclePrice); // TODO: Add specific error
        }
        if clock.unix_timestamp > plan.expires_at {
            return err!(ErrorCode::PlanExpired);
        }
        if plan.amount_in != args.amount_in {
            return err!(ErrorCode::PlanAmountMismatch);
        }

        // Try primary venues first
        match execute_venues_swap(&ctx, &plan.venues, args.amount_in, plan.min_out) {
            Ok(amount_out) => {
                if amount_out >= plan.min_out {
                    return Ok(());
                }
            }
            Err(_) => {
                // Primary venues failed, try fallback plans
                for fallback in &plan.fallback_plans {
                    match execute_venues_swap(&ctx, &fallback.venues, args.amount_in, fallback.min_out) {
                        Ok(amount_out) => {
                            if amount_out >= fallback.min_out {
                                return Ok(());
                            }
                        }
                        Err(_) => continue, // Try next fallback
                    }
                }
            }
        }

        // All plans failed
        err!(ErrorCode::SlippageExceeded)
    }

    fn process_bundled_swap(ctx: Context<SwapToC>, args: SwapArgs, clock: Clock) -> Result<()> {
        // TODO: Implement MEV bundling with Jito
        // For now, process as regular dynamic plan swap
        // In production, this would bundle multiple instructions and submit via Jito service
        process_dynamic_plan_swap(ctx, args, clock)
    }

    fn execute_venues_swap(
        _ctx: &Context<SwapToC>,
        venues: &[VenueWeight],
        total_amount_in: u64,
        min_out: u64,
    ) -> Result<u64> {
        let mut total_amount_out = 0u64;

        for venue_weight in venues {
            let amount_in = (total_amount_in as u128)
                .checked_mul(venue_weight.weight as u128)
                .ok_or(ErrorCode::InvalidOraclePrice)?
                .checked_div(10000)
                .ok_or(ErrorCode::InvalidOraclePrice)? as u64;

            if amount_in > 0 {
                // TODO: Implement actual DEX CPI calls based on venue.venue
                // For now, simulate a successful swap with 99% efficiency
                let venue_amount_out = (amount_in as u128)
                    .checked_mul(99)
                    .ok_or(ErrorCode::InvalidOraclePrice)?
                    .checked_div(100)
                    .ok_or(ErrorCode::InvalidOraclePrice)? as u64;

                total_amount_out = total_amount_out
                    .checked_add(venue_amount_out)
                    .ok_or(ErrorCode::InvalidOraclePrice)?;
            }
        }

        if total_amount_out < min_out {
            return err!(ErrorCode::SlippageExceeded);
        }

        Ok(total_amount_out)
    }

    fn get_oracle_price(_oracle_account: &AccountInfo, _current_time: i64) -> Result<u64> {
        // TODO: Implement proper Pyth oracle integration
        // For now, return a mock price (1.0 USD in 8 decimal places)
        Ok(100000000)
    }

    fn calculate_expected_output(amount_in: u64, oracle_price: u64) -> Result<u64> {
        // Assuming oracle_price is in USD per token with 6 decimals
        // amount_in is in token units (e.g., lamports for SOL)
        // For SOL/USD, oracle_price = price * 1e6, amount_in in lamports
        // expected_out = amount_in * oracle_price / 1e9 (since SOL has 9 decimals)
        // This is simplified - in reality depends on token decimals
        let expected_out = (amount_in as u128)
            .checked_mul(oracle_price as u128)
            .ok_or(ErrorCode::InvalidOraclePrice)?
            .checked_div(1_000_000_000) // Adjust for decimals
            .ok_or(ErrorCode::InvalidOraclePrice)? as u64;

        Ok(expected_out)
    }

    fn calculate_min_output_with_slippage(
        expected_out: u64,
        slippage_tolerance: u16,
    ) -> Result<u64> {
        let slippage_factor = 10_000u64
            .checked_sub(slippage_tolerance as u64)
            .ok_or(ErrorCode::SlippageExceeded)?;

        let min_out = (expected_out as u128)
            .checked_mul(slippage_factor as u128)
            .ok_or(ErrorCode::SlippageExceeded)?
            .checked_div(10_000)
            .ok_or(ErrorCode::SlippageExceeded)? as u64;

        Ok(min_out)
    }

    fn process_single_swap(_ctx: &Context<SwapToC>, amount_in: u64, min_out: u64) -> Result<()> {
        // Simplified swap logic - in reality would call DEX
        // For now, assume 1:1 swap for testing
        let amount_out = amount_in;

        if amount_out < min_out {
            return err!(ErrorCode::SlippageExceeded);
        }

        // Transfer tokens (simplified)
        // In reality, this would be a CPI to a DEX
        Ok(())
    }

    fn process_twap_swap(
        ctx: Context<SwapToC>,
        args: SwapArgs,
        total_min_out: u64,
        twap_slices: u8,
        _clock: Clock,
    ) -> Result<()> {
        let slice_amount = args.amount_in / twap_slices as u64;
        if slice_amount == 0 {
            return err!(ErrorCode::TwapSliceTooSmall);
        }

        let slice_min_out = total_min_out / twap_slices as u64;

        for _i in 0..twap_slices {
            // Process each slice
            process_single_swap(&ctx, slice_amount, slice_min_out)?;

            // Optional: Add delay between slices
            // In Solana, we can't sleep, but we could check slot numbers
            // For now, just process sequentially
        }

        Ok(())
    }
}
