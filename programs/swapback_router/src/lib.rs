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

// Buyback Program ID
pub const BUYBACK_PROGRAM_ID: Pubkey = pubkey!("46UWFYdksvkGhTPy9cTSJGa3d5nqzpY766rtJeuxtMgU");

// cNFT Program ID for boost verification
pub const CNFT_PROGRAM_ID: Pubkey = pubkey!("CxBwdrrSZVUycbJAhkCmVsWbX4zttmM393VXugooxATH");

// Oracle constants
pub const MAX_STALENESS_SECS: i64 = 300; // 5 minutes max staleness

// Rebate configuration
pub const BASE_REBATE_USDC: u64 = 3_000_000; // 3 USDC base rebate (6 decimals)

// Security limits
pub const MAX_VENUES: usize = 10;
pub const MAX_FALLBACKS: usize = 5;

// Fee configuration (in basis points, 10000 = 100%)
pub const PLATFORM_FEE_BPS: u16 = 30; // 0.3% platform fee
pub const BUYBACK_ALLOCATION_BPS: u16 = 4000; // 40% of (fees + routing profit) goes to buyback

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

    /// CHECK: Optional UserNft account for boost verification
    #[account(
        seeds = [b"user_nft", user.key().as_ref()],
        bump,
        seeds::program = CNFT_PROGRAM_ID
    )]
    pub user_nft: Option<Account<'info, UserNft>>,

    /// CHECK: Buyback program
    #[account(address = BUYBACK_PROGRAM_ID)]
    pub buyback_program: Option<AccountInfo<'info>>,

    /// CHECK: Buyback USDC vault (validated in buyback program)
    #[account(mut)]
    pub buyback_usdc_vault: Option<Account<'info, token::TokenAccount>>,

    /// CHECK: Buyback state account (validated in buyback program)
    #[account(mut)]
    pub buyback_state: Option<AccountInfo<'info>>,

    /// CHECK: User's rebate USDC account (for receiving boosted rebates)
    #[account(mut)]
    pub user_rebate_account: Option<Account<'info, token::TokenAccount>>,

    pub token_program: Program<'info, token::Token>,
    pub system_program: Program<'info, System>,
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

#[event]
pub struct SwapCompleted {
    pub user: Pubkey,
    pub amount_in: u64,
    pub amount_out: u64,
    pub platform_fee: u64,
    pub routing_profit: u64,
    pub buyback_deposit: u64,
    pub user_boost: u16,        // Boost de l'utilisateur (basis points)
    pub rebate_amount: u64,     // Montant du rebate en USDC
}

#[event]
pub struct RebatePaid {
    pub user: Pubkey,
    pub base_rebate: u64,       // Rebate de base (3 USDC)
    pub boost: u16,             // Boost appliqué (basis points)
    pub total_rebate: u64,      // Rebate total après boost
    pub timestamp: i64,
}

#[event]
pub struct BuybackDeposit {
    pub amount: u64,
    pub source: String, // "platform_fee" or "routing_profit"
    pub timestamp: i64,
}

// Structure UserNft importée du programme cNFT pour vérification du boost
#[account]
#[derive(Default)]
pub struct UserNft {
    pub user: Pubkey,              // Utilisateur propriétaire
    pub level: LockLevel,          // Niveau de lock (Bronze à Diamond)
    pub amount_locked: u64,        // Montant de tokens lockés
    pub lock_duration: i64,        // Durée du lock en secondes
    pub boost: u16,                // Boost en basis points (0-10000)
    pub mint_time: i64,            // Timestamp du mint
    pub is_active: bool,           // Statut actif/inactif
}

