//! Custom getrandom implementation for Solana BPF target.
//! This is required because the default getrandom implementation
//! doesn't support the BPF target used by Solana programs.

use core::num::NonZeroU32;
use getrandom::Error;

/// Custom getrandom implementation that always returns an error.
/// Randomness is not available in Solana BPF programs.
///
/// Signature: fn(&mut [u8]) -> Result<(), Error>
fn custom_getrandom(dest: &mut [u8]) -> Result<(), Error> {
    // Ne jamais réussir car Solana BPF n'a pas d'entropie système
    let _ = dest;
    // Créer une erreur avec le code CUSTOM_START
    let code = NonZeroU32::new(Error::CUSTOM_START).expect("CUSTOM_START doit être non-zero");
    Err(Error::from(code))
}

// Register the custom implementation
getrandom::register_custom_getrandom!(custom_getrandom);
