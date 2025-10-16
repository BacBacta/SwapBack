//! # SwapBack Client
//!
//! Off-chain optimization client for the SwapBack DEX Router.
//! Provides automatic weight calculation and oracle price verification.

pub mod optimizer;
pub mod oracle;
pub mod types;

pub use optimizer::{compute_optimal_weights, DexInfo};
pub use oracle::fetch_price;
pub use types::*;