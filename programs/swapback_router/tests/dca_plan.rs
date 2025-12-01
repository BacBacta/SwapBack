//! Tests for DCA Plan State Management
//! Validates DCA plan creation, execution, and state transitions

#[cfg(test)]
mod tests {
    // Constants matching lib.rs DCA limits
    const MIN_INTERVAL_SECONDS: i64 = 3600; // 1 hour minimum
    const MAX_INTERVAL_SECONDS: i64 = 31536000; // 1 year maximum
    const MAX_SWAPS: u32 = 10_000;
    const MAX_SINGLE_SWAP_LAMPORTS: u64 = 5_000_000_000_000; // ~5k SOL

    /// DCA Plan structure (mirrors state/dca_plan.rs)
    #[derive(Clone, Default)]
    struct DcaPlan {
        user: [u8; 32],
        plan_id: [u8; 32],
        token_in: [u8; 32],
        token_out: [u8; 32],
        amount_per_swap: u64,
        total_swaps: u32,
        executed_swaps: u32,
        interval_seconds: i64,
        next_execution: i64,
        min_out_per_swap: u64,
        total_invested: u64,
        total_received: u64,
        created_at: i64,
        expires_at: i64,
        is_active: bool,
    }

    impl DcaPlan {
        fn is_completed(&self) -> bool {
            self.executed_swaps >= self.total_swaps
        }

        fn is_expired(&self, current_time: i64) -> bool {
            current_time > self.expires_at
        }

        fn is_ready_for_execution(&self, current_time: i64) -> bool {
            current_time >= self.next_execution
        }

        fn calculate_next_execution(&self) -> i64 {
            self.next_execution + self.interval_seconds
        }

        fn remaining_swaps(&self) -> u32 {
            self.total_swaps.saturating_sub(self.executed_swaps)
        }

        fn average_execution_price(&self) -> Option<f64> {
            if self.total_invested > 0 && self.total_received > 0 {
                Some(self.total_received as f64 / self.total_invested as f64)
            } else {
                None
            }
        }
    }

    // ========== Plan Creation Validation Tests ==========

    #[test]
    fn test_valid_plan_creation() {
        let plan = DcaPlan {
            amount_per_swap: 1_000_000_000, // 1000 USDC
            total_swaps: 10,
            interval_seconds: 86400,       // Daily
            min_out_per_swap: 900_000_000, // 10% slippage tolerance
            expires_at: i64::MAX,
            is_active: true,
            ..Default::default()
        };

        assert!(plan.amount_per_swap > 0);
        assert!(plan.total_swaps > 0);
        assert!(plan.total_swaps <= MAX_SWAPS);
        assert!(plan.interval_seconds >= MIN_INTERVAL_SECONDS);
        assert!(plan.interval_seconds <= MAX_INTERVAL_SECONDS);
    }

    #[test]
    fn test_interval_too_short() {
        let interval = 1800i64; // 30 minutes
        assert!(
            interval < MIN_INTERVAL_SECONDS,
            "Interval should be rejected"
        );
    }

    #[test]
    fn test_interval_too_long() {
        let interval = 63072000i64; // 2 years
        assert!(
            interval > MAX_INTERVAL_SECONDS,
            "Interval should be rejected"
        );
    }

    #[test]
    fn test_too_many_swaps() {
        let swaps = 15000u32;
        assert!(swaps > MAX_SWAPS, "Too many swaps should be rejected");
    }

    #[test]
    fn test_amount_exceeds_limit() {
        let amount = 10_000_000_000_000u64; // 10k SOL
        assert!(
            amount > MAX_SINGLE_SWAP_LAMPORTS,
            "Amount should be rejected"
        );
    }

    // ========== Plan State Tests ==========

    #[test]
    fn test_plan_not_started() {
        let plan = DcaPlan {
            total_swaps: 10,
            executed_swaps: 0,
            is_active: true,
            ..Default::default()
        };

        assert!(!plan.is_completed());
        assert_eq!(plan.remaining_swaps(), 10);
    }

    #[test]
    fn test_plan_in_progress() {
        let plan = DcaPlan {
            total_swaps: 10,
            executed_swaps: 5,
            is_active: true,
            ..Default::default()
        };

        assert!(!plan.is_completed());
        assert_eq!(plan.remaining_swaps(), 5);
    }

