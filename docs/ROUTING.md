# Routing Documentation

## Dynamic plan structure

A **dynamic plan** defines how swap amounts are distributed across multiple venues (DEXes).

### VenueAllocation

```rust
pub struct VenueAllocation {
    pub venue_type: VenueType,  // Jupiter, Orca, Raydium, etc.
    pub weight_bps: u16,        // Weight in basis points (0-10000)
}
```

### Constraints

| Rule | Description |
|------|-------------|
| Sum = 10,000 | All `weight_bps` must sum to exactly 10,000 |
| Per-venue range | Each `weight_bps` ∈ [0, 10000] |
| Non-empty | At least one venue must have weight > 0 |

### Example

```json
{
  "venues": [
    { "venue_type": "Jupiter", "weight_bps": 7000 },
    { "venue_type": "Orca", "weight_bps": 3000 }
  ]
}
```

This splits the swap: 70% via Jupiter, 30% via Orca.

---

## VenueScore integration

If `min_venue_score` is provided, the router adjusts weights based on venue quality scores.

### VenueScore account

```rust
pub struct VenueScore {
    pub venue_type: VenueType,
    pub quality_score: u16,      // 0..10000
    pub latency_score: u16,
    pub slippage_score: u16,
    pub volume_7d: u64,
    pub last_updated: i64,
}
```

### Score-based adjustment

```rust
pub fn adjust_weights_with_scores(
    venues: &mut Vec<VenueAllocation>,
    scores: &BTreeMap<VenueType, u16>,
    min_score: u16,
) {
    for v in venues.iter_mut() {
        let s = scores.get(&v.venue_type).copied().unwrap_or(10_000);
        if s < min_score {
            v.weight_bps = 0;  // Exclude low-score venue
            continue;
        }
        // Scale weight by score
        let scaled = (v.weight_bps as u32) * (s as u32) / 10_000;
        v.weight_bps = scaled.min(10_000) as u16;
    }
    renormalize_weights(venues);  // Ensure sum = 10,000
}
```

### Exclusion logic

| Venue Score | min_venue_score | Result |
|-------------|-----------------|--------|
| 9000 | 2500 | Included (scaled) |
| 2000 | 2500 | **Excluded** |
| 5000 | 2500 | Included (scaled) |

Default `min_venue_score`: **2500** (25%)

---

## Fallback behavior

When a venue fails or is excluded, the plan may use fallback logic:

### Fallback triggers

1. **Venue exclusion**: Score below threshold
2. **CPI failure**: DEX instruction reverts
3. **Slippage exceeded**: Output below `min_out`

### Fallback strategy

```rust
pub struct FallbackPlan {
    pub venues: Vec<VenueWeight>,  // Alternative venue distribution
    pub min_out: u64,              // Minimum acceptable output
}
```

Currently, fallback is handled by:
1. Renormalizing remaining venues (excluded venues get weight=0)
2. Retrying with adjusted weights
3. Failing if no venues remain or all fail

### Example fallback flow

```
Original: Jupiter(7000), Orca(3000)
↓ Orca fails (score < min)
Adjusted: Jupiter(10000)
↓ Execute with 100% Jupiter
```

---

## Min-out semantics

### Global min_out

The `min_out` in `SwapArgs` is the **total minimum output** across all venues:

```rust
pub struct SwapArgs {
    pub amount_in: u64,
    pub min_out: u64,  // Total minimum, not per-venue
    // ...
}
```

### Per-venue min_out

When splitting across venues, `min_out` is distributed proportionally:

```rust
// From math.rs
pub fn split_min_out_by_weights(min_out: u64, weights: &[u16]) -> Result<Vec<u64>> {
    split_amount_by_weights(min_out, weights)
}
```

### Calculation

```
total_amount_in = 1,000,000
weights = [7000, 3000]  // 70%, 30%
min_out = 950,000

Per-venue min_out:
  Jupiter: 950,000 * 7000 / 10000 = 665,000
  Orca:    950,000 * 3000 / 10000 = 285,000
```

### Invariant

```
sum(per_venue_min_out) == global_min_out
```

The last bucket is adjusted to ensure exact sum.
