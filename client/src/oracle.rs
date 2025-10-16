//! # Oracle Price Fetcher
//!
//! Fetches price data from Pyth or Switchboard oracles for price verification.

use crate::types::PriceData;
use solana_client::rpc_client::RpcClient;
use solana_sdk::pubkey::Pubkey;
use std::str::FromStr;

/// Fetch price from Pyth oracle
pub async fn fetch_pyth_price(
    rpc_client: &RpcClient,
    base_mint: Pubkey,
    quote_mint: Pubkey,
) -> Result<PriceData, Box<dyn std::error::Error>> {
    // For now, return mock data - in production, this would query actual Pyth feeds
    // You would need to map token mints to their corresponding Pyth price feed accounts

    // Example Pyth price feeds (these are real testnet feeds):
    // SOL/USD: 7VJsBtJzgTftYzEeooDTVwY92H18UJrsQMMNDcP1tKW
    // USDC/USD: 5SSkXsEKQJEZxZa9m4ieaMG6GDqNdDhEY5NzjE5HvLn

    // Mock implementation - replace with actual Pyth SDK calls
    let mock_price = 150_000_000; // $150 in 6 decimals
    let mock_confidence = 1_000_000; // $0.01 confidence

    Ok(PriceData {
        price: mock_price,
        confidence: mock_confidence,
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs(),
        source: "pyth".to_string(),
    })
}

/// Fetch price from Switchboard oracle
pub async fn fetch_switchboard_price(
    rpc_client: &RpcClient,
    base_mint: Pubkey,
    quote_mint: Pubkey,
) -> Result<PriceData, Box<dyn std::error::Error>> {
    // Mock implementation - replace with actual Switchboard calls
    let mock_price = 149_500_000; // Slightly different price
    let mock_confidence = 500_000;

    Ok(PriceData {
        price: mock_price,
        confidence: mock_confidence,
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs(),
        source: "switchboard".to_string(),
    })
}

/// Fetch price with fallback between multiple oracles
pub async fn fetch_price(
    rpc_client: &RpcClient,
    base_mint: Pubkey,
    quote_mint: Pubkey,
) -> Result<PriceData, Box<dyn std::error::Error>> {
    // Try Pyth first
    match fetch_pyth_price(rpc_client, base_mint, quote_mint).await {
        Ok(price_data) => return Ok(price_data),
        Err(e) => {
            log::warn!("Pyth price fetch failed: {}", e);
        }
    }

    // Fallback to Switchboard
    match fetch_switchboard_price(rpc_client, base_mint, quote_mint).await {
        Ok(price_data) => return Ok(price_data),
        Err(e) => {
            log::error!("Switchboard price fetch failed: {}", e);
            return Err(format!(
                "All oracle fetches failed: Pyth({}), Switchboard({})",
                "pyth_error", e
            )
            .into());
        }
    }
}

/// Calculate minimum return based on oracle price and slippage tolerance
pub fn calculate_min_return(
    amount_in: u64,
    oracle_price: u64,
    slippage_tolerance: f64,
    input_decimals: u8,
    output_decimals: u8,
) -> u64 {
    // Convert amount_in to base units for calculation
    let amount_in_base = amount_in as f64 / 10_f64.powi(input_decimals as i32);

    // Oracle price is typically in USD with 6-8 decimals
    // For simplicity, assume oracle_price is price per input token in output tokens
    let expected_output_base = amount_in_base * (oracle_price as f64 / 1_000_000.0);

    // Apply slippage tolerance
    let min_output_base = expected_output_base * (1.0 - slippage_tolerance);

    // Convert back to token units
    (min_output_base * 10_f64.powi(output_decimals as i32)) as u64
}

/// Validate that a route meets oracle price requirements
pub fn validate_route_price(
    simulated_output: u64,
    min_required_output: u64,
    oracle_price: u64,
    max_deviation_bps: u16, // Max deviation in basis points (e.g., 100 = 1%)
) -> Result<(), String> {
    // Check minimum output
    if simulated_output < min_required_output {
        return Err(format!(
            "Simulated output {} below minimum required {}",
            simulated_output, min_required_output
        ));
    }

    // Calculate deviation from oracle (simplified check)
    // In production, you'd want more sophisticated price impact analysis
    let deviation_bps = ((min_required_output as f64 - simulated_output as f64)
        / simulated_output as f64
        * 10000.0) as u16;

    if deviation_bps > max_deviation_bps {
        return Err(format!(
            "Price deviation {} bps exceeds maximum allowed {} bps",
            deviation_bps, max_deviation_bps
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use solana_client::rpc_client::RpcClient;
    use solana_sdk::commitment_config::CommitmentConfig;

    // Note: These tests would need a real RPC client in production
    // For now, they test the calculation logic

    #[test]
    fn test_calculate_min_return() {
        let amount_in = 1_000_000; // 1 token with 6 decimals
        let oracle_price = 150_000_000; // $150
        let slippage_tolerance = 0.01; // 1%
        let input_decimals = 6;
        let output_decimals = 6;

        let min_return = calculate_min_return(
            amount_in,
            oracle_price,
            slippage_tolerance,
            input_decimals,
            output_decimals,
        );

        // Expected: 1 * 150 * 0.99 = 148.5
        // In token units: 148.5 * 1_000_000 = 148_500_000
        assert!(min_return > 148_000_000);
        assert!(min_return < 149_000_000);
    }

    #[test]
    fn test_validate_route_price_success() {
        let simulated_output = 148_500_000;
        let min_required = 148_000_000;
        let oracle_price = 150_000_000;
        let max_deviation = 200; // 2%

        let result =
            validate_route_price(simulated_output, min_required, oracle_price, max_deviation);

        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_route_price_failure() {
        let simulated_output = 140_000_000; // Too low
        let min_required = 148_000_000;
        let oracle_price = 150_000_000;
        let max_deviation = 200;

        let result =
            validate_route_price(simulated_output, min_required, oracle_price, max_deviation);

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("below minimum"));
    }
}
