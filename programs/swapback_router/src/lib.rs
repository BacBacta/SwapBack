use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

mod cpi_orca;
mod oracle;
pub mod state;
pub mod instructions;
pub mod error;

// Custom getrandom stub for Solana BPF target
#[cfg(target_os = "solana")]
mod getrandom_stub;

// Re-export for external use
pub use state::{DcaPlan, RouterState, UserRebate};
pub use error::SwapbackError;

// Program ID - Deployed on devnet (Nov 12, 2025)
declare_id!("BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz");

// DEX Program IDs (example - would need to be updated with actual deployed programs)
pub const RAYDIUM_AMM_PROGRAM_ID: Pubkey = pubkey!("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");
pub const ORCA_WHIRLPOOL_PROGRAM_ID: Pubkey =
    pubkey!("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");
pub const JUPITER_PROGRAM_ID: Pubkey = pubkey!("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");

// Buyback Program ID (mis à jour)
pub const BUYBACK_PROGRAM_ID: Pubkey = pubkey!("EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf");

// cNFT Program ID for boost verification (deployed Nov 12, 2025)
pub const CNFT_PROGRAM_ID: Pubkey = pubkey!("26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru");

// Oracle constants
pub const MAX_STALENESS_SECS: i64 = 300; // 5 minutes max staleness

// NPI (Routing Profit) allocation configuration (basis points, 10000 = 100%)
// Total must equal 100% to avoid over-allocation
pub const DEFAULT_REBATE_BPS: u16 = 6000;        // 60% du NPI → Rebates utilisateurs
pub const DEFAULT_BUYBACK_BPS: u16 = 2000;       // 20% du NPI → Buyback vault
pub const PROTOCOL_RESERVE_BPS: u16 = 2000;      // 20% du NPI → Protocol treasury
// Total: 60% + 20% + 20% = 100% ✅

// Platform fees allocation (basis points, 10000 = 100%)
pub const PLATFORM_FEE_BPS: u16 = 20;            // 0.2% platform fee (plus compétitif que Raydium 0.25% et Orca 0.30%)
pub const BUYBACK_FROM_FEES_BPS: u16 = 3000;     // 30% des platform fees → Buyback vault
// Remaining 70% of platform fees → Protocol treasury

// Security limits
pub const MAX_VENUES: usize = 10;
pub const MAX_FALLBACKS: usize = 5;

// DCA Account Structures (moved here for Anchor compatibility)
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

#[derive(Accounts)]
pub struct PauseDcaPlan<'info> {
    #[account(
        mut,
        seeds = [b"dca_plan", user.key().as_ref(), &dca_plan.plan_id],
        bump = dca_plan.bump,
        has_one = user
    )]
    pub dca_plan: Account<'info, DcaPlan>,
    
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResumeDcaPlan<'info> {
    #[account(
        mut,
        seeds = [b"dca_plan", user.key().as_ref(), &dca_plan.plan_id],
        bump = dca_plan.bump,
        has_one = user
    )]
    pub dca_plan: Account<'info, DcaPlan>,
    
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct CancelDcaPlan<'info> {
    #[account(
        mut,
        seeds = [b"dca_plan", user.key().as_ref(), &dca_plan.plan_id],
        bump = dca_plan.bump,
        has_one = user,
        close = user
    )]
    pub dca_plan: Account<'info, DcaPlan>,
    
    #[account(mut)]
    pub user: Signer<'info>,
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

#[program]
pub mod swapback_router {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.authority = ctx.accounts.authority.key();
        state.rebate_percentage = DEFAULT_REBATE_BPS;      // 60% du NPI par défaut
        state.buyback_percentage = DEFAULT_BUYBACK_BPS;    // 20% du NPI par défaut
        state.protocol_percentage = PROTOCOL_RESERVE_BPS;  // 20% du NPI par défaut
        state.total_volume = 0;
        state.total_npi = 0;
        state.total_rebates_paid = 0;
        state.total_buyback_from_npi = 0;
        state.total_protocol_revenue = 0;
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

