//! Tests for Fee and Rebate Calculations
//! Validates platform fees, NPI distribution, and boost calculations

#[cfg(test)]
mod tests {
    // Constants matching lib.rs
    const DEFAULT_REBATE_BPS: u16 = 7000; // 70% of NPI → Rebates
    const TREASURY_FROM_NPI_BPS: u16 = 1500; // 15% of NPI → Treasury
    const BOOST_VAULT_BPS: u16 = 1500; // 15% of NPI → Boost vault
    const PLATFORM_FEE_BPS: u16 = 20; // 0.2% platform fee
    const PLATFORM_FEE_TREASURY_BPS: u16 = 8500; // 85% of fees → Treasury
    const PLATFORM_FEE_BUYBURN_BPS: u16 = 1500; // 15% of fees → Buy&Burn

    /// Calculate fee based on amount and basis points
    fn calculate_fee(amount: u64, fee_bps: u16) -> u64 {
        ((amount as u128) * (fee_bps as u128) / 10_000) as u64
    }

    /// Calculate boosted rebate
    fn calculate_boosted_rebate(npi_amount: u64, rebate_bps: u16, boost_bp: u16) -> u64 {
        let base_rebate = calculate_fee(npi_amount, rebate_bps);
        let multiplier = 10_000u64 + boost_bp as u64;
        ((base_rebate as u128) * (multiplier as u128) / 10_000) as u64
    }

    // ========== NPI Distribution Tests ==========

    #[test]
    fn test_npi_distribution_sums_to_100_percent() {
        let total = DEFAULT_REBATE_BPS + TREASURY_FROM_NPI_BPS + BOOST_VAULT_BPS;
        assert_eq!(total, 10_000, "NPI distribution must sum to 100%");
    }

    #[test]
    fn test_npi_rebate_calculation() {
        let npi_amount = 1_000_000u64; // 1 USDC
        let rebate = calculate_fee(npi_amount, DEFAULT_REBATE_BPS);

        // 70% of 1 USDC = 0.7 USDC = 700,000
        assert_eq!(rebate, 700_000);
    }

    #[test]
    fn test_npi_treasury_calculation() {
        let npi_amount = 1_000_000u64;
        let treasury = calculate_fee(npi_amount, TREASURY_FROM_NPI_BPS);

        // 15% of 1 USDC = 0.15 USDC = 150,000
        assert_eq!(treasury, 150_000);
    }

    #[test]
    fn test_npi_boost_vault_calculation() {
        let npi_amount = 1_000_000u64;
        let boost_vault = calculate_fee(npi_amount, BOOST_VAULT_BPS);

        // 15% of 1 USDC = 0.15 USDC = 150,000
        assert_eq!(boost_vault, 150_000);
    }

    #[test]
    fn test_npi_full_distribution() {
        let npi_amount = 10_000_000u64; // 10 USDC

        let rebate = calculate_fee(npi_amount, DEFAULT_REBATE_BPS);
        let treasury = calculate_fee(npi_amount, TREASURY_FROM_NPI_BPS);
        let boost = calculate_fee(npi_amount, BOOST_VAULT_BPS);

        // Sum should equal original (within rounding)
        let total = rebate + treasury + boost;
        assert_eq!(total, npi_amount, "Full NPI should be distributed");
    }

    // ========== Platform Fee Tests ==========

    #[test]
    fn test_platform_fee_allocation_sums_to_100_percent() {
        let total = PLATFORM_FEE_TREASURY_BPS + PLATFORM_FEE_BUYBURN_BPS;
        assert_eq!(total, 10_000, "Platform fee allocation must sum to 100%");
    }

    #[test]
    fn test_platform_fee_calculation() {
        let swap_amount = 100_000_000u64; // 100 USDC
        let fee = calculate_fee(swap_amount, PLATFORM_FEE_BPS);

        // 0.2% of 100 USDC = 0.2 USDC = 200,000
        assert_eq!(fee, 200_000);
    }

