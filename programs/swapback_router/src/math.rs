//! Math utilities for split amounts, basis points, and min_out calculations.
//! All operations use u128 intermediate values to prevent overflow.

use anchor_lang::prelude::*;

/// Split an amount_in by venue weights (BPS sum = 10_000).
/// The last bucket is corrected to ensure the sum equals amount_in exactly.
/// Returns Vec<u64> of per-venue amounts.
pub fn split_amount_by_weights(amount_in: u64, weights: &[u16]) -> Result<Vec<u64>> {
    if weights.is_empty() {
        return Ok(vec![]);
    }
    
    let weight_sum: u32 = weights.iter().map(|w| *w as u32).sum();
    if weight_sum == 0 {
        return Ok(vec![0; weights.len()]);
    }

    let mut parts: Vec<u64> = Vec::with_capacity(weights.len());
    let mut acc: u64 = 0;

    for (i, &w) in weights.iter().enumerate() {
        if i == weights.len() - 1 {
            // Last bucket gets the remainder
            let part = amount_in.saturating_sub(acc);
            parts.push(part);
        } else {
            // Standard calculation: amount_in * weight / weight_sum
            let part = ((amount_in as u128)
                .saturating_mul(w as u128)
                / (weight_sum as u128)) as u64;
            parts.push(part);
            acc = acc.saturating_add(part);
        }
    }

    Ok(parts)
}

/// Split min_out by venue weights, same logic as split_amount_by_weights.
pub fn split_min_out_by_weights(min_out: u64, weights: &[u16]) -> Result<Vec<u64>> {
    split_amount_by_weights(min_out, weights)
}

/// Convert basis points to a fraction of the given value.
/// result = value * bps / 10_000
pub fn bps_of(value: u64, bps: u16) -> u64 {
    ((value as u128).saturating_mul(bps as u128) / 10_000u128) as u64
}

/// Calculate min_out from expected_out and slippage_bps.
/// min_out = expected_out * (10_000 - slippage_bps) / 10_000
pub fn min_out_with_slippage(expected_out: u64, slippage_bps: u16) -> u64 {
    let keep_bps = 10_000u16.saturating_sub(slippage_bps);
    bps_of(expected_out, keep_bps)
}

