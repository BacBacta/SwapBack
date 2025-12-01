use anchor_lang::prelude::*;

use crate::ErrorCode;

/// RouterConfig stores governance-controlled parameters that can be updated without redeploying the program
#[account]
#[derive(InitSpace)]
pub struct RouterConfig {
    pub authority: Pubkey,
    pub pending_authority: Option<Pubkey>,
    pub rebate_bps: u16,
    pub treasury_bps: u16,
    pub boost_vault_bps: u16,
    pub treasury_from_fees_bps: u16,
    pub buyburn_from_fees_bps: u16,
    pub dynamic_slippage_enabled: bool,
    pub npi_benchmarking_enabled: bool,
    /// Maximum venues allowed per swap (compute guard). None = use default (3)
    pub max_venues_per_swap: Option<u8>,
    pub bump: u8,
}

impl RouterConfig {
    pub const LEN: usize = 8  // discriminator
        + 32                  // authority
        + 1 + 32              // pending authority option (1 byte flag + pubkey)
        + 2 * 5               // five u16 parameters
        + 1 + 1               // feature flags
        + 1 + 1               // max_venues_per_swap option (1 byte flag + u8)
        + 1; // bump

    /// Default max venues if not set
    pub const DEFAULT_MAX_VENUES: u8 = 3;

    /// Get effective max venues per swap
    pub fn effective_max_venues(&self) -> u8 {
        self.max_venues_per_swap.unwrap_or(Self::DEFAULT_MAX_VENUES)
    }

    pub fn validate_percentages(&self) -> Result<()> {
        require!(
            self.rebate_bps
                .checked_add(self.treasury_bps)
                .and_then(|sum| sum.checked_add(self.boost_vault_bps))
                == Some(10_000),
            ErrorCode::InvalidBpsSum
        );

        require!(
            self.treasury_from_fees_bps
                .checked_add(self.buyburn_from_fees_bps)
                == Some(10_000),
            ErrorCode::InvalidBpsSum
        );

        Ok(())
    }
}
