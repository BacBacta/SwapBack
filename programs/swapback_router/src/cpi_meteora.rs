use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::program_pack::Pack;
use anchor_spl::token::spl_token::state::Account as SplAccount;

use crate::{ErrorCode, SwapToC, METEORA_DLMM_PROGRAM_ID};

/// Meteora DLMM swap discriminator (from Meteora IDL)
const SWAP_DISCRIMINATOR: [u8; 8] = [248, 198, 158, 145, 225, 117, 135, 200];

/// Account indices for Meteora DLMM swap
const LB_PAIR_INDEX: usize = 0;
const BIN_ARRAY_BITMAP_EXTENSION_INDEX: usize = 1;
const RESERVE_X_INDEX: usize = 2;
const RESERVE_Y_INDEX: usize = 3;
const USER_TOKEN_X_INDEX: usize = 4;
const USER_TOKEN_Y_INDEX: usize = 5;
const TOKEN_X_MINT_INDEX: usize = 6;
const TOKEN_Y_MINT_INDEX: usize = 7;
const ORACLE_INDEX: usize = 8;
const HOST_FEE_INDEX: usize = 9;
const USER_INDEX: usize = 10;
const TOKEN_X_PROGRAM_INDEX: usize = 11;
const TOKEN_Y_PROGRAM_INDEX: usize = 12;
const EVENT_AUTHORITY_INDEX: usize = 13;
const PROGRAM_INDEX: usize = 14;

/// Minimum accounts required for Meteora DLMM swap
pub const METEORA_SWAP_ACCOUNT_COUNT: usize = 15;

/// Additional bin array accounts (dynamic based on price range)
pub const MAX_BIN_ARRAYS: usize = 5;

/// Execute a swap through Meteora DLMM (Dynamic Liquidity Market Maker)
/// 
/// Meteora DLMM uses a bin-based liquidity model for better capital efficiency
/// Similar to Trader Joe's Liquidity Book on Avalanche
pub fn swap(
    ctx: &Context<SwapToC>,
    account_slice: &[AccountInfo],
    amount_in: u64,
    min_out: u64,
) -> Result<u64> {
    if account_slice.len() < METEORA_SWAP_ACCOUNT_COUNT {
        msg!("Meteora DLMM: insufficient accounts, need {} got {}", 
             METEORA_SWAP_ACCOUNT_COUNT, account_slice.len());
        return err!(ErrorCode::DexExecutionFailed);
    }

    let user = &account_slice[USER_INDEX];
    if !user.is_signer {
        msg!("Meteora DLMM: user must be signer");
        return err!(ErrorCode::DexExecutionFailed);
    }

    if user.key() != ctx.accounts.user.key() {
        msg!("Meteora DLMM: user mismatch");
        return err!(ErrorCode::DexExecutionFailed);
    }

    let user_token_x = &account_slice[USER_TOKEN_X_INDEX];
    let user_token_y = &account_slice[USER_TOKEN_Y_INDEX];

    // Verify user owns one of the token accounts
    let user_token_a_key = ctx.accounts.user_token_account_a.key();
    let user_token_b_key = ctx.accounts.user_token_account_b.key();

    let (x_to_y, _source_account, destination_account) = 
        if user_token_x.key() == user_token_a_key && user_token_y.key() == user_token_b_key {
            (true, user_token_x, user_token_y)
        } else if user_token_x.key() == user_token_b_key && user_token_y.key() == user_token_a_key {
            (false, user_token_y, user_token_x)
        } else {
            msg!("Meteora DLMM: token account mismatch");
            return err!(ErrorCode::DexExecutionFailed);
        };

    // Read pre-swap balance
    let pre_amount = read_token_amount(destination_account)?;

    // Build swap instruction data
    // Meteora DLMM swap params: amount_in, min_out, x_to_y
    let mut data = Vec::with_capacity(8 + 8 + 8 + 1);
    data.extend_from_slice(&SWAP_DISCRIMINATOR);
    data.extend_from_slice(&amount_in.to_le_bytes());
    data.extend_from_slice(&min_out.to_le_bytes());
    data.push(if x_to_y { 1u8 } else { 0u8 });

    // Build account metas
    let account_metas: Vec<AccountMeta> = account_slice
        .iter()
        .map(|info| {
            if info.is_writable {
                AccountMeta::new(*info.key, info.is_signer)
            } else {
                AccountMeta::new_readonly(*info.key, info.is_signer)
            }
        })
        .collect();

    let instruction = Instruction {
        program_id: METEORA_DLMM_PROGRAM_ID,
        accounts: account_metas,
        data,
    };

    invoke(&instruction, account_slice)
        .map_err(|e| {
            msg!("Meteora DLMM swap failed: {:?}", e);
            error!(ErrorCode::DexExecutionFailed)
        })?;

    // Verify output
    let post_amount = read_token_amount(destination_account)?;
    let amount_out = post_amount
        .checked_sub(pre_amount)
        .ok_or_else(|| error!(ErrorCode::DexExecutionFailed))?;

    if amount_out < min_out {
        msg!("Meteora DLMM: slippage exceeded, got {} expected min {}", amount_out, min_out);
        return err!(ErrorCode::SlippageExceeded);
    }

    msg!("Meteora DLMM swap success: {} in -> {} out", amount_in, amount_out);
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
