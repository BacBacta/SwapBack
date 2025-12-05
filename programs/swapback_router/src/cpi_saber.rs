use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::program_pack::Pack;
use anchor_spl::token::spl_token::state::Account as SplAccount;

use crate::{ErrorCode, SwapToC, SABER_PROGRAM_ID};

/// Saber swap discriminator
const SWAP_DISCRIMINATOR: u8 = 1; // Saber uses simple u8 discriminator

/// Account indices for Saber swap
const SWAP_INFO_INDEX: usize = 0;
const SWAP_AUTHORITY_INDEX: usize = 1;
const USER_AUTHORITY_INDEX: usize = 2;
const SOURCE_ACCOUNT_INDEX: usize = 3;
const SWAP_SOURCE_INDEX: usize = 4;
const SWAP_DESTINATION_INDEX: usize = 5;
const DESTINATION_ACCOUNT_INDEX: usize = 6;
const ADMIN_FEE_DESTINATION_INDEX: usize = 7;
const TOKEN_PROGRAM_INDEX: usize = 8;
const CLOCK_INDEX: usize = 9;

/// Minimum accounts for Saber swap
pub const SABER_SWAP_ACCOUNT_COUNT: usize = 10;

/// Common stablecoin mints for reference
pub const USDC_MINT: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
pub const USDT_MINT: &str = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
pub const PAI_MINT: &str = "Ea5SjE2Y6yvCeW5dYTn7PYMuW5ikXkvbGdcmSnXeaLjS";
pub const USH_MINT: &str = "9iLH8T7zoWhY7sBmj1WK9ENbWdS1nL8n9wAxaeRitTa6";

/// Execute a swap through Saber StableSwap
/// 
/// Saber is optimized for stablecoin swaps using the StableSwap invariant:
/// - Lower slippage for like-assets (stables, wrapped tokens)
/// - Constant product modified for stable pairs
/// - Popular for USDC/USDT, wrapped asset pairs
pub fn swap(
    ctx: &Context<SwapToC>,
    account_slice: &[AccountInfo],
    amount_in: u64,
    min_out: u64,
) -> Result<u64> {
    if account_slice.len() < SABER_SWAP_ACCOUNT_COUNT {
        msg!("Saber: insufficient accounts, need {} got {}", 
             SABER_SWAP_ACCOUNT_COUNT, account_slice.len());
        return err!(ErrorCode::DexExecutionFailed);
    }

    let user_authority = &account_slice[USER_AUTHORITY_INDEX];
    if !user_authority.is_signer {
        msg!("Saber: user authority must be signer");
        return err!(ErrorCode::DexExecutionFailed);
    }

    if user_authority.key() != ctx.accounts.user.key() {
        msg!("Saber: user authority mismatch");
        return err!(ErrorCode::DexExecutionFailed);
    }

    let source_account = &account_slice[SOURCE_ACCOUNT_INDEX];
    let destination_account = &account_slice[DESTINATION_ACCOUNT_INDEX];

    // Verify token accounts
    let user_token_a_key = ctx.accounts.user_token_account_a.key();
    let user_token_b_key = ctx.accounts.user_token_account_b.key();

    let dest_account = 
        if source_account.key() == user_token_a_key && 
           destination_account.key() == user_token_b_key {
            destination_account
        } else if source_account.key() == user_token_b_key && 
                  destination_account.key() == user_token_a_key {
            destination_account
        } else {
            msg!("Saber: token account mismatch");
            return err!(ErrorCode::DexExecutionFailed);
        };

    // Read pre-swap balance
    let pre_amount = read_token_amount(dest_account)?;

    // Build Saber swap instruction
    // Saber swap uses: discriminator (1 byte) + amount_in (8 bytes) + min_out (8 bytes)
    let mut data = Vec::with_capacity(1 + 8 + 8);
    data.push(SWAP_DISCRIMINATOR);
    data.extend_from_slice(&amount_in.to_le_bytes());
    data.extend_from_slice(&min_out.to_le_bytes());

    // Build account metas (Saber specific ordering)
    let account_metas = vec![
        AccountMeta::new_readonly(*account_slice[SWAP_INFO_INDEX].key, false),
        AccountMeta::new_readonly(*account_slice[SWAP_AUTHORITY_INDEX].key, false),
        AccountMeta::new_readonly(*account_slice[USER_AUTHORITY_INDEX].key, true),
        AccountMeta::new(*account_slice[SOURCE_ACCOUNT_INDEX].key, false),
        AccountMeta::new(*account_slice[SWAP_SOURCE_INDEX].key, false),
        AccountMeta::new(*account_slice[SWAP_DESTINATION_INDEX].key, false),
        AccountMeta::new(*account_slice[DESTINATION_ACCOUNT_INDEX].key, false),
        AccountMeta::new(*account_slice[ADMIN_FEE_DESTINATION_INDEX].key, false),
        AccountMeta::new_readonly(*account_slice[TOKEN_PROGRAM_INDEX].key, false),
        AccountMeta::new_readonly(*account_slice[CLOCK_INDEX].key, false),
    ];

    let instruction = Instruction {
        program_id: SABER_PROGRAM_ID,
        accounts: account_metas,
        data,
    };

    invoke(&instruction, account_slice)
        .map_err(|e| {
            msg!("Saber swap failed: {:?}", e);
            error!(ErrorCode::DexExecutionFailed)
        })?;

    // Verify output
    let post_amount = read_token_amount(dest_account)?;
    let amount_out = post_amount
        .checked_sub(pre_amount)
        .ok_or_else(|| error!(ErrorCode::DexExecutionFailed))?;

    if amount_out < min_out {
        msg!("Saber: slippage exceeded, got {} expected min {}", amount_out, min_out);
        return err!(ErrorCode::SlippageExceeded);
    }

    msg!("Saber stableswap success: {} in -> {} out", amount_in, amount_out);
    Ok(amount_out)
}

/// Check if pair is a stable pair (both are stablecoins)
pub fn is_stable_pair(mint_a: &Pubkey, mint_b: &Pubkey) -> bool {
    let stables = [USDC_MINT, USDT_MINT, PAI_MINT, USH_MINT];
    let mint_a_str = mint_a.to_string();
    let mint_b_str = mint_b.to_string();
    
    stables.iter().any(|&s| s == mint_a_str) && 
    stables.iter().any(|&s| s == mint_b_str)
}

fn read_token_amount(account: &AccountInfo) -> Result<u64> {
    let data = account
        .try_borrow_data()
        .map_err(|_| error!(ErrorCode::DexExecutionFailed))?;
    let token_account = SplAccount::unpack(&data)
        .map_err(|_| error!(ErrorCode::DexExecutionFailed))?;
    Ok(token_account.amount)
}
