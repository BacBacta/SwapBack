use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::program_pack::Pack;
use anchor_spl::token::spl_token::state::Account as SplAccount;

use crate::{ErrorCode, SwapToC, SANCTUM_PROGRAM_ID};

/// Sanctum swap discriminator (SwapExactIn)
const SWAP_EXACT_IN_DISCRIMINATOR: [u8; 8] = [230, 42, 24, 71, 118, 158, 52, 137];

/// Account indices for Sanctum LST swap
const SWAP_AUTHORITY_INDEX: usize = 0;
const USER_INDEX: usize = 1;
const SOURCE_TOKEN_ACCOUNT_INDEX: usize = 2;
const DESTINATION_TOKEN_ACCOUNT_INDEX: usize = 3;
const SOURCE_LST_MINT_INDEX: usize = 4;
const DESTINATION_LST_MINT_INDEX: usize = 5;
const SOURCE_TOKEN_PROGRAM_INDEX: usize = 6;
const DESTINATION_TOKEN_PROGRAM_INDEX: usize = 7;
const INSTRUCTIONS_SYSVAR_INDEX: usize = 8;

/// Additional accounts for specific LST types
const LST_STATE_LIST_INDEX: usize = 9;
const POOL_STATE_INDEX: usize = 10;

/// Minimum accounts for Sanctum swap
pub const SANCTUM_SWAP_ACCOUNT_COUNT: usize = 11;

/// Supported LST tokens for native routing
pub const SUPPORTED_LSTS: [&str; 8] = [
    "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",  // mSOL (Marinade)
    "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", // jitoSOL
    "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1",  // bSOL (BlazeStake)
    "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj", // stSOL (Lido)
    "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm", // scnSOL (Socean)
    "LAinEtNLgpmCP9Rvsf5Hn8W6EhNiKLZQti1xfWMLy6X",  // laineSOL
    "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v",  // jupSOL
    "vSoLxydx6akxyMD9XEcPvGYNGq6Nn66oqVb3UkGkei7",  // vSOL
];

/// Execute a swap through Sanctum (LST aggregator/router)
/// 
/// Sanctum specializes in Liquid Staking Token swaps:
/// - Best rates for LST <-> LST swaps
/// - LST <-> SOL swaps
/// - Uses unified liquidity pool (Infinity Pool)
pub fn swap(
    ctx: &Context<SwapToC>,
    account_slice: &[AccountInfo],
    amount_in: u64,
    min_out: u64,
) -> Result<u64> {
    if account_slice.len() < SANCTUM_SWAP_ACCOUNT_COUNT {
        msg!("Sanctum: insufficient accounts, need {} got {}", 
             SANCTUM_SWAP_ACCOUNT_COUNT, account_slice.len());
        return err!(ErrorCode::DexExecutionFailed);
    }

    let user = &account_slice[USER_INDEX];
    if !user.is_signer {
        msg!("Sanctum: user must be signer");
        return err!(ErrorCode::DexExecutionFailed);
    }

    if user.key() != ctx.accounts.user.key() {
        msg!("Sanctum: user mismatch");
        return err!(ErrorCode::DexExecutionFailed);
    }

    let source_token_account = &account_slice[SOURCE_TOKEN_ACCOUNT_INDEX];
    let destination_token_account = &account_slice[DESTINATION_TOKEN_ACCOUNT_INDEX];

    // Verify token accounts belong to user
    let user_token_a_key = ctx.accounts.user_token_account_a.key();
    let user_token_b_key = ctx.accounts.user_token_account_b.key();

    let destination_account = 
        if source_token_account.key() == user_token_a_key && 
           destination_token_account.key() == user_token_b_key {
            destination_token_account
        } else if source_token_account.key() == user_token_b_key && 
                  destination_token_account.key() == user_token_a_key {
            destination_token_account
        } else {
            msg!("Sanctum: token account mismatch");
            return err!(ErrorCode::DexExecutionFailed);
        };

    // Verify we're dealing with LST tokens
    let _source_mint = &account_slice[SOURCE_LST_MINT_INDEX];
    let _dest_mint = &account_slice[DESTINATION_LST_MINT_INDEX];
    
    // Note: In production, verify mints are in SUPPORTED_LSTS
    // For now, we trust the accounts passed

    // Read pre-swap balance
    let pre_amount = read_token_amount(destination_account)?;

    // Build Sanctum SwapExactIn instruction
    // Params: amount_in, min_amount_out
    let mut data = Vec::with_capacity(8 + 8 + 8);
    data.extend_from_slice(&SWAP_EXACT_IN_DISCRIMINATOR);
    data.extend_from_slice(&amount_in.to_le_bytes());
    data.extend_from_slice(&min_out.to_le_bytes());

    // Build account metas
    let account_metas: Vec<AccountMeta> = account_slice
        .iter()
        .enumerate()
        .map(|(i, info)| {
            let is_writable = matches!(i, 
                SOURCE_TOKEN_ACCOUNT_INDEX | 
                DESTINATION_TOKEN_ACCOUNT_INDEX |
                POOL_STATE_INDEX
            );
            
            if is_writable {
                AccountMeta::new(*info.key, info.is_signer)
            } else {
                AccountMeta::new_readonly(*info.key, info.is_signer)
            }
        })
        .collect();

    let instruction = Instruction {
        program_id: SANCTUM_PROGRAM_ID,
        accounts: account_metas,
        data,
    };

    invoke(&instruction, account_slice)
        .map_err(|e| {
            msg!("Sanctum swap failed: {:?}", e);
            error!(ErrorCode::DexExecutionFailed)
        })?;

    // Verify output
    let post_amount = read_token_amount(destination_account)?;
    let amount_out = post_amount
        .checked_sub(pre_amount)
        .ok_or_else(|| error!(ErrorCode::DexExecutionFailed))?;

    if amount_out < min_out {
        msg!("Sanctum: slippage exceeded, got {} expected min {}", amount_out, min_out);
        return err!(ErrorCode::SlippageExceeded);
    }

    msg!("Sanctum LST swap success: {} in -> {} out", amount_in, amount_out);
    Ok(amount_out)
}

/// Check if a mint is a supported LST
pub fn is_supported_lst(mint: &Pubkey) -> bool {
    let mint_str = mint.to_string();
    SUPPORTED_LSTS.iter().any(|&lst| lst == mint_str)
}

fn read_token_amount(account: &AccountInfo) -> Result<u64> {
    let data = account
        .try_borrow_data()
        .map_err(|_| error!(ErrorCode::DexExecutionFailed))?;
    let token_account = SplAccount::unpack(&data)
        .map_err(|_| error!(ErrorCode::DexExecutionFailed))?;
    Ok(token_account.amount)
}
