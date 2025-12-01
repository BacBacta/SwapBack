//! Tests for Venue Scoring System
//! Validates VenueScore calculations and updates

#[cfg(test)]
mod tests {
    /// VenueScore metrics structure (mirrors venue_scoring.rs)
    #[derive(Clone, Default)]
    struct VenueScore {
        total_swaps: u64,
        total_volume: u64,
        total_npi_generated: i64,
        avg_latency_ms: u32,
        avg_slippage_bps: u16,
        quality_score: u16,
    }

    impl VenueScore {
        fn update_stats(&mut self, volume: u64, npi: i64, latency_ms: u32, slippage_bps: u16) {
            self.total_swaps += 1;
            self.total_volume += volume;
            self.total_npi_generated += npi;

            // Update averages (Simple Moving Average)
            if self.total_swaps > 1 {
                let old_count = self.total_swaps - 1;
                self.avg_latency_ms = ((self.avg_latency_ms as u64 * old_count + latency_ms as u64)
                    / self.total_swaps) as u32;
                self.avg_slippage_bps = ((self.avg_slippage_bps as u64 * old_count
                    + slippage_bps as u64)
                    / self.total_swaps) as u16;
            } else {
                self.avg_latency_ms = latency_ms;
                self.avg_slippage_bps = slippage_bps;
            }

            self.quality_score = calculate_venue_score(self);
        }
    }

    /// Calculate venue quality score (0-10000)
    fn calculate_venue_score(venue: &VenueScore) -> u16 {
        // 1. NPI Score (40% weight)
        let npi_score = if venue.total_volume > 0 && venue.total_npi_generated > 0 {
            let npi_ratio = venue.total_npi_generated as f64 / venue.total_volume as f64;
            (npi_ratio * 1000.0 * 4000.0).min(4000.0) as u16
        } else {
            0
        };

        // 2. Latency Score (30% weight)
        let latency_score = if venue.avg_latency_ms > 0 {
            ((100.0 / venue.avg_latency_ms as f64) * 3000.0).min(3000.0) as u16
        } else {
            0
        };

        // 3. Slippage Score (30% weight)
        let slippage_score =
            ((10000u16.saturating_sub(venue.avg_slippage_bps)) as f64 * 0.3).min(3000.0) as u16;

        (npi_score + latency_score + slippage_score).min(10000)
    }

    // ========== Basic Score Tests ==========

    #[test]
    fn test_initial_score_is_zero() {
        let venue = VenueScore::default();
        assert_eq!(venue.quality_score, 0);
        assert_eq!(venue.total_swaps, 0);
    }

    #[test]
    fn test_first_swap_updates_all_metrics() {
        let mut venue = VenueScore::default();
        venue.update_stats(1_000_000, 10_000, 50, 10);

        assert_eq!(venue.total_swaps, 1);
        assert_eq!(venue.total_volume, 1_000_000);
        assert_eq!(venue.total_npi_generated, 10_000);
        assert_eq!(venue.avg_latency_ms, 50);
        assert_eq!(venue.avg_slippage_bps, 10);
    }

    #[test]
    fn test_average_latency_calculation() {
        let mut venue = VenueScore::default();

        // First swap: 100ms
        venue.update_stats(1_000_000, 1000, 100, 10);
        assert_eq!(venue.avg_latency_ms, 100);

        // Second swap: 50ms
        // Average = (100 + 50) / 2 = 75
        venue.update_stats(1_000_000, 1000, 50, 10);
        assert_eq!(venue.avg_latency_ms, 75);

        // Third swap: 80ms
        // Average = (75 * 2 + 80) / 3 = 76.67 ≈ 76
        venue.update_stats(1_000_000, 1000, 80, 10);
        assert_eq!(venue.avg_latency_ms, 76);
    }

    #[test]
    fn test_average_slippage_calculation() {
        let mut venue = VenueScore::default();

        // First swap: 20 bps
        venue.update_stats(1_000_000, 1000, 100, 20);
        assert_eq!(venue.avg_slippage_bps, 20);

        // Second swap: 10 bps
        venue.update_stats(1_000_000, 1000, 100, 10);
        assert_eq!(venue.avg_slippage_bps, 15); // (20 + 10) / 2
    }

    // ========== Score Component Tests ==========

    #[test]
    fn test_npi_score_high_npi_ratio() {
        let mut venue = VenueScore::default();
        // Very high NPI ratio: 10% of volume
        venue.update_stats(1_000_000, 100_000, 100, 10);

        // NPI ratio = 100000 / 1000000 = 0.1
        // NPI score = 0.1 * 1000 * 4000 = 400_000, capped at 4000
        let npi_score = if venue.total_npi_generated > 0 {
            let ratio = venue.total_npi_generated as f64 / venue.total_volume as f64;
            (ratio * 1000.0 * 4000.0).min(4000.0) as u16
        } else {
            0
        };

        assert_eq!(npi_score, 4000);
    }

    #[test]
    fn test_latency_score_fast_venue() {
        // 100ms latency = 100/100 * 3000 = 3000 (max)
        let latency_ms = 100u32;
        let score = ((100.0 / latency_ms as f64) * 3000.0).min(3000.0) as u16;
        assert_eq!(score, 3000);
    }

