use anchor_lang::prelude::*;

/// Router State Account - Global configuration and statistics
#[account]
#[derive(InitSpace)]
pub struct RouterState {
    /// Authority that can update configuration
    pub authority: Pubkey,

    /// Percentage of NPI allocated to user rebates (basis points, 10000 = 100%)
    pub rebate_percentage: u16,

    /// Percentage of NPI allocated to treasury (basis points, 10000 = 100%)
    pub treasury_percentage: u16,

    /// Percentage of NPI allocated to boost vault (basis points, 10000 = 100%)
    pub boost_vault_percentage: u16,

    /// Percentage of platform fees allocated to treasury (basis points, 10000 = 100%)
    pub treasury_from_fees_bps: u16,

    /// Percentage of platform fees allocated to buy & burn (basis points, 10000 = 100%)
    pub buyburn_from_fees_bps: u16,

    /// Treasury wallet collecting platform fees and NPI share
    pub treasury_wallet: Pubkey,

    /// Boost vault wallet accumulating lock rewards
    pub boost_vault_wallet: Pubkey,

    /// Buy & burn wallet receiving platform fee allocation
    pub buyback_wallet: Pubkey,

    /// Vault used to custody NPI reserves if needed
    pub npi_vault_wallet: Pubkey,

    /// Total volume of swaps processed (in USDC/lamports)
    pub total_volume: u64,

    /// Total Net Positive Income generated
    pub total_npi: u64,

    /// Total rebates paid to users
    pub total_rebates_paid: u64,

    /// Total treasury share sourced from NPI
    pub total_treasury_from_npi: u64,

    /// Total boost vault allocation accumulated
    pub total_boost_vault: u64,

    /// Enable dynamic slippage calculation based on volatility
    pub dynamic_slippage_enabled: bool,

    /// Total treasury share sourced from platform fees
    pub total_treasury_from_fees: u64,

    /// Total buy & burn allocation sourced from platform fees
    pub total_buyburn: u64,

    /// PDA bump seed
    pub bump: u8,
}

impl RouterState {
    pub const LEN: usize = 8  // discriminator
        + 32                  // authority
        + 2 + 2 + 2 + 2 + 2   // percentages
        + 32 + 32 + 32 + 32   // wallets
        + 8 + 8 + 8 + 8 + 8 + 8 + 8 // metrics
        + 1                   // dynamic_slippage_enabled
        + 1; // bump
}

/// User Rebate Tracking Account
#[account]
#[derive(InitSpace)]
pub struct UserRebate {
    /// User who owns this rebate account
    pub user: Pubkey,

    /// Unclaimed USDC rebates (in lamports)
    pub unclaimed_rebate: u64,

    /// Total USDC claimed historically
    pub total_claimed: u64,

    /// Number of swaps completed
    pub total_swaps: u64,

    /// Last swap timestamp
    pub last_swap_timestamp: i64,

    /// Last claim timestamp
    pub last_claim_timestamp: i64,

    /// PDA bump seed
    pub bump: u8,
}

impl UserRebate {
    pub const LEN: usize = 8 + 32 + 8 + 8 + 8 + 8 + 8 + 1;
}
