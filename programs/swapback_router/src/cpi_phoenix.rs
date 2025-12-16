use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::program_pack::Pack;
use anchor_spl::token::spl_token::state::Account as SplAccount;

use crate::{ErrorCode, SwapToC, PHOENIX_PROGRAM_ID};

/// Phoenix swap discriminator
///
/// Phoenix v1 encodes instructions as a u8 discriminator. For Swap, this is 0.
/// (Matches phoenix-sdk `swapInstructionDiscriminator`.)
const SWAP_INSTRUCTION_DISCRIMINATOR: u8 = 0;

/// OrderPacket enum discriminators (matches phoenix-sdk `orderPacketBeet` ordering)
const ORDER_PACKET_IMMEDIATE_OR_CANCEL: u8 = 2;

/// coption tag values (metaplex beet)
const COPTION_NONE: u8 = 0;
const COPTION_SOME: u8 = 1;

/// Self-trade behavior (matches phoenix-sdk `SelfTradeBehavior`)
const SELF_TRADE_DECREMENT_TAKE: u8 = 2;

/// Phoenix default match limit (matches phoenix-sdk DEFAULT_MATCH_LIMIT)
const PHOENIX_DEFAULT_MATCH_LIMIT: u64 = 2048;

/// Account indices for Phoenix swap
const PHOENIX_PROGRAM_INDEX: usize = 0;
const LOG_AUTHORITY_INDEX: usize = 1;
const MARKET_INDEX: usize = 2;
const TRADER_INDEX: usize = 3;
const BASE_ACCOUNT_INDEX: usize = 4;
const QUOTE_ACCOUNT_INDEX: usize = 5;
const BASE_VAULT_INDEX: usize = 6;
const QUOTE_VAULT_INDEX: usize = 7;
const TOKEN_PROGRAM_INDEX: usize = 8;

/// Minimum accounts for Phoenix swap (matches phoenix-sdk createSwapInstruction keys)
pub const PHOENIX_SWAP_ACCOUNT_COUNT: usize = 9;

/// Phoenix side
#[repr(u8)]
pub enum PhoenixSide {
    Bid = 0,  // Buy base with quote
    Ask = 1,  // Sell base for quote
}

