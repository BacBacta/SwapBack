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

    let filtered_accounts: Vec<AccountInfo> = account_slice
        .iter()
        .filter(|account| account.key != &ACCOUNT_PADDING_SENTINEL)
        .cloned()
        .collect();

    require!(
        filtered_accounts.len() >= JUPITER_MIN_ACCOUNT_COUNT,
        ErrorCode::DexExecutionFailed
    );
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

    let metas: Vec<AccountMeta> = filtered_accounts
        .iter()
        .map(|info| AccountMeta {
            pubkey: *info.key,
            is_signer: info.is_signer,
            is_writable: info.is_writable,
        })
        .collect();

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

    // CPI: build metas from remaining accounts (Jupiter expects exact ordering)
    let metas: Vec<AccountMeta> = remaining_accounts
        .iter()
        .map(|ai| AccountMeta {
            pubkey: *ai.key,
            is_signer: ai.is_signer,
            is_writable: ai.is_writable,
        })
        .collect();

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
