use anchor_lang::prelude::*;

/// Structure minimale pour lire un prix Pyth
/// Compatible avec Pyth Oracle v2 sans dépendance externe
#[derive(Debug, Clone, Copy)]
pub struct PriceData {
    pub price: i64,
    pub conf: u64,
    pub expo: i32,
    pub timestamp: i64,
}

/// Lit les données de prix directement depuis un compte Pyth
/// Évite les dépendances externes et conflits de versions
pub fn load_price_from_account(account_info: &AccountInfo) -> Result<PriceData> {
    require!(
        account_info.data_len() >= 3312,
        ErrorCode::InvalidPythAccount
    );

    let data = account_info.data.borrow();
    
    // Offsets pour Pyth Price Account v2
    // Magic: bytes 0-4 (0xa1b2c3d4)
    // Version: bytes 4-8
    // Type: bytes 8-12 (3 = Price)
    // Price: bytes 208-216 (i64)
    // Conf: bytes 216-224 (u64) 
    // Expo: bytes 224-228 (i32)
    // Publish time: bytes 228-236 (i64)

    let magic = u32::from_le_bytes([data[0], data[1], data[2], data[3]]);
    require!(
        magic == 0xa1b2c3d4,
        ErrorCode::InvalidPythAccount
    );

    let price = i64::from_le_bytes([
        data[208], data[209], data[210], data[211],
        data[212], data[213], data[214], data[215],
    ]);

    let conf = u64::from_le_bytes([
        data[216], data[217], data[218], data[219],
        data[220], data[221], data[222], data[223],
    ]);

    let expo = i32::from_le_bytes([
        data[224], data[225], data[226], data[227],
    ]);

    let timestamp = i64::from_le_bytes([
        data[228], data[229], data[230], data[231],
        data[232], data[233], data[234], data[235],
    ]);

    Ok(PriceData {
        price,
        conf,
        expo,
        timestamp,
    })
}

/// Vérifie que le prix n'est pas trop ancien
pub fn check_price_age(price_data: &PriceData, max_age_secs: i64) -> Result<()> {
    let clock = Clock::get()?;
    let age = clock.unix_timestamp - price_data.timestamp;
    
    require!(
        age >= 0 && age <= max_age_secs,
        ErrorCode::PriceTooOld
    );
    
    Ok(())
}

/// Calcule le prix avec gestion des décimales
pub fn get_price_scaled(price_data: &PriceData, target_decimals: u32) -> Result<u128> {
    require!(price_data.price > 0, ErrorCode::InvalidPrice);

    let price = price_data.price as u128;
    let expo_abs = price_data.expo.abs() as u32;

    // Ajuster selon l'exposant
    let scaled = if price_data.expo < 0 {
        // Prix avec exposant négatif (ex: -8 pour $0.00000001)
        if target_decimals >= expo_abs {
            price.checked_mul(10u128.pow(target_decimals - expo_abs))
        } else {
            price.checked_div(10u128.pow(expo_abs - target_decimals))
        }
    } else {
        // Prix avec exposant positif (rare)
        price
            .checked_mul(10u128.pow(expo_abs))
            .and_then(|p| p.checked_mul(10u128.pow(target_decimals)))
    };

    scaled.ok_or(ErrorCode::MathOverflow.into())
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid Pyth account")]
    InvalidPythAccount,
    #[msg("Price too old")]
    PriceTooOld,
    #[msg("Invalid price")]
    InvalidPrice,
    #[msg("Math overflow")]
    MathOverflow,
}
