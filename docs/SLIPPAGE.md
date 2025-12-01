# Slippage Documentation

## Static slippage

When `dynamic_slippage_enabled = false`, the router uses a fixed slippage tolerance.

### `slippage_tolerance` parameter

```rust
pub struct SwapArgs {
    pub slippage_tolerance: Option<u16>,  // In basis points
    // ...
}
```

| Value | Meaning |
|-------|---------|
| 50 | 0.5% slippage |
| 100 | 1.0% slippage |
| 300 | 3.0% slippage |

### Default behavior

If `slippage_tolerance` is `None`, the program uses **50 bps (0.5%)** as default.

---

## Dynamic slippage

When `dynamic_slippage_enabled = true`, slippage is calculated based on market conditions.

### Formula

```
slippage_bps = base_slippage + size_impact + volatility_impact
```

Where:
- `base_slippage`: Fixed baseline (default: 50 bps)
- `size_impact`: Additional slippage for large swaps relative to pool
- `volatility_impact`: Additional slippage based on market volatility

### Detailed calculation

```rust
pub fn calculate_dynamic_slippage_with_breakdown(
    swap_amount: u64,
    pool_tvl: u64,        // liquidity_estimate
    volatility_bps: u16,
    config: Option<SlippageConfig>,
) -> SlippageResult
```

**Components:**

1. **Base component**: `config.base_slippage_bps` (default: 50)

2. **Size component**:
   ```
   size_ratio_bps = (swap_amount * 10000) / pool_tvl
   size_component = max(0, size_ratio_bps - threshold)
   ```
   Default threshold: 100 bps (1% of pool)

3. **Volatility component**:
   ```
   volatility_component = volatility_bps / volatility_divisor
   ```
   Default divisor: 10

### Bounds

The final slippage is **always clamped**:

```rust
let total = (base + size + volatility).min(max_slippage_bps);
// Default max: 500 bps (5%)
// Minimum enforced: 30 bps (0.3%)
```

| Bound | Default | Description |
|-------|---------|-------------|
| Min | 30 bps | Never allow < 0.3% |
| Max | 500 bps | Never allow > 5% |

---

## min_out computation

### From expected_out to min_out

```rust
pub fn min_out_with_slippage(expected_out: u64, slippage_bps: u16) -> u64 {
    let keep_bps = 10_000u16.saturating_sub(slippage_bps);
    bps_of(expected_out, keep_bps)
}
```

### Example

```
expected_out = 1,000,000 tokens
slippage_bps = 50 (0.5%)

keep_bps = 10000 - 50 = 9950
min_out = 1,000,000 * 9950 / 10000 = 995,000 tokens
```

### Invariant

```
min_out <= expected_out
min_out = expected_out * (1 - slippage%)
```

---

## Operational guidance

### Estimating liquidity offchain

The keeper must provide `liquidity_estimate` (pool TVL). Options:

1. **Jupiter API**: Extract from quote response
   ```json
   {
     "routePlan": [
       { "ammKey": "...", "inAmount": "...", "outAmount": "..." }
     ]
   }
   ```

2. **Direct RPC**: Query pool accounts for reserves
   ```typescript
   const poolInfo = await connection.getAccountInfo(poolAddress);
   const tvl = parsePoolTvl(poolInfo.data);
   ```

3. **Indexer APIs**: Use DeFi Llama, Birdeye, etc.

### Estimating volatility offchain

`volatility_bps` represents recent price movement. Options:

1. **Price oracle**: Calculate from Pyth/Switchboard price history
   ```typescript
   const prices = await getPriceHistory(mint, 24h);
   const volatility = calculateStdDev(prices);
   const volatility_bps = Math.round(volatility * 10000);
   ```

2. **CEX data**: Fetch from Binance, Coinbase APIs
3. **Conservative default**: Use 100-200 bps for stable pairs, 500+ for volatile

### Recommended ranges

| Asset type | volatility_bps range |
|------------|---------------------|
| Stablecoins (USDC/USDT) | 10-50 |
| Major pairs (SOL/USDC) | 100-300 |
| Volatile alts | 300-1000 |
| Memecoins | 500-2000 |

### Input validation

The program validates:

```rust
// liquidity_estimate must be > 0
require!(liquidity_estimate > 0, SwapbackError::InvalidInput);

// volatility_bps capped at 5000 (50%)
let vol = volatility_bps.min(5000);
```
