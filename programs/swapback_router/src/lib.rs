use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

mod cpi_jupiter;
mod cpi_orca;
mod cpi_raydium;
pub mod error;
pub mod instructions;
mod oracle;
pub mod oracle_cache;
pub mod slippage;
pub mod state;
pub mod venue_scoring;

// Custom getrandom stub for Solana BPF target
#[cfg(target_os = "solana")]
mod getrandom_stub;

// Re-export for external use
pub use error::SwapbackError;
pub use state::{DcaPlan, RouterConfig, RouterState, UserRebate};

// Program ID - Deployed on devnet (Nov 12, 2025)
declare_id!("9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh");

// DEX Program IDs (example - would need to be updated with actual deployed programs)
pub const RAYDIUM_AMM_PROGRAM_ID: Pubkey = pubkey!("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");
pub const ORCA_WHIRLPOOL_PROGRAM_ID: Pubkey =
    pubkey!("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");
pub const JUPITER_PROGRAM_ID: Pubkey = pubkey!("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");

// Buyback Program ID (mis à jour)
pub const BUYBACK_PROGRAM_ID: Pubkey = pubkey!("EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf");

// cNFT Program ID with unlock_tokens (verified Nov 14, 2025)
pub const CNFT_PROGRAM_ID: Pubkey = pubkey!("26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru");

// Oracle constants
pub const MAX_STALENESS_SECS: i64 = 300; // 5 minutes max staleness
pub const MAX_ORACLE_DIVERGENCE_BPS: u64 = 200; // 2% max divergence between feeds

// NPI (Routing Profit) allocation configuration (basis points, 10000 = 100%)
// Total must equal 100% to avoid over-allocation
pub const DEFAULT_REBATE_BPS: u16 = 7000; // 70% du NPI → Rebates utilisateurs
pub const TREASURY_FROM_NPI_BPS: u16 = 1500; // 15% du NPI → Protocol treasury
pub const BOOST_VAULT_BPS: u16 = 1500; // 15% du NPI → Boost vault (lock rewards)
                                       // Total: 70% + 15% + 15% = 100% ✅

// Platform fees allocation (basis points, 10000 = 100%)
pub const PLATFORM_FEE_BPS: u16 = 20; // 0.2% platform fee
pub const PLATFORM_FEE_TREASURY_BPS: u16 = 8500; // 85% des platform fees → Treasury
pub const PLATFORM_FEE_BUYBURN_BPS: u16 = 1500; // 15% des platform fees → Buy & Burn BACK

// Security limits
pub const MAX_VENUES: usize = 10;
pub const MAX_FALLBACKS: usize = 5;
pub const MAX_SINGLE_SWAP_LAMPORTS: u64 = 5_000_000_000_000; // ~5k SOL equivalent

// DCA Account Structures - must be defined here for #[program] macro
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
    pub state: Box<Account<'info, RouterState>>,

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

#[derive(Accounts)]
pub struct InitializeOracleCache<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = oracle_cache::OracleCache::LEN,
        seeds = [b"oracle_cache", oracle.key().as_ref()],
        bump
    )]
    pub oracle_cache: Account<'info, oracle_cache::OracleCache>,

    /// CHECK: The oracle account to cache (e.g. Pyth feed)
    pub oracle: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeVenueScore<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(mut)]
    pub state: Account<'info, RouterState>,

    #[account(
        init,
        payer = authority,
        space = venue_scoring::VenueScore::LEN,
        seeds = [b"venue_score", state.key().as_ref()],
        bump
    )]
    pub venue_score: Account<'info, venue_scoring::VenueScore>,

    pub system_program: Program<'info, System>,
}

#[program]
pub mod swapback_router {
    use super::*;
    // use instructions::*; // Removed to avoid ambiguity

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.authority = ctx.accounts.authority.key();
        state.rebate_percentage = DEFAULT_REBATE_BPS;
        state.treasury_percentage = TREASURY_FROM_NPI_BPS;
        state.boost_vault_percentage = BOOST_VAULT_BPS;
        state.treasury_from_fees_bps = PLATFORM_FEE_TREASURY_BPS;
        state.buyburn_from_fees_bps = PLATFORM_FEE_BUYBURN_BPS;
        state.dynamic_slippage_enabled = false;
        state.treasury_wallet = Pubkey::default();
        state.boost_vault_wallet = Pubkey::default();
        state.buyback_wallet = Pubkey::default();
        state.npi_vault_wallet = Pubkey::default();
        state.total_volume = 0;
        state.total_npi = 0;
        state.total_rebates_paid = 0;
        state.total_treasury_from_npi = 0;
        state.total_boost_vault = 0;
        state.total_treasury_from_fees = 0;
        state.total_buyburn = 0;
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