    // ============================
    // 🔄 DCA INSTRUCTIONS
    // ============================
    
    /// Create a new DCA plan
    pub fn create_dca_plan(
        ctx: Context<CreateDcaPlan>,
        plan_id: [u8; 32],
        args: CreateDcaPlanArgs,
    ) -> Result<()> {
        // Inline handler for CreateDcaPlan
        let dca_plan = &mut ctx.accounts.dca_plan;
        let clock = Clock::get()?;
        
        // Validation
        require!(args.amount_per_swap > 0, error::SwapbackError::InvalidAmount);
        require!(args.total_swaps > 0, error::SwapbackError::InvalidSwapCount);
        require!(args.total_swaps <= 10000, error::SwapbackError::TooManySwaps);
        require!(args.interval_seconds >= 3600, error::SwapbackError::IntervalTooShort);
        require!(args.interval_seconds <= 31536000, error::SwapbackError::IntervalTooLong);
        
        // If expiry is set, must be in the future
        if args.expires_at > 0 {
            require!(
                args.expires_at > clock.unix_timestamp,
                error::SwapbackError::InvalidExpiry
            );
        }
        
        // Initialize DCA plan
        dca_plan.plan_id = plan_id;
        dca_plan.user = ctx.accounts.user.key();
        dca_plan.token_in = args.token_in;
        dca_plan.token_out = args.token_out;
        dca_plan.amount_per_swap = args.amount_per_swap;
        dca_plan.total_swaps = args.total_swaps;
        dca_plan.executed_swaps = 0;
        dca_plan.interval_seconds = args.interval_seconds;
        dca_plan.next_execution = clock.unix_timestamp + args.interval_seconds;
        dca_plan.min_out_per_swap = args.min_out_per_swap;
        dca_plan.created_at = clock.unix_timestamp;
        dca_plan.expires_at = args.expires_at;
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
    
    /// Execute a single swap in a DCA plan
    pub fn execute_dca_swap(
        ctx: Context<ExecuteDcaSwap>,
    ) -> Result<()> {
        // Inline handler for ExecuteDcaSwap
        let dca_plan = &mut ctx.accounts.dca_plan;
        let clock = Clock::get()?;
        
        // Validation
        require!(dca_plan.is_active, error::SwapbackError::PlanNotActive);
        require!(!dca_plan.is_completed(), error::SwapbackError::PlanCompleted);
        require!(
            !dca_plan.is_expired(clock.unix_timestamp),
            error::SwapbackError::PlanExpired
        );
        require!(
            dca_plan.is_ready_for_execution(clock.unix_timestamp),
            error::SwapbackError::NotReadyForExecution
        );
        
        // Verify user has sufficient balance
        require!(
            ctx.accounts.user_token_in.amount >= dca_plan.amount_per_swap,
            error::SwapbackError::InsufficientBalance
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
            error::SwapbackError::SlippageExceeded
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
    
    /// Pause a DCA plan
    pub fn pause_dca_plan(
        ctx: Context<PauseDcaPlan>,
    ) -> Result<()> {
        // Inline handler for PauseDcaPlan
        let dca_plan = &mut ctx.accounts.dca_plan;
        
        require!(dca_plan.is_active, error::SwapbackError::AlreadyPaused);
        require!(!dca_plan.is_completed(), error::SwapbackError::PlanCompleted);
        
        dca_plan.is_active = false;
        
        msg!("⏸️  DCA Plan paused");
        msg!("Plan ID: {:?}", dca_plan.plan_id);
        
        Ok(())
    }
    
    /// Resume a paused DCA plan
    pub fn resume_dca_plan(
        ctx: Context<ResumeDcaPlan>,
    ) -> Result<()> {
        // Inline handler for ResumeDcaPlan
        let dca_plan = &mut ctx.accounts.dca_plan;
        let clock = Clock::get()?;
        
        require!(!dca_plan.is_active, error::SwapbackError::AlreadyActive);
        require!(!dca_plan.is_completed(), error::SwapbackError::PlanCompleted);
        require!(!dca_plan.is_expired(clock.unix_timestamp), error::SwapbackError::PlanExpired);
        
        dca_plan.is_active = true;
        
        // Update next execution to avoid immediate execution after resume
        if dca_plan.next_execution < clock.unix_timestamp {
            dca_plan.next_execution = clock.unix_timestamp + dca_plan.interval_seconds;
        }
        
        msg!("▶️  DCA Plan resumed");
        msg!("Plan ID: {:?}", dca_plan.plan_id);
        msg!("Next execution: {}", dca_plan.next_execution);
        
        Ok(())
    }
    
    /// Cancel and close a DCA plan
    pub fn cancel_dca_plan(
        ctx: Context<CancelDcaPlan>,
    ) -> Result<()> {
        // Inline handler for CancelDcaPlan
        let dca_plan = &ctx.accounts.dca_plan;
        
        msg!("❌ DCA Plan cancelled and closed");
        msg!("Plan ID: {:?}", dca_plan.plan_id);
        msg!("Swaps executed: {}/{}", dca_plan.executed_swaps, dca_plan.total_swaps);
        msg!("Total invested: {}", dca_plan.total_invested);
        msg!("Total received: {}", dca_plan.total_received);
        
        // Account will be closed automatically and rent refunded to user
        
        Ok(())
    }

    /// Claim accumulated rebates
    /// Transfers unclaimed USDC rebates from vault to user
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        let user_rebate = &mut ctx.accounts.user_rebate;
        
        // Verify there are rewards to claim
        require!(
            user_rebate.unclaimed_rebate > 0,
            ErrorCode::NoRewardsToClaim
        );

        // Verify vault has sufficient balance
        require!(
            ctx.accounts.rebate_vault.amount >= user_rebate.unclaimed_rebate,
            ErrorCode::InsufficientVaultBalance
        );

        let claimed_amount = user_rebate.unclaimed_rebate;

        // Transfer USDC from vault to user using PDA signer
        let seeds = &[b"rebate_vault".as_ref(), &[ctx.accounts.state.bump]];
        let signer = &[&seeds[..]];

        let cpi_accounts = token::Transfer {
            from: ctx.accounts.rebate_vault.to_account_info(),
            to: ctx.accounts.user_usdc_account.to_account_info(),
            authority: ctx.accounts.state.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

        token::transfer(cpi_ctx, claimed_amount)?;

        // Update user rebate account
        user_rebate.unclaimed_rebate = 0;
        user_rebate.total_claimed = user_rebate
            .total_claimed
            .checked_add(claimed_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        user_rebate.last_claim_timestamp = Clock::get()?.unix_timestamp;

        // Emit event
        emit!(RewardsClaimed {
            user: ctx.accounts.user.key(),
            amount: claimed_amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("✅ Rewards claimed: {} USDC", claimed_amount / 1_000_000);

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 2 + 2 + 2 + 8 + 8 + 8 + 8 + 8 + 1, // 87 bytes total
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
    pub user_token_account_a: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account_b: Account<'info, TokenAccount>,

    #[account(mut)]
    pub vault_token_account_a: Account<'info, TokenAccount>,

    #[account(mut)]
    pub vault_token_account_b: Account<'info, TokenAccount>,

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
    pub buyback_usdc_vault: Option<Account<'info, TokenAccount>>,

    /// CHECK: Buyback state account (validated in buyback program)
    #[account(mut)]
    pub buyback_state: Option<AccountInfo<'info>>,

    /// CHECK: User's rebate USDC account (for receiving boosted rebates)
    #[account(mut)]
    pub user_rebate_account: Option<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Claim accumulated rebates context
#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut)]
    pub state: Account<'info, RouterState>,

    #[account(
        mut,
        seeds = [b"user_rebate", user.key().as_ref()],
        bump
    )]
    pub user_rebate: Account<'info, UserRebate>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// User's USDC token account to receive rebates
    #[account(mut)]
    pub user_usdc_account: Account<'info, TokenAccount>,

    /// Rebate vault PDA holding USDC for rebates
    #[account(
        mut,
        seeds = [b"rebate_vault"],
        bump
    )]
    pub rebate_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
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

// NOTE: RouterState and UserRebate have been moved to state/router_state.rs
// Keeping these comments here for reference during migration
/*
#[account]
pub struct RouterState {
    pub authority: Pubkey,
    pub rebate_percentage: u16,
    pub buyback_percentage: u16,
    pub protocol_percentage: u16,
    pub total_volume: u64,
    pub total_npi: u64,
    pub total_rebates_paid: u64,
    pub total_buyback_from_npi: u64,
    pub total_protocol_revenue: u64,
    pub bump: u8,
}

#[account]
pub struct UserRebate {
    pub user: Pubkey,
    pub unclaimed_rebate: u64,
    pub total_claimed: u64,
    pub total_swaps: u64,
    pub last_swap_timestamp: i64,
    pub last_claim_timestamp: i64,
    pub bump: u8,
}
*/

/* Moved to state/router_state.rs
impl UserRebate {
    pub const LEN: usize = 8 + // discriminator
        32 + // user
        8 +  // unclaimed_rebate
        8 +  // total_claimed
        8 +  // total_swaps
        8 +  // last_swap_timestamp
        8 +  // last_claim_timestamp
        1;   // bump
}
*/

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
    pub npi_amount: u64,        // NPI (routing profit) réalisé
    pub base_rebate: u64,       // Rebate de base (75% du NPI)
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

#[event]
pub struct RewardsClaimed {
    pub user: Pubkey,
    pub amount: u64,
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
    #[msg("Invalid amount - must be greater than 0")]
    InvalidAmount,
    #[msg("Slippage tolerance too high - max 10%")]
    SlippageTooHigh,
    #[msg("No rewards to claim")]
    NoRewardsToClaim,
    #[msg("Insufficient vault balance")]
    InsufficientVaultBalance,
    #[msg("Math overflow")]
    MathOverflow,
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

    pub fn process_swap_toc(mut ctx: Context<SwapToC>, args: SwapArgs) -> Result<()> {
        // ✅ SECURITY: Validate input parameters
        require!(args.amount_in > 0, ErrorCode::InvalidAmount);
        require!(args.min_out > 0, ErrorCode::InvalidAmount);
        
        // ✅ SECURITY: Validate slippage is reasonable (max 10%)
        if let Some(slippage) = args.slippage_tolerance {
            require!(slippage <= 1000, ErrorCode::SlippageTooHigh); // 10% max
        }
        
        let clock = Clock::get()?;

        if ctx.accounts.oracle.key() != args.oracle_account {
            return err!(ErrorCode::InvalidOraclePrice);
        }

        if args.use_dynamic_plan {
            return process_dynamic_plan_swap(&mut ctx, args, &clock);
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
        ctx: &mut Context<SwapToC>,
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
        ctx: &mut Context<SwapToC>,
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

        // Calculate platform fee (0.2% of amount_out - plus bas que Raydium 0.25% et Orca 0.30%)
        let platform_fee = calculate_fee(total_amount_out, PLATFORM_FEE_BPS)?;
        
        // Calculate routing profit (NPI = amount_out - min_out - platform_fee)
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

        // NOUVELLE LOGIQUE D'ALLOCATION AVEC BOOST:
        // 1. Calculer rebate base (60% du NPI)
        // 2. Calculer boost supplémentaire
        // 3. Le boost est prélevé sur la part buyback uniquement
        // 4. Le protocol garde sa part fixe (20% du NPI)
        
        let base_rebate = calculate_fee(routing_profit, DEFAULT_REBATE_BPS)?; // 60% du NPI
        
        // Calculer le boost supplémentaire (basé sur le rebate de base)
        let boost_amount = if user_boost > 0 {
            calculate_fee(base_rebate, user_boost)?
        } else {
            0
        };
        
        // Total rebate = base + boost
        let total_rebate = base_rebate
            .checked_add(boost_amount)
            .ok_or(ErrorCode::InvalidOraclePrice)?;
        
        // Payer le rebate total à l'utilisateur
        pay_rebate_to_user_with_amount(ctx, routing_profit, user_boost, total_rebate)?;

        // Calculate buyback allocation:
        // - 30% of platform fees (inchangé)
        // - 20% of NPI MOINS le boost payé à l'utilisateur
        let fee_for_buyback = calculate_fee(platform_fee, BUYBACK_FROM_FEES_BPS)?;
        let profit_for_buyback_base = calculate_fee(routing_profit, DEFAULT_BUYBACK_BPS)?; // 20% du NPI
        
        // Le buyback absorbe le coût du boost
        let profit_for_buyback = if boost_amount > 0 {
            profit_for_buyback_base.saturating_sub(boost_amount)
        } else {
            profit_for_buyback_base
        };
        
        let total_buyback_deposit = fee_for_buyback
            .checked_add(profit_for_buyback)
            .ok_or(ErrorCode::InvalidOraclePrice)?;

        // Calculate protocol revenue:
        // - 70% of platform fees (remaining after buyback allocation)
        // - 20% of routing profit (NPI reserve) - INCHANGÉ, le protocol ne paie pas le boost
        let protocol_from_fees = calculate_fee(platform_fee, 7000)?; // 70% des fees
        let protocol_from_npi = calculate_fee(routing_profit, PROTOCOL_RESERVE_BPS)?; // 20% du NPI
        let total_protocol_revenue = protocol_from_fees
            .checked_add(protocol_from_npi)
            .ok_or(ErrorCode::InvalidOraclePrice)?;

        // Update state statistics
        let state = &mut ctx.accounts.state;
        state.total_buyback_from_npi = state.total_buyback_from_npi
            .checked_add(profit_for_buyback)
            .ok_or(ErrorCode::InvalidOraclePrice)?;
        state.total_protocol_revenue = state.total_protocol_revenue
            .checked_add(total_protocol_revenue)
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
                rebate_amount: total_rebate,
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

    /// Calculate boosted rebate based on NPI and user's cNFT boost
    /// Formula: rebate = (NPI * rebate_percentage / 10000) * (1 + boost/10000)
    /// Example: NPI 10 USDC, 75% rebate, boost 2300 BP (23%)
    ///          base_rebate = 10 * 0.75 = 7.5 USDC
    ///          boosted = 7.5 * 1.23 = 9.225 USDC
    pub fn calculate_boosted_rebate(npi_amount: u64, rebate_bps: u16, boost_bp: u16) -> Result<u64> {
        // Calculer le rebate de base (pourcentage du NPI)
        let base_rebate = (npi_amount as u128)
            .checked_mul(rebate_bps as u128)
            .ok_or(ErrorCode::InvalidOraclePrice)?
            .checked_div(10_000)
            .ok_or(ErrorCode::InvalidOraclePrice)? as u64;

        // Appliquer le boost
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

    /// Pay rebate to user with boost applied (based on NPI)
    /// Legacy function - kept for compatibility
    fn pay_rebate_to_user(ctx: &mut Context<SwapToC>, npi_amount: u64, boost: u16) -> Result<u64> {
        // Si pas de NPI, pas de rebate
        if npi_amount == 0 {
            return Ok(0);
        }

        // Si pas de compte rebate, pas de paiement
        let _user_rebate_account = match &ctx.accounts.user_rebate_account {
            Some(acc) => acc,
            None => return Ok(0),
        };

        // Obtenir le pourcentage de rebate depuis le state
        let rebate_percentage = ctx.accounts.state.rebate_percentage;

        // Calculer le rebate de base (% du NPI)
        let base_rebate = (npi_amount as u128)
            .checked_mul(rebate_percentage as u128)
            .ok_or(ErrorCode::InvalidOraclePrice)?
            .checked_div(10_000)
            .ok_or(ErrorCode::InvalidOraclePrice)? as u64;

        // Calculer le rebate avec boost
        let boosted_rebate = calculate_boosted_rebate(npi_amount, rebate_percentage, boost)?;

        // Mettre à jour les statistiques du state
        let state = &mut ctx.accounts.state;
        state.total_npi = state.total_npi
            .checked_add(npi_amount)
            .ok_or(ErrorCode::InvalidOraclePrice)?;
        state.total_rebates_paid = state.total_rebates_paid
            .checked_add(boosted_rebate)
            .ok_or(ErrorCode::InvalidOraclePrice)?;

        // TODO: Transférer les USDC depuis le vault vers le compte utilisateur
        // Pour l'instant, juste émettre l'événement

        emit!(RebatePaid {
            user: ctx.accounts.user.key(),
            npi_amount,
            base_rebate,
            boost,
            total_rebate: boosted_rebate,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(boosted_rebate)
    }

    /// Pay rebate to user with pre-calculated amount
    /// New function with cleaner separation of concerns
    fn pay_rebate_to_user_with_amount(
        ctx: &mut Context<SwapToC>, 
        npi_amount: u64, 
        boost: u16,
        total_rebate: u64
    ) -> Result<()> {
        // Si pas de NPI, pas de rebate
        if npi_amount == 0 || total_rebate == 0 {
            return Ok(());
        }

        // Si pas de compte rebate, pas de paiement
        let _user_rebate_account = match &ctx.accounts.user_rebate_account {
            Some(acc) => acc,
            None => return Ok(()),
        };

        // Calculer le base rebate (60% du NPI)
        let base_rebate = calculate_fee(npi_amount, ctx.accounts.state.rebate_percentage)?;

        // Mettre à jour les statistiques du state
        let state = &mut ctx.accounts.state;
        state.total_npi = state.total_npi
            .checked_add(npi_amount)
            .ok_or(ErrorCode::InvalidOraclePrice)?;
        state.total_rebates_paid = state.total_rebates_paid
            .checked_add(total_rebate)
            .ok_or(ErrorCode::InvalidOraclePrice)?;

        // TODO: Transférer les USDC depuis le vault vers le compte utilisateur
        // Pour l'instant, juste émettre l'événement

        emit!(RebatePaid {
            user: ctx.accounts.user.key(),
            npi_amount,
            base_rebate,
            boost,
            total_rebate,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
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
        // NPI: 10 USDC (10_000_000 avec 6 decimals)
        // Rebate: 6000 BP (60%) - nouvelle allocation
        // Boost: 0 BP (0%)
        // Expected: 10 × 0.60 × 1.0 = 6 USDC
        let npi = 10_000_000u64;
        let rebate_bps = 6000u16;
        let boost = 0u16;
        let result = swap_toc_processor::calculate_boosted_rebate(npi, rebate_bps, boost).unwrap();
        assert_eq!(result, 6_000_000, "60% of 10 USDC NPI with no boost = 6 USDC");
    }

    #[test]
    fn test_calculate_boosted_rebate_small_boost() {
        // NPI: 10 USDC
        // Rebate: 6000 BP (60%)
        // Boost: 100 BP (1%) - nouveau boost réaliste
        // Expected: 10 × 0.60 × 1.01 = 6.06 USDC
        let npi = 10_000_000u64;
        let rebate_bps = 6000u16;
        let boost = 100u16;
        let result = swap_toc_processor::calculate_boosted_rebate(npi, rebate_bps, boost).unwrap();
        assert_eq!(result, 6_060_000, "60% of 10 USDC with 1% boost = 6.06 USDC");
    }

    #[test]
    fn test_calculate_boosted_rebate_medium_boost() {
        // NPI: 10 USDC
        // Rebate: 6000 BP (60%)
        // Boost: 600 BP (6%) - Gold tier boost
        // Expected: 10 × 0.60 × 1.06 = 6.36 USDC
        let npi = 10_000_000u64;
        let rebate_bps = 6000u16;
        let boost = 600u16;
        let result = swap_toc_processor::calculate_boosted_rebate(npi, rebate_bps, boost).unwrap();
        assert_eq!(result, 6_360_000, "60% of 10 USDC with 6% boost = 6.36 USDC");
    }

    #[test]
    fn test_calculate_boosted_rebate_high_boost() {
        // NPI: 10 USDC
        // Rebate: 6000 BP (60%)
        // Boost: 1000 BP (10%) - Platinum tier boost
        // Expected: 10 × 0.60 × 1.10 = 6.6 USDC
        let npi = 10_000_000u64;
        let rebate_bps = 6000u16;
        let boost = 1000u16;
        let result = swap_toc_processor::calculate_boosted_rebate(npi, rebate_bps, boost).unwrap();
        assert_eq!(result, 6_600_000, "60% of 10 USDC with 10% boost = 6.6 USDC");
    }

    #[test]
    fn test_calculate_boosted_rebate_maximum_boost() {
        // NPI: 10 USDC
        // Rebate: 6000 BP (60%)
        // Boost: 1500 BP (15%) - Diamond tier maximum boost
        // Expected: 10 × 0.60 × 1.15 = 6.9 USDC
        let npi = 10_000_000u64;
        let rebate_bps = 6000u16;
        let boost = 1500u16;
        let result = swap_toc_processor::calculate_boosted_rebate(npi, rebate_bps, boost).unwrap();
        assert_eq!(result, 6_900_000, "60% of 10 USDC with 15% boost = 6.9 USDC");
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
    fn test_complete_revenue_allocation_with_boost() {
        // NOUVEAU TEST: Valider que le boost est prélevé sur le buyback uniquement
        // Scénario: 20 USDC fees + 50 USDC NPI + boost 10% (Diamond tier)
        
        let platform_fee = 20_000_000u64; // 20 USDC
        let npi = 50_000_000u64;          // 50 USDC
        let boost_bp = 1000u16;           // 10% boost (Platinum tier)
        
        // CALCULS:
        
        // 1. Rebate base (60% du NPI)
        let base_rebate = swap_toc_processor::calculate_fee(npi, DEFAULT_REBATE_BPS).unwrap();
        assert_eq!(base_rebate, 30_000_000, "60% of 50 USDC NPI = 30 USDC");
        
        // 2. Boost supplémentaire (10% du rebate base)
        let boost_amount = swap_toc_processor::calculate_fee(base_rebate, boost_bp).unwrap();
        assert_eq!(boost_amount, 3_000_000, "10% boost on 30 USDC = 3 USDC");
        
        // 3. Total rebate utilisateur
        let total_rebate = base_rebate + boost_amount;
        assert_eq!(total_rebate, 33_000_000, "30 + 3 = 33 USDC pour l'utilisateur");
        
        // 4. Buyback FROM FEES (30% des fees - inchangé)
        let fee_to_buyback = swap_toc_processor::calculate_fee(platform_fee, BUYBACK_FROM_FEES_BPS).unwrap();
        assert_eq!(fee_to_buyback, 6_000_000, "30% of 20 USDC fees = 6 USDC");
        
        // 5. Buyback FROM NPI (20% du NPI MOINS le boost)
        let npi_to_buyback_base = swap_toc_processor::calculate_fee(npi, DEFAULT_BUYBACK_BPS).unwrap();
        assert_eq!(npi_to_buyback_base, 10_000_000, "20% of 50 USDC NPI = 10 USDC");
        
        let npi_to_buyback_after_boost = npi_to_buyback_base.saturating_sub(boost_amount);
        assert_eq!(npi_to_buyback_after_boost, 7_000_000, "10 - 3 = 7 USDC (le buyback paie le boost)");
        
        // 6. Total buyback
        let total_buyback = fee_to_buyback + npi_to_buyback_after_boost;
        assert_eq!(total_buyback, 13_000_000, "6 + 7 = 13 USDC total buyback");
        
        // 7. Protocol revenue (INCHANGÉ - ne paie pas le boost)
        let protocol_from_fees = swap_toc_processor::calculate_fee(platform_fee, 7000).unwrap();
        assert_eq!(protocol_from_fees, 14_000_000, "70% of 20 USDC fees = 14 USDC");
        
        let protocol_from_npi = swap_toc_processor::calculate_fee(npi, PROTOCOL_RESERVE_BPS).unwrap();
        assert_eq!(protocol_from_npi, 10_000_000, "20% of 50 USDC NPI = 10 USDC");
        
        let total_protocol = protocol_from_fees + protocol_from_npi;
        assert_eq!(total_protocol, 24_000_000, "14 + 10 = 24 USDC protocol");
        
        // 8. VÉRIFICATION FINALE: Total = 100% des revenus
        let grand_total = total_rebate + total_buyback + total_protocol;
        let expected_total = platform_fee + npi;
        assert_eq!(grand_total, expected_total, "33 + 13 + 24 = 70 USDC (100% alloué)");
        
        // 9. Vérifier que le boost a bien été payé uniquement par le buyback
        let buyback_reduction = npi_to_buyback_base - npi_to_buyback_after_boost;
        assert_eq!(buyback_reduction, boost_amount, "Le buyback a absorbé exactement le coût du boost");
    }

    #[test]
    fn test_complete_revenue_allocation() {
        // Test SANS boost (pour référence)
        // Scénario: 20 USDC de platform fees + 50 USDC de NPI
        
        let platform_fee = 20_000_000u64; // 20 USDC
        let npi = 50_000_000u64;          // 50 USDC
        
        // PLATFORM FEES (20 USDC):
        // - 30% buyback = 6 USDC
        let fee_to_buyback = swap_toc_processor::calculate_fee(platform_fee, BUYBACK_FROM_FEES_BPS).unwrap();
        assert_eq!(fee_to_buyback, 6_000_000, "30% of 20 USDC fees = 6 USDC");
        
        // - 70% protocol = 14 USDC
        let fee_to_protocol = swap_toc_processor::calculate_fee(platform_fee, 7000).unwrap();
        assert_eq!(fee_to_protocol, 14_000_000, "70% of 20 USDC fees = 14 USDC");
        
        // NPI (50 USDC):
        // - 60% rebates = 30 USDC
        let npi_to_rebates = swap_toc_processor::calculate_fee(npi, DEFAULT_REBATE_BPS).unwrap();
        assert_eq!(npi_to_rebates, 30_000_000, "60% of 50 USDC NPI = 30 USDC");
        
        // - 20% buyback = 10 USDC
        let npi_to_buyback = swap_toc_processor::calculate_fee(npi, DEFAULT_BUYBACK_BPS).unwrap();
        assert_eq!(npi_to_buyback, 10_000_000, "20% of 50 USDC NPI = 10 USDC");
        
        // - 20% protocol = 10 USDC
        let npi_to_protocol = swap_toc_processor::calculate_fee(npi, PROTOCOL_RESERVE_BPS).unwrap();
        assert_eq!(npi_to_protocol, 10_000_000, "20% of 50 USDC NPI = 10 USDC");
        
        // TOTAUX:
        let total_buyback = fee_to_buyback + npi_to_buyback;
        let total_protocol = fee_to_protocol + npi_to_protocol;
        let total_rebates = npi_to_rebates;
        
        assert_eq!(total_buyback, 16_000_000, "Total buyback = 16 USDC (6 + 10)");
        assert_eq!(total_protocol, 24_000_000, "Total protocol = 24 USDC (14 + 10)");
        assert_eq!(total_rebates, 30_000_000, "Total rebates = 30 USDC");
        
        // Vérifier que tout est bien alloué (70 USDC total)
        let grand_total = total_buyback + total_protocol + total_rebates;
        let expected_total = platform_fee + npi;
        assert_eq!(grand_total, expected_total, "100% of revenue allocated (70 USDC)");
    }
}
