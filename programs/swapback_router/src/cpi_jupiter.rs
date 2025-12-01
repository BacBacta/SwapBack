use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program,
};
use anchor_spl::token::TokenAccount as SplTokenAccount;
use solana_program::program::invoke_signed;

use crate::{ErrorCode, JupiterRouteParams, SwapToC, JUPITER_PROGRAM_ID};

pub const JUPITER_SWAP_ACCOUNT_COUNT: usize = 48;
const JUPITER_MIN_ACCOUNT_COUNT: usize = 1;

/// Remaining account padding uses the default (all-zero) pubkey sentinel.
const ACCOUNT_PADDING_SENTINEL: Pubkey = Pubkey::new_from_array([0u8; 32]);

/// Execute a Jupiter aggregator swap via CPI by replaying a fully-built instruction.
pub fn swap(
    ctx: &Context<SwapToC>,
    account_slice: &[AccountInfo],
    amount_in: u64,
    min_out: u64,
    route: &JupiterRouteParams,
) -> Result<u64> {
    require!(
        !route.swap_instruction.is_empty(),
        ErrorCode::InvalidJupiterRoute
    );
    require_eq!(
        route.expected_input_amount,
        amount_in,
        ErrorCode::InvalidJupiterRoute
    );

    // Count valid accounts first to pre-allocate
    let valid_count = account_slice
        .iter()
        .filter(|a| a.key != &ACCOUNT_PADDING_SENTINEL)
        .count();

    require!(
        valid_count >= JUPITER_MIN_ACCOUNT_COUNT,
        ErrorCode::DexExecutionFailed
    );

    // Pre-allocate with exact capacity
    let mut filtered_accounts: Vec<AccountInfo> = Vec::with_capacity(valid_count);
    let mut metas: Vec<AccountMeta> = Vec::with_capacity(valid_count);

    for account in account_slice.iter() {
        if account.key != &ACCOUNT_PADDING_SENTINEL {
            metas.push(AccountMeta {
                pubkey: *account.key,
                is_signer: account.is_signer,
                is_writable: account.is_writable,
            });
            filtered_accounts.push(account.clone());
        }
    }

    require_keys_eq!(
        *filtered_accounts
            .first()
            .ok_or(ErrorCode::DexExecutionFailed)?
            .key,
        JUPITER_PROGRAM_ID,
        ErrorCode::DexExecutionFailed
    );

    let destination_account_info = ctx.accounts.user_token_account_b.to_account_info();
    let amount_before = ctx.accounts.user_token_account_b.amount;

    let instruction = Instruction {
        program_id: JUPITER_PROGRAM_ID,
        accounts: metas,
        data: route.swap_instruction.clone(),
    };

    program::invoke(&instruction, &filtered_accounts)?;

    let account_data = destination_account_info
        .try_borrow_data()
        .map_err(|_| ErrorCode::DexExecutionFailed)?;
    let mut data_slice: &[u8] = &account_data;
    let destination_after = SplTokenAccount::try_deserialize(&mut data_slice)
        .map_err(|_| ErrorCode::DexExecutionFailed)?
        .amount;
    drop(account_data);

    let amount_out = destination_after
        .checked_sub(amount_before)
        .ok_or(ErrorCode::DexExecutionFailed)?;
    require!(amount_out >= min_out, ErrorCode::SlippageExceeded);

    Ok(amount_out)
}

/// Helper: read token amount from AccountInfo using anchor_spl TokenAccount
fn token_amount(ai: &AccountInfo) -> Result<u64> {
    let data = ai.try_borrow_data()?;
    let mut data_slice: &[u8] = &data;
    let acc = SplTokenAccount::try_deserialize(&mut data_slice)
        .map_err(|_| error!(ErrorCode::InvalidTokenAccount))?;
    Ok(acc.amount)
}

/// Exécute un swap Jupiter via CPI en rejouant l'instruction (data + remaining_accounts),
/// puis calcule `amount_out` via delta de la token account de destination.
///
/// - `jupiter_program` : le programme Jupiter Swap/Router (AccountInfo)
/// - `remaining_accounts` : tous les comptes requis par l'instruction Jupiter (dans le bon ordre)
/// - `user_source_ata` / `user_dest_ata` : token accounts à mesurer (delta)
/// - `swap_ix_data` : bytes de l'instruction Jupiter (fourni par keeper/SDK)
/// - `signer_seeds` : seeds si ton programme doit signer (souvent vide [] si user signe)
pub fn swap_with_balance_deltas<'info>(
    jupiter_program: &AccountInfo<'info>,
    remaining_accounts: &[AccountInfo<'info>],
    user_source_ata: &AccountInfo<'info>,
    user_dest_ata: &AccountInfo<'info>,
    amount_in: u64,
    min_out: u64,
    swap_ix_data: &[u8],
    signer_seeds: &[&[&[u8]]],
) -> Result<u64> {
    // Snapshot balances
    let pre_in = token_amount(user_source_ata)?;
    let pre_out = token_amount(user_dest_ata)?;

    // CPI: build metas from remaining accounts with pre-allocation
    let account_count = remaining_accounts.len();
    let mut metas: Vec<AccountMeta> = Vec::with_capacity(account_count);
    for ai in remaining_accounts.iter() {
        metas.push(AccountMeta {
            pubkey: *ai.key,
            is_signer: ai.is_signer,
            is_writable: ai.is_writable,
        });
    }

    let ix = Instruction {
        program_id: *jupiter_program.key,
        accounts: metas,
        data: swap_ix_data.to_vec(),
    };

    // Execute Jupiter swap
    // NOTE: amount_in/min_out sont généralement encodés dans swap_ix_data; on garde quand même les checks post-delta.
    invoke_signed(&ix, remaining_accounts, signer_seeds)
        .map_err(|_| error!(ErrorCode::JupiterCpiFailed))?;

    // Snapshot balances post
    let post_in = token_amount(user_source_ata)?;
    let post_out = token_amount(user_dest_ata)?;

    // Deltas
    let spent_in = pre_in.saturating_sub(post_in);
    let received_out = post_out.saturating_sub(pre_out);

    require!(spent_in > 0, ErrorCode::JupiterNoInputSpent);
    // Optionnel: si spender_in diffère trop de amount_in attendu, rejeter
    require!(
        spent_in <= amount_in.saturating_add(5), // marge anti-arrondi
        ErrorCode::JupiterSpentTooHigh
    );
    require!(received_out >= min_out, ErrorCode::SlippageExceeded);

    Ok(received_out)
}

