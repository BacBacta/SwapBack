use anchor_lang::prelude::*;

use crate::{ErrorCode, OracleType, MAX_STALENESS_SECS};

#[cfg(feature = "switchboard")]
use switchboard_solana::AggregatorAccountData;

#[derive(Clone, Copy)]
pub struct OracleObservation {
    pub price: u64,
    pub confidence: u64,
    pub publish_time: i64,
    pub slot: u64,
    pub oracle_type: OracleType,
    pub feed: Pubkey,
}

// Confidence maximale autorisée (2% = 200 bps) - Pyth seulement
#[allow(dead_code)]
const MAX_CONFIDENCE_BPS: u128 = 200;

pub fn read_price(oracle_account: &AccountInfo, clock: &Clock) -> Result<OracleObservation> {
    if oracle_account.key() == Pubkey::default() {
        return err!(ErrorCode::InvalidOraclePrice);
    }

    // Switchboard Oracle (ACTIVÉ - Compatible Solana 1.18)
    #[cfg(feature = "switchboard")]
    {
        // Tentative de lecture comme compte Switchboard
        // On utilise un scope pour le borrow de data
        let is_switchboard = {
            if let Ok(data) = oracle_account.try_borrow_data() {
                AggregatorAccountData::new_from_bytes(&data).is_ok()
            } else {
                false
            }
        };

        if is_switchboard {
            let data = oracle_account
                .try_borrow_data()
                .map_err(|_| error!(ErrorCode::InvalidOraclePrice))?;

            let aggregator = AggregatorAccountData::new_from_bytes(&data)
                .map_err(|_| error!(ErrorCode::InvalidOraclePrice))?;

            let round = &aggregator.latest_confirmed_round;
            let timestamp = round.round_open_timestamp;

            // Vérifier staleness
            if clock.unix_timestamp - timestamp > MAX_STALENESS_SECS {
                msg!(
                    "⚠️ Switchboard data too old: {} seconds",
                    clock.unix_timestamp - timestamp
                );
                return err!(ErrorCode::StaleOracleData);
            }

            // get_result() retourne Result<SwitchboardDecimal, Error> dans v0.30.4
            match aggregator.get_result() {
                Ok(result) => {
                    // Convertir SwitchboardDecimal en f64
                    let value: f64 = result
                        .try_into()
                        .map_err(|_| error!(ErrorCode::InvalidOraclePrice))?;

                    if value.is_sign_negative() || value == 0.0 {
                        msg!("❌ Invalid Switchboard price: {}", value);
                        return err!(ErrorCode::InvalidOraclePrice);
                    }

                    // Convertir en format 8 décimales (prix * 10^8)
                    let price_scaled = (value * 100_000_000_f64) as u64;

                    msg!(
                        "✅ Switchboard price read: ${} ({} lamports)",
                        value,
                        price_scaled
                    );

                    return Ok(OracleObservation {
                        price: price_scaled,
                        confidence: 0, // Switchboard n'expose pas confidence directement
                        publish_time: timestamp,
                        slot: clock.slot,
                        oracle_type: OracleType::Switchboard,
                        feed: oracle_account.key(),
                    });
                }
                Err(e) => {
                    msg!("❌ Switchboard get_result error: {:?}", e);
                    return err!(ErrorCode::InvalidOraclePrice);
                }
            }
        }
    }

    // Fallback: Pyth SDK (DÉSACTIVÉ - Conflit versions)
    // TODO: Réactiver avec version compatible Solana 1.18
    
    // Pyth SDK Implementation
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
            feed: oracle_account.key(),
        });
    }

    msg!("❌ Oracle price not found (Pyth/Switchboard)");
    return err!(ErrorCode::InvalidOraclePrice);
}

// Fonctions utilitaires pour Pyth (conservées pour future réactivation)
#[allow(dead_code)]
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

#[allow(dead_code)]
fn pow10_i128(exp: u32) -> Option<i128> {
    let mut value: i128 = 1;
    for _ in 0..exp {
        value = value.checked_mul(10)?;
    }
    Some(value)
}