    pub fn initialize_config(ctx: Context<InitializeConfig>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.pending_authority = None;
        config.rebate_bps = DEFAULT_REBATE_BPS;
        config.treasury_bps = TREASURY_FROM_NPI_BPS;
        config.boost_vault_bps = BOOST_VAULT_BPS;
        config.treasury_from_fees_bps = PLATFORM_FEE_TREASURY_BPS;
        config.buyburn_from_fees_bps = PLATFORM_FEE_BUYBURN_BPS;
        config.dynamic_slippage_enabled = false;
        config.npi_benchmarking_enabled = false;
        config.bump = ctx.bumps.config;
        config.validate_percentages()?;

        // Mirror configuration into RouterState for quick access
        let state = &mut ctx.accounts.state;
        state.rebate_percentage = config.rebate_bps;
        state.treasury_percentage = config.treasury_bps;
        state.boost_vault_percentage = config.boost_vault_bps;
        state.treasury_from_fees_bps = config.treasury_from_fees_bps;
        state.buyburn_from_fees_bps = config.buyburn_from_fees_bps;
        state.dynamic_slippage_enabled = config.dynamic_slippage_enabled;
        Ok(())
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        rebate_bps: Option<u16>,
        treasury_bps: Option<u16>,
        boost_vault_bps: Option<u16>,
        treasury_from_fees_bps: Option<u16>,
        buyburn_from_fees_bps: Option<u16>,
        dynamic_slippage_enabled: Option<bool>,
        npi_benchmarking_enabled: Option<bool>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;

        if let Some(value) = rebate_bps {
            config.rebate_bps = value;
        }
        if let Some(value) = treasury_bps {
            config.treasury_bps = value;
        }
        if let Some(value) = boost_vault_bps {
            config.boost_vault_bps = value;
        }
        if let Some(value) = treasury_from_fees_bps {
            config.treasury_from_fees_bps = value;
        }
        if let Some(value) = buyburn_from_fees_bps {
            config.buyburn_from_fees_bps = value;
        }
        if let Some(value) = dynamic_slippage_enabled {
            config.dynamic_slippage_enabled = value;
        }
        if let Some(value) = npi_benchmarking_enabled {
            config.npi_benchmarking_enabled = value;
        }

        config.validate_percentages()?;

        // Mirror configuration into RouterState for quick access
        let state = &mut ctx.accounts.state;
        state.rebate_percentage = config.rebate_bps;
        state.treasury_percentage = config.treasury_bps;
        state.boost_vault_percentage = config.boost_vault_bps;
        state.treasury_from_fees_bps = config.treasury_from_fees_bps;
        state.buyburn_from_fees_bps = config.buyburn_from_fees_bps;
        state.dynamic_slippage_enabled = config.dynamic_slippage_enabled;

        emit!(ConfigUpdated {
            authority: ctx.accounts.authority.key(),
            rebate_bps: config.rebate_bps,
            treasury_bps: config.treasury_bps,
            boost_vault_bps: config.boost_vault_bps,
            treasury_from_fees_bps: config.treasury_from_fees_bps,
            buyburn_from_fees_bps: config.buyburn_from_fees_bps,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn initialize_rebate_vault(ctx: Context<InitializeRebateVault>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.state.authority,
            ctx.accounts.authority.key(),
            ErrorCode::Unauthorized
        );

        msg!(
            "✅ Rebate vault initialized at {}",
            ctx.accounts.rebate_vault.key()
        );
        Ok(())
    }

    // ============================
    // 🔄 DCA INSTRUCTIONS
    // ============================

    /// Create a new DCA plan
    pub fn create_dca_plan(
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
        instructions::create_dca_plan::handler(
            ctx,
            plan_id,
            token_in,
            token_out,
            amount_per_swap,
            total_swaps,
            interval_seconds,
            min_out_per_swap,
            expires_at,
        )
    }

    /// Execute a single swap in a DCA plan
    pub fn execute_dca_swap(ctx: Context<ExecuteDcaSwap>) -> Result<()> {
        // Inline handler for ExecuteDcaSwap
        let dca_plan = &mut ctx.accounts.dca_plan;
        let clock = Clock::get()?;

        // Validation
        require!(dca_plan.is_active, error::SwapbackError::PlanNotActive);
        require!(
            !dca_plan.is_completed(),
            error::SwapbackError::PlanCompleted
        );
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

        msg!(
            "Progress: {}/{} swaps",
            dca_plan.executed_swaps,
            dca_plan.total_swaps
        );
        msg!("Next execution: {}", dca_plan.next_execution);
        msg!("Total invested: {}", dca_plan.total_invested);
        msg!("Total received: {}", dca_plan.total_received);

        Ok(())
    }

    /// Pause a DCA plan
    pub fn pause_dca_plan(ctx: Context<PauseDcaPlan>) -> Result<()> {
        // Inline handler for PauseDcaPlan
        let dca_plan = &mut ctx.accounts.dca_plan;

        require!(dca_plan.is_active, error::SwapbackError::AlreadyPaused);
        require!(
            !dca_plan.is_completed(),
            error::SwapbackError::PlanCompleted
        );

        dca_plan.is_active = false;

        msg!("⏸️  DCA Plan paused");
        msg!("Plan ID: {:?}", dca_plan.plan_id);

        Ok(())
    }

    /// Resume a paused DCA plan
    pub fn resume_dca_plan(ctx: Context<ResumeDcaPlan>) -> Result<()> {
        // Inline handler for ResumeDcaPlan
        let dca_plan = &mut ctx.accounts.dca_plan;
        let clock = Clock::get()?;

        require!(!dca_plan.is_active, error::SwapbackError::AlreadyActive);
        require!(
            !dca_plan.is_completed(),
            error::SwapbackError::PlanCompleted
        );
        require!(
            !dca_plan.is_expired(clock.unix_timestamp),
            error::SwapbackError::PlanExpired
        );

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
    pub fn cancel_dca_plan(ctx: Context<CancelDcaPlan>) -> Result<()> {
        // Inline handler for CancelDcaPlan
        let dca_plan = &ctx.accounts.dca_plan;

        msg!("❌ DCA Plan cancelled and closed");
        msg!("Plan ID: {:?}", dca_plan.plan_id);
        msg!(
            "Swaps executed: {}/{}",
            dca_plan.executed_swaps,
            dca_plan.total_swaps
        );
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
        let seeds = &[b"router_state".as_ref(), &[ctx.accounts.state.bump]];
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

    pub fn initialize_oracle_cache(ctx: Context<InitializeOracleCache>) -> Result<()> {
        let cache = &mut ctx.accounts.oracle_cache;
        cache.token_pair = [Pubkey::default(), Pubkey::default()]; // Placeholder
        cache.cached_price = 0;
        cache.cached_at = 0;
        cache.cache_duration = 5; // 5 seconds default
        cache.bump = ctx.bumps.oracle_cache;
        Ok(())
    }

    pub fn initialize_venue_score(ctx: Context<InitializeVenueScore>) -> Result<()> {
        let score = &mut ctx.accounts.venue_score;
        score.venue = ctx.accounts.state.key();
        score.venue_type = venue_scoring::VenueType::Unknown;
        score.total_swaps = 0;
        score.total_volume = 0;
        score.total_npi_generated = 0;
        score.avg_latency_ms = 0;
        score.avg_slippage_bps = 0;
        score.quality_score = 0;
        score.last_updated = Clock::get()?.unix_timestamp;
        score.window_start = Clock::get()?.unix_timestamp;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = RouterState::LEN,
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

    /// CHECK: Primary oracle account (e.g. Switchboard feed)
    pub primary_oracle: AccountInfo<'info>,

    /// CHECK: Optional fallback oracle (e.g. Pyth feed)
    pub fallback_oracle: Option<AccountInfo<'info>>,

    #[account(mut)]
    pub user_token_account_a: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub user_token_account_b: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub vault_token_account_a: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub vault_token_account_b: Box<Account<'info, TokenAccount>>,

    /// CHECK: Optional swap plan account when using dynamic plans
    pub plan: Option<Box<Account<'info, SwapPlan>>>,

    /// CHECK: Optional UserNft account for boost verification
    #[account(
        seeds = [b"user_nft", user.key().as_ref()],
        bump,
        seeds::program = CNFT_PROGRAM_ID
    )]
    pub user_nft: Option<Box<Account<'info, UserNft>>>,

    /// CHECK: Buyback program
    #[account(address = BUYBACK_PROGRAM_ID)]
    pub buyback_program: Option<AccountInfo<'info>>,

    /// CHECK: Buyback USDC vault (validated in buyback program)
    #[account(mut)]
    pub buyback_usdc_vault: Option<Box<Account<'info, TokenAccount>>>,

    /// CHECK: Buyback state account (validated in buyback program)
    #[account(mut)]
    pub buyback_state: Option<AccountInfo<'info>>,

    /// CHECK: User's rebate USDC account (for receiving boosted rebates)
    #[account(mut)]
    pub user_rebate_account: Option<Box<Account<'info, TokenAccount>>>,

    /// Rebate vault PDA holding USDC
    #[account(
        mut,
        seeds = [b"rebate_vault", state.key().as_ref()],
        bump
    )]
    pub rebate_vault: Box<Account<'info, TokenAccount>>,

    /// CHECK: Optional Oracle Cache for optimized price lookups
    #[account(
        mut,
        seeds = [b"oracle_cache", primary_oracle.key().as_ref()],
        bump
    )]
    pub oracle_cache: Option<Account<'info, oracle_cache::OracleCache>>,

    /// CHECK: Optional Venue Score for routing optimization
    #[account(
        mut,
        seeds = [b"venue_score", state.key().as_ref()], // Using state as seed for now as venue is dynamic
        bump
    )]
    pub venue_score: Option<Account<'info, venue_scoring::VenueScore>>,

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
        seeds = [b"rebate_vault", state.key().as_ref()],
        bump
    )]
    pub rebate_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = RouterConfig::LEN,
        seeds = [b"router_config"],
        bump
    )]
    pub config: Account<'info, RouterConfig>,

    #[account(
        mut,
        seeds = [b"router_state"],
        bump = state.bump,
        constraint = state.authority == authority.key()
    )]
    pub state: Account<'info, RouterState>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [b"router_config"],
        bump = config.bump,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub config: Account<'info, RouterConfig>,

    #[account(
        mut,
        seeds = [b"router_state"],
        bump = state.bump,
        constraint = state.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub state: Account<'info, RouterState>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitializeRebateVault<'info> {
    #[account(
        mut,
        seeds = [b"router_state"],
        bump = state.bump,
        constraint = state.authority == authority.key()
    )]
    pub state: Account<'info, RouterState>,

    #[account(
        init,
        payer = authority,
        seeds = [b"rebate_vault", state.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = state,
    )]
    pub rebate_vault: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct JupiterRouteParams {
    /// Full Jupiter instruction data (including discriminator)
    pub swap_instruction: Vec<u8>,
    /// Amount Jupiter is expected to pull from user_source_token_account
    pub expected_input_amount: u64,
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
    pub primary_oracle_account: Pubkey,  // Primary oracle account for price validation
    pub fallback_oracle_account: Option<Pubkey>, // Optional fallback oracle account
    pub jupiter_route: Option<JupiterRouteParams>,
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
    pub buyburn_deposit: u64,
    pub user_boost: u16,    // Boost de l'utilisateur (basis points)
    pub rebate_amount: u64, // Montant du rebate en USDC
}

