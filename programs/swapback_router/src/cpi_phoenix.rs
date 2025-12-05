use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::program_pack::Pack;
use anchor_spl::token::spl_token::state::Account as SplAccount;

use crate::{ErrorCode, SwapToC, PHOENIX_PROGRAM_ID};

/// Phoenix swap discriminator (new order instruction)
const NEW_ORDER_DISCRIMINATOR: u8 = 0;

/// Account indices for Phoenix swap
const PHOENIX_PROGRAM_INDEX: usize = 0;
const LOG_AUTHORITY_INDEX: usize = 1;
const MARKET_INDEX: usize = 2;
const TRADER_INDEX: usize = 3;
const SEAT_INDEX: usize = 4;
const BASE_ACCOUNT_INDEX: usize = 5;
const QUOTE_ACCOUNT_INDEX: usize = 6;
const BASE_VAULT_INDEX: usize = 7;
const QUOTE_VAULT_INDEX: usize = 8;
const TOKEN_PROGRAM_INDEX: usize = 9;

/// Minimum accounts for Phoenix swap
pub const PHOENIX_SWAP_ACCOUNT_COUNT: usize = 10;

/// Phoenix order types
#[repr(u8)]
pub enum PhoenixOrderType {
    Limit = 0,
    ImmediateOrCancel = 1,  // IOC - what we use for swaps
    PostOnly = 2,
}

/// Phoenix side
#[repr(u8)]
pub enum PhoenixSide {
    Bid = 0,  // Buy base with quote
    Ask = 1,  // Sell base for quote
}

/// Execute a swap through Phoenix CLOB (Central Limit Order Book)
/// 
/// Phoenix is a fully on-chain order book DEX with:
/// - Sub-second finality
/// - No off-chain components
/// - Optimal for larger trades with minimal slippage
pub fn swap(
    ctx: &Context<SwapToC>,
    account_slice: &[AccountInfo],
    amount_in: u64,
    min_out: u64,
) -> Result<u64> {
    if account_slice.len() < PHOENIX_SWAP_ACCOUNT_COUNT {
        msg!("Phoenix: insufficient accounts, need {} got {}", 
             PHOENIX_SWAP_ACCOUNT_COUNT, account_slice.len());
        return err!(ErrorCode::DexExecutionFailed);
    }

    let trader = &account_slice[TRADER_INDEX];
    if !trader.is_signer {
        msg!("Phoenix: trader must be signer");
        return err!(ErrorCode::DexExecutionFailed);
    }

    if trader.key() != ctx.accounts.user.key() {
        msg!("Phoenix: trader mismatch");
        return err!(ErrorCode::DexExecutionFailed);
    }

    let base_account = &account_slice[BASE_ACCOUNT_INDEX];
    let quote_account = &account_slice[QUOTE_ACCOUNT_INDEX];

    // Verify token accounts
    let user_token_a_key = ctx.accounts.user_token_account_a.key();
    let user_token_b_key = ctx.accounts.user_token_account_b.key();

    // Determine if this is a bid (buy base) or ask (sell base)
    let (side, _source_account, destination_account) = 
        if base_account.key() == user_token_a_key && quote_account.key() == user_token_b_key {
            // Selling quote to get base = Bid
            (PhoenixSide::Bid, quote_account, base_account)
        } else if base_account.key() == user_token_b_key && quote_account.key() == user_token_a_key {
            // Selling base to get quote = Ask
            (PhoenixSide::Ask, base_account, quote_account)
        } else if quote_account.key() == user_token_a_key && base_account.key() == user_token_b_key {
            // Selling base for quote = Ask
            (PhoenixSide::Ask, base_account, quote_account)
        } else {
            msg!("Phoenix: token account mismatch");
            return err!(ErrorCode::DexExecutionFailed);
        };

    // Read pre-swap balance
    let pre_amount = read_token_amount(destination_account)?;

    // Build Phoenix new order instruction data
    // Phoenix uses a custom binary format for orders
    let mut data = Vec::with_capacity(32);
    data.push(NEW_ORDER_DISCRIMINATOR);
    
    // Order params (simplified IOC market order)
    data.push(PhoenixOrderType::ImmediateOrCancel as u8);
    data.push(side as u8);
    
    // Price in ticks (0 = market order for IOC)
    data.extend_from_slice(&0u64.to_le_bytes());
    
    // Size in base lots
    data.extend_from_slice(&amount_in.to_le_bytes());
    
    // Min output (slippage protection)
    data.extend_from_slice(&min_out.to_le_bytes());
    
    // Self trade behavior (decrement take)
    data.push(0u8);
    
    // Match limit (max matches)
    data.extend_from_slice(&u16::MAX.to_le_bytes());
    
    // Client order ID
    data.extend_from_slice(&0u128.to_le_bytes());
    
    // Use only deposited funds
    data.push(1u8);

    // Build account metas
    let account_metas: Vec<AccountMeta> = account_slice
        .iter()
        .enumerate()
        .map(|(i, info)| {
            let is_writable = matches!(i, 
                MARKET_INDEX | 
                SEAT_INDEX |
                BASE_ACCOUNT_INDEX | 
                QUOTE_ACCOUNT_INDEX |
                BASE_VAULT_INDEX |
                QUOTE_VAULT_INDEX
            );
            
            if is_writable {
                AccountMeta::new(*info.key, info.is_signer)
            } else {
                AccountMeta::new_readonly(*info.key, info.is_signer)
            }
        })
        .collect();

    let instruction = Instruction {
        program_id: PHOENIX_PROGRAM_ID,
        accounts: account_metas,
        data,
    };

    invoke(&instruction, account_slice)
        .map_err(|e| {
            msg!("Phoenix swap failed: {:?}", e);
            error!(ErrorCode::DexExecutionFailed)
        })?;

    // Verify output
    let post_amount = read_token_amount(destination_account)?;
    let amount_out = post_amount
        .checked_sub(pre_amount)
        .ok_or_else(|| error!(ErrorCode::DexExecutionFailed))?;

    if amount_out < min_out {
        msg!("Phoenix: slippage exceeded, got {} expected min {}", amount_out, min_out);
        return err!(ErrorCode::SlippageExceeded);
    }

    msg!("Phoenix swap success: {} in -> {} out", amount_in, amount_out);
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
