//! # Swap Optimizer
//!
//! Implements tranche-based weight allocation algorithm for optimal DEX routing.

use crate::types::{DexInfo, SwapRoute};
use std::cmp::Ordering;

/// Compute optimal weights using tranche-based allocation algorithm
///
/// This function implements a greedy allocation strategy:
/// 1. Simulate AMM output for each DEX using x*y=k formula with fees
/// 2. Calculate unit cost ci = qin/qouti (higher = worse)
/// 3. Sort DEXes by ascending cost (lowest cost first)
/// 4. Allocate in tranches starting from lowest cost DEX
/// 5. Convert allocations to weights summing to 100
pub fn compute_optimal_weights(amount_in: u64, dexes: &[DexInfo]) -> Result<Vec<u8>, String> {
    if dexes.is_empty() {
        return Err("No DEXes provided".to_string());
    }

    if dexes.len() == 1 {
        return Ok(vec![100]);
    }

    if amount_in == 0 {
        return Err("Input amount must be greater than 0".to_string());
    }

    // Step 1: Simulate output for each DEX and calculate unit costs
    let mut dex_costs: Vec<DexCost> = dexes
        .iter()
        .enumerate()
        .map(|(index, dex)| {
            let simulated_output = simulate_amm_output(amount_in, dex);
            let unit_cost = amount_in as f64 / simulated_output as f64;

            DexCost {
                index,
                dex: dex.clone(),
                unit_cost,
                simulated_output,
            }
        })
        .collect();

    // Step 2: Sort DEXes by ascending unit cost (lowest cost first)
    dex_costs.sort_by(|a, b| {
        a.unit_cost
            .partial_cmp(&b.unit_cost)
            .unwrap_or(Ordering::Equal)
    });

    // Step 3: Allocate in tranches using greedy algorithm
    let mut allocations: Vec<Allocation> = Vec::new();
    let mut remaining_amount = amount_in as f64;

    for dex_cost in &dex_costs {
        if remaining_amount <= 0.0 {
            break;
        }

        // Calculate tranche size: min of 40% of remaining or 10% of DEX liquidity
        let tranche_size = remaining_amount.min(dex_cost.dex.reserve_x as f64 * 0.1);
        let allocated_amount = tranche_size.min(remaining_amount);

        if allocated_amount > 0.0 {
            allocations.push(Allocation {
                dex_index: dex_cost.index,
                allocated_input: allocated_amount,
            });
            remaining_amount -= allocated_amount;
        }
    }

    // Step 4: Convert allocations to weights (u8 values summing to 100)
    let mut weights = vec![0u8; dexes.len()];

    for allocation in allocations {
        let weight = ((allocation.allocated_input / amount_in as f64) * 100.0).round() as u8;
        weights[allocation.dex_index] = weights[allocation.dex_index].saturating_add(weight);
    }

    // Step 5: Ensure weights sum to exactly 100
    let total_weight: u32 = weights.iter().map(|&w| w as u32).sum();
    if total_weight != 100 {
        let adjustment = 100i32 - total_weight as i32;
        if !weights.is_empty() {
            let last_index = weights.len() - 1;
            weights[last_index] = (weights[last_index] as i32 + adjustment).max(0).min(255) as u8;
        }
    }

    // Validate final weights
    let final_sum: u32 = weights.iter().map(|&w| w as u32).sum();
    if final_sum != 100 {
        return Err(format!("Weights sum to {}, expected 100", final_sum));
    }

    Ok(weights)
}

/// Simulate AMM output using constant product formula with fees
fn simulate_amm_output(amount_in: u64, dex: &DexInfo) -> f64 {
    let reserve_x = dex.reserve_x as f64;
    let reserve_y = dex.reserve_y as f64;
    let fee_rate = dex.fee_rate;

    if reserve_x <= 0.0 || reserve_y <= 0.0 {
        return 0.0;
    }

    // Apply fee: effective input = amount_in * (1 - fee)
    let effective_input = amount_in as f64 * (1.0 - fee_rate);

    // AMM formula: qout = reserve_y - (reserve_x * reserve_y) / (reserve_x + effective_input)
    let numerator = reserve_x * reserve_y;
    let denominator = reserve_x + effective_input;

    if denominator <= 0.0 {
        return 0.0;
    }

    let output = reserve_y - (numerator / denominator);
    output.max(0.0)
}

