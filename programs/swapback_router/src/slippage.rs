use anchor_lang::prelude::*;

/// Configuration for dynamic slippage calculation
#[derive(Clone, Copy)]
pub struct SlippageConfig {
    /// Base slippage in basis points (default: 50 = 0.5%)
    pub base_slippage_bps: u16,
    /// Maximum slippage cap in basis points (default: 500 = 5%)
    pub max_slippage_bps: u16,
    /// Size threshold for additional slippage (1% of pool = 100 bps)
    pub size_threshold_bps: u16,
    /// Volatility impact factor (divisor, default: 10)
    pub volatility_divisor: u16,
}

impl Default for SlippageConfig {
    fn default() -> Self {
        Self {
            base_slippage_bps: 50,   // 0.5%
            max_slippage_bps: 500,   // 5%
            size_threshold_bps: 100, // 1% of pool
            volatility_divisor: 10,
        }
    }
}

/// Result of dynamic slippage calculation with breakdown
#[derive(Clone, Copy, Debug)]
pub struct SlippageResult {
    /// Final slippage in basis points
    pub slippage_bps: u16,
    /// Base component
    pub base_component: u16,
    /// Size impact component
    pub size_component: u16,
    /// Volatility component
    pub volatility_component: u16,
}

/// Calculate dynamic slippage based on multiple factors
///
/// # Arguments
/// * `swap_amount` - Amount being swapped
/// * `pool_tvl` - Total value locked in the pool (liquidity)
/// * `volatility_bps` - Current market volatility from oracle (in bps)
/// * `config` - Optional configuration (uses default if None)
///
/// # Returns
/// * `SlippageResult` with breakdown of slippage components
pub fn calculate_dynamic_slippage_with_breakdown(
    swap_amount: u64,
    pool_tvl: u64,
    volatility_bps: u16,
    config: Option<SlippageConfig>,
) -> SlippageResult {
    let cfg = config.unwrap_or_default();

    let base_component = cfg.base_slippage_bps;

    // Size impact: Additional slippage when swap is > threshold % of pool
    let size_component = if pool_tvl > 0 {
        // Calculate size ratio in bps (swap / tvl * 10000)
        let size_ratio_bps = ((swap_amount as u128)
            .saturating_mul(10_000)
            .saturating_div(pool_tvl as u128)) as u16;

        // Add slippage for each bps above threshold
        size_ratio_bps.saturating_sub(cfg.size_threshold_bps)
    } else {
        // Unknown TVL: add 100 bps safety margin
        100
    };

    // Volatility impact: Higher volatility = higher slippage
    let volatility_component = if cfg.volatility_divisor > 0 {
        volatility_bps / cfg.volatility_divisor
    } else {
        0
    };

    // Sum components and cap
    let total = (base_component as u32)
        .saturating_add(size_component as u32)
        .saturating_add(volatility_component as u32)
        .min(cfg.max_slippage_bps as u32) as u16;

    SlippageResult {
        slippage_bps: total,
        base_component,
        size_component,
        volatility_component,
    }
}

/// Simple calculation returning just the slippage value
pub fn calculate_dynamic_slippage(
    _token_mint: &Pubkey,
    swap_amount: u64,
    pool_tvl: u64,
    volatility_bps: u16,
) -> Result<u16> {
    let result =
        calculate_dynamic_slippage_with_breakdown(swap_amount, pool_tvl, volatility_bps, None);
    Ok(result.slippage_bps)
}

/// Estimate pool TVL from Jupiter quote data
/// This extracts liquidity information from remaining accounts if available
pub fn estimate_pool_tvl_from_accounts(
    accounts: &[AccountInfo],
    token_a_decimals: u8,
    token_b_decimals: u8,
) -> u64 {
    // Default estimate if we can't determine
    let default_tvl = 1_000_000_000_000u64; // 1M USDC equivalent

    // Try to read pool reserves from known account layouts
    // Raydium AMM: vault accounts at indices 4 and 5
    if accounts.len() >= 6 {
        if let (Ok(data_a), Ok(data_b)) =
            (accounts[4].try_borrow_data(), accounts[5].try_borrow_data())
        {
            // SPL Token account layout: amount at offset 64
            if data_a.len() >= 72 && data_b.len() >= 72 {
                let amount_a = u64::from_le_bytes(data_a[64..72].try_into().unwrap_or([0u8; 8]));
                let amount_b = u64::from_le_bytes(data_b[64..72].try_into().unwrap_or([0u8; 8]));

                // Normalize to 6 decimals (USDC standard)
                let normalized_a = normalize_amount(amount_a, token_a_decimals, 6);
                let normalized_b = normalize_amount(amount_b, token_b_decimals, 6);

                // TVL = 2 * sqrt(a * b) approximation for AMM pools
                // Simplified: just sum both sides
                let tvl = normalized_a.saturating_add(normalized_b);
                if tvl > 0 {
                    return tvl;
                }
            }
        }
    }

    default_tvl
}

