use anchor_lang::prelude::*;

use crate::{ErrorCode, OracleType, MAX_STALENESS_SECS};

use core::convert::TryFrom;
#[cfg(feature = "switchboard")]
use core::convert::TryInto;
#[cfg(feature = "switchboard")]
use switchboard_solana::AggregatorAccountData;

pub struct OracleObservation {
    pub price: u64,
    pub confidence: u64,
    pub publish_time: i64,
    pub slot: u64,
    pub oracle_type: OracleType,
}

const MAX_CONFIDENCE_BPS: u128 = 200;

pub fn read_price(oracle_account: &AccountInfo, clock: &Clock) -> Result<OracleObservation> {
    if oracle_account.key() == Pubkey::default() {
        return err!(ErrorCode::InvalidOraclePrice);
    }

    let price_data = oracle_account
        .try_borrow_data()
        .map_err(|_| error!(ErrorCode::InvalidOraclePrice))?;
    let price_account = pyth_sdk_solana::state::load_price_account::<32, ()>(&price_data)
        .map_err(|_| error!(ErrorCode::InvalidOraclePrice))?;
    let price_key = oracle_account.key();
    let price_feed = price_account.to_price_feed(&price_key);
    drop(price_data);

    if let Some(price) =
        price_feed.get_price_no_older_than(clock.unix_timestamp, MAX_STALENESS_SECS as u64)
    {
        let staleness = clock.unix_timestamp - price.publish_time;
        if staleness > MAX_STALENESS_SECS {
            return err!(ErrorCode::StaleOracleData);
        }

        let price_scaled = normalize_decimal(price.price as i128, price.expo)
            .ok_or_else(|| error!(ErrorCode::InvalidOraclePrice))?;
        if price_scaled == 0 {
            return err!(ErrorCode::InvalidOraclePrice);
        }

        let confidence_scaled = normalize_decimal(price.conf as i128, price.expo)
            .ok_or_else(|| error!(ErrorCode::InvalidOraclePrice))?;

        let confidence_bps = confidence_scaled
            .checked_mul(10_000)
            .and_then(|value| value.checked_div(price_scaled))
            .ok_or_else(|| error!(ErrorCode::InvalidOraclePrice))?;

        if confidence_bps > MAX_CONFIDENCE_BPS {
            return err!(ErrorCode::InvalidOraclePrice);
        }

        let normalized_price =
            u64::try_from(price_scaled).map_err(|_| error!(ErrorCode::InvalidOraclePrice))?;
        let normalized_confidence =
            u64::try_from(confidence_scaled).map_err(|_| error!(ErrorCode::InvalidOraclePrice))?;

        return Ok(OracleObservation {
            price: normalized_price,
            confidence: normalized_confidence,
            publish_time: price.publish_time,
            slot: clock.slot,
            oracle_type: OracleType::Pyth,
        });
    }

    #[cfg(feature = "switchboard")]
    {
        if let Ok(aggregator) = AggregatorAccountData::new(oracle_account) {
            let round = &aggregator.latest_confirmed_round;
            let timestamp = round.round_open_timestamp;
            if clock.unix_timestamp - timestamp > MAX_STALENESS_SECS {
                return err!(ErrorCode::StaleOracleData);
            }

            if let Some(result) = aggregator.get_result() {
                if let Ok(value) = TryInto::<f64>::try_into(result) {
                    if value.is_sign_negative() || value == 0.0 {
                        return err!(ErrorCode::InvalidOraclePrice);
                    }

                    let price_scaled = (value * 100_000_000_f64) as u64;
                    return Ok(OracleObservation {
                        price: price_scaled,
                        confidence: 0,
                        publish_time: timestamp,
                        slot: clock.slot,
                        oracle_type: OracleType::Switchboard,
                    });
                }
            }
        }
    }

    err!(ErrorCode::InvalidOraclePrice)
}

fn normalize_decimal(value: i128, expo: i32) -> Option<u128> {
    let target_exponent = -8;
    let exponent_diff = target_exponent - expo;
    let mut scaled = value;

    if exponent_diff >= 0 {
        scaled = scaled.checked_mul(pow10_i128(exponent_diff as u32)?)?;
    } else {
        scaled = scaled.checked_div(pow10_i128((-exponent_diff) as u32)?)?;
    }

    if scaled < 0 {
        None
    } else {
        Some(scaled as u128)
    }
}

fn pow10_i128(exp: u32) -> Option<i128> {
    let mut value: i128 = 1;
    for _ in 0..exp {
        value = value.checked_mul(10)?;
    }
    Some(value)
}
