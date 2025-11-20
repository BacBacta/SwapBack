use anchor_lang::prelude::*;

pub fn calculate_dynamic_slippage(
    _token_mint: &Pubkey,
    swap_amount: u64,
    pool_tvl: u64,
    volatility_bps: u16,  // From oracle
) -> Result<u16> {
    // Base slippage
    let mut slippage_bps = 50u16; // 0.5%
    
    // Adjust for swap size vs pool TVL
    if pool_tvl > 0 {
        let size_ratio = (swap_amount as f64 / pool_tvl as f64) * 10000.0;
        if size_ratio > 100.0 {  // > 1% of pool
            slippage_bps += (size_ratio as u16).saturating_sub(100);
        }
    }
    
    // Adjust for volatility
    slippage_bps += volatility_bps / 10;
    
    // Cap at 5% (500 bps)
    Ok(slippage_bps.min(500))
}
