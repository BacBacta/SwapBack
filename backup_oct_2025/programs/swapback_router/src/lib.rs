use anchor_lang::prelude::*;
use anchor_spl::token;

mod cpi_orca;
mod oracle;

// Custom getrandom stub for Solana BPF target
#[cfg(target_os = "solana")]
mod getrandom_stub;

// Program ID déployé sur devnet - 19 Oct 2025
declare_id!("3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap");

// DEX Program IDs (example - would need to be updated with actual deployed programs)
pub const RAYDIUM_AMM_PROGRAM_ID: Pubkey = pubkey!("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");
pub const ORCA_WHIRLPOOL_PROGRAM_ID: Pubkey =
    pubkey!("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");
pub const JUPITER_PROGRAM_ID: Pubkey = pubkey!("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");

// Oracle constants
pub const MAX_STALENESS_SECS: i64 = 300; // 5 minutes max staleness

// Security limits
pub const MAX_VENUES: usize = 10;
pub const MAX_FALLBACKS: usize = 5;

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

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
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

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub enum OracleType {
    Switchboard,
    Pyth,
}

#[event]
pub struct OracleChecked {
    pub feed: Pubkey,
    pub price: u64,
    pub confidence: u64,
    pub slot: u64,
    pub timestamp: i64,
    pub oracle_type: OracleType,
}

#[event]
pub struct VenueExecuted {
    pub venue: Pubkey,
    pub amount_in: u64,
    pub amount_out: u64,
    pub success: bool,
    pub fallback_used: bool,
}

#[event]
pub struct FallbackTriggered {
    pub plan_index: u8,
    pub reason: String,
}

#[event]
pub struct BundleHint {
    pub priority_fee: u64,
    pub n_instructions: u8,
}

#[event]
pub struct PriorityFeeSet {
    pub compute_unit_limit: u32,
    pub compute_unit_price: u64,
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
    #[msg("Unknown DEX or not yet implemented")]
    UnknownDex,
    #[msg("Invalid token account")]
    InvalidTokenAccount,
    DexNotImplemented,
    #[msg("DEX execution failed")]
    DexExecutionFailed,
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
    use crate::cpi_orca;
    use crate::oracle::{self, OracleObservation};

    pub fn process_swap_toc(ctx: Context<SwapToC>, args: SwapArgs) -> Result<()> {
        let clock = Clock::get()?;

        if ctx.accounts.oracle.key() != args.oracle_account {
            return err!(ErrorCode::InvalidOraclePrice);
        }

        if args.use_dynamic_plan {
            return process_dynamic_plan_swap(&ctx, args, &clock);
        }

        let oracle_observation = get_oracle_price(&ctx.accounts.oracle, &clock)?;
        let expected_out = calculate_expected_output(args.amount_in, oracle_observation.price)?;

        let min_out = if let Some(slippage_tolerance) = args.slippage_tolerance {
            calculate_min_output_with_slippage(expected_out, slippage_tolerance)?
        } else {
            args.min_out
        };

        if let Some(twap_slices) = args.twap_slices {
            if twap_slices > 1 {
                return process_twap_swap(&ctx, args, min_out, twap_slices, &clock);
            }
        }

        process_single_swap(&ctx, args.amount_in, min_out)
    }

