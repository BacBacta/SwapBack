use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

// Program ID generated locally for deployment
declare_id!("EtqKmwUHhaBJbmDzb3BrMf2iZ4RyGYPos9U78Xjpe3Ug");

// Constants
pub const MAX_VENUES: usize = 5;
pub const WEIGHT_PRECISION: u64 = 100; // Weights must sum to 100
pub const MAX_FALLBACK_ROUTES: usize = 3;

/// Common swap program with weight-based routing and MEV protection
#[program]
pub mod common_swap {
    use super::*;

    /// Initialize the common swap program
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;
        global_state.authority = ctx.accounts.authority.key();
        global_state.is_paused = false;
        global_state.total_swaps = 0;
        global_state.emergency_mode = false;

        // Calculate bump for PDA
        let (_pda, bump) = Pubkey::find_program_address(&[b"global_state"], ctx.program_id);
        global_state.bump = bump;

        msg!("Common swap program initialized");
        Ok(())
    }

    /// Execute an optimized swap with weight-based routing
    /// Weights must sum to 100, providing exact allocation across venues
    pub fn execute_weighted_swap(
        ctx: Context<ExecuteWeightedSwap>,
        input_mint: Pubkey,
        output_mint: Pubkey,
        total_input_amount: u64,
        min_output_amount: u64,
        weights: Vec<u8>,             // Weights for each venue (must sum to 100)
        venue_addresses: Vec<Pubkey>, // DEX/venue program addresses
        oracle_price: u64,            // Oracle price for verification
        oracle_confidence: u64,       // Oracle confidence interval
        use_jito_bundling: bool,
        max_slippage_bps: u16, // Max slippage in basis points
    ) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;

        // Emergency pause check
        require!(!global_state.is_paused, ErrorCode::ProgramPaused);
        require!(!global_state.emergency_mode, ErrorCode::EmergencyMode);

        // Validate weights
        require!(weights.len() <= MAX_VENUES, ErrorCode::TooManyVenues);
        require!(
            weights.len() == venue_addresses.len(),
            ErrorCode::WeightVenueMismatch
        );

        let total_weight: u64 = weights.iter().map(|&w| w as u64).sum();
        require!(total_weight == WEIGHT_PRECISION, ErrorCode::InvalidWeights);

        // Validate amounts
        require!(total_input_amount > 0, ErrorCode::InvalidAmount);
        require!(min_output_amount > 0, ErrorCode::InvalidAmount);

        // Oracle price verification (basic check)
        require!(oracle_price > 0, ErrorCode::InvalidOraclePrice);

        msg!(
            "Executing weighted swap: {} venues, total weight: {}",
            weights.len(),
            total_weight
        );

        // TODO: Implement actual DEX integrations and weight-based execution
        // For MVP, simulate the swap with weight validation

        let mut total_output = 0u64;
        let mut executed_weights = Vec::new();

        // Simulate execution across venues based on weights
        for (i, &weight) in weights.iter().enumerate() {
            let venue_input =
                (total_input_amount as u128 * weight as u128 / WEIGHT_PRECISION as u128) as u64;
            let venue_output = venue_input * 99 / 100; // Simulate 1% fee

            total_output += venue_output;
            executed_weights.push(weight);

            msg!(
                "Venue {}: weight={}, input={}, output={}",
                venue_addresses[i],
                weight,
                venue_input,
                venue_output
            );
        }

        // Verify minimum output
        require!(
            total_output >= min_output_amount,
            ErrorCode::SlippageExceeded
        );

        // Update global statistics
        global_state.total_swaps += 1;

        // Emit success event
        emit!(WeightedSwapExecuted {
            user: ctx.accounts.user.key(),
            input_mint,
            output_mint,
            total_input_amount,
            total_output_amount: total_output,
            weights: executed_weights,
            venue_count: weights.len() as u8,
            oracle_price,
            jito_protected: use_jito_bundling,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Weighted swap completed successfully");
        Ok(())
    }

    /// Execute swap with dynamic weight calculation based on oracle data
    pub fn execute_dynamic_swap(
        ctx: Context<ExecuteDynamicSwap>,
        input_mint: Pubkey,
        output_mint: Pubkey,
        input_amount: u64,
        min_output_amount: u64,
        oracle_data: OracleData,
        max_venues: u8,
    ) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;

        // Emergency checks
        require!(!global_state.is_paused, ErrorCode::ProgramPaused);
        require!(!global_state.emergency_mode, ErrorCode::EmergencyMode);

        // Validate oracle data
        require!(oracle_data.price > 0, ErrorCode::InvalidOraclePrice);
        require!(oracle_data.timestamp > 0, ErrorCode::InvalidOracleTimestamp);

        // TODO: Implement dynamic weight calculation based on:
        // - Oracle price vs venue prices
        // - Liquidity depth per venue
        // - Venue fees and reliability
        // - MEV risk assessment

        // For MVP, use simple equal weighting
        let venue_count = max_venues.min(MAX_VENUES as u8).max(1);
        let base_weight = (WEIGHT_PRECISION / venue_count as u64) as u8;
        let mut weights = vec![base_weight; venue_count as usize];

        // Distribute remainder
        let remainder = (WEIGHT_PRECISION % venue_count as u64) as u8;
        if remainder > 0 && weights.len() > 0 {
            weights[0] += remainder;
        }

        msg!("Dynamic weights calculated: {:?}", weights);

        // TODO: Execute the swap with calculated weights
        // For now, simulate success

        emit!(DynamicSwapExecuted {
            user: ctx.accounts.user.key(),
            input_mint,
            output_mint,
            input_amount,
            estimated_output: input_amount * 98 / 100, // Simulate 2% total cost
            calculated_weights: weights,
            oracle_provider: oracle_data.provider,
            timestamp: Clock::get()?.unix_timestamp,
        });

        global_state.total_swaps += 1;

        Ok(())
    }

    /// Emergency pause/unpause the program
    pub fn set_emergency_mode(ctx: Context<SetEmergencyMode>, enabled: bool) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.global_state.authority,
            ErrorCode::Unauthorized
        );

        ctx.accounts.global_state.emergency_mode = enabled;

        emit!(EmergencyModeChanged {
            authority: ctx.accounts.authority.key(),
            enabled,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!(
            "Emergency mode {}",
            if enabled { "enabled" } else { "disabled" }
        );
        Ok(())
    }

    /// Pause/unpause the program (admin only)
    pub fn pause_program(ctx: Context<PauseProgram>, paused: bool) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.global_state.authority,
            ErrorCode::Unauthorized
        );

        ctx.accounts.global_state.is_paused = paused;

        emit!(ProgramPaused {
            authority: ctx.accounts.authority.key(),
            paused,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Program {}", if paused { "paused" } else { "unpaused" });
        Ok(())
    }
}