// Enum LockLevel importé du programme cNFT
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum LockLevel {
    #[default]
    Bronze,   // 100+ BACK × 7+ jours
    Silver,   // 1k+ BACK × 30+ jours
    Gold,     // 10k+ BACK × 90+ jours
    Platinum, // 50k+ BACK × 180+ jours
    Diamond,  // 100k+ BACK × 365+ jours
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

        // Lire le boost depuis le compte UserNft (si disponible)
        let user_boost = if let Some(user_nft) = &ctx.accounts.user_nft {
            if user_nft.is_active {
                user_nft.boost
            } else {
                0 // NFT inactif, pas de boost
            }
        } else {
            0 // Pas de NFT, pas de boost
        };

        // Payer le rebate avec boost à l'utilisateur
        let rebate_paid = pay_rebate_to_user(ctx, user_boost)?;

        // Calculate platform fee (0.3% of amount_out)
        let platform_fee = calculate_fee(total_amount_out, PLATFORM_FEE_BPS)?;
        
        // Calculate routing profit (amount_out - min_out - platform_fee)
        let net_amount_out = total_amount_out
            .checked_sub(platform_fee)
            .ok_or(ErrorCode::InvalidOraclePrice)?;
        
        let routing_profit = if net_amount_out > min_out {
            net_amount_out
                .checked_sub(min_out)
                .ok_or(ErrorCode::InvalidOraclePrice)?
        } else {
            0
        };

        // Calculate buyback deposit (40% of platform_fee + 40% of routing_profit)
        let fee_for_buyback = calculate_fee(platform_fee, BUYBACK_ALLOCATION_BPS)?;
        let profit_for_buyback = calculate_fee(routing_profit, BUYBACK_ALLOCATION_BPS)?;
        let total_buyback_deposit = fee_for_buyback
            .checked_add(profit_for_buyback)
            .ok_or(ErrorCode::InvalidOraclePrice)?;

        // Deposit to buyback if accounts are provided and amount > 0
        if total_buyback_deposit > 0 
            && ctx.accounts.buyback_program.is_some()
            && ctx.accounts.buyback_usdc_vault.is_some()
            && ctx.accounts.buyback_state.is_some()
        {
            deposit_to_buyback(ctx, total_buyback_deposit)?;

            emit!(SwapCompleted {
                user: ctx.accounts.user.key(),
                amount_in: total_amount_in,
                amount_out: total_amount_out,
                platform_fee,
                routing_profit,
                buyback_deposit: total_buyback_deposit,
                user_boost,
                rebate_amount: rebate_paid,
            });
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

    /// Calculate fee based on amount and basis points
    pub fn calculate_fee(amount: u64, fee_bps: u16) -> Result<u64> {
        let fee = (amount as u128)
            .checked_mul(fee_bps as u128)
            .ok_or(ErrorCode::InvalidOraclePrice)?
            .checked_div(10_000)
            .ok_or(ErrorCode::InvalidOraclePrice)? as u64;
        Ok(fee)
    }

    /// Calculate boosted rebate based on user's cNFT boost
    /// Formula: rebate = base_rebate * (1 + boost/10000)
    /// Example: base 3 USDC, boost 2300 BP (23%) = 3 * 1.23 = 3.69 USDC
    pub fn calculate_boosted_rebate(base_rebate: u64, boost_bp: u16) -> Result<u64> {
        // Multiplier = 10000 (100%) + boost_bp
        // Example: 10000 + 2300 = 12300 (123%)
        let multiplier = 10_000u128
            .checked_add(boost_bp as u128)
            .ok_or(ErrorCode::InvalidOraclePrice)?;
        
        let boosted = (base_rebate as u128)
            .checked_mul(multiplier)
            .ok_or(ErrorCode::InvalidOraclePrice)?
            .checked_div(10_000)
            .ok_or(ErrorCode::InvalidOraclePrice)? as u64;
        
        Ok(boosted)
    }

    /// Pay rebate to user with boost applied
    fn pay_rebate_to_user(ctx: &Context<SwapToC>, boost: u16) -> Result<u64> {
        // Si pas de compte rebate, pas de paiement
        let _user_rebate_account = match &ctx.accounts.user_rebate_account {
            Some(acc) => acc,
            None => return Ok(0),
        };

        // Calculer le rebate avec boost
        let boosted_rebate = calculate_boosted_rebate(BASE_REBATE_USDC, boost)?;

        // TODO: Transférer les USDC depuis le vault vers le compte utilisateur
        // Pour l'instant, juste émettre l'événement

        emit!(RebatePaid {
            user: ctx.accounts.user.key(),
            base_rebate: BASE_REBATE_USDC,
            boost,
            total_rebate: boosted_rebate,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(boosted_rebate)
    }

    /// Deposit USDC to buyback program via CPI
    fn deposit_to_buyback(ctx: &Context<SwapToC>, amount: u64) -> Result<()> {
        // Get required accounts
        let buyback_program = ctx.accounts.buyback_program.as_ref()
            .ok_or(ErrorCode::InvalidOraclePrice)?;
        let buyback_vault = ctx.accounts.buyback_usdc_vault.as_ref()
            .ok_or(ErrorCode::InvalidOraclePrice)?;
        let buyback_state = ctx.accounts.buyback_state.as_ref()
            .ok_or(ErrorCode::InvalidOraclePrice)?;

        // Build CPI accounts for buyback deposit_usdc instruction
        let cpi_accounts = vec![
            buyback_state.to_account_info(),
            ctx.accounts.vault_token_account_b.to_account_info(), // source (router's USDC)
            buyback_vault.to_account_info(), // destination (buyback vault)
            ctx.accounts.state.to_account_info(), // depositor (router authority)
            ctx.accounts.token_program.to_account_info(),
        ];

        // Create instruction data: deposit_usdc discriminator + amount
        let mut instruction_data = vec![242, 35, 198, 137, 82, 225, 242, 182]; // deposit_usdc discriminator
        instruction_data.extend_from_slice(&amount.to_le_bytes());

        let instruction = solana_program::instruction::Instruction {
            program_id: *buyback_program.key,
            accounts: cpi_accounts.iter().enumerate().map(|(i, acc)| {
                solana_program::instruction::AccountMeta {
                    pubkey: *acc.key,
                    is_signer: i == 3, // router state is signer
                    is_writable: i != 4, // all except token_program
                }
            }).collect(),
            data: instruction_data,
        };

        // Create PDA signer seeds for router state
        let seeds = &[
            b"router_state".as_ref(),
            &[ctx.accounts.state.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        // Invoke CPI
        solana_program::program::invoke_signed(
            &instruction,
            &cpi_accounts,
            signer_seeds,
        )?;

        emit!(BuybackDeposit {
            amount,
            source: "swap_fees_and_profit".to_string(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Deposited {} USDC to buyback vault", amount);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_boosted_rebate_no_boost() {
        // Base: 3 USDC (3_000_000 avec 6 decimals)
        // Boost: 0 BP (0%)
        // Expected: 3 USDC
        let base = 3_000_000u64;
        let boost = 0u16;
        let result = swap_toc_processor::calculate_boosted_rebate(base, boost).unwrap();
        assert_eq!(result, 3_000_000, "No boost should return base amount");
    }

    #[test]
    fn test_calculate_boosted_rebate_small_boost() {
        // Base: 3 USDC
        // Boost: 350 BP (3.5%)
        // Expected: 3 × 1.035 = 3.105 USDC
        let base = 3_000_000u64;
        let boost = 350u16;
        let result = swap_toc_processor::calculate_boosted_rebate(base, boost).unwrap();
        assert_eq!(result, 3_105_000, "3.5% boost should give 3.105 USDC");
    }

    #[test]
    fn test_calculate_boosted_rebate_medium_boost() {
        // Base: 3 USDC
        // Boost: 2300 BP (23%)
        // Expected: 3 × 1.23 = 3.69 USDC
        let base = 3_000_000u64;
        let boost = 2300u16;
        let result = swap_toc_processor::calculate_boosted_rebate(base, boost).unwrap();
        assert_eq!(result, 3_690_000, "23% boost should give 3.69 USDC");
    }

    #[test]
    fn test_calculate_boosted_rebate_high_boost() {
        // Base: 3 USDC
        // Boost: 8600 BP (86%)
        // Expected: 3 × 1.86 = 5.58 USDC
        let base = 3_000_000u64;
        let boost = 8600u16;
        let result = swap_toc_processor::calculate_boosted_rebate(base, boost).unwrap();
        assert_eq!(result, 5_580_000, "86% boost should give 5.58 USDC");
    }

    #[test]
    fn test_calculate_boosted_rebate_maximum_boost() {
        // Base: 3 USDC
        // Boost: 10000 BP (100%)
        // Expected: 3 × 2 = 6 USDC
        let base = 3_000_000u64;
        let boost = 10_000u16;
        let result = swap_toc_processor::calculate_boosted_rebate(base, boost).unwrap();
        assert_eq!(result, 6_000_000, "100% boost should double the rebate to 6 USDC");
    }

    #[test]
    fn test_calculate_fee() {
        // Test platform fee calculation (0.3% = 30 BP)
        let amount = 1_000_000u64; // 1 USDC
        let fee_bps = 30u16;
        let result = swap_toc_processor::calculate_fee(amount, fee_bps).unwrap();
        assert_eq!(result, 3_000, "0.3% of 1 USDC should be 0.003 USDC");
    }

    #[test]
    fn test_buyback_allocation() {
        // Test buyback allocation (40% = 4000 BP)
        let platform_fee = 10_000u64; // 0.01 USDC in fees
        let result = swap_toc_processor::calculate_fee(platform_fee, BUYBACK_ALLOCATION_BPS).unwrap();
        assert_eq!(result, 4_000, "40% of 10k should be 4k");
    }
}