/// Renormalize weights to sum to 10_000.
/// Removes zero-weight entries and adjusts the last entry to ensure exact sum.
pub fn renormalize_weights_to_10000(weights: &mut Vec<u16>) {
    weights.retain(|&w| w > 0);
    let sum: u32 = weights.iter().map(|&w| w as u32).sum();
    if sum == 0 {
        return;
    }
    
    let mut acc: u32 = 0;
    for i in 0..weights.len() {
        if i == weights.len() - 1 {
            // Last entry gets remainder to hit 10_000 exactly
            weights[i] = (10_000u32.saturating_sub(acc)).min(10_000) as u16;
        } else {
            let scaled = (weights[i] as u32).saturating_mul(10_000) / sum;
            weights[i] = scaled.min(10_000) as u16;
            acc = acc.saturating_add(weights[i] as u32);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // =========================================================================
    // SPLIT AMOUNT TESTS
    // =========================================================================

    #[test]
    fn split_amount_empty_weights() {
        let parts = split_amount_by_weights(1_000_000, &[]).unwrap();
        assert!(parts.is_empty());
    }

    #[test]
    fn split_amount_single_venue_full() {
        let parts = split_amount_by_weights(1_000_000, &[10_000]).unwrap();
        assert_eq!(parts, vec![1_000_000]);
    }

    #[test]
    fn split_amount_equal_two() {
        let parts = split_amount_by_weights(1_000_000, &[5_000, 5_000]).unwrap();
        assert_eq!(parts.iter().sum::<u64>(), 1_000_000);
        assert_eq!(parts[0], 500_000);
        assert_eq!(parts[1], 500_000);
    }

    #[test]
    fn split_amount_unequal_three() {
        // 60%, 30%, 10%
        let parts = split_amount_by_weights(1_000_000, &[6_000, 3_000, 1_000]).unwrap();
        let sum: u64 = parts.iter().sum();
        assert_eq!(sum, 1_000_000, "Sum must equal amount_in exactly");
        assert_eq!(parts[0], 600_000);
        assert_eq!(parts[1], 300_000);
        assert_eq!(parts[2], 100_000);
    }

    #[test]
    fn split_amount_rounding_correction() {
        // 33%, 33%, 34% - will have rounding
        let parts = split_amount_by_weights(100, &[3_333, 3_333, 3_334]).unwrap();
        let sum: u64 = parts.iter().sum();
        assert_eq!(sum, 100, "Sum must equal amount_in even with rounding");
    }

    #[test]
    fn split_amount_high_value_no_overflow() {
        let high = u64::MAX / 2; // Very large value
        let parts = split_amount_by_weights(high, &[5_000, 3_000, 2_000]).unwrap();
        let sum: u64 = parts.iter().sum();
        assert_eq!(sum, high, "Should handle large values without overflow");
    }

    #[test]
    fn split_amount_one_lamport() {
        let parts = split_amount_by_weights(1, &[5_000, 5_000]).unwrap();
        let sum: u64 = parts.iter().sum();
        assert_eq!(sum, 1, "Should handle single lamport");
    }

    #[test]
    fn split_amount_weights_sum_less_than_10000() {
        // Weights don't sum to 10000 - function still works proportionally
        let parts = split_amount_by_weights(1000, &[500, 500]).unwrap();
        let sum: u64 = parts.iter().sum();
        assert_eq!(sum, 1000);
    }

    #[test]
    fn split_amount_all_zero_weights() {
        let parts = split_amount_by_weights(1_000_000, &[0, 0, 0]).unwrap();
        assert_eq!(parts, vec![0, 0, 0]);
    }

    // =========================================================================
    // BPS CALCULATION TESTS
    // =========================================================================

    #[test]
    fn bps_of_100_percent() {
        assert_eq!(bps_of(1_000_000, 10_000), 1_000_000);
    }

    #[test]
    fn bps_of_50_percent() {
        assert_eq!(bps_of(1_000_000, 5_000), 500_000);
    }

    #[test]
    fn bps_of_small_value() {
        assert_eq!(bps_of(1_000_000, 1), 100); // 0.01%
    }

    #[test]
    fn bps_of_zero_value() {
        assert_eq!(bps_of(0, 5_000), 0);
    }

    #[test]
    fn bps_of_zero_bps() {
        assert_eq!(bps_of(1_000_000, 0), 0);
    }

    #[test]
    fn bps_of_high_value_no_overflow() {
        let high = u64::MAX;
        let result = bps_of(high, 5_000);
        // Should not panic and should be approximately half
        assert!(result <= high / 2 + 1);
    }

    // =========================================================================
    // MIN_OUT WITH SLIPPAGE TESTS
    // =========================================================================

    #[test]
    fn min_out_slippage_50bps() {
        // 0.5% slippage: 1_000_000 * 9950 / 10000 = 995_000
        assert_eq!(min_out_with_slippage(1_000_000, 50), 995_000);
    }

    #[test]
    fn min_out_slippage_200bps() {
        // 2% slippage: 1_000_000 * 9800 / 10000 = 980_000
        assert_eq!(min_out_with_slippage(1_000_000, 200), 980_000);
    }

    #[test]
    fn min_out_slippage_zero() {
        assert_eq!(min_out_with_slippage(1_000_000, 0), 1_000_000);
    }

    #[test]
    fn min_out_slippage_max() {
        // 100% slippage = 0 min_out
        assert_eq!(min_out_with_slippage(1_000_000, 10_000), 0);
    }

    #[test]
    fn min_out_slippage_over_100_saturates() {
        // >100% slippage saturates to 0 (no underflow)
        assert_eq!(min_out_with_slippage(1_000_000, 15_000), 0);
    }

    // =========================================================================
    // RENORMALIZE WEIGHTS TESTS
    // =========================================================================

    #[test]
    fn renormalize_already_10000() {
        let mut weights = vec![6_000u16, 4_000u16];
        renormalize_weights_to_10000(&mut weights);
        let sum: u32 = weights.iter().map(|&w| w as u32).sum();
        assert_eq!(sum, 10_000);
    }

    #[test]
    fn renormalize_from_smaller_sum() {
        let mut weights = vec![600u16, 400u16]; // sum = 1000
        renormalize_weights_to_10000(&mut weights);
        let sum: u32 = weights.iter().map(|&w| w as u32).sum();
        assert_eq!(sum, 10_000, "Should renormalize to exactly 10_000");
    }

    #[test]
    fn renormalize_removes_zeros() {
        let mut weights = vec![5_000u16, 0u16, 5_000u16];
        renormalize_weights_to_10000(&mut weights);
        assert_eq!(weights.len(), 2, "Should remove zero-weight entry");
        let sum: u32 = weights.iter().map(|&w| w as u32).sum();
        assert_eq!(sum, 10_000);
    }

    #[test]
    fn renormalize_single_weight() {
        let mut weights = vec![5_000u16];
        renormalize_weights_to_10000(&mut weights);
        assert_eq!(weights, vec![10_000u16]);
    }

    #[test]
    fn renormalize_empty() {
        let mut weights: Vec<u16> = vec![];
        renormalize_weights_to_10000(&mut weights);
        assert!(weights.is_empty());
    }

    #[test]
    fn renormalize_all_zeros() {
        let mut weights = vec![0u16, 0u16, 0u16];
        renormalize_weights_to_10000(&mut weights);
        assert!(weights.is_empty(), "All-zero weights should result in empty");
    }

    #[test]
    fn renormalize_deterministic() {
        // Run twice with same input, should get same output
        let input = vec![3_000u16, 2_000u16, 5_000u16];
        let mut w1 = input.clone();
        let mut w2 = input.clone();
        renormalize_weights_to_10000(&mut w1);
        renormalize_weights_to_10000(&mut w2);
        assert_eq!(w1, w2, "Should be deterministic");
    }

    // =========================================================================
    // EDGE CASES & OVERFLOW PROTECTION
    // =========================================================================

    #[test]
    fn split_near_u64_max() {
        // Test with a value near u64::MAX
        let amount = u64::MAX - 1;
        let weights = vec![5_000u16, 5_000u16];
        let parts = split_amount_by_weights(amount, &weights).unwrap();
        let sum: u64 = parts.iter().sum();
        assert_eq!(sum, amount, "Should handle near-max values");
    }

    #[test]
    fn bps_computation_precision() {
        // 1 bps of 10_000 = 1
        assert_eq!(bps_of(10_000, 1), 1);
        // 1 bps of 9_999 = 0 (truncates)
        assert_eq!(bps_of(9_999, 1), 0);
    }
}
