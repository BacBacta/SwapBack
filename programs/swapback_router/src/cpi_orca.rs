use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::program_pack::Pack;
use anchor_spl::token::spl_token::state::Account as SplAccount;

use crate::{ErrorCode, SwapToC, ORCA_WHIRLPOOL_PROGRAM_ID};

pub const ORCA_SWAP_ACCOUNT_COUNT: usize = 11;
const SWAP_DISCRIMINATOR: [u8; 8] = [248, 198, 158, 145, 225, 117, 135, 200];
const MIN_SQRT_PRICE: u128 = 4_295_048_016; // Aligns with Whirlpool min price + 1
const MAX_SQRT_PRICE: u128 = 79_226_673_515_401_279_992_447_579_055; // Whirlpool max price - 1

pub fn swap(
    ctx: &Context<SwapToC>,
    account_slice: &[AccountInfo],
    amount_in: u64,
    min_out: u64,
) -> Result<u64> {
    let user_token_a = ctx.accounts.user_token_account_a.key();
    let user_token_b = ctx.accounts.user_token_account_b.key();
    if account_slice.len() < ORCA_SWAP_ACCOUNT_COUNT {
        return err!(ErrorCode::DexExecutionFailed);
    }

    let token_owner_a = &account_slice[3];
    let token_owner_b = &account_slice[5];

    let (a_to_b, destination_account) = if token_owner_a.key() == user_token_a {
        (true, token_owner_b)
    } else if token_owner_b.key() == user_token_a {
        (false, token_owner_a)
    } else if token_owner_a.key() == user_token_b {
        (false, token_owner_b)
    } else if token_owner_b.key() == user_token_b {
        (true, token_owner_a)
    } else {
        return err!(ErrorCode::DexExecutionFailed);
    };

    let expected_destination = if a_to_b { user_token_b } else { user_token_a };

    if destination_account.key() != expected_destination {
        return err!(ErrorCode::DexExecutionFailed);
    }

    let pre_amount = read_token_amount(destination_account)?;

    let sqrt_price_limit = if a_to_b {
        MIN_SQRT_PRICE
    } else {
        MAX_SQRT_PRICE
    };

    let mut data = Vec::with_capacity(8 + 8 + 8 + 16 + 2);
    data.extend_from_slice(&SWAP_DISCRIMINATOR);
    data.extend_from_slice(&amount_in.to_le_bytes());
    data.extend_from_slice(&min_out.to_le_bytes());
    data.extend_from_slice(&sqrt_price_limit.to_le_bytes());
    data.push(1u8); // amount_specified_is_input
    data.push(if a_to_b { 1u8 } else { 0u8 });

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

    let accounts: Vec<AccountInfo> = account_slice.to_vec();

    let instruction = Instruction {
        program_id: ORCA_WHIRLPOOL_PROGRAM_ID,
        accounts: account_metas,
        data,
    };

    invoke(&instruction, &accounts).map_err(|_| error!(ErrorCode::DexExecutionFailed))?;

    let post_amount = read_token_amount(destination_account)?;
    let amount_out = post_amount
        .checked_sub(pre_amount)
        .ok_or_else(|| error!(ErrorCode::DexExecutionFailed))?;

    if amount_out < min_out {
        return err!(ErrorCode::SlippageExceeded);
    }

    Ok(amount_out)
}

fn read_token_amount(account: &AccountInfo) -> Result<u64> {
    let data = account
        .try_borrow_data()
        .map_err(|_| error!(ErrorCode::DexExecutionFailed))?;
    let token_account =
        SplAccount::unpack(&data).map_err(|_| error!(ErrorCode::DexExecutionFailed))?;
    Ok(token_account.amount)
}
