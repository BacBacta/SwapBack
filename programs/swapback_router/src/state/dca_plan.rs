use anchor_lang::prelude::*;

/// DCA Plan Account - Manages Dollar Cost Averaging orders
///
/// This account stores all information needed for automated DCA execution:
/// - Token pair (input/output)
/// - Amount per swap
/// - Execution frequency (interval in seconds)
/// - Total number of swaps and progress tracking
/// - Pause/Resume capability
#[account]
pub struct DcaPlan {
    /// Unique identifier for this plan (32 bytes for flexibility)
    pub plan_id: [u8; 32],

    /// User who owns this DCA plan
    pub user: Pubkey,

    /// Input token mint (token being sold)
    pub token_in: Pubkey,

    /// Output token mint (token being bought)
    pub token_out: Pubkey,

    /// Amount of input token per swap (in lamports/smallest unit)
    pub amount_per_swap: u64,

    /// Total number of swaps to execute
    pub total_swaps: u32,

    /// Number of swaps already executed
    pub executed_swaps: u32,

    /// Interval between swaps in seconds
    /// Examples: 3600 (1h), 86400 (1d), 604800 (1w), 2592000 (30d)
    pub interval_seconds: i64,

    /// Unix timestamp of next scheduled execution
    pub next_execution: i64,

    /// Minimum amount of output token per swap (slippage protection)
    pub min_out_per_swap: u64,

    /// Unix timestamp when plan was created
    pub created_at: i64,

    /// Unix timestamp when plan expires (optional, 0 = no expiry)
    pub expires_at: i64,

    /// Whether the plan is active (can be paused by user)
    pub is_active: bool,

    /// Total amount invested so far (tracking)
    pub total_invested: u64,

    /// Total amount received so far (tracking)
    pub total_received: u64,

    /// PDA bump seed
    pub bump: u8,
}

impl DcaPlan {
    /// Calculate space needed for DCA Plan account
    ///
    /// Layout:
    /// - Discriminator: 8 bytes
    /// - plan_id: 32 bytes
    /// - user: 32 bytes  
    /// - token_in: 32 bytes
    /// - token_out: 32 bytes
    /// - amount_per_swap: 8 bytes
    /// - total_swaps: 4 bytes
    /// - executed_swaps: 4 bytes
    /// - interval_seconds: 8 bytes
    /// - next_execution: 8 bytes
    /// - min_out_per_swap: 8 bytes
    /// - created_at: 8 bytes
    /// - expires_at: 8 bytes
    /// - is_active: 1 byte
    /// - total_invested: 8 bytes
    /// - total_received: 8 bytes
    /// - bump: 1 byte
    pub const LEN: usize = 8 + 32 + 32 + 32 + 32 + 8 + 4 + 4 + 8 + 8 + 8 + 8 + 8 + 1 + 8 + 8 + 1;

    /// Check if plan is ready for execution
    pub fn is_ready_for_execution(&self, current_timestamp: i64) -> bool {
        self.is_active
            && self.executed_swaps < self.total_swaps
            && current_timestamp >= self.next_execution
            && (self.expires_at == 0 || current_timestamp < self.expires_at)
    }

    /// Check if plan is completed
    pub fn is_completed(&self) -> bool {
        self.executed_swaps >= self.total_swaps
    }

    /// Check if plan is expired
    pub fn is_expired(&self, current_timestamp: i64) -> bool {
        self.expires_at > 0 && current_timestamp >= self.expires_at
    }

    /// Calculate next execution timestamp after a swap
    pub fn calculate_next_execution(&self) -> i64 {
        self.next_execution + self.interval_seconds
    }

    /// Get total amount to invest (total_swaps * amount_per_swap)
    pub fn get_total_amount(&self) -> u64 {
        (self.total_swaps as u64)
            .checked_mul(self.amount_per_swap)
            .unwrap_or(u64::MAX)
    }

    /// Get remaining swaps
    pub fn get_remaining_swaps(&self) -> u32 {
        self.total_swaps.saturating_sub(self.executed_swaps)
    }

    /// Get progress percentage (0-100)
    pub fn get_progress_percentage(&self) -> u8 {
        if self.total_swaps == 0 {
            return 0;
        }
        let progress = (self.executed_swaps as u64 * 100) / self.total_swaps as u64;
        progress.min(100) as u8
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dca_plan_len() {
        // Verify calculated LEN matches actual size
        assert_eq!(DcaPlan::LEN, 210);
    }

    #[test]
    fn test_is_ready_for_execution() {
        let plan = DcaPlan {
            plan_id: [0; 32],
            user: Pubkey::default(),
            token_in: Pubkey::default(),
            token_out: Pubkey::default(),
            amount_per_swap: 1_000_000,
            total_swaps: 10,
            executed_swaps: 5,
            interval_seconds: 86400,
            next_execution: 1000,
            min_out_per_swap: 900_000,
            created_at: 0,
            expires_at: 0,
            is_active: true,
            total_invested: 5_000_000,
            total_received: 4_500_000,
            bump: 255,
        };

        assert!(plan.is_ready_for_execution(1000));
        assert!(plan.is_ready_for_execution(2000));
        assert!(!plan.is_ready_for_execution(999));
    }

    #[test]
    fn test_get_progress_percentage() {
        let plan = DcaPlan {
            plan_id: [0; 32],
            user: Pubkey::default(),
            token_in: Pubkey::default(),
            token_out: Pubkey::default(),
            amount_per_swap: 1_000_000,
            total_swaps: 10,
            executed_swaps: 5,
            interval_seconds: 86400,
            next_execution: 1000,
            min_out_per_swap: 900_000,
            created_at: 0,
            expires_at: 0,
            is_active: true,
            total_invested: 5_000_000,
            total_received: 4_500_000,
            bump: 255,
        };

        assert_eq!(plan.get_progress_percentage(), 50);
    }
}