/// Internal structure for DEX cost calculation
#[derive(Debug, Clone)]
struct DexCost {
    index: usize,
    dex: DexInfo,
    unit_cost: f64, // qin/qouti (higher = worse)
    simulated_output: f64,
}

/// Internal structure for allocation tracking
#[derive(Debug, Clone)]
struct Allocation {
    dex_index: usize,
    allocated_input: f64,
}

/// Create an optimized swap route with weights and oracle verification
pub fn create_optimized_route(
    amount_in: u64,
    dexes: Vec<DexInfo>,
    oracle_price: u64,
    slippage_tolerance: f64,
) -> Result<SwapRoute, String> {
    if dexes.is_empty() {
        return Err("No DEXes provided".to_string());
    }

    // Compute optimal weights
    let weights = compute_optimal_weights(amount_in, &dexes)?;

    // Calculate expected output from oracle
    let expected_output = ((amount_in as f64) * (oracle_price as f64) / 1_000_000.0) as u64; // Adjust for decimals

    // Calculate minimum output with slippage tolerance
    let min_output = ((expected_output as f64) * (1.0 - slippage_tolerance)) as u64;

    // Verify that the weighted allocation meets minimum output
    let total_simulated_output = simulate_weighted_output(amount_in, &dexes, &weights);
    if total_simulated_output < min_output as f64 {
        return Err(format!(
            "Simulated output {:.2} below minimum required {:.2}",
            total_simulated_output, min_output
        ));
    }

    Ok(SwapRoute {
        dexes,
        weights,
        min_output,
        expected_output,
    })
}

/// Simulate total output for weighted allocation across multiple DEXes
fn simulate_weighted_output(amount_in: u64, dexes: &[DexInfo], weights: &[u8]) -> f64 {
    let mut total_output = 0.0;

    for (i, &weight) in weights.iter().enumerate() {
        if weight == 0 || i >= dexes.len() {
            continue;
        }

        let portion = (weight as f64) / 100.0;
        let portion_amount = (amount_in as f64 * portion) as u64;

        let output = simulate_amm_output(portion_amount, &dexes[i]);
        total_output += output;
    }

    total_output
}

#[cfg(test)]
mod tests {
    use super::*;
    use solana_sdk::pubkey::Pubkey;

    fn create_test_dex(pool_id: &str, reserve_x: u64, reserve_y: u64, fee_rate: f64) -> DexInfo {
        DexInfo {
            pool_id: Pubkey::new_unique(),
            reserve_x,
            reserve_y,
            fee_rate,
            program_id: Pubkey::new_unique(),
        }
    }

    #[test]
    fn test_compute_optimal_weights_single_dex() {
        let dexes = vec![create_test_dex("dex1", 1000000, 1000000, 0.003)];
        let weights = compute_optimal_weights(100000, &dexes).unwrap();
        assert_eq!(weights, vec![100]);
    }

    #[test]
    fn test_compute_optimal_weights_two_dexes() {
        let dexes = vec![
            create_test_dex("dex1", 1000000, 1000000, 0.003), // Better liquidity
            create_test_dex("dex2", 500000, 500000, 0.002),   // Lower fees
        ];
        let weights = compute_optimal_weights(100000, &dexes).unwrap();

        assert_eq!(weights.len(), 2);
        assert_eq!(weights.iter().map(|&w| w as u32).sum::<u32>(), 100);
        assert!(weights.iter().all(|&w| w > 0));
    }

    #[test]
    fn test_compute_optimal_weights_empty_dexes() {
        let result = compute_optimal_weights(100000, &[]);
        assert!(result.is_err());
    }

    #[test]
    fn test_simulate_amm_output() {
        let dex = create_test_dex("dex1", 1000000, 1000000, 0.003);
        let output = simulate_amm_output(100000, &dex);
        assert!(output > 0.0);
        assert!(output < 100000.0); // Should be less than input due to fees
    }
}