    fn process_dynamic_plan_swap(
        ctx: &Context<SwapToC>,
        args: SwapArgs,
        clock: &Clock,
    ) -> Result<()> {
        let (plan_user, plan_amount_in, plan_min_out, plan_venues, plan_fallbacks, plan_expires_at) = {
            let plan = ctx
                .accounts
                .plan
                .as_ref()
                .ok_or(ErrorCode::InvalidOraclePrice)?;
            (
                plan.user,
                plan.amount_in,
                plan.min_out,
                plan.venues.clone(),
                plan.fallback_plans.clone(),
                plan.expires_at,
            )
        };

        if args.use_bundle {
            let estimated_instr = 2u8
                .saturating_add(plan_venues.len() as u8)
                .saturating_add(plan_fallbacks.len() as u8);
            let n_instructions = estimated_instr.max(2);
            let priority_fee = 100_000u64;

            emit!(BundleHint {
                priority_fee,
                n_instructions,
            });
        }

        emit_priority_fee_hint(args.amount_in, plan_venues.len(), plan_fallbacks.len());

        if plan_venues.len() > MAX_VENUES {
            return err!(ErrorCode::InvalidPlanWeights);
        }
        if plan_fallbacks.len() > MAX_FALLBACKS {
            return err!(ErrorCode::InvalidPlanWeights);
        }
        if plan_user != ctx.accounts.user.key() {
            return err!(ErrorCode::UnauthorizedPlanAccess);
        }
        if clock.unix_timestamp > plan_expires_at {
            return err!(ErrorCode::PlanExpired);
        }
        if plan_amount_in != args.amount_in {
            return err!(ErrorCode::PlanAmountMismatch);
        }

        let total_weight: u16 = plan_venues.iter().map(|v| v.weight).sum();
        if total_weight != 10_000 {
            return err!(ErrorCode::InvalidPlanWeights);
        }

        for fallback in &plan_fallbacks {
            let fallback_weight: u16 = fallback.venues.iter().map(|v| v.weight).sum();
            if fallback_weight != 10_000 {
                return err!(ErrorCode::InvalidPlanWeights);
            }
        }

        let primary_result = execute_venues_swap(
            ctx,
            &plan_venues,
            args.amount_in,
            plan_min_out,
            ctx.remaining_accounts,
            false,
        );

        let mut failure_reason = match primary_result {
            Ok(amount_out) if amount_out >= plan_min_out => return Ok(()),
            Ok(_) => String::from("Primary venues slippage"),
            Err(_) => String::from("Primary venues execution failure"),
        };

        for (index, fallback_plan) in plan_fallbacks.iter().enumerate() {
            emit!(FallbackTriggered {
                plan_index: index as u8,
                reason: failure_reason.clone(),
            });

            let fallback_result = execute_venues_swap(
                ctx,
                &fallback_plan.venues,
                args.amount_in,
                fallback_plan.min_out,
                ctx.remaining_accounts,
                true,
            );

            match fallback_result {
                Ok(amount_out) if amount_out >= fallback_plan.min_out => return Ok(()),
                Ok(_) => {
                    failure_reason = String::from("Fallback slippage");
                }
                Err(_) => {
                    failure_reason = String::from("Fallback execution failure");
                }
            }
        }

        err!(ErrorCode::SlippageExceeded)
    }