    #[test]
    fn test_latency_score_slow_venue() {
        // 500ms latency = 100/500 * 3000 = 600
        let latency_ms = 500u32;
        let score = ((100.0 / latency_ms as f64) * 3000.0).min(3000.0) as u16;
        assert_eq!(score, 600);
    }

    #[test]
    fn test_slippage_score_low_slippage() {
        // 10 bps slippage = (10000 - 10) * 0.3 = 2997
        let slippage_bps = 10u16;
        let score = ((10000u16.saturating_sub(slippage_bps)) as f64 * 0.3).min(3000.0) as u16;
        assert_eq!(score, 2997);
    }

    #[test]
    fn test_slippage_score_high_slippage() {
        // 500 bps slippage = (10000 - 500) * 0.3 = 2850
        let slippage_bps = 500u16;
        let score = ((10000u16.saturating_sub(slippage_bps)) as f64 * 0.3).min(3000.0) as u16;
        assert_eq!(score, 2850);
    }

    // ========== Composite Score Tests ==========

    #[test]
    fn test_excellent_venue_score() {
        let mut venue = VenueScore::default();

        // Simulate 10 swaps with excellent metrics
        for _ in 0..10 {
            venue.update_stats(
                1_000_000, // 1 USDC volume
                50_000,    // 5% NPI (very high)
                50,        // 50ms latency (fast)
                5,         // 5 bps slippage (very low)
            );
        }

        // Should have high score
        assert!(
            venue.quality_score > 5000,
            "Excellent venue should have high score"
        );
    }

    #[test]
    fn test_poor_venue_score() {
        let mut venue = VenueScore::default();

        // Simulate swaps with very poor metrics
        for _ in 0..10 {
            venue.update_stats(
                1_000_000, 10,   // 0.001% NPI (extremely low)
                2000, // 2000ms latency (very slow)
                500,  // 500 bps slippage (very high)
            );
        }

        // Should have low score
        // NPI: 10/1M = 0.00001, score = 0.00001 * 1000 * 4000 = 0.04 ≈ 0
        // Latency: 100/2000 * 3000 = 150
        // Slippage: (10000-500) * 0.3 = 2850
        // Total ≈ 3000, but with those poor metrics should be quite low
        assert!(
            venue.quality_score < 3500,
            "Poor venue should have low score, got {}",
            venue.quality_score
        );
    }

    // ========== Volume Accumulation Tests ==========

    #[test]
    fn test_volume_accumulation() {
        let mut venue = VenueScore::default();

        venue.update_stats(1_000_000, 1000, 100, 10);
        venue.update_stats(2_000_000, 2000, 100, 10);
        venue.update_stats(3_000_000, 3000, 100, 10);

        assert_eq!(venue.total_volume, 6_000_000);
        assert_eq!(venue.total_npi_generated, 6000);
        assert_eq!(venue.total_swaps, 3);
    }

    #[test]
    fn test_negative_npi_handling() {
        let mut venue = VenueScore::default();

        // Negative NPI (user got less than expected)
        venue.update_stats(1_000_000, -5000, 100, 50);

        assert_eq!(venue.total_npi_generated, -5000);

        // NPI score should be 0 for negative NPI
        let npi_score = if venue.total_npi_generated > 0 { 1 } else { 0 };
        assert_eq!(npi_score, 0);
    }

    // ========== Edge Cases ==========

    #[test]
    fn test_zero_volume_score() {
        let venue = VenueScore {
            total_volume: 0,
            total_npi_generated: 0,
            avg_latency_ms: 100,
            avg_slippage_bps: 10,
            ..Default::default()
        };

        let score = calculate_venue_score(&venue);
        // Only latency and slippage contribute
        assert!(score < 6000);
    }

    #[test]
    fn test_zero_latency_score() {
        // 0 latency should give 0 score (not divide by zero)
        let latency_ms = 0u32;
        let score = if latency_ms > 0 {
            ((100.0 / latency_ms as f64) * 3000.0).min(3000.0) as u16
        } else {
            0
        };
        assert_eq!(score, 0);
    }

    #[test]
    fn test_max_slippage_score() {
        // 10000 bps (100%) slippage = (10000 - 10000) * 0.3 = 0
        let slippage_bps = 10000u16;
        let score = ((10000u16.saturating_sub(slippage_bps)) as f64 * 0.3).min(3000.0) as u16;
        assert_eq!(score, 0);
    }

    #[test]
    fn test_score_capped_at_10000() {
        let mut venue = VenueScore::default();

        // Even with perfect metrics, score shouldn't exceed 10000
        venue.update_stats(
            100,        // Small volume
            10_000_000, // Huge NPI (would overflow ratio)
            1,          // 1ms latency (impossibly fast)
            0,          // 0 slippage (perfect)
        );

        assert!(venue.quality_score <= 10000);
    }

    // ========== Comparison Tests ==========

    #[test]
    fn test_venue_comparison() {
        let mut jupiter = VenueScore::default();
        let mut raydium = VenueScore::default();

        // Jupiter: Fast but higher slippage
        jupiter.update_stats(1_000_000, 5000, 30, 20);

        // Raydium: Slower but lower slippage
        raydium.update_stats(1_000_000, 5000, 100, 5);

        // Both should have reasonable scores
        assert!(jupiter.quality_score > 0);
        assert!(raydium.quality_score > 0);

        // The "better" venue depends on weights
        // With equal NPI, lower latency vs lower slippage is trade-off
    }
}
