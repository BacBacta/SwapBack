use anchor_lang::prelude::*;

use crate::ErrorCode;

/// RouterConfig stores governance-controlled parameters that can be updated without redeploying the program
#[account]
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
    pub bump: u8,
}

impl RouterConfig {
    pub const LEN: usize = 8  // discriminator
        + 32                  // authority
        + 1 + 32              // pending authority option (1 byte flag + pubkey)
        + 2 * 5               // five u16 parameters
        + 1 + 1               // feature flags
        + 1; // bump

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