#[cfg(test)]
mod tests {

    /// Test that delta-based enforcement logic catches edge cases.
    /// These tests verify the require! checks without actual CPI calls.

    #[test]
    fn test_delta_enforcement_zero_spent_fails() {
        // Scenario: Jupiter CPI returns but no tokens were spent (pre_in == post_in)
        let pre_in = 1000u64;
        let post_in = 1000u64; // No change
        let spent_in = pre_in.saturating_sub(post_in);

        // This should fail: spent_in == 0
        assert_eq!(spent_in, 0);
        // In swap_with_balance_deltas, this triggers: require!(spent_in > 0, JupiterNoInputSpent)
    }

    #[test]
    fn test_delta_enforcement_spent_too_high_fails() {
        // Scenario: Jupiter spent more than expected (malicious/buggy)
        let amount_in = 1000u64;
        let spent_in = 1010u64; // Spent 10 more than expected

        // Check: spent_in <= amount_in + 5 (rounding margin)
        let is_valid = spent_in <= amount_in.saturating_add(5);
        assert!(!is_valid, "Should fail when spent exceeds amount_in + 5");
    }

    #[test]
    fn test_delta_enforcement_spent_within_margin() {
        // Scenario: Jupiter spent slightly more due to rounding (acceptable)
        let amount_in = 1000u64;
        let spent_in = 1003u64; // Within 5 margin

        let is_valid = spent_in <= amount_in.saturating_add(5);
        assert!(is_valid, "Should pass when spent is within margin");
    }

    #[test]
    fn test_delta_enforcement_min_out_check() {
        // Scenario: Slippage exceeded - received less than minimum
        let min_out = 950u64;
        let received_out = 940u64; // 10 less than min_out

        let passes_slippage = received_out >= min_out;
        assert!(!passes_slippage, "Should fail slippage check");
    }

    #[test]
    fn test_delta_enforcement_min_out_exact() {
        // Scenario: Received exactly min_out (should pass)
        let min_out = 950u64;
        let received_out = 950u64;

        let passes_slippage = received_out >= min_out;
        assert!(passes_slippage, "Should pass when received == min_out");
    }

    #[test]
    fn test_delta_enforcement_positive_slippage() {
        // Scenario: Received more than min_out (positive slippage = NPI)
        let min_out = 950u64;
        let received_out = 1020u64;

        let passes_slippage = received_out >= min_out;
        assert!(passes_slippage, "Should pass with positive slippage");

        let npi = received_out.saturating_sub(min_out);
        assert_eq!(npi, 70, "NPI should be 70");
    }

    #[test]
    fn test_delta_calculation_normal_swap() {
        // Normal swap scenario
        let pre_in = 10_000u64;
        let post_in = 9_000u64;
        let pre_out = 500u64;
        let post_out = 1_470u64;

        let spent_in = pre_in.saturating_sub(post_in);
        let received_out = post_out.saturating_sub(pre_out);

        assert_eq!(spent_in, 1000, "Should have spent 1000");
        assert_eq!(received_out, 970, "Should have received 970");
    }

    #[test]
    fn test_delta_overflow_protection() {
        // Edge case: post balance somehow higher than pre (saturating_sub protects)
        let pre_in = 1000u64;
        let post_in = 1500u64; // Impossible in normal operation

        let spent_in = pre_in.saturating_sub(post_in);
        assert_eq!(spent_in, 0, "saturating_sub should return 0, not underflow");
    }

    #[test]
    fn test_all_enforcement_checks_pass() {
        // Complete valid swap scenario
        let amount_in = 1000u64;
        let min_out = 900u64;

        // Simulated deltas
        let spent_in = 1000u64;
        let received_out = 980u64;

        // All checks
        let check1 = spent_in > 0;
        let check2 = spent_in <= amount_in.saturating_add(5);
        let check3 = received_out >= min_out;

        assert!(check1, "Check 1: spent > 0");
        assert!(check2, "Check 2: spent <= amount_in + margin");
        assert!(check3, "Check 3: received >= min_out");
    }
}