/// Normalize token amount to target decimals
fn normalize_amount(amount: u64, from_decimals: u8, to_decimals: u8) -> u64 {
    if from_decimals == to_decimals {
        amount
    } else if from_decimals > to_decimals {
        let divisor = 10u64.pow((from_decimals - to_decimals) as u32);
        amount / divisor
    } else {
        let multiplier = 10u64.pow((to_decimals - from_decimals) as u32);
        amount.saturating_mul(multiplier)
    }
}

/// Entrées pour slippage dynamique (tout en BPS/valeurs entières pour éviter floating fragile on-chain).
#[derive(Clone, Copy, Debug)]
pub struct DynamicSlippageInputs {
    pub amount_in: u64,
    /// Estimation de liquidité (ex: TVL, ou profondeur utile) fournie par keeper/off-chain.
    pub liquidity_est: u64,
    /// Volatilité estimée en BPS (ex: 0..=5000). 100 = 1%.
    pub volatility_bps: u16,
    /// Slippage de base en BPS (par défaut 50 = 0.5%).
    pub base_bps: u16,
    /// Minimum et maximum hard bounds.
    pub min_bps: u16,
    pub max_bps: u16,
}

/// Calcule un slippage effectif (BPS) :
/// - augmente avec le ratio amount/liquidité
/// - augmente avec volatility_bps
/// - borné entre min_bps et max_bps
pub fn calculate_dynamic_slippage_bps(i: DynamicSlippageInputs) -> u16 {
    let liquidity = i.liquidity_est.max(1);
    let ratio_bps = ((i.amount_in as u128).saturating_mul(10_000u128) / (liquidity as u128))
        .min(u128::from(u16::MAX)) as u16;
    // Impact = ratio_bps / 4 (adoucit), + volatility/2
    let amount_impact = ratio_bps / 4;
    let vol_impact = i.volatility_bps / 2;
    let raw = i
        .base_bps
        .saturating_add(amount_impact)
        .saturating_add(vol_impact);
    raw.clamp(i.min_bps, i.max_bps)
}

