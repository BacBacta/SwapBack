//! Oracle Module V2 - Compatible Pyth V2 Pull Oracle
//! 
//! Ce module lit les prix des oracles Pyth V2 (PriceUpdateV2 accounts).
//! Utilise une désérialisation manuelle pour éviter les conflits de version Anchor.

use anchor_lang::prelude::*;

use crate::{ErrorCode, OracleType};

/// Observation d'oracle normalisée
#[derive(Clone, Copy)]
pub struct OracleObservation {
    pub price: u64,
    pub confidence: u64,
    pub publish_time: i64,
    pub slot: u64,
    pub oracle_type: OracleType,
    pub feed: Pubkey,
}

// Confidence maximale autorisée (5% = 500 bps)
const MAX_CONFIDENCE_BPS: u128 = 500;

// Pyth Pull Oracle Program ID (mainnet)
// rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ
const PYTH_RECEIVER_PROGRAM_ID: &str = "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ";

// Pyth Feed IDs (hex) pour les tokens supportés
// Voir: https://docs.pyth.network/price-feeds/core/price-feeds
pub mod feed_ids {
    /// SOL/USD
    pub const SOL_USD: &str = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
    /// USDC/USD
    pub const USDC_USD: &str = "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a";
    /// USDT/USD
    pub const USDT_USD: &str = "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b";
    /// BONK/USD
    pub const BONK_USD: &str = "0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419";
    /// WIF/USD
    pub const WIF_USD: &str = "0x4ca4beeca86f0d164160323817a4e42b10010a724c2217c6ee41b54cd4cc61fc";
}

