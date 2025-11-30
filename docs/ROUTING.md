# SwapBack Router - Architecture & Routing

## Overview

The SwapBack Router (`swapback_router`) is the core swap execution engine that handles:
- **Real swap execution** via CPI to Jupiter, Raydium, and Orca
- **Dynamic slippage** calculation based on pool liquidity and volatility
- **NPI (Net Positive Impact)** distribution with rebates
- **Venue scoring** for route optimization
- **DCA (Dollar Cost Averaging)** plans with keeper orchestration
- **TWAP (Time-Weighted Average Price)** execution

## Program IDs (Devnet)

| Program | ID |
|---------|-----|
| SwapBack Router | `9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh` |
| SwapBack cNFT | `EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP` |
| SwapBack Buyback | `7wCCwRXxWvMY2DJDRrnhFg3b8jVPb5vVPxLH5YAGL6eJ` |
| Jupiter | `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4` |
| Orca Whirlpool | `whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc` |
| Raydium AMM | `675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8` |

## Swap Execution Flow

### 1. Simple Swap (`swap_toc`)

```
User → Frontend → Jupiter API (quote) → SwapBack Router → Jupiter CPI → User receives tokens
                                              ↓
                                    Fees/Rebates distributed
```

**Steps:**
1. User initiates swap via frontend (app)
2. Frontend calls Jupiter V6 API to get optimal route + `swapInstruction`
3. Frontend builds transaction with `swap_toc` instruction including `JupiterRouteParams`
4. Router validates parameters, executes Jupiter CPI
5. Router calculates and distributes:
   - Platform fees (0.2%): 85% treasury, 15% buy & burn
   - NPI (routing profit): 70% rebates, 15% treasury, 15% boost vault

### 2. DCA Swap (`execute_dca_swap`)

```
User creates plan → Keeper monitors → Keeper calls Jupiter API → Keeper executes instruction
                         ↓
              On execution time reached
```

**See [KEEPER.md](./KEEPER.md) for keeper implementation details.**

### 3. TWAP Execution

TWAP swaps are split into multiple slices executed over time:

1. First slice executes immediately
2. `TwapSlicesRequired` event is emitted
3. Keeper schedules remaining slices
4. Each slice is a separate transaction

## Dynamic Slippage

The router calculates dynamic slippage based on:

### Components

| Component | Calculation | Impact |
|-----------|-------------|--------|
| Base | Fixed 50 bps (0.5%) | Minimum protection |
| Size | `(swap_size / pool_tvl) * 10000 - 100` | Larger swaps = more slippage |
| Volatility | `oracle_volatility_bps / 10` | High volatility = more slippage |

### Configuration

```rust
pub struct SlippageConfig {
    pub base_slippage_bps: u16,     // Default: 50 (0.5%)
    pub max_slippage_bps: u16,      // Default: 500 (5%)
    pub size_threshold_bps: u16,    // Default: 100 (1% of pool)
    pub volatility_divisor: u16,    // Default: 10
}
```

### TVL Estimation

Pool TVL is estimated from remaining accounts:
- Raydium AMM: Vault accounts at indices 4 and 5
- Falls back to 1M USDC estimate if unknown

## Fee Structure

### Platform Fees (0.2% of swap amount)

```
Platform Fee (20 bps)
    ├── 85% → Protocol Treasury
    └── 15% → Buy & Burn BACK token
```

### NPI Distribution (Routing Profit)

When swap output > min_out, the difference is NPI:

```
NPI (Routing Profit)
    ├── 70% → User Rebate (+ boost from cNFT lock)
    ├── 15% → Protocol Treasury
    └── 15% → Boost Vault (for lock rewards)
```

## Venue Scoring

Each DEX venue is scored based on:

| Metric | Weight | Calculation |
|--------|--------|-------------|
| NPI Score | 40% | `npi_ratio * 1000 * 4000` |
| Latency Score | 30% | `(100 / avg_latency_ms) * 3000` |
| Slippage Score | 30% | `(10000 - avg_slippage_bps) * 0.3` |

Scores are updated after each swap via `VenueScore.update_stats()`.

## CPI Modules

### Jupiter (`cpi_jupiter.rs`)

Executes swaps via Jupiter aggregator:
- Replays fully-built instruction from frontend
- Validates input amount matches expected
- Returns actual amount received

### Orca (`cpi_orca.rs`)

Direct Whirlpool swap:
- Builds swap instruction with sqrt_price_limit
- Handles both a_to_b and b_to_a directions
- 11 accounts required

### Raydium (`cpi_raydium.rs`)

AMM swap via Raydium:
- Determines base_in direction from vault mints
- 17 accounts required
- Uses instruction opcodes 9 (base_in) or 11 (quote_in)

## Events

| Event | Purpose |
|-------|---------|
| `SwapCompleted` | Main swap success event with all metrics |
| `VenueExecuted` | Per-venue execution result |
| `NPIDistributed` | NPI allocation breakdown |
| `FeesAllocated` | Platform fee distribution |
| `TwapSlicesRequired` | TWAP keeper scheduling hint |
| `DcaSwapExecuted` | DCA swap completion |
| `BuyburnDeposit` | Buy & burn deposit confirmation |

## Security Considerations

### Input Validation
- Amount must be > 0 and <= MAX_SINGLE_SWAP_LAMPORTS (5k SOL)
- Slippage tolerance capped at 10% (1000 bps)
- Token accounts must be owned by signer

### Oracle Security
- Dual oracle support with divergence check (max 2%)
- Staleness check (max 5 minutes)
- Oracle cache with configurable TTL

### Anti-Whale Protection
- Maximum single swap limit
- Dynamic slippage increases for large swaps

## Account Structures

### Key PDAs

| Account | Seeds | Purpose |
|---------|-------|---------|
| RouterState | `["router_state"]` | Global protocol state |
| UserRebate | `["user_rebate", user]` | User's unclaimed rebates |
| DcaPlan | `["dca_plan", user, plan_id]` | DCA plan state |
| OracleCache | `["oracle_cache", oracle]` | Cached oracle prices |
| VenueScore | `["venue_score", state]` | Venue performance metrics |

## Usage Example

```typescript
import { Connection, PublicKey } from '@solana/web3.js';
import { createJupiterApiClient } from '@jup-ag/api';

// 1. Get Jupiter quote
const jupiter = createJupiterApiClient();
const quote = await jupiter.quoteGet({
  inputMint: 'So11111111111111111111111111111111111111112', // SOL
  outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  amount: 1_000_000_000, // 1 SOL
  slippageBps: 50,
});

// 2. Get swap instruction
const { swapInstruction } = await jupiter.swapInstructionsPost({
  quoteResponse: quote,
  userPublicKey: wallet.publicKey.toString(),
});

// 3. Build SwapBack router instruction
const swapArgs = {
  amount_in: 1_000_000_000,
  min_out: quote.otherAmountThreshold,
  slippage_tolerance: 50,
  use_dynamic_plan: false,
  use_bundle: false,
  primary_oracle_account: ORACLE_PUBKEY,
  jupiter_route: {
    swap_instruction: swapInstruction.data,
    expected_input_amount: 1_000_000_000,
  },
};

// 4. Execute via SwapBack
const tx = await program.methods
  .swapToc(swapArgs)
  .accounts({...})
  .remainingAccounts(swapInstruction.accounts)
  .rpc();
```
