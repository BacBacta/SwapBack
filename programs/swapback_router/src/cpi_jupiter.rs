use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program,
};
use anchor_spl::token::TokenAccount as SplTokenAccount;

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