    fn execute_venues_swap(
        ctx: &Context<SwapToC>,
        venues: &[VenueWeight],
        total_amount_in: u64,
        min_out: u64,
        remaining_accounts: &[AccountInfo],
        is_fallback: bool,
    ) -> Result<u64> {
        let mut total_amount_out: u64 = 0;
        let mut account_cursor: usize = 0;

        for venue_weight in venues {
            let amount_in = (total_amount_in as u128)
                .checked_mul(venue_weight.weight as u128)
                .ok_or(ErrorCode::InvalidOraclePrice)?
                .checked_div(10_000)
                .ok_or(ErrorCode::InvalidOraclePrice)? as u64;

            if amount_in == 0 {
                continue;
            }

            let min_out_per_venue = min_out
                .checked_mul(venue_weight.weight as u64)
                .ok_or(ErrorCode::InvalidPlanWeights)?
                .checked_div(10_000)
                .ok_or(ErrorCode::InvalidPlanWeights)?;

            let required_accounts = required_account_len_for_dex(&venue_weight.venue)?;
            if account_cursor
                .checked_add(required_accounts)
                .unwrap_or(usize::MAX)
                > remaining_accounts.len()
            {
                emit!(VenueExecuted {
                    venue: venue_weight.venue,
                    amount_in,
                    amount_out: 0,
                    success: false,
                    fallback_used: is_fallback,
                });
                return err!(ErrorCode::DexExecutionFailed);
            }

            let account_slice =
                &remaining_accounts[account_cursor..account_cursor + required_accounts];
            account_cursor += required_accounts;

            let amount_out = execute_dex_swap(
                ctx,
                venue_weight.venue,
                amount_in,
                min_out_per_venue,
                account_slice,
                is_fallback,
            )?;

            total_amount_out = total_amount_out
                .checked_add(amount_out)
                .ok_or(ErrorCode::SlippageExceeded)?;
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
        account_slice: &[AccountInfo],
        is_fallback: bool,
    ) -> Result<u64> {
        match dex_program {
            RAYDIUM_AMM_PROGRAM_ID => {
                emit!(VenueExecuted {
                    venue: dex_program,
                    amount_in,
                    amount_out: 0,
                    success: false,
                    fallback_used: is_fallback,
                });
                err!(ErrorCode::DexNotImplemented)
            }
            ORCA_WHIRLPOOL_PROGRAM_ID => {
                let amount_out = cpi_orca::swap(ctx, account_slice, amount_in, min_out)?;
                emit!(VenueExecuted {
                    venue: dex_program,
                    amount_in,
                    amount_out,
                    success: true,
                    fallback_used: is_fallback,
                });
                Ok(amount_out)
            }
            JUPITER_PROGRAM_ID => {
                emit!(VenueExecuted {
                    venue: dex_program,
                    amount_in,
                    amount_out: 0,
                    success: false,
                    fallback_used: is_fallback,
                });
                err!(ErrorCode::DexNotImplemented)
            }
            _ => {
                emit!(VenueExecuted {
                    venue: dex_program,
                    amount_in,
                    amount_out: 0,
                    success: false,
                    fallback_used: is_fallback,
                });
                err!(ErrorCode::DexNotImplemented)
            }
        }
    }

    fn required_account_len_for_dex(program_id: &Pubkey) -> Result<usize> {
        if *program_id == ORCA_WHIRLPOOL_PROGRAM_ID {
            Ok(cpi_orca::ORCA_SWAP_ACCOUNT_COUNT)
        } else {
            Ok(0)
        }
    }

    fn get_oracle_price(oracle_account: &AccountInfo, clock: &Clock) -> Result<OracleObservation> {
        let observation = oracle::read_price(oracle_account, clock)?;
        emit!(OracleChecked {
            feed: oracle_account.key(),
            price: observation.price,
            confidence: observation.confidence,
            slot: observation.slot,
            timestamp: observation.publish_time,
            oracle_type: observation.oracle_type,
        });
        Ok(observation)
    }

    fn emit_priority_fee_hint(amount_in: u64, venue_count: usize, fallback_count: usize) {
        let base_limit: u32 = 200_000;
        let cu_limit = base_limit
            .saturating_add((venue_count as u32).saturating_mul(30_000))
            .saturating_add((fallback_count as u32).saturating_mul(10_000));

        let mut priority_fee = amount_in / 1_000;
        if priority_fee < 5_000 {
            priority_fee = 5_000;
        }
        if priority_fee > 500_000 {
            priority_fee = 500_000;
        }

        emit!(PriorityFeeSet {
            compute_unit_limit: cu_limit,
            compute_unit_price: priority_fee,
        });
    }

    fn calculate_expected_output(amount_in: u64, oracle_price: u64) -> Result<u64> {
        let expected_out = (amount_in as u128)
            .checked_mul(oracle_price as u128)
            .ok_or(ErrorCode::InvalidOraclePrice)?
            .checked_div(1_000_000_000)
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
        let amount_out = amount_in;

        if amount_out < min_out {
            return err!(ErrorCode::SlippageExceeded);
        }

        Ok(())
    }

    fn process_twap_swap(
        ctx: &Context<SwapToC>,
        args: SwapArgs,
        total_min_out: u64,
        twap_slices: u8,
        _clock: &Clock,
    ) -> Result<()> {
        let slice_amount = args.amount_in / twap_slices as u64;
        if slice_amount == 0 {
            return err!(ErrorCode::TwapSliceTooSmall);
        }

        let slice_min_out = total_min_out / twap_slices as u64;

        for _ in 0..twap_slices {
            process_single_swap(&ctx, slice_amount, slice_min_out)?;
        }

        Ok(())
    }
}
