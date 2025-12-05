use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::program_pack::Pack;
use anchor_spl::token::spl_token::state::Account as SplAccount;

use crate::{ErrorCode, SwapToC, RAYDIUM_CLMM_PROGRAM_ID};

/// Raydium CLMM (Concentrated Liquidity) swap discriminator
const SWAP_DISCRIMINATOR: [u8; 8] = [43, 4, 237, 11, 26, 201, 30, 98];

/// Account indices for Raydium CLMM swap
const PAYER_INDEX: usize = 0;
const AMM_CONFIG_INDEX: usize = 1;
const POOL_STATE_INDEX: usize = 2;
const INPUT_TOKEN_ACCOUNT_INDEX: usize = 3;
const OUTPUT_TOKEN_ACCOUNT_INDEX: usize = 4;
const INPUT_VAULT_INDEX: usize = 5;
const OUTPUT_VAULT_INDEX: usize = 6;
const OBSERVATION_STATE_INDEX: usize = 7;
const TOKEN_PROGRAM_INDEX: usize = 8;
const TICK_ARRAY_0_INDEX: usize = 9;
const TICK_ARRAY_1_INDEX: usize = 10;
const TICK_ARRAY_2_INDEX: usize = 11;

/// Minimum accounts for Raydium CLMM swap (without extra tick arrays)
pub const RAYDIUM_CLMM_SWAP_ACCOUNT_COUNT: usize = 12;

/// Sqrt price limits for directional swaps
const MIN_SQRT_PRICE_X64: u128 = 4_295_048_016u128 << 32; // Minimum price
const MAX_SQRT_PRICE_X64: u128 = 79_226_673_515_401_279_992_447_579_055u128; // Maximum price

/// Execute a swap through Raydium CLMM (Concentrated Liquidity Market Maker)
/// 
/// CLMM provides better capital efficiency by allowing LPs to concentrate
/// liquidity in specific price ranges, similar to Uniswap V3
pub fn swap(
    ctx: &Context<SwapToC>,
    account_slice: &[AccountInfo],
    amount_in: u64,
    min_out: u64,
) -> Result<u64> {
    if account_slice.len() < RAYDIUM_CLMM_SWAP_ACCOUNT_COUNT {
        msg!("Raydium CLMM: insufficient accounts, need {} got {}", 
             RAYDIUM_CLMM_SWAP_ACCOUNT_COUNT, account_slice.len());
        return err!(ErrorCode::DexExecutionFailed);
    }

    let payer = &account_slice[PAYER_INDEX];
    if !payer.is_signer {
        msg!("Raydium CLMM: payer must be signer");
        return err!(ErrorCode::DexExecutionFailed);
    }

    if payer.key() != ctx.accounts.user.key() {
        msg!("Raydium CLMM: payer mismatch");
        return err!(ErrorCode::DexExecutionFailed);
    }

    let input_token_account = &account_slice[INPUT_TOKEN_ACCOUNT_INDEX];
    let output_token_account = &account_slice[OUTPUT_TOKEN_ACCOUNT_INDEX];

    // Verify token accounts belong to user
    let user_token_a_key = ctx.accounts.user_token_account_a.key();
    let user_token_b_key = ctx.accounts.user_token_account_b.key();

    // Determine swap direction (a_to_b or b_to_a)
    let (zero_for_one, destination_account) = 
        if input_token_account.key() == user_token_a_key && output_token_account.key() == user_token_b_key {
            (true, output_token_account)
        } else if input_token_account.key() == user_token_b_key && output_token_account.key() == user_token_a_key {
            (false, output_token_account)
        } else {
            msg!("Raydium CLMM: token account mismatch");
            return err!(ErrorCode::DexExecutionFailed);
        };

    // Read pre-swap balance
    let pre_amount = read_token_amount(destination_account)?;

    // Calculate sqrt price limit based on direction
    let sqrt_price_limit_x64 = if zero_for_one {
        MIN_SQRT_PRICE_X64
    } else {
        MAX_SQRT_PRICE_X64
    };

    // Build swap instruction data
    // Raydium CLMM swap params:
    // - amount: u64 (input amount)
    // - other_amount_threshold: u64 (min output)
    // - sqrt_price_limit_x64: u128
    // - is_base_input: bool
    let mut data = Vec::with_capacity(8 + 8 + 8 + 16 + 1);
    data.extend_from_slice(&SWAP_DISCRIMINATOR);
    data.extend_from_slice(&amount_in.to_le_bytes());
    data.extend_from_slice(&min_out.to_le_bytes());
    data.extend_from_slice(&sqrt_price_limit_x64.to_le_bytes());
    data.push(1u8); // is_base_input = true (we specify input amount)

    // Build account metas
    let account_metas: Vec<AccountMeta> = account_slice
        .iter()
        .enumerate()
        .map(|(i, info)| {
            // Writable accounts: pool_state, token accounts, vaults, observation, tick arrays
            let is_writable = matches!(i, 
                POOL_STATE_INDEX | 
                INPUT_TOKEN_ACCOUNT_INDEX | 
                OUTPUT_TOKEN_ACCOUNT_INDEX |
                INPUT_VAULT_INDEX |
                OUTPUT_VAULT_INDEX |
                OBSERVATION_STATE_INDEX |
                TICK_ARRAY_0_INDEX |
                TICK_ARRAY_1_INDEX |
                TICK_ARRAY_2_INDEX
            ) || (i >= TICK_ARRAY_0_INDEX);
            
            if is_writable {
                AccountMeta::new(*info.key, info.is_signer)
            } else {
                AccountMeta::new_readonly(*info.key, info.is_signer)
            }
        })
        .collect();

    let instruction = Instruction {
        program_id: RAYDIUM_CLMM_PROGRAM_ID,
        accounts: account_metas,
        data,
    };

    invoke(&instruction, account_slice)
        .map_err(|e| {
            msg!("Raydium CLMM swap failed: {:?}", e);
            error!(ErrorCode::DexExecutionFailed)
        })?;

    // Verify output
    let post_amount = read_token_amount(destination_account)?;
    let amount_out = post_amount
        .checked_sub(pre_amount)
        .ok_or_else(|| error!(ErrorCode::DexExecutionFailed))?;

    if amount_out < min_out {
        msg!("Raydium CLMM: slippage exceeded, got {} expected min {}", amount_out, min_out);
        return err!(ErrorCode::SlippageExceeded);
    }

    msg!("Raydium CLMM swap success: {} in -> {} out", amount_in, amount_out);
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