/// Phoenix MarketHeader offsets (bytes) for values we need.
///
/// Layout is defined in phoenix-sdk `MarketHeader` beet struct:
/// [discriminant:u64][status:u64][marketSizeParams:3*u64][baseParams:72][baseLotSize:u64][quoteParams:72][quoteLotSize:u64]...
const PHOENIX_BASE_LOT_SIZE_OFFSET: usize = 112;
const PHOENIX_QUOTE_LOT_SIZE_OFFSET: usize = 192;
const PHOENIX_REQUIRED_HEADER_LEN: usize = PHOENIX_QUOTE_LOT_SIZE_OFFSET + 8;

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

    // Basic account sanity checks to catch ordering mistakes early.
    let phoenix_program = &account_slice[PHOENIX_PROGRAM_INDEX];
    if phoenix_program.key() != PHOENIX_PROGRAM_ID {
        msg!("Phoenix: program account mismatch");
        return err!(ErrorCode::DexExecutionFailed);
    }

    let token_program = &account_slice[TOKEN_PROGRAM_INDEX];
    if token_program.key() != anchor_spl::token::ID {
        msg!("Phoenix: token program mismatch");
        return err!(ErrorCode::DexExecutionFailed);
    }

    let base_account = &account_slice[BASE_ACCOUNT_INDEX];
    let quote_account = &account_slice[QUOTE_ACCOUNT_INDEX];

    // Verify token accounts
    let user_token_a_key = ctx.accounts.user_token_account_a.key();
    let user_token_b_key = ctx.accounts.user_token_account_b.key();

    // Determine side from router token accounts:
    // - user_token_account_a = input token account
    // - user_token_account_b = output token account
    // Phoenix Swap expects baseAccount and quoteAccount (ATAs for market base/quote mints).
    // Bid: input is quote, output is base
    // Ask: input is base, output is quote
    let (side, _source_account, destination_account) = if quote_account.key() == user_token_a_key
        && base_account.key() == user_token_b_key
    {
        (PhoenixSide::Bid, quote_account, base_account)
    } else if base_account.key() == user_token_a_key && quote_account.key() == user_token_b_key {
        (PhoenixSide::Ask, base_account, quote_account)
    } else {
        msg!("Phoenix: token account mismatch");
        return err!(ErrorCode::DexExecutionFailed);
    };

    // Parse lot sizes from market header to convert raw SPL amounts to Phoenix lots.
    let (base_lot_size, quote_lot_size) = read_market_lot_sizes(&account_slice[MARKET_INDEX])?;
    if base_lot_size == 0 || quote_lot_size == 0 {
        msg!("Phoenix: invalid lot sizes");
        return err!(ErrorCode::DexExecutionFailed);
    }

    let (num_base_lots, num_quote_lots, min_base_lots_to_fill, min_quote_lots_to_fill) = match side {
        PhoenixSide::Ask => {
            // Sell base for quote: in = base atoms, out = quote atoms
            let in_base_lots = amount_in.checked_div(base_lot_size).unwrap_or(0);
            let min_quote_lots = div_ceil(min_out, quote_lot_size)?;
            (in_base_lots, 0u64, 0u64, min_quote_lots)
        }
        PhoenixSide::Bid => {
            // Buy base with quote: in = quote atoms, out = base atoms
            let in_quote_lots = amount_in.checked_div(quote_lot_size).unwrap_or(0);
            let min_base_lots = div_ceil(min_out, base_lot_size)?;
            (0u64, in_quote_lots, min_base_lots, 0u64)
        }
    };

    if num_base_lots == 0 && num_quote_lots == 0 {
        msg!("Phoenix: amount_in too small for lot size");
        return err!(ErrorCode::DexExecutionFailed);
    }

    // Read pre-swap balance
    let pre_amount = read_token_amount(destination_account)?;

    // Build Phoenix Swap instruction args:
    // [u8 discriminator][OrderPacket enum]
    // OrderPacket::ImmediateOrCancel layout matches phoenix-sdk beet serialization.
    let mut data = Vec::with_capacity(1 + 1 + 64);
    data.push(SWAP_INSTRUCTION_DISCRIMINATOR);
    data.push(ORDER_PACKET_IMMEDIATE_OR_CANCEL);
    // ImmediateOrCancel fields
    data.push(side as u8);
    // priceInTicks: None (market)
    write_coption_u64(&mut data, None);
    // numBaseLots / numQuoteLots budgets
    data.extend_from_slice(&num_base_lots.to_le_bytes());
    data.extend_from_slice(&num_quote_lots.to_le_bytes());
    // minBaseLotsToFill / minQuoteLotsToFill
    data.extend_from_slice(&min_base_lots_to_fill.to_le_bytes());
    data.extend_from_slice(&min_quote_lots_to_fill.to_le_bytes());
    // selfTradeBehavior
    data.push(SELF_TRADE_DECREMENT_TAKE);
    // matchLimit: Some(DEFAULT_MATCH_LIMIT)
    write_coption_u64(&mut data, Some(PHOENIX_DEFAULT_MATCH_LIMIT));
    // clientOrderId
    data.extend_from_slice(&0u128.to_le_bytes());
    // useOnlyDepositedFunds: false
    data.push(0u8);
    // lastValidSlot: None
    write_coption_u64(&mut data, None);
    // lastValidUnixTimestampInSeconds: None
    write_coption_u64(&mut data, None);

    // Build account metas
    let account_metas: Vec<AccountMeta> = account_slice
        .iter()
        .enumerate()
        .map(|(i, info)| {
            let is_writable = matches!(i, 
                MARKET_INDEX | 
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

fn read_market_lot_sizes(market: &AccountInfo) -> Result<(u64, u64)> {
    let data = market
        .try_borrow_data()
        .map_err(|_| error!(ErrorCode::DexExecutionFailed))?;
    if data.len() < PHOENIX_REQUIRED_HEADER_LEN {
        msg!("Phoenix: market header too short");
        return err!(ErrorCode::DexExecutionFailed);
    }

    let base_lot_size = u64::from_le_bytes(
        data[PHOENIX_BASE_LOT_SIZE_OFFSET..PHOENIX_BASE_LOT_SIZE_OFFSET + 8]
            .try_into()
            .map_err(|_| error!(ErrorCode::DexExecutionFailed))?,
    );
    let quote_lot_size = u64::from_le_bytes(
        data[PHOENIX_QUOTE_LOT_SIZE_OFFSET..PHOENIX_QUOTE_LOT_SIZE_OFFSET + 8]
            .try_into()
            .map_err(|_| error!(ErrorCode::DexExecutionFailed))?,
    );

    Ok((base_lot_size, quote_lot_size))
}

fn div_ceil(n: u64, d: u64) -> Result<u64> {
    if d == 0 {
        return err!(ErrorCode::DexExecutionFailed);
    }
    Ok(n
        .checked_add(d - 1)
        .ok_or_else(|| error!(ErrorCode::DexExecutionFailed))?
        / d)
}

fn write_coption_u64(buf: &mut Vec<u8>, value: Option<u64>) {
    match value {
        None => buf.push(COPTION_NONE),
        Some(v) => {
            buf.push(COPTION_SOME);
            buf.extend_from_slice(&v.to_le_bytes());
        }
    }
}

fn read_token_amount(account: &AccountInfo) -> Result<u64> {
    let data = account
        .try_borrow_data()
        .map_err(|_| error!(ErrorCode::DexExecutionFailed))?;
    let token_account = SplAccount::unpack(&data)
        .map_err(|_| error!(ErrorCode::DexExecutionFailed))?;
    Ok(token_account.amount)
}