/// Lit le prix d'un compte Pyth V2 (PriceUpdateV2) depuis un AccountInfo brut.
/// Compatible avec les Push Feed Accounts sponsorisés par Pyth Data Association.
/// 
/// # Arguments
/// * `oracle_account` - AccountInfo du compte PriceUpdateV2 (owné par Pyth Receiver)
/// * `clock` - Clock sysvar
/// * `max_staleness_secs` - Âge maximum du prix en secondes
pub fn read_price_with_staleness(
    oracle_account: &AccountInfo,
    clock: &Clock,
    max_staleness_secs: i64,
) -> Result<OracleObservation> {
    if oracle_account.key() == Pubkey::default() {
        return err!(ErrorCode::InvalidOraclePrice);
    }

    // Vérifier que le compte est owné par le Pyth Pull Oracle program
    let expected_owner = PYTH_RECEIVER_PROGRAM_ID.parse::<Pubkey>()
        .map_err(|_| error!(ErrorCode::InvalidOraclePrice))?;
    
    if oracle_account.owner != &expected_owner {
        msg!("⚠️ Account not owned by Pyth Receiver program (owner: {})", oracle_account.owner);
        return err!(ErrorCode::InvalidOraclePrice);
    }
    
    // Deserialize the PriceUpdateV2 account data
    let data = oracle_account.try_borrow_data()
        .map_err(|_| error!(ErrorCode::InvalidOraclePrice))?;
    
    // PriceUpdateV2 structure from pyth_solana_receiver_sdk (CORRECT LAYOUT):
    // Total size: 134 bytes
    // - 8 bytes: Anchor discriminator
    // - 32 bytes: write_authority (Pubkey, NOT Option!)
    // - 2 bytes: verification_level (VerificationLevel enum - u8 + padding or u16)
    // - PriceFeedMessage fields:
    //   - 32 bytes: feed_id [u8; 32]
    //   - 8 bytes: price (i64)
    //   - 8 bytes: conf (u64)
    //   - 4 bytes: exponent (i32)
    //   - 8 bytes: publish_time (i64)
    //   - 8 bytes: prev_publish_time (i64)
    //   - 8 bytes: ema_price (i64)
    //   - 8 bytes: ema_conf (u64)
    // - 8 bytes: posted_slot (u64)
    //
    // Layout offsets:
    // 0-7:   discriminator
    // 8-39:  write_authority (32 bytes)
    // 40-41: verification_level (2 bytes)
    // 42-73: feed_id (32 bytes)
    // 74-81: price (8 bytes)
    // 82-89: conf (8 bytes)
    // 90-93: exponent (4 bytes)
    // 94-101: publish_time (8 bytes)
    // 102-109: prev_publish_time (8 bytes)
    // 110-117: ema_price (8 bytes)
    // 118-125: ema_conf (8 bytes)
    // 126-133: posted_slot (8 bytes)
    
    const EXPECTED_LEN: usize = 134;
    
    if data.len() < EXPECTED_LEN {
        msg!("⚠️ PriceUpdateV2 data too short: {} < {} expected", data.len(), EXPECTED_LEN);
        return err!(ErrorCode::InvalidOraclePrice);
    }
    
    // PriceFeedMessage starts at offset 42 (after discriminator + write_authority + verification_level)
    const MSG_OFFSET: usize = 8 + 32 + 2; // = 42
    let msg_offset = MSG_OFFSET;
    
    // Read price message fields
    // feed_id: [u8; 32] at msg_offset
    #[allow(unused_variables)]
    let mut feed_id = [0u8; 32];
    feed_id.copy_from_slice(&data[msg_offset..msg_offset + 32]);
    
    // price: i64 (little-endian) at msg_offset + 32
    let price_bytes: [u8; 8] = data[msg_offset + 32..msg_offset + 40].try_into()
        .map_err(|_| error!(ErrorCode::InvalidOraclePrice))?;
    let price_raw = i64::from_le_bytes(price_bytes);
    
    // conf: u64 (little-endian) at msg_offset + 40
    let conf_bytes: [u8; 8] = data[msg_offset + 40..msg_offset + 48].try_into()
        .map_err(|_| error!(ErrorCode::InvalidOraclePrice))?;
    let conf_raw = u64::from_le_bytes(conf_bytes);
    
    // exponent: i32 (little-endian) at msg_offset + 48
    let exp_bytes: [u8; 4] = data[msg_offset + 48..msg_offset + 52].try_into()
        .map_err(|_| error!(ErrorCode::InvalidOraclePrice))?;
    let exponent = i32::from_le_bytes(exp_bytes);
    
    // publish_time: i64 (little-endian) at msg_offset + 52
    let pub_time_bytes: [u8; 8] = data[msg_offset + 52..msg_offset + 60].try_into()
        .map_err(|_| error!(ErrorCode::InvalidOraclePrice))?;
    let publish_time = i64::from_le_bytes(pub_time_bytes);
    
    // Drop borrow before any further operations
    drop(data);
    
    // Vérifier staleness
    let staleness = clock.unix_timestamp - publish_time;
    if staleness > max_staleness_secs {
        msg!(
            "⚠️ Pyth V2 data too old: {}s (max: {}s)",
            staleness,
            max_staleness_secs
        );
        return err!(ErrorCode::StaleOracleData);
    }
    
    // Reject negative staleness (future timestamp)
    if staleness < -60 {
        msg!("⚠️ Pyth V2 timestamp is in the future: {}s", -staleness);
        return err!(ErrorCode::InvalidOraclePrice);
    }
    
    // Normaliser le prix en 8 décimales
    let price_scaled = normalize_decimal(price_raw as i128, exponent)
        .ok_or_else(|| error!(ErrorCode::InvalidOraclePrice))?;
    
    if price_scaled == 0 {
        msg!("❌ Pyth V2 price is zero");
        return err!(ErrorCode::InvalidOraclePrice);
    }
    
    let confidence_scaled = normalize_decimal(conf_raw as i128, exponent)
        .ok_or_else(|| error!(ErrorCode::InvalidOraclePrice))?;
    
    // Vérifier confidence
    let confidence_bps = confidence_scaled
        .checked_mul(10_000)
        .and_then(|value| value.checked_div(price_scaled))
        .ok_or_else(|| error!(ErrorCode::InvalidOraclePrice))?;
    
    if confidence_bps > MAX_CONFIDENCE_BPS {
        msg!(
            "❌ Pyth V2 confidence too wide: {} bps (max: {})",
            confidence_bps,
            MAX_CONFIDENCE_BPS
        );
        return err!(ErrorCode::InvalidOraclePrice);
    }
    
    let normalized_price =
        u64::try_from(price_scaled).map_err(|_| error!(ErrorCode::InvalidOraclePrice))?;
    let normalized_confidence =
        u64::try_from(confidence_scaled).map_err(|_| error!(ErrorCode::InvalidOraclePrice))?;
    
    msg!(
        "✅ Pyth V2 price: {} (confidence: {} bps, staleness: {}s)",
        normalized_price,
        confidence_bps,
        staleness
    );
    
    Ok(OracleObservation {
        price: normalized_price,
        confidence: normalized_confidence,
        publish_time,
        slot: clock.slot,
        oracle_type: OracleType::Pyth,
        feed: oracle_account.key(),
    })
}

/// Normalise un nombre décimal vers 8 décimales (format standard Pyth/Switchboard)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_decimal() {
        // Prix de $150.50 avec expo -8 (format Pyth standard)
        // 15050000000 * 10^-8 = $150.50
        // diff = -8 - (-8) = 0, donc pas de changement
        assert_eq!(normalize_decimal(15050000000, -8), Some(15050000000));
        
        // Prix de $1.50 avec expo -8
        // 150000000 * 10^-8 = $1.50
        assert_eq!(normalize_decimal(150000000, -8), Some(150000000));
        
        // Prix de $150.50 avec expo -6
        // 150500000 * 10^-6 = $150.50
        // diff = -8 - (-6) = -2, donc divise par 10^2 = 100
        // 150500000 / 100 = 1505000
        assert_eq!(normalize_decimal(150500000, -6), Some(1505000));
        
        // Prix de $150.50 avec expo -10
        // 1505000000000 * 10^-10 = $150.50
        // diff = -8 - (-10) = 2, donc multiplie par 10^2 = 100
        // 1505000000000 * 100 = overflow? Non, car i128
        assert_eq!(normalize_decimal(1505000000000_i128, -10), Some(150500000000000));
        
        // Prix négatif -> None
        assert_eq!(normalize_decimal(-100, -8), None);
    }
}
