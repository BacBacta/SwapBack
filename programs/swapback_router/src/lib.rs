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

    pub token_program: Program<'info, token::Token>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SwapArgs {
    pub amount_in: u64,
    pub min_out: u64,
    pub slippage_tolerance: Option<u16>, // In basis points (e.g., 50 = 0.5%)
    pub twap_slices: Option<u8>,         // Number of slices for TWAP
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
}

pub mod swap_toc_processor {
    use super::*;

    pub fn process_swap_toc(ctx: Context<SwapToC>, args: SwapArgs) -> Result<()> {
        let clock = Clock::get()?;

        // Consult oracle for reference price
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

    fn get_oracle_price(_oracle_account: &AccountInfo, _current_time: i64) -> Result<u64> {
        // TODO: Implement actual oracle price fetching
        // For now, return a fixed price for testing (1 USD = 1_000_000 in our 6-decimal system)
        Ok(1_000_000)
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