    #[test]
    fn test_platform_fee_to_treasury() {
        let fee = 200_000u64; // 0.2 USDC fee
        let to_treasury = calculate_fee(fee, PLATFORM_FEE_TREASURY_BPS);

        // 85% of 0.2 USDC = 0.17 USDC = 170,000
        assert_eq!(to_treasury, 170_000);
    }

    #[test]
    fn test_platform_fee_to_buyburn() {
        let fee = 200_000u64;
        let to_buyburn = calculate_fee(fee, PLATFORM_FEE_BUYBURN_BPS);

        // 15% of 0.2 USDC = 0.03 USDC = 30,000
        assert_eq!(to_buyburn, 30_000);
    }

    #[test]
    fn test_platform_fee_full_distribution() {
        let swap_amount = 1_000_000_000u64; // 1000 USDC
        let fee = calculate_fee(swap_amount, PLATFORM_FEE_BPS);

        let to_treasury = calculate_fee(fee, PLATFORM_FEE_TREASURY_BPS);
        let to_buyburn = calculate_fee(fee, PLATFORM_FEE_BUYBURN_BPS);

        assert_eq!(to_treasury + to_buyburn, fee);
    }

    // ========== Boost Calculation Tests ==========

    #[test]
    fn test_boost_no_boost() {
        let npi = 1_000_000u64;
        let rebate = calculate_boosted_rebate(npi, DEFAULT_REBATE_BPS, 0);

        // Without boost, just 70% of NPI
        assert_eq!(rebate, 700_000);
    }

    #[test]
    fn test_boost_bronze_level() {
        // Bronze: 500 BP = 5% boost
        let npi = 1_000_000u64;
        let rebate = calculate_boosted_rebate(npi, DEFAULT_REBATE_BPS, 500);

        // Base: 700,000 (70%)
        // Boosted: 700,000 * 1.05 = 735,000
        assert_eq!(rebate, 735_000);
    }

    #[test]
    fn test_boost_silver_level() {
        // Silver: 1000 BP = 10% boost
        let npi = 1_000_000u64;
        let rebate = calculate_boosted_rebate(npi, DEFAULT_REBATE_BPS, 1000);

        // Base: 700,000 (70%)
        // Boosted: 700,000 * 1.10 = 770,000
        assert_eq!(rebate, 770_000);
    }

    #[test]
    fn test_boost_gold_level() {
        // Gold: 1500 BP = 15% boost
        let npi = 1_000_000u64;
        let rebate = calculate_boosted_rebate(npi, DEFAULT_REBATE_BPS, 1500);

        // Base: 700,000 (70%)
        // Boosted: 700,000 * 1.15 = 805,000
        assert_eq!(rebate, 805_000);
    }

    #[test]
    fn test_boost_platinum_level() {
        // Platinum: 2000 BP = 20% boost
        let npi = 1_000_000u64;
        let rebate = calculate_boosted_rebate(npi, DEFAULT_REBATE_BPS, 2000);

        // Base: 700,000 (70%)
        // Boosted: 700,000 * 1.20 = 840,000
        assert_eq!(rebate, 840_000);
    }

    #[test]
    fn test_boost_diamond_level() {
        // Diamond: 2300 BP = 23% boost
        let npi = 1_000_000u64;
        let rebate = calculate_boosted_rebate(npi, DEFAULT_REBATE_BPS, 2300);

        // Base: 700,000 (70%)
        // Boosted: 700,000 * 1.23 = 861,000
        assert_eq!(rebate, 861_000);
    }

    // ========== Edge Cases ==========

    #[test]
    fn test_zero_amount() {
        assert_eq!(calculate_fee(0, DEFAULT_REBATE_BPS), 0);
        assert_eq!(calculate_fee(0, PLATFORM_FEE_BPS), 0);
    }

    #[test]
    fn test_small_amount_rounding() {
        // Very small amount - tests rounding behavior
        let small_amount = 100u64; // 0.0001 USDC
        let fee = calculate_fee(small_amount, PLATFORM_FEE_BPS);

        // 0.2% of 100 = 0.2, rounds to 0
        assert_eq!(fee, 0);
    }

