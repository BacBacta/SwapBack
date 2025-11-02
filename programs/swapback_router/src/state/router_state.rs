use anchor_lang::prelude::*;

/// Router State Account - Global configuration and statistics
#[account]
pub struct RouterState {
    /// Authority that can update configuration
    pub authority: Pubkey,
    
    /// Percentage of NPI allocated to user rebates (basis points, 10000 = 100%)
    pub rebate_percentage: u16,
    
    /// Percentage of NPI allocated to buyback (basis points, 10000 = 100%)
    pub buyback_percentage: u16,
    
    /// Percentage of NPI allocated to protocol treasury (basis points, 10000 = 100%)
    pub protocol_percentage: u16,
    
    /// Total volume of swaps processed (in USDC/lamports)
    pub total_volume: u64,
    
    /// Total Net Positive Income generated
    pub total_npi: u64,
    
    /// Total rebates paid to users
    pub total_rebates_paid: u64,
    
    /// Total buyback from NPI
    pub total_buyback_from_npi: u64,
    
    /// Total protocol revenue (fees + NPI)
    pub total_protocol_revenue: u64,
    
    /// PDA bump seed
    pub bump: u8,
}

impl RouterState {
    pub const LEN: usize = 8 + 32 + 2 + 2 + 2 + 8 + 8 + 8 + 8 + 8 + 1;
}

/// User Rebate Tracking Account
#[account]
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
