use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum VenueType {
    Raydium,
    Orca,
    Jupiter,
    Unknown,
}

#[account]
pub struct VenueScore {
    pub venue: Pubkey,
    pub venue_type: VenueType,
    
    // Métriques de performance (rolling window)
    pub total_swaps: u64,
    pub total_volume: u64,
    pub total_npi_generated: i64,
    pub avg_latency_ms: u32,
    pub avg_slippage_bps: u16,
    
    // Score composite (0-10000)
    pub quality_score: u16,
    
    // Timestamps
    pub last_updated: i64,
    pub window_start: i64,
}

impl VenueScore {
    pub const LEN: usize = 8 + // discriminator
        32 + // venue
        1 + // venue_type (enum)
        8 + // total_swaps
        8 + // total_volume
        8 + // total_npi_generated
        4 + // avg_latency_ms
        2 + // avg_slippage_bps
        2 + // quality_score
        8 + // last_updated
        8;  // window_start
}

pub fn calculate_venue_score(venue: &VenueScore) -> u16 {
    // Weighted scoring
    
    // 1. NPI Score (40% weight)
    // Normalized NPI per volume unit
    let npi_score = if venue.total_volume > 0 && venue.total_npi_generated > 0 {
        let npi_ratio = venue.total_npi_generated as f64 / venue.total_volume as f64;
        // Target: 10 bps NPI (0.001) => 4000 points
        (npi_ratio * 1000.0 * 4000.0).min(4000.0) as u16
    } else { 
        0 
    };
    
    // 2. Latency Score (30% weight)
    // Target: < 100ms => 3000 points
    let latency_score = if venue.avg_latency_ms > 0 {
        ((100.0 / venue.avg_latency_ms as f64) * 3000.0).min(3000.0) as u16
    } else {
        // If 0 (unknown/instant), assume perfect or handle as uninitialized? 
        // Let's assume 0 means uninitialized, so maybe 0 score? 
        // But for now let's follow the logic: if 0, division by zero.
        // If 0, let's say it's not scored yet.
        0
    };
    
    // 3. Slippage Score (30% weight)
    // Target: 0 bps slippage => 3000 points
    // Penalty: -3 points per bps
    let slippage_score = ((10000u16.saturating_sub(venue.avg_slippage_bps)) as f64 * 0.3).min(3000.0) as u16;
    
    (npi_score + latency_score + slippage_score).min(10000)
}

impl VenueScore {
    pub fn update_stats(&mut self, volume: u64, npi: i64, latency_ms: u32, slippage_bps: u16, clock: &Clock) {
        // Update totals
        self.total_swaps = self.total_swaps.saturating_add(1);
        self.total_volume = self.total_volume.saturating_add(volume);
        self.total_npi_generated = self.total_npi_generated.saturating_add(npi);
        
        // Update averages (Simple Moving Average approximation)
        if self.total_swaps > 1 {
            let old_count = self.total_swaps - 1;
            self.avg_latency_ms = ((self.avg_latency_ms as u64 * old_count + latency_ms as u64) / self.total_swaps) as u32;
            self.avg_slippage_bps = ((self.avg_slippage_bps as u64 * old_count + slippage_bps as u64) / self.total_swaps) as u16;
        } else {
            self.avg_latency_ms = latency_ms;
            self.avg_slippage_bps = slippage_bps;
        }
        
        self.last_updated = clock.unix_timestamp;
        self.quality_score = calculate_venue_score(self);
    }
}
