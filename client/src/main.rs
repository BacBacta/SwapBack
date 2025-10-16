//! # SwapBack Client Example
//!
//! Demonstrates how to use the optimization client for DEX routing.

use solana_client::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::pubkey::Pubkey;
use std::str::FromStr;

use swapback_client::{compute_optimal_weights, create_optimized_route, fetch_price, DexInfo};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize RPC client
    let rpc_client = RpcClient::new_with_commitment(
        "https://api.mainnet-beta.solana.com".to_string(),
        CommitmentConfig::confirmed(),
    );

    // Example token mints (SOL and USDC)
    let sol_mint = Pubkey::from_str("So11111111111111111111111111111111111111112")?;
    let usdc_mint = Pubkey::from_str("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")?;

    // Example DEX information (mock data for demonstration)
    let dexes = vec![
        DexInfo {
            pool_id: Pubkey::new_unique(), // Raydium SOL/USDC pool
            reserve_x: 1_000_000_000,      // 1000 SOL
            reserve_y: 150_000_000_000,    // 150M USDC
            fee_rate: 0.003,               // 0.3%
            program_id: Pubkey::from_str("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8")?, // Raydium program
        },
        DexInfo {
            pool_id: Pubkey::new_unique(), // Orca SOL/USDC pool
            reserve_x: 500_000_000,        // 500 SOL
            reserve_y: 75_000_000_000,     // 75M USDC
            fee_rate: 0.0025,              // 0.25%
            program_id: Pubkey::from_str("9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP")?, // Orca program
        },
    ];

    // Swap parameters
    let amount_in = 10_000_000; // 10 SOL (6 decimals)
    let slippage_tolerance = 0.005; // 0.5%

    println!(
        "🔄 Optimizing swap route for {} SOL to USDC",
        amount_in as f64 / 1_000_000.0
    );

    // Step 1: Fetch oracle price
    println!("📊 Fetching oracle price...");
    let price_data = fetch_price(&rpc_client, sol_mint, usdc_mint).await?;
    println!(
        "💰 Oracle price: ${:.2} (source: {})",
        price_data.price as f64 / 1_000_000.0,
        price_data.source
    );

    // Step 2: Create optimized route
    println!("🎯 Computing optimal weights...");
    let route = create_optimized_route(
        amount_in,
        dexes.clone(),
        price_data.price,
        slippage_tolerance,
    )?;

    println!("📋 Optimized Route:");
    println!("   Weights: {:?}", route.weights);
    println!(
        "   Expected output: {} USDC",
        route.expected_output as f64 / 1_000_000.0
    );
    println!(
        "   Minimum output: {} USDC",
        route.min_output as f64 / 1_000_000.0
    );

    // Step 3: Display DEX allocation
    for (i, (dex, &weight)) in dexes.iter().zip(route.weights.iter()).enumerate() {
        if weight > 0 {
            let portion = weight as f64 / 100.0;
            let dex_amount = (amount_in as f64 * portion) as u64;
            println!(
                "   DEX {}: {}% ({} SOL) - Pool: {}",
                i + 1,
                weight,
                dex_amount as f64 / 1_000_000.0,
                dex.pool_id.to_string()[..8]
            );
        }
    }

    // Step 4: Prepare for on-chain execution
    println!("🚀 Ready for on-chain execution:");
    println!(
        "   Venue addresses: {:?}",
        dexes.iter().map(|d| d.program_id).collect::<Vec<_>>()
    );
    println!("   Weights: {:?}", route.weights);
    println!("   Min output: {}", route.min_output);

    Ok(())
}
