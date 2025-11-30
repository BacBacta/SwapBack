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
            base_slippage_bps: 50,      // 0.5%
            max_slippage_bps: 500,      // 5%
            size_threshold_bps: 100,    // 1% of pool
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
    let result = calculate_dynamic_slippage_with_breakdown(
        swap_amount,
        pool_tvl,
        volatility_bps,
        None,
    );
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
        if let (Ok(data_a), Ok(data_b)) = (
            accounts[4].try_borrow_data(),
            accounts[5].try_borrow_data(),
        ) {
            // SPL Token account layout: amount at offset 64
            if data_a.len() >= 72 && data_b.len() >= 72 {
                let amount_a = u64::from_le_bytes(
                    data_a[64..72].try_into().unwrap_or([0u8; 8])
                );
                let amount_b = u64::from_le_bytes(
                    data_b[64..72].try_into().unwrap_or([0u8; 8])
                );
                
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_base_slippage() {
        let result = calculate_dynamic_slippage_with_breakdown(
            1_000_000, // 1 USDC
            1_000_000_000_000, // 1M TVL
            0, // No volatility
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
            50_000_000_000, // 50k USDC (5% of pool)
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
            1_000_000,
            0, // Unknown TVL
            0,
            None,
        );
        assert_eq!(result.size_component, 100); // Safety margin
        assert_eq!(result.slippage_bps, 150); // 50 + 100
    }
}
