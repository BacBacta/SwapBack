//! Gated logging for performance optimization.
//! Debug logs are only compiled when `debug-logs` feature is enabled.

/// Debug message macro - only logs when `debug-logs` feature is enabled.
/// Use this for non-essential logs in hot paths to reduce compute units.
#[macro_export]
macro_rules! dmsg {
    ($($arg:tt)*) => {
        #[cfg(feature = "debug-logs")]
        {
            anchor_lang::prelude::msg!($($arg)*);
        }
    };
}

/// Always-on message for critical errors and invariants.
/// Use sparingly - each msg! costs ~100 CUs.
#[macro_export]
macro_rules! critical_msg {
    ($($arg:tt)*) => {
        anchor_lang::prelude::msg!($($arg)*);
    };
}