#[event]
pub struct RebatePaid {
    pub user: Pubkey,
    pub npi_amount: u64,   // NPI (routing profit) réalisé
    pub base_rebate: u64,  // Rebate de base (75% du NPI)
    pub boost: u16,        // Boost appliqué (basis points)
    pub total_rebate: u64, // Rebate total après boost
    pub timestamp: i64,
}

#[event]
pub struct FeesAllocated {
    pub swap_amount: u64,
    pub platform_fee: u64,
    pub to_treasury: u64,
    pub to_buyburn: u64,
    pub timestamp: i64,
}

#[event]
pub struct NPIDistributed {
    pub user: Pubkey,
    pub total_npi: u64,
    pub to_rebate: u64,
    pub to_treasury: u64,
    pub to_boost_vault: u64,
    pub boost_paid: u64,
    pub timestamp: i64,
}

#[event]
pub struct ConfigUpdated {
    pub authority: Pubkey,
    pub rebate_bps: u16,
    pub treasury_bps: u16,
    pub boost_vault_bps: u16,
    pub treasury_from_fees_bps: u16,
    pub buyburn_from_fees_bps: u16,
    pub timestamp: i64,
}

#[event]
pub struct BuyburnDeposit {
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
    pub user: Pubkey,       // Utilisateur propriétaire
    pub level: LockLevel,   // Niveau de lock (Bronze à Diamond)
    pub amount_locked: u64, // Montant de tokens lockés
    pub lock_duration: i64, // Durée du lock en secondes
    pub boost: u16,         // Boost en basis points (0-10000)
    pub mint_time: i64,     // Timestamp du mint
    pub is_active: bool,    // Statut actif/inactif
}