/// Applique slippage (BPS) à un expected_out → min_out.
pub fn min_out_from_expected(expected_out: u64, slippage_bps: u16) -> u64 {
    let keep_bps = 10_000u128.saturating_sub(slippage_bps as u128);
    ((expected_out as u128).saturating_mul(keep_bps) / 10_000u128) as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    // =========================================================================
    // LEGACY SLIPPAGE TESTS (calculate_dynamic_slippage_with_breakdown)
    // =========================================================================

    #[test]
    fn test_base_slippage() {
        let result = calculate_dynamic_slippage_with_breakdown(
            1_000_000,         // 1 USDC
            1_000_000_000_000, // 1M TVL
            0,                 // No volatility
            None,
        );
        assert_eq!(result.slippage_bps, 50); // Just base
        assert_eq!(result.base_component, 50);
        assert_eq!(result.size_component, 0);
        assert_eq!(result.volatility_component, 0);
    }

    #[test]
    fn test_large_swap_adds_slippage() {
        let result = calculate_dynamic_slippage_with_breakdown(
            50_000_000_000,    // 50k USDC (5% of pool)
            1_000_000_000_000, // 1M TVL
            0,
            None,
        );
        // 5% = 500 bps, threshold 100 bps, so +400 bps
        assert_eq!(result.size_component, 400);
        assert!(result.slippage_bps >= 450); // base 50 + size 400
    }

    #[test]
    fn test_volatility_adds_slippage() {
        let result = calculate_dynamic_slippage_with_breakdown(
            1_000_000,
            1_000_000_000_000,
            200, // 2% volatility
            None,
        );
        // volatility 200 / 10 = 20 bps
        assert_eq!(result.volatility_component, 20);
        assert_eq!(result.slippage_bps, 70); // 50 base + 20 volatility
    }

    #[test]
    fn test_slippage_capped_at_max() {
        let result = calculate_dynamic_slippage_with_breakdown(
            100_000_000_000, // 100k (10% of pool)
            1_000_000_000_000,
            500, // High volatility
            None,
        );
        assert_eq!(result.slippage_bps, 500); // Capped at 5%
    }

    #[test]
    fn test_zero_tvl_adds_safety_margin() {
        let result = calculate_dynamic_slippage_with_breakdown(
            1_000_000, 0, // Unknown TVL
            0, None,
        );
        assert_eq!(result.size_component, 100); // Safety margin
        assert_eq!(result.slippage_bps, 150); // 50 + 100
    }

    // =========================================================================
    // DYNAMIC SLIPPAGE (calculate_dynamic_slippage_bps) - BOUNDS TESTS
    // =========================================================================

    #[test]
    fn slippage_bounded() {
        let bps = calculate_dynamic_slippage_bps(DynamicSlippageInputs {
            amount_in: 1_000_000,
            liquidity_est: 10_000_000,
            volatility_bps: 200,
            base_bps: 50,
            min_bps: 10,
            max_bps: 800,
        });
        assert!(bps >= 10 && bps <= 800);
    }

    #[test]
    fn slippage_always_within_bounds_small() {
        let bps = calculate_dynamic_slippage_bps(DynamicSlippageInputs {
            amount_in: 1,
            liquidity_est: u64::MAX,
            volatility_bps: 0,
            base_bps: 50,
            min_bps: 10,
            max_bps: 800,
        });
        assert!(bps >= 10 && bps <= 800, "Small trade should be >= min_bps");
    }

    #[test]
    fn slippage_always_within_bounds_large() {
        let bps = calculate_dynamic_slippage_bps(DynamicSlippageInputs {
            amount_in: u64::MAX / 2,
            liquidity_est: 1,
            volatility_bps: 5000,
            base_bps: 50,
            min_bps: 10,
            max_bps: 800,
        });
        assert!(
            bps >= 10 && bps <= 800,
            "Large trade should be capped at max_bps"
        );
    }

    #[test]
    fn slippage_clamped_to_min() {
        let bps = calculate_dynamic_slippage_bps(DynamicSlippageInputs {
            amount_in: 100,
            liquidity_est: 1_000_000_000_000,
            volatility_bps: 0,
            base_bps: 5, // Very low base
            min_bps: 50,
            max_bps: 800,
        });
        assert_eq!(bps, 50, "Should clamp to min_bps when raw < min");
    }

    #[test]
    fn slippage_clamped_to_max() {
        let bps = calculate_dynamic_slippage_bps(DynamicSlippageInputs {
            amount_in: 1_000_000_000,
            liquidity_est: 100,
            volatility_bps: 5000,
            base_bps: 500,
            min_bps: 10,
            max_bps: 200,
        });
        assert_eq!(bps, 200, "Should clamp to max_bps when raw > max");
    }

    // =========================================================================
    // MONOTONICITY TESTS
    // =========================================================================

    #[test]
    fn slippage_monotonic_amount_in() {
        // Slippage should increase (or stay same) as amount_in increases
        let base_inputs = DynamicSlippageInputs {
            amount_in: 0,
            liquidity_est: 10_000_000,
            volatility_bps: 100,
            base_bps: 50,
            min_bps: 10,
            max_bps: 1000,
        };

        let amounts = [100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000];
        let mut prev_bps = 0u16;

        for amount in amounts {
            let bps = calculate_dynamic_slippage_bps(DynamicSlippageInputs {
                amount_in: amount,
                ..base_inputs
            });
            assert!(
                bps >= prev_bps,
                "Slippage should be monotonically increasing with amount_in"
            );
            prev_bps = bps;
        }
    }

    #[test]
    fn slippage_monotonic_liquidity_decreases() {
        // Slippage should decrease (or stay same) as liquidity increases
        // Note: Due to clamping, very high slippage values may be capped
        let base_inputs = DynamicSlippageInputs {
            amount_in: 1_000_000,
            liquidity_est: 0,
            volatility_bps: 100,
            base_bps: 50,
            min_bps: 10,
            max_bps: 1000,
        };

        // Test with increasing liquidity - slippage should decrease or stay same
        let liquidities = [
            100_000_000u64,
            1_000_000_000,
            10_000_000_000,
            100_000_000_000,
            1_000_000_000_000,
        ];
        let mut prev_bps = u16::MAX;

        for liquidity in liquidities {
            let bps = calculate_dynamic_slippage_bps(DynamicSlippageInputs {
                liquidity_est: liquidity,
                ..base_inputs
            });
            assert!(
                bps <= prev_bps,
                "Slippage should decrease or stay same as liquidity increases: prev={}, current={}",
                prev_bps,
                bps
            );
            prev_bps = bps;
        }
    }

    #[test]
    fn slippage_monotonic_volatility() {
        // Slippage should increase (or stay same) as volatility increases
        let base_inputs = DynamicSlippageInputs {
            amount_in: 1_000_000,
            liquidity_est: 100_000_000,
            volatility_bps: 0,
            base_bps: 50,
            min_bps: 10,
            max_bps: 2000,
        };

        let volatilities = [0u16, 50, 100, 200, 500, 1000];
        let mut prev_bps = 0u16;

        for vol in volatilities {
            let bps = calculate_dynamic_slippage_bps(DynamicSlippageInputs {
                volatility_bps: vol,
                ..base_inputs
            });
            assert!(bps >= prev_bps, "Slippage should increase with volatility");
            prev_bps = bps;
        }
    }

    // =========================================================================
    // MIN_OUT CONVERSION TESTS
    // =========================================================================

    #[test]
    fn min_out_decreases_with_slippage() {
        let e = 1_000_000u64;
        let m1 = min_out_from_expected(e, 50);
        let m2 = min_out_from_expected(e, 200);
        assert!(m2 < m1);
    }

    #[test]
    fn min_out_exact_50bps() {
        // expected_out=1_000_000, slippage=50 => 995_000
        let result = min_out_from_expected(1_000_000, 50);
        assert_eq!(result, 995_000);
    }

    #[test]
    fn min_out_exact_200bps() {
        // expected_out=1_000_000, slippage=200 => 980_000
        let result = min_out_from_expected(1_000_000, 200);
        assert_eq!(result, 980_000);
    }

    #[test]
    fn min_out_zero_slippage() {
        let result = min_out_from_expected(1_000_000, 0);
        assert_eq!(result, 1_000_000);
    }

    #[test]
    fn min_out_full_slippage() {
        let result = min_out_from_expected(1_000_000, 10_000);
        assert_eq!(result, 0);
    }

    #[test]
    fn min_out_high_value_no_overflow() {
        let high = u64::MAX / 2;
        let result = min_out_from_expected(high, 100);
        // Should be approximately 99% of high
        // Use u128 to avoid overflow in assertion
        let expected_min = (high as u128) * 98 / 100;
        let expected_max = high as u128;
        assert!((result as u128) > expected_min);
        assert!((result as u128) < expected_max);
    }

    // =========================================================================
    // EDGE CASES
    // =========================================================================

    #[test]
    fn slippage_zero_amount() {
        let bps = calculate_dynamic_slippage_bps(DynamicSlippageInputs {
            amount_in: 0,
            liquidity_est: 1_000_000,
            volatility_bps: 100,
            base_bps: 50,
            min_bps: 10,
            max_bps: 800,
        });
        // With zero amount, only base + volatility apply
        assert!(bps >= 10 && bps <= 800);
    }

    #[test]
    fn slippage_handles_very_low_liquidity() {
        let bps = calculate_dynamic_slippage_bps(DynamicSlippageInputs {
            amount_in: 1_000_000,
            liquidity_est: 1, // Near-zero liquidity (uses max(1))
            volatility_bps: 0,
            base_bps: 50,
            min_bps: 10,
            max_bps: 500,
        });
        assert_eq!(bps, 500, "Should cap at max when liquidity is very low");
    }

    #[test]
    fn slippage_deterministic() {
        let inputs = DynamicSlippageInputs {
            amount_in: 1_000_000,
            liquidity_est: 50_000_000,
            volatility_bps: 150,
            base_bps: 50,
            min_bps: 10,
            max_bps: 800,
        };
        let bps1 = calculate_dynamic_slippage_bps(inputs);
        let bps2 = calculate_dynamic_slippage_bps(inputs);
        assert_eq!(bps1, bps2, "Same inputs should produce same output");
    }

    // =========================================================================
    // NORMALIZE AMOUNT TESTS
    // =========================================================================

    #[test]
    fn normalize_same_decimals() {
        let result = normalize_amount(1_000_000, 6, 6);
        assert_eq!(result, 1_000_000);
    }

    #[test]
    fn normalize_more_to_less() {
        // 9 decimals to 6 decimals: divide by 1000
        let result = normalize_amount(1_000_000_000, 9, 6);
        assert_eq!(result, 1_000_000);
    }

    #[test]
    fn normalize_less_to_more() {
        // 6 decimals to 9 decimals: multiply by 1000
        let result = normalize_amount(1_000_000, 6, 9);
        assert_eq!(result, 1_000_000_000);
    }
}
