//! Oracle Module - Wrapper pour oracle_v2
//! 
//! Ce module délègue maintenant vers oracle_v2.rs qui utilise Pyth V2.
//! Conservé pour compatibilité avec le code existant.

use anchor_lang::prelude::*;

use crate::{ErrorCode, OracleType};
use crate::oracle_v2;

#[cfg(feature = "switchboard")]
use switchboard_solana::AggregatorAccountData;

// Re-export OracleObservation depuis oracle_v2
pub use oracle_v2::OracleObservation;

// Confidence maximale autorisée (5% = 500 bps) - Pyth seulement
#[allow(dead_code)]
const MAX_CONFIDENCE_BPS: u128 = 500;

/// Read oracle price with configurable staleness threshold
/// For volatile markets, use lower values (30-60s)
/// Default: MAX_STALENESS_SECS (300s)
/// 
/// Cette fonction délègue maintenant vers oracle_v2 qui supporte Pyth V2
pub fn read_price_with_staleness(
    oracle_account: &AccountInfo,
    clock: &Clock,
    max_staleness_secs: i64,
) -> Result<OracleObservation> {
    if oracle_account.key() == Pubkey::default() {
        return err!(ErrorCode::InvalidOraclePrice);
    }

    // Strategy: Try Switchboard first, fallback to Pyth V2 if it fails
    // This ensures maximum availability across oracle providers

    // Primary: Switchboard Oracle (si feature activée)
    #[cfg(feature = "switchboard")]
    {
        match try_read_switchboard(oracle_account, clock, max_staleness_secs) {
            Ok(observation) => {
                msg!("✅ Switchboard oracle used (staleness limit: {}s)", max_staleness_secs);
                return Ok(observation);
            }
            Err(e) => {
                msg!("⚠️ Switchboard failed: {:?}, attempting Pyth V2 fallback", e);
            }
        }
    }

    // Fallback: Pyth V2 via oracle_v2 module
    oracle_v2::read_price_with_staleness(oracle_account, clock, max_staleness_secs)
}

#[cfg(feature = "switchboard")]
fn try_read_switchboard(
    oracle_account: &AccountInfo,
    clock: &Clock,
    max_staleness_secs: i64,
) -> Result<OracleObservation> {
    // Check if account is a Switchboard aggregator
    let is_switchboard = {
        if let Ok(data) = oracle_account.try_borrow_data() {
            AggregatorAccountData::new_from_bytes(&data).is_ok()
        } else {
            false
        }
    };

    if !is_switchboard {
        return err!(ErrorCode::InvalidOraclePrice);
    }

    let data = oracle_account
        .try_borrow_data()
        .map_err(|_| error!(ErrorCode::InvalidOraclePrice))?;

    let aggregator = AggregatorAccountData::new_from_bytes(&data)
        .map_err(|_| error!(ErrorCode::InvalidOraclePrice))?;

    let round = &aggregator.latest_confirmed_round;
    let timestamp = round.round_open_timestamp;

    // Vérifier staleness avec seuil configurable
    let staleness = clock.unix_timestamp - timestamp;
    if staleness > max_staleness_secs {
        msg!(
            "⚠️ Switchboard data too old: {}s (max: {}s)",
            staleness,
            max_staleness_secs
        );
        return err!(ErrorCode::StaleOracleData);
    }

    // get_result() retourne Result<SwitchboardDecimal, Error> dans v0.30.4
    let result = aggregator
        .get_result()
        .map_err(|_| error!(ErrorCode::InvalidOraclePrice))?;

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

    Ok(OracleObservation {
        price: price_scaled,
        confidence: 0, // Switchboard n'expose pas confidence directement
        publish_time: timestamp,
        slot: clock.slot,
        oracle_type: OracleType::Switchboard,
        feed: oracle_account.key(),
    })
}
