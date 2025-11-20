use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::program_pack::Pack;
use anchor_spl::token::spl_token::state::Account as SplAccount;

use crate::{ErrorCode, SwapToC, RAYDIUM_AMM_PROGRAM_ID};

const TOKEN_PROGRAM_INDEX: usize = 0;
const AMM_POOL_INDEX: usize = 1;
const AMM_AUTHORITY_INDEX: usize = 2;
const AMM_OPEN_ORDERS_INDEX: usize = 3;
const AMM_COIN_VAULT_INDEX: usize = 4;
const AMM_PC_VAULT_INDEX: usize = 5;
const MARKET_PROGRAM_INDEX: usize = 6;
const MARKET_INDEX: usize = 7;
const MARKET_BIDS_INDEX: usize = 8;
const MARKET_ASKS_INDEX: usize = 9;
const MARKET_EVENT_QUEUE_INDEX: usize = 10;
const MARKET_COIN_VAULT_INDEX: usize = 11;
const MARKET_PC_VAULT_INDEX: usize = 12;
const MARKET_VAULT_SIGNER_INDEX: usize = 13;
const USER_SOURCE_INDEX: usize = 14;
const USER_DESTINATION_INDEX: usize = 15;
const USER_OWNER_INDEX: usize = 16;

pub const RAYDIUM_SWAP_ACCOUNT_COUNT: usize = USER_OWNER_INDEX + 1;

pub fn swap(
    ctx: &Context<SwapToC>,
    account_slice: &[AccountInfo],
    amount_in: u64,
    min_out: u64,
) -> Result<u64> {
    if account_slice.len() < RAYDIUM_SWAP_ACCOUNT_COUNT {
        return err!(ErrorCode::DexExecutionFailed);
    }

    let token_program = &account_slice[TOKEN_PROGRAM_INDEX];
    if token_program.key != &anchor_spl::token::ID {
        return err!(ErrorCode::DexExecutionFailed);
    }

    let user_destination = &account_slice[USER_DESTINATION_INDEX];
    let user_source = &account_slice[USER_SOURCE_INDEX];
    let user_owner = &account_slice[USER_OWNER_INDEX];

    if !user_owner.is_signer {
        return err!(ErrorCode::DexExecutionFailed);
    }

    if user_owner.key() != ctx.accounts.user.key() {
        return err!(ErrorCode::DexExecutionFailed);
    }

    if user_source.key() != ctx.accounts.user_token_account_a.key()
        && user_source.key() != ctx.accounts.user_token_account_b.key()
    {
        return err!(ErrorCode::DexExecutionFailed);
    }

    if user_destination.key() != ctx.accounts.user_token_account_a.key()
        && user_destination.key() != ctx.accounts.user_token_account_b.key()
    {
        return err!(ErrorCode::DexExecutionFailed);
    }

    let source_mint = read_token_mint(user_source)?;
    let destination_pre_amount = read_token_amount(user_destination)?;

    let coin_vault_mint = read_token_mint(&account_slice[AMM_COIN_VAULT_INDEX])?;
    let pc_vault_mint = read_token_mint(&account_slice[AMM_PC_VAULT_INDEX])?;

    let base_in = if source_mint == coin_vault_mint {
        true
    } else if source_mint == pc_vault_mint {
        false
    } else {
        return err!(ErrorCode::DexExecutionFailed);
    };

    let instruction = build_raydium_swap_instruction(account_slice, amount_in, min_out, base_in);

    invoke(&instruction, account_slice).map_err(|_| error!(ErrorCode::DexExecutionFailed))?;

    let post_amount = read_token_amount(user_destination)?;
    let amount_out = post_amount
        .checked_sub(destination_pre_amount)
        .ok_or_else(|| error!(ErrorCode::DexExecutionFailed))?;

    if amount_out < min_out {
        return err!(ErrorCode::SlippageExceeded);
    }

    Ok(amount_out)
}

fn read_token_account(account: &AccountInfo) -> Result<SplAccount> {
    let data = account
        .try_borrow_data()
        .map_err(|_| error!(ErrorCode::DexExecutionFailed))?;
    let account_data =
        SplAccount::unpack(&data).map_err(|_| error!(ErrorCode::DexExecutionFailed))?;
    Ok(account_data)
}

fn read_token_amount(account: &AccountInfo) -> Result<u64> {
    Ok(read_token_account(account)?.amount)
}

fn read_token_mint(account: &AccountInfo) -> Result<Pubkey> {
    Ok(read_token_account(account)?.mint)
}

fn build_raydium_swap_instruction(
    account_slice: &[AccountInfo],
    amount_primary: u64,
    amount_secondary: u64,
    base_in: bool,
) -> Instruction {
    let mut data = Vec::with_capacity(1 + 8 + 8);
    data.push(if base_in { 9 } else { 11 });
    data.extend_from_slice(&amount_primary.to_le_bytes());
    data.extend_from_slice(&amount_secondary.to_le_bytes());

    let accounts = vec![
        AccountMeta::new_readonly(account_slice[TOKEN_PROGRAM_INDEX].key(), false),
        AccountMeta::new(account_slice[AMM_POOL_INDEX].key(), false),
        AccountMeta::new_readonly(account_slice[AMM_AUTHORITY_INDEX].key(), false),
        AccountMeta::new(account_slice[AMM_OPEN_ORDERS_INDEX].key(), false),
        AccountMeta::new(account_slice[AMM_COIN_VAULT_INDEX].key(), false),
        AccountMeta::new(account_slice[AMM_PC_VAULT_INDEX].key(), false),
        AccountMeta::new_readonly(account_slice[MARKET_PROGRAM_INDEX].key(), false),
        AccountMeta::new(account_slice[MARKET_INDEX].key(), false),
        AccountMeta::new(account_slice[MARKET_BIDS_INDEX].key(), false),
        AccountMeta::new(account_slice[MARKET_ASKS_INDEX].key(), false),
        AccountMeta::new(account_slice[MARKET_EVENT_QUEUE_INDEX].key(), false),
        AccountMeta::new(account_slice[MARKET_COIN_VAULT_INDEX].key(), false),
        AccountMeta::new(account_slice[MARKET_PC_VAULT_INDEX].key(), false),
        AccountMeta::new_readonly(account_slice[MARKET_VAULT_SIGNER_INDEX].key(), false),
        AccountMeta::new(account_slice[USER_SOURCE_INDEX].key(), false),
        AccountMeta::new(account_slice[USER_DESTINATION_INDEX].key(), false),
        AccountMeta::new_readonly(account_slice[USER_OWNER_INDEX].key(), true),
    ];

    Instruction {
        program_id: RAYDIUM_AMM_PROGRAM_ID,
        accounts,
        data,
    }
}