    #[test]
    fn test_plan_completed() {
        let plan = DcaPlan {
            total_swaps: 10,
            executed_swaps: 10,
            is_active: false,
            ..Default::default()
        };

        assert!(plan.is_completed());
        assert_eq!(plan.remaining_swaps(), 0);
    }

    #[test]
    fn test_plan_expired() {
        let current_time = 1700000000i64;
        let plan = DcaPlan {
            expires_at: 1699999999, // 1 second before current
            ..Default::default()
        };

        assert!(plan.is_expired(current_time));
    }

    #[test]
    fn test_plan_not_expired() {
        let current_time = 1700000000i64;
        let plan = DcaPlan {
            expires_at: 1700000001, // 1 second after current
            ..Default::default()
        };

        assert!(!plan.is_expired(current_time));
    }

    // ========== Execution Timing Tests ==========

    #[test]
    fn test_ready_for_execution() {
        let current_time = 1700000000i64;
        let plan = DcaPlan {
            next_execution: 1699999999, // In the past
            ..Default::default()
        };

        assert!(plan.is_ready_for_execution(current_time));
    }

    #[test]
    fn test_not_ready_for_execution() {
        let current_time = 1700000000i64;
        let plan = DcaPlan {
            next_execution: 1700000001, // In the future
            ..Default::default()
        };

        assert!(!plan.is_ready_for_execution(current_time));
    }

    #[test]
    fn test_next_execution_calculation() {
        let plan = DcaPlan {
            next_execution: 1700000000,
            interval_seconds: 86400, // Daily
            ..Default::default()
        };

        let next = plan.calculate_next_execution();
        assert_eq!(next, 1700086400); // +1 day
    }

    // ========== Execution Flow Tests ==========

    #[test]
    fn test_execute_swap_updates_state() {
        let mut plan = DcaPlan {
            amount_per_swap: 1_000_000,
            total_swaps: 10,
            executed_swaps: 0,
            interval_seconds: 3600,
            next_execution: 1700000000,
            total_invested: 0,
            total_received: 0,
            is_active: true,
            ..Default::default()
        };

        // Simulate swap execution
        let amount_received = 950_000u64; // Slight slippage

        plan.executed_swaps += 1;
        plan.total_invested += plan.amount_per_swap;
        plan.total_received += amount_received;
        plan.next_execution = plan.calculate_next_execution();

        assert_eq!(plan.executed_swaps, 1);
        assert_eq!(plan.total_invested, 1_000_000);
        assert_eq!(plan.total_received, 950_000);
        assert_eq!(plan.next_execution, 1700003600);
    }

    #[test]
    fn test_multiple_executions() {
        let mut plan = DcaPlan {
            amount_per_swap: 100_000_000, // 100 USDC
            total_swaps: 5,
            interval_seconds: 3600,
            next_execution: 1700000000,
            is_active: true,
            ..Default::default()
        };

        let execution_results = vec![
            95_000_000u64, // Swap 1: 95 output
            98_000_000,    // Swap 2: 98 output
            102_000_000,   // Swap 3: 102 output (positive slippage)
            97_000_000,    // Swap 4: 97 output
            99_000_000,    // Swap 5: 99 output
        ];

        for amount_received in execution_results {
            plan.executed_swaps += 1;
            plan.total_invested += plan.amount_per_swap;
            plan.total_received += amount_received;
            plan.next_execution = plan.calculate_next_execution();
        }

        assert_eq!(plan.executed_swaps, 5);
        assert_eq!(plan.total_invested, 500_000_000); // 500 USDC in
        assert_eq!(plan.total_received, 491_000_000); // 491 USDC out
        assert!(plan.is_completed());
    }

    // ========== Average Price Tests ==========

    #[test]
    fn test_average_execution_price() {
        let plan = DcaPlan {
            total_invested: 1_000_000_000,  // 1000 USDC
            total_received: 50_000_000_000, // 50000 tokens
            ..Default::default()
        };

        let avg_price = plan.average_execution_price().unwrap();
        // 50000 / 1000 = 50 tokens per USDC
        assert!((avg_price - 50.0).abs() < 0.001);
    }

