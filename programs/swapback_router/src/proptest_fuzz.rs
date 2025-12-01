//! Property-based tests (fuzz) using proptest.
//! These tests verify invariants across a wide range of inputs.

#[cfg(test)]
mod proptest_tests {
    use proptest::prelude::*;
    use crate::slippage::{calculate_dynamic_slippage_bps, DynamicSlippageInputs, min_out_from_expected};
    use crate::math::{split_amount_by_weights, bps_of, renormalize_weights_to_10000};

    // =========================================================================
    // SLIPPAGE PROPERTY TESTS
    // =========================================================================

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(1000))]

        /// Slippage is always within [min_bps, max_bps]
        #[test]
        fn slippage_always_bounded(
            amount_in in 0u64..u64::MAX/2,
            liquidity in 1u64..u64::MAX/2,
            volatility in 0u16..5000u16,
            base_bps in 10u16..200u16,
            min_bps in 5u16..100u16,
            max_bps in 200u16..2000u16,
        ) {
            let actual_min = min_bps.min(max_bps);
            let actual_max = min_bps.max(max_bps);
            
            let bps = calculate_dynamic_slippage_bps(DynamicSlippageInputs {
                amount_in,
                liquidity_est: liquidity,
                volatility_bps: volatility,
                base_bps,
                min_bps: actual_min,
                max_bps: actual_max,
            });
            
            prop_assert!(bps >= actual_min, "Slippage {} < min {}", bps, actual_min);
            prop_assert!(bps <= actual_max, "Slippage {} > max {}", bps, actual_max);
        }

        /// Slippage increases (or stays same) as amount_in increases
        #[test]
        fn slippage_monotonic_in_amount(
            amount1 in 0u64..u64::MAX/4,
            amount2 in 0u64..u64::MAX/4,
            liquidity in 1u64..u64::MAX/4,
            volatility in 0u16..1000u16,
        ) {
            let inputs = DynamicSlippageInputs {
                amount_in: 0,
                liquidity_est: liquidity,
                volatility_bps: volatility,
                base_bps: 50,
                min_bps: 10,
                max_bps: 1000,
            };
            
            let bps1 = calculate_dynamic_slippage_bps(DynamicSlippageInputs { amount_in: amount1, ..inputs });
            let bps2 = calculate_dynamic_slippage_bps(DynamicSlippageInputs { amount_in: amount2, ..inputs });
            
            if amount1 <= amount2 {
                prop_assert!(bps1 <= bps2, "amount1 <= amount2 but bps1 {} > bps2 {}", bps1, bps2);
            } else {
                prop_assert!(bps1 >= bps2, "amount1 > amount2 but bps1 {} < bps2 {}", bps1, bps2);
            }
        }

        /// Slippage decreases (or stays same) as liquidity increases
        #[test]
        fn slippage_monotonic_in_liquidity(
            amount in 1u64..u64::MAX/4,
            liquidity1 in 1u64..u64::MAX/4,
            liquidity2 in 1u64..u64::MAX/4,
            volatility in 0u16..500u16,
        ) {
            let inputs = DynamicSlippageInputs {
                amount_in: amount,
                liquidity_est: 0,
                volatility_bps: volatility,
                base_bps: 50,
                min_bps: 10,
                max_bps: 1000,
            };
            
            let bps1 = calculate_dynamic_slippage_bps(DynamicSlippageInputs { liquidity_est: liquidity1, ..inputs });
            let bps2 = calculate_dynamic_slippage_bps(DynamicSlippageInputs { liquidity_est: liquidity2, ..inputs });
            
            if liquidity1 <= liquidity2 {
                prop_assert!(bps1 >= bps2, "liquidity1 <= liquidity2 but bps1 {} < bps2 {}", bps1, bps2);
            } else {
                prop_assert!(bps1 <= bps2, "liquidity1 > liquidity2 but bps1 {} > bps2 {}", bps1, bps2);
            }
        }

        /// No panic on any input combination
        #[test]
        fn slippage_no_panic(
            amount_in in 0u64..=u64::MAX,
            liquidity in 0u64..=u64::MAX,
            volatility in 0u16..=u16::MAX,
            base_bps in 0u16..=10000u16,
            min_bps in 0u16..=10000u16,
            max_bps in 0u16..=10000u16,
        ) {
            // Ensure min <= max for clamp to work
            let actual_min = min_bps.min(max_bps);
            let actual_max = min_bps.max(max_bps);
            let liquidity_safe = liquidity.max(1); // Avoid div by zero in formula
            
            let _ = calculate_dynamic_slippage_bps(DynamicSlippageInputs {
                amount_in,
                liquidity_est: liquidity_safe,
                volatility_bps: volatility,
                base_bps,
                min_bps: actual_min,
                max_bps: actual_max,
            });
        }
    }

    // =========================================================================
    // MIN_OUT PROPERTY TESTS
    // =========================================================================

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(1000))]

        /// min_out is always <= expected_out
        #[test]
        fn min_out_less_than_expected(
            expected_out in 0u64..=u64::MAX/2,
            slippage_bps in 0u16..=10000u16,
        ) {
            let min_out = min_out_from_expected(expected_out, slippage_bps);
            prop_assert!(min_out <= expected_out);
        }

        /// min_out decreases as slippage increases (monotonic)
        #[test]
        fn min_out_monotonic_slippage(
            expected_out in 1u64..=u64::MAX/2,
            slippage1 in 0u16..=5000u16,
            slippage2 in 0u16..=5000u16,
        ) {
            let m1 = min_out_from_expected(expected_out, slippage1);
            let m2 = min_out_from_expected(expected_out, slippage2);
            
            if slippage1 <= slippage2 {
                prop_assert!(m1 >= m2);
            } else {
                prop_assert!(m1 <= m2);
            }
        }
    }

    // =========================================================================
    // SPLIT AMOUNT PROPERTY TESTS
    // =========================================================================

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(500))]

        /// Sum of split parts equals original amount
        #[test]
        fn split_sum_equals_input(
            amount in 0u64..=u64::MAX/2,
            w1 in 0u16..=10000u16,
            w2 in 0u16..=10000u16,
            w3 in 0u16..=10000u16,
        ) {
            let weights: Vec<u16> = vec![w1, w2, w3].into_iter().filter(|&w| w > 0).collect();
            if weights.is_empty() {
                return Ok(());
            }
            
            let parts = split_amount_by_weights(amount, &weights).unwrap();
            let sum: u64 = parts.iter().sum();
            prop_assert_eq!(sum, amount, "Sum of parts must equal input amount");
        }

        /// Split handles large values without overflow
        #[test]
        fn split_no_overflow_large(
            amount in (u64::MAX/4)..=u64::MAX/2,
            w1 in 1u16..=5000u16,
            w2 in 1u16..=5000u16,
        ) {
            let weights = vec![w1, w2];
            let parts = split_amount_by_weights(amount, &weights).unwrap();
            let sum: u64 = parts.iter().sum();
            prop_assert_eq!(sum, amount);
        }
    }

    // =========================================================================
    // BPS CALCULATION PROPERTY TESTS
    // =========================================================================

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(1000))]

        /// bps_of result is <= value when bps <= 10000
        #[test]
        fn bps_of_bounded(
            value in 0u64..=u64::MAX/2,
            bps in 0u16..=10000u16,
        ) {
            let result = bps_of(value, bps);
            prop_assert!(result <= value, "bps_of({}, {}) = {} > {}", value, bps, result, value);
        }

        /// bps_of(value, 10000) == value
        #[test]
        fn bps_of_100_percent(value in 0u64..=u64::MAX/2) {
            let result = bps_of(value, 10000);
            prop_assert_eq!(result, value);
        }

        /// bps_of(value, 0) == 0
        #[test]
        fn bps_of_zero_percent(value in 0u64..=u64::MAX) {
            let result = bps_of(value, 0);
            prop_assert_eq!(result, 0);
        }
    }

    // =========================================================================
    // RENORMALIZE WEIGHTS PROPERTY TESTS
    // =========================================================================

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(500))]

        /// After renormalization, sum is exactly 10_000 (if non-empty)
        #[test]
        fn renormalize_sum_is_10000(
            w1 in 1u16..=10000u16,
            w2 in 0u16..=10000u16,
            w3 in 0u16..=10000u16,
        ) {
            let mut weights: Vec<u16> = vec![w1, w2, w3];
            renormalize_weights_to_10000(&mut weights);
            
            if !weights.is_empty() {
                let sum: u32 = weights.iter().map(|&w| w as u32).sum();
                prop_assert_eq!(sum, 10000, "Sum after renormalize should be 10000");
            }
        }

        /// Renormalization is idempotent (applying twice = applying once)
        #[test]
        fn renormalize_idempotent(
            w1 in 1u16..=5000u16,
            w2 in 1u16..=5000u16,
        ) {
            let original = vec![w1, w2];
            let mut once = original.clone();
            renormalize_weights_to_10000(&mut once);
            
            let mut twice = once.clone();
            renormalize_weights_to_10000(&mut twice);
            
            prop_assert_eq!(once, twice, "Renormalize should be idempotent");
        }

        /// No weights become negative or overflow
        #[test]
        fn renormalize_no_overflow(
            w1 in 0u16..=u16::MAX,
            w2 in 0u16..=u16::MAX,
            w3 in 0u16..=u16::MAX,
        ) {
            let mut weights = vec![w1, w2, w3];
            renormalize_weights_to_10000(&mut weights);
            
            for &w in &weights {
                prop_assert!(w <= 10000, "Weight {} > 10000", w);
            }
        }
    }
}
