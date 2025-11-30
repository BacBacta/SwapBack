use anchor_lang::prelude::*;

#[account]
pub struct OracleCache {
    pub token_pair: [Pubkey; 2],
    pub cached_price: u64,
    pub cached_at: i64,
    pub cache_duration: i64,  // 5 seconds default
    pub volatility_bps: u16,  // Market volatility in basis points
    pub bump: u8,
}

impl OracleCache {
    pub const LEN: usize = 8 + // discriminator
        32 * 2 + // token_pair
        8 + // cached_price
        8 + // cached_at
        8 + // cache_duration
        2 + // volatility_bps
        1;  // bump

    pub fn is_stale(&self, current_time: i64) -> bool {
        current_time - self.cached_at > self.cache_duration
    }

    /// Update cache with new price data
    pub fn update(&mut self, price: u64, volatility_bps: u16, current_time: i64) {
        self.cached_price = price;
        self.volatility_bps = volatility_bps;
        self.cached_at = current_time;
    }
}
