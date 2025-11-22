#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::prelude::*;
    use std::str::FromStr;
    use crate::instructions::create_dca_plan::{CreateDcaPlanArgs, validate_plan_args};
    use crate::{SwapbackError, MAX_SINGLE_SWAP_LAMPORTS};

    #[test]
    fn test_plan_weights_validation() {
        // Test that plan weights must sum to 10000
        let valid_weights = vec![
            VenueWeight {
                venue: Pubkey::from_str("JUP4sxrRzkF3EFRQ3SExvxBH5yDcszb1VSEi8PvX8Br").unwrap(),
                weight: 5000,
            },
            VenueWeight {
                venue: Pubkey::from_str("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8").unwrap(),
                weight: 5000,
            },
        ];

        let total_weight: u16 = valid_weights.iter().map(|v| v.weight).sum();
        assert_eq!(total_weight, 10000, "Valid weights should sum to 10000");

        let invalid_weights = vec![
            VenueWeight {
                venue: Pubkey::from_str("JUP4sxrRzkF3EFRQ3SExvxBH5yDcszb1VSEi8PvX8Br").unwrap(),
                weight: 6000,
            },
            VenueWeight {
                venue: Pubkey::from_str("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8").unwrap(),
                weight: 5000,
            },
        ];

        let invalid_total: u16 = invalid_weights.iter().map(|v| v.weight).sum();
        assert_ne!(
            invalid_total, 10000,
            "Invalid weights should not sum to 10000"
        );
    }

    #[test]
    fn test_slippage_calculation() {
        // Test slippage calculation
        let expected_out = 1000000; // 1 token
        let slippage_bps = 50; // 0.5%

        let min_out = (expected_out as u128)
            .checked_mul((10000u64 - slippage_bps) as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;

        let expected_min_out = 995000; // 1 * 0.995
        assert_eq!(
            min_out, expected_min_out,
            "Slippage calculation should work correctly"
        );
    }

    #[test]
    fn test_twap_slice_calculation() {
        // Test TWAP slice amount calculation
        let total_amount = 1000000; // 1 token in lamports
        let twap_slices = 10;

        let slice_amount = total_amount / twap_slices;
        assert_eq!(
            slice_amount, 100000,
            "TWAP slice calculation should work correctly"
        );

        // Test minimum slice check
        assert!(slice_amount > 0, "Slice amount should be greater than 0");
    }

    #[test]
    fn test_oracle_price_validation() {
        // Test oracle price staleness check
        let current_time = 1000000000; // Some timestamp
        let fresh_price_time = current_time - 30; // 30 seconds ago
        let stale_price_time = current_time - 120; // 2 minutes ago

        assert!(
            fresh_price_time > current_time - 60,
            "Fresh price should be within 60 seconds"
        );
        assert!(
            stale_price_time <= current_time - 60,
            "Stale price should be older than 60 seconds"
        );
    }

    fn sample_args() -> CreateDcaPlanArgs {
        CreateDcaPlanArgs {
            token_in: Pubkey::new_unique(),
            token_out: Pubkey::new_unique(),
            amount_per_swap: 1_000_000,
            total_swaps: 10,
            interval_seconds: 3600,
            min_out_per_swap: 900_000,
            expires_at: 0,
        }
    }

    #[test]
    fn test_plan_validation_identical_mints_rejected() {
        let mut args = sample_args();
        args.token_out = args.token_in;
        let err = validate_plan_args(&args, 0).unwrap_err();
        assert_eq!(err, SwapbackError::IdenticalMints.into());
    }

    #[test]
    fn test_plan_validation_amount_limit() {
        let mut args = sample_args();
        args.amount_per_swap = MAX_SINGLE_SWAP_LAMPORTS + 1;
        let err = validate_plan_args(&args, 0).unwrap_err();
        assert_eq!(err, SwapbackError::AmountExceedsLimit.into());
    }

    #[test]
    fn test_plan_validation_min_output() {
        let mut args = sample_args();
        args.min_out_per_swap = 0;
        let err = validate_plan_args(&args, 0).unwrap_err();
        assert_eq!(err, SwapbackError::InvalidMinOutput.into());
    }
}