// Enum LockLevel importé du programme cNFT
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum LockLevel {
    #[default]
    Bronze, // 100+ BACK × 7+ jours
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
    #[msg("Missing fallback oracle account")]
    MissingFallbackOracle,
    #[msg("Dual oracle price divergence too high")]
    OracleDivergenceTooHigh,
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
    #[msg("Invalid basis points configuration")]
    InvalidBpsSum,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Missing Jupiter route payload")]
    MissingJupiterRoute,
    #[msg("Invalid Jupiter route parameters")]
    InvalidJupiterRoute,
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

        // --- Phase 2: Oracle Cache Check ---
        if let Some(cache) = &ctx.accounts.oracle_cache {
            if cache.is_stale(clock.unix_timestamp) {
                msg!("Warning: Oracle cache is stale");
            }
        }

        // --- Phase 2: Dynamic Slippage ---
        if ctx.accounts.state.dynamic_slippage_enabled {
             // Simplified dynamic slippage
             let default_volatility = 50u16; 
             let pool_tvl_estimate = 1_000_000_000_000u64;
             
             if let Ok(dynamic_slippage) = crate::slippage::calculate_dynamic_slippage(
                 &ctx.accounts.primary_oracle.key(),
                 args.amount_in,
                 pool_tvl_estimate,
                 default_volatility
             ) {
                 msg!("Dynamic Slippage calculated: {} bps", dynamic_slippage);
             }
        }

        if ctx.accounts.primary_oracle.key() != args.primary_oracle_account {
            return err!(ErrorCode::InvalidOraclePrice);
        }

        let fallback_account = match (
            args.fallback_oracle_account,
            ctx.accounts.fallback_oracle.as_ref(),
        ) {
            (Some(expected_key), Some(account)) => {
                if account.key() != expected_key {
                    return err!(ErrorCode::InvalidOraclePrice);
                }
                Some(account)
            }
            (Some(_), None) => return err!(ErrorCode::MissingFallbackOracle),
            (None, Some(account)) => Some(account),
            (None, None) => None,
        };

        if args.use_dynamic_plan {
            return process_dynamic_plan_swap(&mut ctx, args, &clock);
        }

        let oracle_observation = get_oracle_price(
            &ctx.accounts.primary_oracle,
            fallback_account,
            &clock,
        )?;
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

        process_single_swap(&ctx, args.amount_in, min_out)?;

        // --- Phase 2: Update Venue Score ---
        if let Some(venue_score) = &mut ctx.accounts.venue_score {
            // Mock stats for now as process_single_swap is mocked
            let latency = 100; 
            let slippage_bps = 10;
            let npi = 0;
            venue_score.update_stats(args.amount_in, npi, latency, slippage_bps, &clock);
        }

        Ok(())
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
            args.jupiter_route.as_ref(),
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
                args.jupiter_route.as_ref(),
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
        jupiter_route: Option<&JupiterRouteParams>,
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
                jupiter_route,
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

        let platform_fee = calculate_fee(total_amount_out, PLATFORM_FEE_BPS)?;
        let treasury_fee_allocation =
            calculate_fee(platform_fee, ctx.accounts.state.treasury_from_fees_bps)?;
        let buyburn_fee_allocation =
            calculate_fee(platform_fee, ctx.accounts.state.buyburn_from_fees_bps)?;

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

        let base_rebate = calculate_fee(routing_profit, ctx.accounts.state.rebate_percentage)?;
        let treasury_from_npi =
            calculate_fee(routing_profit, ctx.accounts.state.treasury_percentage)?;
        let boost_vault_allocation =
            calculate_fee(routing_profit, ctx.accounts.state.boost_vault_percentage)?;

        let boost_amount = if user_boost > 0 {
            calculate_fee(base_rebate, user_boost)?
        } else {
            0
        };

        let boost_paid = boost_amount.min(boost_vault_allocation);
        let total_rebate = base_rebate
            .checked_add(boost_paid)
            .ok_or(ErrorCode::InvalidOraclePrice)?;
        let boost_vault_reserve = boost_vault_allocation
            .checked_sub(boost_paid)
            .ok_or(ErrorCode::InvalidOraclePrice)?;

        pay_rebate_to_user_with_amount(ctx, routing_profit, user_boost, total_rebate)?;

        let state = &mut ctx.accounts.state;
        state.total_treasury_from_npi = state
            .total_treasury_from_npi
            .checked_add(treasury_from_npi)
            .ok_or(ErrorCode::InvalidOraclePrice)?;
        state.total_boost_vault = state
            .total_boost_vault
            .checked_add(boost_vault_reserve)
            .ok_or(ErrorCode::InvalidOraclePrice)?;
        state.total_treasury_from_fees = state
            .total_treasury_from_fees
            .checked_add(treasury_fee_allocation)
            .ok_or(ErrorCode::InvalidOraclePrice)?;
        state.total_buyburn = state
            .total_buyburn
            .checked_add(buyburn_fee_allocation)
            .ok_or(ErrorCode::InvalidOraclePrice)?;

        let now = Clock::get()?.unix_timestamp;
        emit!(FeesAllocated {
            swap_amount: total_amount_out,
            platform_fee,
            to_treasury: treasury_fee_allocation,
            to_buyburn: buyburn_fee_allocation,
            timestamp: now,
        });

        emit!(NPIDistributed {
            user: ctx.accounts.user.key(),
            total_npi: routing_profit,
            to_rebate: total_rebate,
            to_treasury: treasury_from_npi,
            to_boost_vault: boost_vault_reserve,
            boost_paid,
            timestamp: now,
        });

        // Deposit to buyback if accounts are provided and amount > 0
        if buyburn_fee_allocation > 0
            && ctx.accounts.buyback_program.is_some()
            && ctx.accounts.buyback_usdc_vault.is_some()
            && ctx.accounts.buyback_state.is_some()
        {
            deposit_to_buyback(ctx, buyburn_fee_allocation)?;

            emit!(SwapCompleted {
                user: ctx.accounts.user.key(),
                amount_in: total_amount_in,
                amount_out: total_amount_out,
                platform_fee,
                routing_profit,
                buyburn_deposit: buyburn_fee_allocation,
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
        jupiter_route: Option<&JupiterRouteParams>,
    ) -> Result<u64> {
        match dex_program {
            RAYDIUM_AMM_PROGRAM_ID => {
                let amount_out = cpi_raydium::swap(ctx, account_slice, amount_in, min_out)?;
                emit!(VenueExecuted {
                    venue: dex_program,
                    amount_in,
                    amount_out,
                    success: true,
                    fallback_used: is_fallback,
                });
                Ok(amount_out)
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
                let route_params = jupiter_route.ok_or(ErrorCode::MissingJupiterRoute)?;
                let amount_out =
                    cpi_jupiter::swap(ctx, account_slice, amount_in, min_out, route_params)?;
                emit!(VenueExecuted {
                    venue: dex_program,
                    amount_in,
                    amount_out,
                    success: true,
                    fallback_used: is_fallback,
                });
                Ok(amount_out)
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
        } else if *program_id == RAYDIUM_AMM_PROGRAM_ID {
            Ok(cpi_raydium::RAYDIUM_SWAP_ACCOUNT_COUNT)
        } else if *program_id == JUPITER_PROGRAM_ID {
            Ok(cpi_jupiter::JUPITER_SWAP_ACCOUNT_COUNT)
        } else {
            Ok(0)
        }
    }

    fn get_oracle_price<'info>(
        primary_oracle: &AccountInfo<'info>,
        fallback_oracle: Option<&AccountInfo<'info>>,
        clock: &Clock,
    ) -> Result<OracleObservation> {
        let primary_result = oracle::read_price(primary_oracle, clock);
        let fallback_observation = fallback_oracle.and_then(|account| match oracle::read_price(account, clock) {
            Ok(observation) => Some(observation),
            Err(_) => {
                msg!("⚠️ Fallback oracle read failed");
                None
            }
        });

        let observation = match (primary_result, fallback_observation) {
            (Ok(primary), Some(fallback)) => {
                let high = primary.price.max(fallback.price) as u128;
                let low = primary.price.min(fallback.price) as u128;
                if low == 0 {
                    return err!(ErrorCode::InvalidOraclePrice);
                }

                let spread = high
                    .checked_sub(low)
                    .ok_or(ErrorCode::InvalidOraclePrice)?;
                let divergence_bps = spread
                    .checked_mul(10_000)
                    .and_then(|value| value.checked_div(low))
                    .ok_or(ErrorCode::InvalidOraclePrice)?;

                if divergence_bps > MAX_ORACLE_DIVERGENCE_BPS as u128 {
                    return err!(ErrorCode::OracleDivergenceTooHigh);
                }

                if primary.publish_time >= fallback.publish_time {
                    primary
                } else {
                    fallback
                }
            }
            (Ok(primary), None) => primary,
            (Err(_), Some(fallback)) => {
                msg!(
                    "⚠️ Primary oracle unavailable, using fallback feed {}",
                    fallback.feed
                );
                fallback
            }
            (Err(err), None) => return Err(err),
        };

        emit!(OracleChecked {
            feed: observation.feed,
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
    /// Example: NPI 10 USDC, 70% rebate, boost 2300 BP (23%)
    ///          base_rebate = 10 * 0.70 = 7.0 USDC
    ///          boosted = 7.0 * 1.23 = 8.61 USDC
    pub fn calculate_boosted_rebate(
        npi_amount: u64,
        rebate_bps: u16,
        boost_bp: u16,
    ) -> Result<u64> {
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


    /// Pay rebate to user with pre-calculated amount
    /// New function with cleaner separation of concerns
    fn pay_rebate_to_user_with_amount(
        ctx: &mut Context<SwapToC>,
        npi_amount: u64,
        boost: u16,
        total_rebate: u64,
    ) -> Result<()> {
        // Si pas de NPI, pas de rebate
        if npi_amount == 0 || total_rebate == 0 {
            return Ok(());
        }

        // Si pas de compte rebate, pas de paiement
        let user_rebate_account = match &ctx.accounts.user_rebate_account {
            Some(acc) => acc,
            None => return Ok(()),
        };

        // Calculer le base rebate (60% du NPI)
        let base_rebate = calculate_fee(npi_amount, ctx.accounts.state.rebate_percentage)?;

        require!(
            ctx.accounts.rebate_vault.amount >= total_rebate,
            ErrorCode::InsufficientVaultBalance
        );

        let seeds = &[b"router_state".as_ref(), &[ctx.accounts.state.bump]];
        let signer = &[&seeds[..]];

        let cpi_accounts = token::Transfer {
            from: ctx.accounts.rebate_vault.to_account_info(),
            to: user_rebate_account.to_account_info(),
            authority: ctx.accounts.state.to_account_info(),
        };

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        token::transfer(cpi_ctx, total_rebate)?;

        // Mettre à jour les statistiques du state
        let state = &mut ctx.accounts.state;
        state.total_npi = state
            .total_npi
            .checked_add(npi_amount)
            .ok_or(ErrorCode::InvalidOraclePrice)?;
        state.total_rebates_paid = state
            .total_rebates_paid
            .checked_add(total_rebate)
            .ok_or(ErrorCode::InvalidOraclePrice)?;

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
        let buyback_program = ctx
            .accounts
            .buyback_program
            .as_ref()
            .ok_or(ErrorCode::InvalidOraclePrice)?;
        let buyback_vault = ctx
            .accounts
            .buyback_usdc_vault
            .as_ref()
            .ok_or(ErrorCode::InvalidOraclePrice)?;
        let buyback_state = ctx
            .accounts
            .buyback_state
            .as_ref()
            .ok_or(ErrorCode::InvalidOraclePrice)?;

        // Build CPI accounts for buyback deposit_usdc instruction
        let cpi_accounts = vec![
            buyback_state.to_account_info(),
            ctx.accounts.vault_token_account_b.to_account_info(), // source (router's USDC)
            buyback_vault.to_account_info(),                      // destination (buyback vault)
            ctx.accounts.state.to_account_info(),                 // depositor (router authority)
            ctx.accounts.token_program.to_account_info(),
        ];

        // Create instruction data: deposit_usdc discriminator + amount
        let mut instruction_data = vec![242, 35, 198, 137, 82, 225, 242, 182]; // deposit_usdc discriminator
        instruction_data.extend_from_slice(&amount.to_le_bytes());

        let instruction = solana_program::instruction::Instruction {
            program_id: *buyback_program.key,
            accounts: cpi_accounts
                .iter()
                .enumerate()
                .map(|(i, acc)| {
                    solana_program::instruction::AccountMeta {
                        pubkey: *acc.key,
                        is_signer: i == 3,   // router state is signer
                        is_writable: i != 4, // all except token_program
                    }
                })
                .collect(),
            data: instruction_data,
        };

        // Create PDA signer seeds for router state
        let seeds = &[b"router_state".as_ref(), &[ctx.accounts.state.bump]];
        let signer_seeds = &[&seeds[..]];

        // Invoke CPI
        solana_program::program::invoke_signed(&instruction, &cpi_accounts, signer_seeds)?;

        emit!(BuyburnDeposit {
            amount,
            source: "platform_fees".to_string(),
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
        // Rebate: 7000 BP (70%) - nouvelle allocation
        // Boost: 0 BP (0%)
        // Expected: 10 × 0.70 × 1.0 = 7 USDC
        let npi = 10_000_000u64;
        let rebate_bps = DEFAULT_REBATE_BPS;
        let boost = 0u16;
        let result = swap_toc_processor::calculate_boosted_rebate(npi, rebate_bps, boost).unwrap();
        assert_eq!(
            result, 7_000_000,
            "70% of 10 USDC NPI with no boost = 7 USDC"
        );
    }

    #[test]
    fn test_calculate_boosted_rebate_small_boost() {
        // NPI: 10 USDC
        // Rebate: 7000 BP (70%)
        // Boost: 100 BP (1%) - nouveau boost réaliste
        // Expected: 10 × 0.70 × 1.01 = 7.07 USDC
        let npi = 10_000_000u64;
        let rebate_bps = DEFAULT_REBATE_BPS;
        let boost = 100u16;
        let result = swap_toc_processor::calculate_boosted_rebate(npi, rebate_bps, boost).unwrap();
        assert_eq!(
            result, 7_070_000,
            "70% of 10 USDC with 1% boost = 7.07 USDC"
        );
    }

    #[test]
    fn test_calculate_boosted_rebate_medium_boost() {
        // NPI: 10 USDC
        // Rebate: 7000 BP (70%)
        // Boost: 600 BP (6%) - Gold tier boost
        // Expected: 10 × 0.70 × 1.06 = 7.42 USDC
        let npi = 10_000_000u64;
        let rebate_bps = DEFAULT_REBATE_BPS;
        let boost = 600u16;
        let result = swap_toc_processor::calculate_boosted_rebate(npi, rebate_bps, boost).unwrap();
        assert_eq!(
            result, 7_420_000,
            "70% of 10 USDC with 6% boost = 7.42 USDC"
        );
    }

    #[test]
    fn test_calculate_boosted_rebate_high_boost() {
        // NPI: 10 USDC
        // Rebate: 7000 BP (70%)
        // Boost: 1000 BP (10%) - Platinum tier boost
        // Expected: 10 × 0.70 × 1.10 = 7.7 USDC
        let npi = 10_000_000u64;
        let rebate_bps = DEFAULT_REBATE_BPS;
        let boost = 1000u16;
        let result = swap_toc_processor::calculate_boosted_rebate(npi, rebate_bps, boost).unwrap();
        assert_eq!(
            result, 7_700_000,
            "70% of 10 USDC with 10% boost = 7.7 USDC"
        );
    }

    #[test]
    fn test_calculate_boosted_rebate_maximum_boost() {
        // NPI: 10 USDC
        // Rebate: 7000 BP (70%)
        // Boost: 1500 BP (15%) - Diamond tier maximum boost
        // Expected: 10 × 0.70 × 1.15 = 8.05 USDC
        let npi = 10_000_000u64;
        let rebate_bps = DEFAULT_REBATE_BPS;
        let boost = 1500u16;
        let result = swap_toc_processor::calculate_boosted_rebate(npi, rebate_bps, boost).unwrap();
        assert_eq!(
            result, 8_050_000,
            "70% of 10 USDC with 15% boost = 8.05 USDC"
        );
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
        // Mise à jour: 20 USDC fees + 50 USDC NPI + boost 10% (Platinum tier)

        let platform_fee = 20_000_000u64; // 20 USDC
        let npi = 50_000_000u64; // 50 USDC
        let boost_bp = 1000u16; // 10% boost

        // 1. Rebate base (70% du NPI)
        let base_rebate = swap_toc_processor::calculate_fee(npi, DEFAULT_REBATE_BPS).unwrap();
        assert_eq!(base_rebate, 35_000_000, "70% of 50 USDC NPI = 35 USDC");

        // 2. Boost supplémentaire (10% du rebate base)
        let boost_amount = swap_toc_processor::calculate_fee(base_rebate, boost_bp).unwrap();
        assert_eq!(boost_amount, 3_500_000, "10% boost on 35 USDC = 3.5 USDC");

        let total_rebate = base_rebate + boost_amount;
        assert_eq!(
            total_rebate, 38_500_000,
            "35 + 3.5 = 38.5 USDC pour l'utilisateur"
        );

        // 3. Boost vault allocation (15% du NPI) et réserve après boost
        let boost_vault_allocation =
            swap_toc_processor::calculate_fee(npi, BOOST_VAULT_BPS).unwrap();
        assert_eq!(
            boost_vault_allocation, 7_500_000,
            "15% of 50 USDC NPI = 7.5 USDC"
        );

        let boost_vault_reserve = boost_vault_allocation - boost_amount;
        assert_eq!(
            boost_vault_reserve, 4_000_000,
            "7.5 - 3.5 = 4 USDC conservés dans le boost vault"
        );

        // 4. Treasury allocations
        let treasury_from_npi =
            swap_toc_processor::calculate_fee(npi, TREASURY_FROM_NPI_BPS).unwrap();
        assert_eq!(
            treasury_from_npi, 7_500_000,
            "15% of 50 USDC NPI = 7.5 USDC"
        );

        let treasury_from_fees =
            swap_toc_processor::calculate_fee(platform_fee, PLATFORM_FEE_TREASURY_BPS).unwrap();
        assert_eq!(
            treasury_from_fees, 17_000_000,
            "85% of 20 USDC fees = 17 USDC"
        );

        // 5. Buy & burn allocation (15% des fees)
        let buyburn_from_fees =
            swap_toc_processor::calculate_fee(platform_fee, PLATFORM_FEE_BUYBURN_BPS).unwrap();
        assert_eq!(buyburn_from_fees, 3_000_000, "15% of 20 USDC fees = 3 USDC");

        // 6. Vérification finale
        let grand_total = total_rebate
            + treasury_from_npi
            + boost_vault_reserve
            + treasury_from_fees
            + buyburn_from_fees;
        assert_eq!(
            grand_total,
            platform_fee + npi,
            "100% des revenus distribués"
        );
    }

    #[test]
    fn test_complete_revenue_allocation() {
        // Scénario: 20 USDC de platform fees + 50 USDC de NPI, sans boost

        let platform_fee = 20_000_000u64; // 20 USDC
        let npi = 50_000_000u64; // 50 USDC

        let fee_to_treasury =
            swap_toc_processor::calculate_fee(platform_fee, PLATFORM_FEE_TREASURY_BPS).unwrap();
        assert_eq!(fee_to_treasury, 17_000_000, "85% of 20 USDC fees = 17 USDC");

        let fee_to_buyburn =
            swap_toc_processor::calculate_fee(platform_fee, PLATFORM_FEE_BUYBURN_BPS).unwrap();
        assert_eq!(fee_to_buyburn, 3_000_000, "15% of 20 USDC fees = 3 USDC");

        let npi_to_rebates = swap_toc_processor::calculate_fee(npi, DEFAULT_REBATE_BPS).unwrap();
        assert_eq!(npi_to_rebates, 35_000_000, "70% of 50 USDC NPI = 35 USDC");

        let npi_to_treasury =
            swap_toc_processor::calculate_fee(npi, TREASURY_FROM_NPI_BPS).unwrap();
        assert_eq!(npi_to_treasury, 7_500_000, "15% of 50 USDC NPI = 7.5 USDC");

        let npi_to_boost_vault = swap_toc_processor::calculate_fee(npi, BOOST_VAULT_BPS).unwrap();
        assert_eq!(
            npi_to_boost_vault, 7_500_000,
            "15% of 50 USDC NPI = 7.5 USDC"
        );

        let grand_total = fee_to_treasury
            + fee_to_buyburn
            + npi_to_rebates
            + npi_to_treasury
            + npi_to_boost_vault;
        let expected_total = platform_fee + npi;
        assert_eq!(
            grand_total, expected_total,
            "100% of revenue allocated (70 USDC)"
        );
    }
}
