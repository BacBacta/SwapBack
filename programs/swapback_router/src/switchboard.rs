use anchor_lang::prelude::*;

/// Structure minimale pour lire un feed Switchboard
/// Compatible avec Switchboard V2 sans dépendance externe
#[derive(Debug, Clone, Copy)]
pub struct SwitchboardPrice {
    pub value: i128,
    pub decimals: u32,
    pub timestamp: i64,
}

/// Lit les données de prix directement depuis un compte Switchboard Aggregator
/// Évite les dépendances externes et conflits de versions
pub fn load_switchboard_feed(account_info: &AccountInfo) -> Result<SwitchboardPrice> {
    require!(
        account_info.data_len() >= 512,
        ErrorCode::InvalidSwitchboardAccount
    );

    let data = account_info.data.borrow();
    
    // Offsets pour Switchboard Aggregator Account V2
    // Les offsets exacts peuvent varier selon la version
    // Discriminator: bytes 0-8
    // Latest confirmed round result value: bytes 217-233 (i128)
    // Decimals: byte 241
    // Latest timestamp: bytes 249-257 (i64)

    // Vérifier que c'est bien un aggregator
    let discriminator = &data[0..8];
    let expected_discriminator = [217, 230, 65, 101, 201, 162, 27, 125]; // Aggregator
    
    require!(
        discriminator == expected_discriminator,
        ErrorCode::InvalidSwitchboardAccount
    );

    // Lire la valeur (i128 en little-endian)
    let mut value_bytes = [0u8; 16];
    value_bytes.copy_from_slice(&data[217..233]);
    let value = i128::from_le_bytes(value_bytes);

    // Lire les décimales
    let decimals = data[241] as u32;

    // Lire le timestamp
    let timestamp = i64::from_le_bytes([
        data[249], data[250], data[251], data[252],
        data[253], data[254], data[255], data[256],
    ]);

    Ok(SwitchboardPrice {
        value,
        decimals,
        timestamp,
    })
}

/// Vérifie que le prix n'est pas trop ancien
pub fn check_feed_age(price: &SwitchboardPrice, max_age_secs: i64) -> Result<()> {
    let clock = Clock::get()?;
    let age = clock.unix_timestamp - price.timestamp;
    
    require!(
        age >= 0 && age <= max_age_secs,
        ErrorCode::FeedTooOld
    );
    
    Ok(())
}

/// Convertit le prix Switchboard en format utilisable avec gestion des décimales
pub fn get_price_as_u64(price: &SwitchboardPrice, target_decimals: u32) -> Result<u64> {
    require!(price.value > 0, ErrorCode::InvalidPrice);

    let value = price.value as u128;
    
    // Ajuster les décimales
    let scaled = if target_decimals > price.decimals {
        let multiplier = 10u128.pow(target_decimals - price.decimals);
        value.checked_mul(multiplier)
    } else if target_decimals < price.decimals {
        let divisor = 10u128.pow(price.decimals - target_decimals);
        value.checked_div(divisor)
    } else {
        Some(value)
    };

    let result = scaled
        .ok_or(ErrorCode::MathOverflow)?
        .try_into()
        .map_err(|_| ErrorCode::PriceOverflow)?;

    Ok(result)
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid Switchboard account")]
    InvalidSwitchboardAccount,
    #[msg("Feed too old")]
    FeedTooOld,
    #[msg("Invalid price")]
    InvalidPrice,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Price overflow - value too large")]
    PriceOverflow,
}
