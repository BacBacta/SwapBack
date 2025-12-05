use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::program_pack::Pack;
use anchor_spl::token::spl_token::state::Account as SplAccount;

use crate::{ErrorCode, SwapToC, LIFINITY_PROGRAM_ID};

/// Lifinity swap discriminator
const SWAP_DISCRIMINATOR: [u8; 8] = [248, 198, 158, 145, 225, 117, 135, 200];

/// Account indices for Lifinity swap (v2)
const AMM_INDEX: usize = 0;
const AUTHORITY_INDEX: usize = 1;
const USER_TRANSFER_AUTHORITY_INDEX: usize = 2;
const SOURCE_INFO_INDEX: usize = 3;
const DESTINATION_INFO_INDEX: usize = 4;
const SWAP_SOURCE_INDEX: usize = 5;
const SWAP_DESTINATION_INDEX: usize = 6;
const POOL_MINT_INDEX: usize = 7;
const FEE_ACCOUNT_INDEX: usize = 8;
const TOKEN_PROGRAM_INDEX: usize = 9;
const ORACLE_MAIN_ACCOUNT_INDEX: usize = 10;
const ORACLE_SUB_ACCOUNT_INDEX: usize = 11;
const ORACLE_PC_ACCOUNT_INDEX: usize = 12;

/// Minimum accounts for Lifinity swap
pub const LIFINITY_SWAP_ACCOUNT_COUNT: usize = 13;

/// Execute a swap through Lifinity AMM
/// 
/// Lifinity uses Pyth oracles for pricing, providing:
/// - Lower slippage through oracle-based pricing
/// - MEV protection via fair pricing
/// - Concentrated liquidity without manual rebalancing
pub fn swap(
    ctx: &Context<SwapToC>,
    account_slice: &[AccountInfo],
    amount_in: u64,
    min_out: u64,
) -> Result<u64> {
    if account_slice.len() < LIFINITY_SWAP_ACCOUNT_COUNT {
        msg!("Lifinity: insufficient accounts, need {} got {}", 
             LIFINITY_SWAP_ACCOUNT_COUNT, account_slice.len());
        return err!(ErrorCode::DexExecutionFailed);
    }

    let user_authority = &account_slice[USER_TRANSFER_AUTHORITY_INDEX];
    if !user_authority.is_signer {
        msg!("Lifinity: user authority must be signer");
        return err!(ErrorCode::DexExecutionFailed);
    }

    if user_authority.key() != ctx.accounts.user.key() {
        msg!("Lifinity: user authority mismatch");
        return err!(ErrorCode::DexExecutionFailed);
    }

    let source_info = &account_slice[SOURCE_INFO_INDEX];
    let destination_info = &account_slice[DESTINATION_INFO_INDEX];

    // Verify token accounts
    let user_token_a_key = ctx.accounts.user_token_account_a.key();
    let user_token_b_key = ctx.accounts.user_token_account_b.key();

    // Determine swap direction
    let destination_account = 
        if source_info.key() == user_token_a_key && destination_info.key() == user_token_b_key {
            destination_info
        } else if source_info.key() == user_token_b_key && destination_info.key() == user_token_a_key {
            destination_info
        } else {
            msg!("Lifinity: token account mismatch");
            return err!(ErrorCode::DexExecutionFailed);
        };

    // Read pre-swap balance
    let pre_amount = read_token_amount(destination_account)?;

    // Build Lifinity swap instruction
    // Lifinity swap params: amount_in, minimum_amount_out
    let mut data = Vec::with_capacity(8 + 8 + 8);
    data.extend_from_slice(&SWAP_DISCRIMINATOR);
    data.extend_from_slice(&amount_in.to_le_bytes());
    data.extend_from_slice(&min_out.to_le_bytes());

    // Build account metas
    let account_metas: Vec<AccountMeta> = account_slice
        .iter()
        .enumerate()
        .map(|(i, info)| {
            let is_writable = matches!(i, 
                AMM_INDEX |
                SOURCE_INFO_INDEX | 
                DESTINATION_INFO_INDEX |
                SWAP_SOURCE_INDEX |
                SWAP_DESTINATION_INDEX |
                POOL_MINT_INDEX |
                FEE_ACCOUNT_INDEX
            );
            
            if is_writable {
                AccountMeta::new(*info.key, info.is_signer)
            } else {
                AccountMeta::new_readonly(*info.key, info.is_signer)
            }
        })
        .collect();

    let instruction = Instruction {
        program_id: LIFINITY_PROGRAM_ID,
        accounts: account_metas,
        data,
    };

    invoke(&instruction, account_slice)
        .map_err(|e| {
            msg!("Lifinity swap failed: {:?}", e);
            error!(ErrorCode::DexExecutionFailed)
        })?;

    // Verify output
    let post_amount = read_token_amount(destination_account)?;
    let amount_out = post_amount
        .checked_sub(pre_amount)
        .ok_or_else(|| error!(ErrorCode::DexExecutionFailed))?;

    if amount_out < min_out {
        msg!("Lifinity: slippage exceeded, got {} expected min {}", amount_out, min_out);
        return err!(ErrorCode::SlippageExceeded);
    }

    msg!("Lifinity swap success: {} in -> {} out", amount_in, amount_out);
    Ok(amount_out)
}

fn read_token_amount(account: &AccountInfo) -> Result<u64> {
    let data = account
        .try_borrow_data()
        .map_err(|_| error!(ErrorCode::DexExecutionFailed))?;
    let token_account = SplAccount::unpack(&data)
        .map_err(|_| error!(ErrorCode::DexExecutionFailed))?;
    Ok(token_account.amount)
}