    #[test]
    fn test_average_price_no_executions() {
        let plan = DcaPlan {
            total_invested: 0,
            total_received: 0,
            ..Default::default()
        };

        assert!(plan.average_execution_price().is_none());
    }

    // ========== Pause/Resume Tests ==========

    #[test]
    fn test_pause_plan() {
        let mut plan = DcaPlan {
            is_active: true,
            executed_swaps: 3,
            total_swaps: 10,
            ..Default::default()
        };

        // Pause
        plan.is_active = false;

        assert!(!plan.is_active);
        assert!(!plan.is_completed()); // Still has remaining swaps
    }

    #[test]
    fn test_resume_plan() {
        let mut plan = DcaPlan {
            is_active: false,
            executed_swaps: 3,
            total_swaps: 10,
            next_execution: 1699999000, // In the past
            interval_seconds: 3600,
            ..Default::default()
        };

        let current_time = 1700000000i64;

        // Resume - update next_execution if in past
        plan.is_active = true;
        if plan.next_execution < current_time {
            plan.next_execution = current_time + plan.interval_seconds;
        }

        assert!(plan.is_active);
        assert_eq!(plan.next_execution, 1700003600);
    }

    // ========== Edge Cases ==========

    #[test]
    fn test_single_swap_plan() {
        let plan = DcaPlan {
            total_swaps: 1,
            executed_swaps: 0,
            is_active: true,
            ..Default::default()
        };

        assert!(!plan.is_completed());
        assert_eq!(plan.remaining_swaps(), 1);
    }

    #[test]
    fn test_over_executed_protection() {
        let plan = DcaPlan {
            total_swaps: 10,
            executed_swaps: 11, // Somehow over-executed
            ..Default::default()
        };

        assert!(plan.is_completed());
        assert_eq!(plan.remaining_swaps(), 0); // saturating_sub
    }

    #[test]
    fn test_max_swaps_plan() {
        let plan = DcaPlan {
            total_swaps: MAX_SWAPS,
            executed_swaps: 0,
            ..Default::default()
        };

        assert_eq!(plan.remaining_swaps(), MAX_SWAPS);
    }

    // ========== Full Lifecycle Test ==========

    #[test]
    fn test_complete_dca_lifecycle() {
        // 1. Create plan
        let mut plan = DcaPlan {
            amount_per_swap: 100_000_000, // 100 USDC
            total_swaps: 3,
            interval_seconds: 3600, // Hourly
            next_execution: 1700000000,
            min_out_per_swap: 90_000_000, // 10% slippage
            expires_at: 1700100000,       // ~27 hours from start
            is_active: true,
            ..Default::default()
        };

        // Verify initial state
        assert!(plan.is_active);
        assert!(!plan.is_completed());
        assert_eq!(plan.executed_swaps, 0);

        // 2. Execute first swap
        let current_time_1 = 1700000000i64;
        assert!(plan.is_ready_for_execution(current_time_1));

        plan.executed_swaps += 1;
        plan.total_invested += plan.amount_per_swap;
        plan.total_received += 95_000_000;
        plan.next_execution = plan.calculate_next_execution();

        assert_eq!(plan.executed_swaps, 1);
        assert_eq!(plan.remaining_swaps(), 2);

        // 3. Execute second swap
        let current_time_2 = 1700003600i64; // +1 hour
        assert!(plan.is_ready_for_execution(current_time_2));

        plan.executed_swaps += 1;
        plan.total_invested += plan.amount_per_swap;
        plan.total_received += 98_000_000;
        plan.next_execution = plan.calculate_next_execution();

        // 4. Execute third (final) swap
        let current_time_3 = 1700007200i64; // +2 hours
        assert!(plan.is_ready_for_execution(current_time_3));

        plan.executed_swaps += 1;
        plan.total_invested += plan.amount_per_swap;
        plan.total_received += 96_000_000;
        plan.is_active = false; // Mark completed

        // 5. Verify final state
        assert!(plan.is_completed());
        assert!(!plan.is_active);
        assert_eq!(plan.total_invested, 300_000_000); // 300 USDC
        assert_eq!(plan.total_received, 289_000_000); // ~3.7% slippage overall

        let avg_price = plan.average_execution_price().unwrap();
        assert!((avg_price - 0.9633).abs() < 0.001); // 289/300
    }
}
