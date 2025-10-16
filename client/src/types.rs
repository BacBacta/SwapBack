//! Common types for the SwapBack client

use serde::{Deserialize, Serialize};
use solana_sdk::pubkey::Pubkey;

/// Information about a DEX pool
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DexInfo {
    /// Pool identifier (usually the pool account address)
    pub pool_id: Pubkey,
    /// Reserve amount of input token (x)
    pub reserve_x: u64,
    /// Reserve amount of output token (y)
    pub reserve_y: u64,
    /// Fee rate (e.g., 0.003 for 0.3%)
    pub fee_rate: f64,
    /// DEX program address
    pub program_id: Pubkey,
}

/// Swap route with calculated weights
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapRoute {
    /// List of DEXes to use
    pub dexes: Vec<DexInfo>,
    /// Weights for each DEX (must sum to 100)
    pub weights: Vec<u8>,
    /// Minimum output amount (slippage protection)
    pub min_output: u64,
    /// Expected output from oracle
    pub expected_output: u64,
}

/// Oracle price data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceData {
    /// Price in quote tokens per base token
    pub price: u64,
    /// Confidence interval
    pub confidence: u64,
    /// Timestamp of the price
    pub timestamp: u64,
    /// Oracle source (Pyth, Switchboard, etc.)
    pub source: String,
}

/// Swap parameters for on-chain execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapParams {
    /// Input token mint
    pub input_mint: Pubkey,
    /// Output token mint
    pub output_mint: Pubkey,
    /// Total input amount
    pub amount_in: u64,
    /// Minimum output amount
    pub min_out: u64,
    /// Slippage tolerance in basis points (e.g., 50 = 0.5%)
    pub slippage_bps: u16,
    /// Use Jito bundling for MEV protection
    pub use_jito: bool,
}