    #[test]
    fn test_minimum_fee_threshold() {
        // Find minimum amount for non-zero fee
        // fee = amount * 20 / 10000 >= 1
        // amount >= 10000 / 20 = 500
        let min_amount = 500u64;
        let fee = calculate_fee(min_amount, PLATFORM_FEE_BPS);

        assert_eq!(fee, 1, "Minimum fee should be 1 at threshold");
    }

    #[test]
    fn test_large_amount_no_overflow() {
        // Test with maximum realistic swap amount
        let large_amount = 1_000_000_000_000u64; // 1M USDC
        let fee = calculate_fee(large_amount, PLATFORM_FEE_BPS);

        // 0.2% of 1M = 2000 USDC = 2_000_000_000
        assert_eq!(fee, 2_000_000_000);
    }

    #[test]
    fn test_max_boost_no_overflow() {
        let large_npi = 100_000_000_000u64; // 100k USDC NPI
        let max_boost = 10_000u16; // 100% boost (theoretical max)

        let rebate = calculate_boosted_rebate(large_npi, DEFAULT_REBATE_BPS, max_boost);

        // 70% * 2 = 140% of NPI
        assert_eq!(rebate, 140_000_000_000);
    }

    // ========== Full Swap Flow Tests ==========

    #[test]
    fn test_complete_swap_flow() {
        let swap_amount = 100_000_000_000u64; // 100k USDC
        let min_out = 99_000_000_000u64; // Expected with slippage
        let amount_out = 99_500_000_000u64; // Actual output

        // 1. Calculate platform fee
        let platform_fee = calculate_fee(amount_out, PLATFORM_FEE_BPS);
        assert_eq!(platform_fee, 199_000_000); // ~0.2 USDC

        // 2. Calculate net amount
        let net_amount = amount_out - platform_fee;
        assert_eq!(net_amount, 99_301_000_000);

        // 3. Calculate NPI (routing profit)
        let npi = net_amount.saturating_sub(min_out);
        assert_eq!(npi, 301_000_000); // ~0.3 USDC profit

        // 4. Distribute NPI
        let rebate = calculate_fee(npi, DEFAULT_REBATE_BPS);
        let treasury = calculate_fee(npi, TREASURY_FROM_NPI_BPS);
        let boost_vault = calculate_fee(npi, BOOST_VAULT_BPS);

        assert_eq!(rebate, 210_700_000); // 70%
        assert_eq!(treasury, 45_150_000); // 15%
        assert_eq!(boost_vault, 45_150_000); // 15%

        // 5. Distribute platform fee
        let fee_treasury = calculate_fee(platform_fee, PLATFORM_FEE_TREASURY_BPS);
        let fee_buyburn = calculate_fee(platform_fee, PLATFORM_FEE_BUYBURN_BPS);

        assert_eq!(fee_treasury, 169_150_000); // 85%
        assert_eq!(fee_buyburn, 29_850_000); // 15%
    }

    #[test]
    fn test_swap_with_boost() {
        let npi = 1_000_000_000u64; // 1000 USDC NPI
        let user_boost = 2300u16; // Diamond level

        // Base rebate: 70% = 700 USDC
        let base_rebate = calculate_fee(npi, DEFAULT_REBATE_BPS);
        assert_eq!(base_rebate, 700_000_000);

        // Boost allocation: 15% = 150 USDC
        let boost_allocation = calculate_fee(npi, BOOST_VAULT_BPS);
        assert_eq!(boost_allocation, 150_000_000);

        // Boost amount: 23% of base = 161 USDC
        let boost_amount = calculate_fee(base_rebate, user_boost);
        assert_eq!(boost_amount, 161_000_000);

        // Boost paid: min(boost_amount, boost_allocation)
        let boost_paid = boost_amount.min(boost_allocation);
        assert_eq!(boost_paid, 150_000_000); // Capped at allocation

        // Total rebate to user
        let total_rebate = base_rebate + boost_paid;
        assert_eq!(total_rebate, 850_000_000); // 850 USDC

        // Remaining in boost vault
        let boost_remaining = boost_allocation - boost_paid;
        assert_eq!(boost_remaining, 0); // All used
    }
}
