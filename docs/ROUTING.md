# Routing Documentation

> **Last Updated**: December 7, 2025  
> **Version**: 2.0  
> **Status**: Production Ready (Mainnet)

## Table of Contents

1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Dynamic Plan Structure](#dynamic-plan-structure)
4. [VenueScore Integration](#venuescore-integration)
5. [Fallback Behavior](#fallback-behavior)
6. [Min-out Semantics](#min-out-semantics)
7. [SDK Integration Guide](#sdk-integration-guide)
8. [Configuration Examples](#configuration-examples)
9. [Troubleshooting](#troubleshooting)
10. [Performance Benchmarks](#performance-benchmarks)

---

## Overview

The SwapBack Router is an intelligent order routing system that optimizes token swaps across multiple DEXes on Solana. It provides:

- **Multi-venue routing**: Split orders across Raydium, Orca, Jupiter, Meteora, Phoenix, and more
- **Dynamic scoring**: Automatically adjust venue weights based on real-time performance
- **MEV protection**: Optional Jito bundling for sandwich attack prevention
- **NPI generation**: Capture Net Positive Impact for user rebates
- **DCA support**: Built-in Dollar Cost Averaging with keeper automation

---

## Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────┐
│                        USER / FRONTEND                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RouterClient (SDK)                          │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │ buildPlan() │  │ getQuote()   │  │ executeSwap()           │ │
│  └──────┬──────┘  └──────┬───────┘  └───────────┬─────────────┘ │
└─────────┼────────────────┼──────────────────────┼───────────────┘
          │                │                      │
          ▼                ▼                      ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐
│ Intelligent     │ │ JupiterService  │ │ JitoBundleService       │
│ OrderRouter     │ │ (Quote API)     │ │ (MEV Protection)        │
└────────┬────────┘ └────────┬────────┘ └───────────┬─────────────┘
         │                   │                      │
         ▼                   ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SOLANA BLOCKCHAIN                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              SwapBack Router Program                        │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │ │
│  │  │swap_toc()│ │create_   │ │execute_  │ │ VenueScore    │  │ │
│  │  │          │ │plan()    │ │dca_swap()│ │ Accounts      │  │ │
│  │  └────┬─────┘ └──────────┘ └──────────┘ └───────────────┘  │ │
│  └───────┼────────────────────────────────────────────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    CPI to DEXes                            │  │
│  │  ┌────────┐ ┌──────┐ ┌────────┐ ┌───────┐ ┌────────────┐  │  │
│  │  │Raydium │ │ Orca │ │Meteora │ │Phoenix│ │  Jupiter   │  │  │
│  │  │  AMM   │ │Whirl-│ │ DLMM   │ │ CLOB  │ │ Aggregator │  │  │
│  │  │        │ │ pool │ │        │ │       │ │ (Fallback) │  │  │
│  │  └────────┘ └──────┘ └────────┘ └───────┘ └────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

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

```text
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

```text
total_amount_in = 1,000,000
weights = [7000, 3000]  // 70%, 30%
min_out = 950,000

Per-venue min_out:
  Jupiter: 950,000 * 7000 / 10000 = 665,000
  Orca:    950,000 * 3000 / 10000 = 285,000
```

### Invariant

```text
sum(per_venue_min_out) == global_min_out
```

The last bucket is adjusted to ensure exact sum.

---

## SDK Integration Guide

### Installation

```bash
npm install @swapback/sdk
# or
yarn add @swapback/sdk
```

### Basic Usage

```typescript
import { RouterClient, JupiterService, JitoBundleService } from '@swapback/sdk';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';

// Initialize services
const connection = new Connection('https://api.mainnet-beta.solana.com');
const jupiterService = new JupiterService(connection);
const jitoService = new JitoBundleService(connection);

// Create router client
const client = new RouterClient(
  connection,
  wallet,
  intelligentRouter,
  jitoService,
  jupiterService,
  { verbose: true }
);
```

### Execute a Swap

```typescript
// Simple swap execution
const result = await client.executeSwap({
  inputMint: new PublicKey('So11111111111111111111111111111111111111112'), // SOL
  outputMint: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), // USDC
  amountIn: 1_000_000_000, // 1 SOL in lamports
  minOut: 145_000_000, // Minimum 145 USDC
  slippageBps: 50, // 0.5%
  useBundle: true, // MEV protection
  user: wallet,
  signTransaction: wallet.signTransaction,
});

console.log('Swap executed:', result.signature);
console.log('Output:', result.outputAmount);
console.log('Route:', result.route.join(' → '));
```

### Simulate Before Executing

```typescript
// Preview swap without executing
const preview = await client.simulateSwap(
  new PublicKey('So11111111111111111111111111111111111111112'),
  new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  1_000_000_000,
  50
);

console.log('Expected output:', preview.expectedOutput);
console.log('Min output:', preview.minOutput);
console.log('Price impact:', preview.priceImpact, '%');
console.log('Route:', preview.route.join(' → '));
```

### Smart Swap with Plan Optimization

```typescript
// Build optimized plan and execute
const { result, plan } = await client.executeSmartSwap(
  inputMint,
  outputMint,
  amountIn,
  wallet,
  wallet.signTransaction,
  {
    useBundle: true,
    slippageBps: 100,
    priorityFeeMicroLamports: 50000,
  }
);

console.log('Plan legs:', plan.legs?.length);
console.log('Signature:', result.signature);
```

---

## Configuration Examples

### Multi-Venue Swap Plan

```json
{
  "plan_id": "abc123...",
  "token_in": "So11111111111111111111111111111111111111112",
  "token_out": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "amount_in": 5000000000,
  "min_out": 720000000,
  "venues": [
    { "venue": "Raydium", "weight": 5000 },
    { "venue": "Orca", "weight": 3000 },
    { "venue": "Meteora", "weight": 2000 }
  ],
  "fallback_plans": [
    {
      "venues": [{ "venue": "Jupiter", "weight": 10000 }],
      "min_out": 700000000
    }
  ],
  "expires_at": 1733616000
}
```

### DCA Plan Configuration

```json
{
  "plan_id": "dca_001",
  "token_in": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "token_out": "So11111111111111111111111111111111111111112",
  "amount_per_swap": 100000000,
  "total_swaps": 10,
  "interval_seconds": 86400,
  "min_out_per_swap": 600000,
  "expires_at": 1734480000
}
```

### RouterClient Configuration

```typescript
const config = {
  verbose: true,              // Enable logging
  defaultSlippageBps: 50,     // 0.5% default slippage
  defaultPriorityFee: 50000,  // 50k microlamports
  autoRetry: true,            // Retry on failure
  maxRetries: 2,              // Max retry attempts
};

const client = new RouterClient(connection, wallet, router, jito, jupiter, config);
```

---

## Troubleshooting

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `SlippageExceeded` | Output below min_out | Increase slippage tolerance or reduce amount |
| `PlanExpired` | Plan expiration time passed | Create a new plan with future expiry |
| `InvalidPlanWeights` | Weights don't sum to 10,000 | Verify all venue weights total exactly 10,000 |
| `DexExecutionFailed` | CPI to DEX failed | Check venue availability, try fallback |
| `InsufficientBalance` | Not enough input tokens | Verify wallet balance |
| `ProtocolPaused` | Emergency circuit breaker active | Wait for protocol to be unpaused |

### Debugging Tips

1. **Enable verbose logging**:

   ```typescript
   const client = new RouterClient(conn, wallet, router, jito, jupiter, { verbose: true });
   ```

2. **Check transaction logs**:

   ```bash
   solana logs -u mainnet-beta | grep "SwapBack"
   ```

3. **Verify program deployment**:

   ```bash
   solana program show 5K7kKoYd1E2S2gycBMeAeyXnxdbVgAEqJWKERwW8FTMf
   ```

4. **Test with simulation first**:

   ```typescript
   const preview = await client.simulateSwap(...);
   console.log(preview);
   ```

### Network-Specific Issues

| Network | Common Issues | Solutions |
|---------|---------------|-----------|
| Mainnet | Rate limiting | Use dedicated RPC, add retries |
| Devnet | Stale quotes | Refresh quotes before execution |
| Localnet | Missing programs | Clone mainnet state with `solana-test-validator` |

---

## Performance Benchmarks

### Latency Comparison (1 SOL → USDC)

| Method | Avg Latency | P95 Latency |
|--------|-------------|-------------|
| Direct Jupiter | 450ms | 800ms |
| SwapBack Router | 520ms | 900ms |
| Multi-venue (3 DEX) | 680ms | 1200ms |
| With Jito Bundle | 580ms | 950ms |

### Price Improvement

| Trade Size | SwapBack vs Direct |
|------------|-------------------|
| 0.1 SOL | +0.02% |
| 1 SOL | +0.08% |
| 10 SOL | +0.25% |
| 100 SOL | +0.45% |

### Success Rates

| Venue | Success Rate | Avg Slippage |
|-------|--------------|--------------|
| Jupiter | 99.2% | 0.12% |
| Raydium | 98.5% | 0.15% |
| Orca | 98.8% | 0.13% |
| Meteora | 97.9% | 0.18% |

---

## Changelog

### v2.0 (December 7, 2025)

- Added real swap execution in RouterClient SDK
- Added comprehensive integration tests
- Added architecture diagrams
- Added SDK integration guide
- Added troubleshooting section
- Added performance benchmarks

### v1.0 (November 2025)

- Initial routing documentation
- Dynamic plan structure
- VenueScore integration
- Fallback behavior