// === ACCOUNT STRUCTURES ===

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + GlobalState::INIT_SPACE,
        seeds = [b"global_state"],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteWeightedSwap<'info> {
    #[account(mut, seeds = [b"global_state"], bump = global_state.bump)]
    pub global_state: Account<'info, GlobalState>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: User input token account
    pub user_input_account: AccountInfo<'info>,

    /// CHECK: User output token account
    pub user_output_account: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct ExecuteDynamicSwap<'info> {
    #[account(mut, seeds = [b"global_state"], bump = global_state.bump)]
    pub global_state: Account<'info, GlobalState>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: User input token account
    pub user_input_account: AccountInfo<'info>,

    /// CHECK: User output token account
    pub user_output_account: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct SetEmergencyMode<'info> {
    #[account(mut, seeds = [b"global_state"], bump = global_state.bump)]
    pub global_state: Account<'info, GlobalState>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct PauseProgram<'info> {
    #[account(mut, seeds = [b"global_state"], bump = global_state.bump)]
    pub global_state: Account<'info, GlobalState>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

// === DATA STRUCTURES ===

#[account]
#[derive(InitSpace)]
pub struct GlobalState {
    pub authority: Pubkey,
    pub is_paused: bool,
    pub emergency_mode: bool,
    pub total_swaps: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct OracleData {
    pub provider: OracleProvider,
    pub price: u64,
    pub confidence: u64,
    pub timestamp: i64,
    pub exponent: i8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum OracleProvider {
    Pyth,
    Switchboard,
}

// === EVENTS ===

#[event]
pub struct WeightedSwapExecuted {
    pub user: Pubkey,
    pub input_mint: Pubkey,
    pub output_mint: Pubkey,
    pub total_input_amount: u64,
    pub total_output_amount: u64,
    pub weights: Vec<u8>,
    pub venue_count: u8,
    pub oracle_price: u64,
    pub jito_protected: bool,
    pub timestamp: i64,
}

#[event]
pub struct DynamicSwapExecuted {
    pub user: Pubkey,
    pub input_mint: Pubkey,
    pub output_mint: Pubkey,
    pub input_amount: u64,
    pub estimated_output: u64,
    pub calculated_weights: Vec<u8>,
    pub oracle_provider: OracleProvider,
    pub timestamp: i64,
}

#[event]
pub struct EmergencyModeChanged {
    pub authority: Pubkey,
    pub enabled: bool,
    pub timestamp: i64,
}

#[event]
pub struct ProgramPaused {
    pub authority: Pubkey,
    pub paused: bool,
    pub timestamp: i64,
}

// === ERROR CODES ===

#[error_code]
pub enum ErrorCode {
    #[msg("Program is currently paused")]
    ProgramPaused,
    #[msg("Emergency mode is active")]
    EmergencyMode,
    #[msg("Invalid amount specified")]
    InvalidAmount,
    #[msg("Weights must sum to 100")]
    InvalidWeights,
    #[msg("Too many venues specified")]
    TooManyVenues,
    #[msg("Number of weights must match number of venues")]
    WeightVenueMismatch,
    #[msg("Invalid oracle price")]
    InvalidOraclePrice,
    #[msg("Invalid oracle timestamp")]
    InvalidOracleTimestamp,
    #[msg("Slippage exceeded maximum allowed")]
    SlippageExceeded,
    #[msg("Unauthorized access")]
    Unauthorized,
}
