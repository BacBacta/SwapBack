use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token};

// Program ID generated locally for deployment
declare_id!("Gws21om1MSeL9fnZq5yc3tsMMdQDTwHDvE7zARG8rQBa");

// DEX Program IDs (example - would need to be updated with actual deployed programs)
pub const RAYDIUM_AMM_PROGRAM_ID: Pubkey = pubkey!("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");
pub const ORCA_WHIRLPOOL_PROGRAM_ID: Pubkey = pubkey!("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");
pub const JUPITER_PROGRAM_ID: Pubkey = pubkey!("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");

#[program]
pub mod swapback_router {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.authority = ctx.accounts.authority.key();
        state.bump = ctx.bumps.state;
        Ok(())
    }

    pub fn create_plan(
        ctx: Context<CreatePlan>,
        plan_id: [u8; 32],
        plan_data: CreatePlanArgs,
    ) -> Result<()> {
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
    pub use_dynamic_plan: bool,          // Whether to use a dynamic plan from plan_account
    pub plan_account: Option<Pubkey>,    // Account containing AtomicSwapPlan (if use_dynamic_plan)
    pub use_bundle: bool,                // Whether to use MEV bundling
    pub oracle_account: Pubkey,          // Oracle account for price validation (Pyth/Switchboard)
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct VenueWeight {
    pub venue: Pubkey, // DEX venue program ID
    pub weight: u16,   // Weight in basis points (0-10000)
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct FallbackPlan {
    pub venues: Vec<VenueWeight>,
    pub min_out: u64,
}

#[account]
pub struct SwapPlan {
    pub plan_id: [u8; 32],                 // Unique plan identifier
    pub user: Pubkey,                      // User who created the plan
    pub token_in: Pubkey,                  // Input token mint
    pub token_out: Pubkey,                 // Output token mint
    pub amount_in: u64,                    // Total input amount
    pub min_out: u64,                      // Minimum output amount
    pub venues: Vec<VenueWeight>,          // Primary venues with weights
    pub fallback_plans: Vec<FallbackPlan>, // Fallback plans if primary fails
    pub expires_at: i64,                   // Plan expiration timestamp
    pub created_at: i64,                   // Plan creation timestamp
    pub bump: u8,                          // PDA bump
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
    #[msg("Unauthorized access to swap plan")]
    UnauthorizedPlanAccess,
}

pub mod create_plan_processor {
    use super::*;

    pub fn process_create_plan(
        ctx: Context<CreatePlan>,
        _plan_id: [u8; 32],
        plan_data: CreatePlanArgs,
    ) -> Result<()> {
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

        // Validate oracle account matches the provided oracle_account
        if ctx.accounts.oracle.key() != args.oracle_account {
            return err!(ErrorCode::InvalidOraclePrice);
        }

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

    fn process_dynamic_plan_swap(
        ctx: Context<SwapToC>,
        args: SwapArgs,
        clock: Clock,
    ) -> Result<()> {
        // Handle MEV bundling if requested
        if args.use_bundle {
            return process_bundled_swap(ctx, args, clock);
        }

        // Validate that plan account is provided
        let plan_account = ctx
            .accounts
            .plan
            .as_ref()
            .ok_or(ErrorCode::InvalidOraclePrice)?;
        let plan = &plan_account;

        // Validate plan ownership and expiration
        if plan.user != ctx.accounts.user.key() {
            return err!(ErrorCode::UnauthorizedPlanAccess);
        }
        if clock.unix_timestamp > plan.expires_at {
            return err!(ErrorCode::PlanExpired);
        }
        if plan.amount_in != args.amount_in {
            return err!(ErrorCode::PlanAmountMismatch);
        }

        // Validate that primary venue weights sum to 10000 (100%)
        let total_weight: u16 = plan.venues.iter().map(|v| v.weight).sum();
        if total_weight != 10000 {
            return err!(ErrorCode::InvalidPlanWeights);
        }

        // Validate fallback plan weights as well
        for fallback in &plan.fallback_plans {
            let fallback_weight: u16 = fallback.venues.iter().map(|v| v.weight).sum();
            if fallback_weight != 10000 {
                return err!(ErrorCode::InvalidPlanWeights);
            }
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
                    match execute_venues_swap(
                        &ctx,
                        &fallback.venues,
                        args.amount_in,
                        fallback.min_out,
                    ) {
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
        ctx: &Context<SwapToC>,
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
                // Execute swap on the specified DEX
                let venue_amount_out = execute_dex_swap(ctx, venue_weight.venue, amount_in, 0)?; // min_out handled at venue level

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

    fn execute_dex_swap(
        ctx: &Context<SwapToC>,
        dex_program: Pubkey,
        amount_in: u64,
        min_out: u64,
    ) -> Result<u64> {
        match dex_program {
            RAYDIUM_AMM_PROGRAM_ID => {
                // Raydium AMM swap - simplified implementation
                // In production, this would require proper AMM account resolution
                // and all necessary accounts passed via remaining_accounts

                // For demonstration, we'll simulate a realistic swap
                // Real implementation would use raydium's swap instruction
                let simulated_out = (amount_in as u128)
                    .checked_mul(982) // 98.2% efficiency (typical for AMM)
                    .ok_or(ErrorCode::InvalidOraclePrice)?
                    .checked_div(1000)
                    .ok_or(ErrorCode::InvalidOraclePrice)? as u64;

                // Ensure minimum output is met
                if simulated_out < min_out {
                    return err!(ErrorCode::SlippageExceeded);
                }

                Ok(simulated_out)
            }
            ORCA_WHIRLPOOL_PROGRAM_ID => {
                // Orca Whirlpool swap - concentrated liquidity implementation
                // In production, this would use whirlpool's swap instruction
                // with proper tick arrays and position resolution

                let simulated_out = (amount_in as u128)
                    .checked_mul(973) // 97.3% efficiency (concentrated liquidity)
                    .ok_or(ErrorCode::InvalidOraclePrice)?
                    .checked_div(1000)
                    .ok_or(ErrorCode::InvalidOraclePrice)? as u64;

                if simulated_out < min_out {
                    return err!(ErrorCode::SlippageExceeded);
                }

                Ok(simulated_out)
            }
            JUPITER_PROGRAM_ID => {
                // Jupiter aggregator swap - best route finding
                // In production, this would use Jupiter's route optimization
                // and execute the best available route

                let simulated_out = (amount_in as u128)
                    .checked_mul(992) // 99.2% efficiency (aggregator advantage)
                    .ok_or(ErrorCode::InvalidOraclePrice)?
                    .checked_div(1000)
                    .ok_or(ErrorCode::InvalidOraclePrice)? as u64;

                if simulated_out < min_out {
                    return err!(ErrorCode::SlippageExceeded);
                }

                Ok(simulated_out)
            }
            _ => {
                // Unknown DEX - basic swap simulation
                let simulated_out = (amount_in as u128)
                    .checked_mul(950)
                    .ok_or(ErrorCode::InvalidOraclePrice)?
                    .checked_div(1000)
                    .ok_or(ErrorCode::InvalidOraclePrice)? as u64;

                if simulated_out < min_out {
                    return err!(ErrorCode::SlippageExceeded);
                }

                Ok(simulated_out)
            }
        }
    }

    fn get_oracle_price(oracle_account: &AccountInfo, _current_time: i64) -> Result<u64> {
        // TODO: Implement full Pyth/Switchboard integration
        // Current implementation provides basic validation but uses mock price
        // Full implementation requires updated Pyth SDK compatible with Anchor

        // Basic validation - ensure oracle account is provided and not default
        if oracle_account.key() == Pubkey::default() {
            return err!(ErrorCode::InvalidOraclePrice);
        }

        // TODO: Replace with actual Pyth price feed loading:
        // let price_feed = pyth_sdk_solana::SolanaPriceAccount::account_info_to_feed(oracle_account)?;
        // let price = price_feed.get_price_no_older_than(current_time, 60)?;
        // Validate confidence and freshness...

        // Mock price for development (1.0 USD in 8 decimal places)
        // In production, this would return actual price from oracle
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
