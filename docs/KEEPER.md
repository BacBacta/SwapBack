# Keeper Documentation

## Overview

The **keeper** is an off-chain service responsible for preparing and submitting swap transactions to the SwapBack router program. It acts as an intermediary between users/DCA plans and the on-chain execution.

### What the keeper does:
- Fetches optimal routes from Jupiter (or other DEX aggregators)
- Prepares `jupiter_swap_ix_data` (serialized instruction bytes)
- Builds the ordered `remaining_accounts` array for CPI
- Estimates `liquidity_estimate` and `volatility_bps` for dynamic slippage
- Constructs and signs transactions for `swap_toc` or `execute_dca_swap`

### What the keeper does NOT do:
- **No custody**: The keeper never holds user funds
- **No signing authority over user tokens**: Users sign their own transactions
- **No on-chain state modification**: Only prepares transaction parameters

---

## Transaction building

### `swap_toc` instruction

The `swap_toc` instruction executes a single swap with the following parameters:

```typescript
interface SwapArgs {
  amount_in: u64;
  min_out: u64;
  slippage_tolerance?: u16;        // Optional, in basis points (50 = 0.5%)
  twap_slices?: u8;                // Optional TWAP slices
  use_dynamic_plan: boolean;
  plan_account?: Pubkey;
  use_bundle: boolean;
  primary_oracle_account: Pubkey;
  fallback_oracle_account?: Pubkey;
  jupiter_route?: JupiterRouteParams;
  jupiter_swap_ix_data?: Vec<u8>;  // Serialized Jupiter instruction
  liquidity_estimate?: u64;        // Pool TVL estimate
  volatility_bps?: u16;            // Volatility 0..5000
  min_venue_score?: u16;           // Exclude venues below this score
}
```

**Transaction structure:**
```
swap_toc {
  accounts: [
    user (signer),
    user_token_account_a (mut),
    user_token_account_b (mut),
    state,
    config,
    token_a_mint,
    token_b_mint,
    user_rebate (mut),
    rebate_vault (mut),
    token_program,
    system_program,
  ],
  remaining_accounts: [
    jupiter_program,
    ...jupiter_route_accounts  // In exact order from Jupiter API
  ],
  args: SwapArgs
}
```

### `execute_dca_swap` instruction

For DCA plans, the keeper monitors active plans and triggers execution when ready:

```
execute_dca_swap {
  accounts: [
    dca_plan (mut),
    user_token_in (mut),
    user_token_out (mut),
    token_program,
  ],
  remaining_accounts: [
    jupiter_program,
    ...jupiter_route_accounts
  ]
}
```

---

## Inputs

### `jupiter_swap_ix_data`

The serialized instruction data from Jupiter's swap/route API. This is obtained by:

1. Calling Jupiter's `/quote` endpoint
2. Calling Jupiter's `/swap` endpoint with the quote
3. Extracting `swapTransaction` and deserializing the instruction data

```typescript
// Example: Extract Jupiter ix data
const quoteResponse = await fetch(`https://quote-api.jup.ag/v6/quote?...`);
const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
  method: 'POST',
  body: JSON.stringify({ quoteResponse, userPublicKey: user.toBase58() })
});
const { swapTransaction } = await swapResponse.json();
// Deserialize and extract instruction data
```

**For offline/mock testing:** See [scripts/prepare-mock-route.ts](../scripts/prepare-mock-route.ts)

### `remaining_accounts`

The array of account metas required by the Jupiter instruction, in exact order. See [CPI_ACCOUNTS.md](./CPI_ACCOUNTS.md) for details.

### `liquidity_estimate` and `volatility_bps`

For dynamic slippage calculation:

| Parameter | Type | Range | Description |
|-----------|------|-------|-------------|
| `liquidity_estimate` | u64 | >= 1 | Pool TVL in smallest units |
| `volatility_bps` | u16 | 0..5000 | Market volatility (100 = 1%) |

See [SLIPPAGE.md](./SLIPPAGE.md) for calculation details.

---

## Determinism & safety

### Limits and clamping

- **Slippage**: Always clamped to `[30, 500]` bps (0.3% - 5%)
- **Weights**: Sum renormalized to exactly 10,000 bps
- **Amount splits**: Last bucket corrected to ensure sum = `amount_in`

### Replay protection

- Each swap modifies on-chain state (user rebate, plan execution count)
- Transaction signatures are unique per blockhash
- DCA plans track `next_execution` timestamp

### Risk considerations

1. **Stale routes**: Jupiter routes expire. The keeper should fetch fresh routes close to execution.
2. **Slippage attacks**: Always provide realistic `min_out` based on current prices.
3. **Account ordering**: Incorrect account order causes CPI failure.
4. **Venue exclusion**: Low-score venues (< `min_venue_score`) are excluded from routing.

---

## Examples

### Prepare a mock route (offline)
```bash
npx tsx scripts/prepare-mock-route.ts \
  --from <source_ata> \
  --to <dest_ata> \
  --authority <user_pubkey> \
  --amount 1000000000
```

### Prepare dynamic plan
```bash
npx tsx scripts/prepare-dynamic-plan.ts \
  --venues Jupiter:7000 Orca:3000 \
  --mode renormalize
```

### Prepare slippage inputs
```bash
npx tsx scripts/prepare-slippage-inputs.ts \
  --liquidity 1000000000 \
  --volatility-bps 125 \
  --base-bps 50 \
  --min-bps 30 \
  --max-bps 500
```

### Validate remaining accounts
```bash
npx tsx scripts/validate-remaining-accounts.ts \
  --file tmp/keeper_route.json
```

### Run full verification
```bash
./scripts/verify-docs-and-scripts.sh
```

---

## Priority fee & compute units

The router emits a `PriorityFeeSet` event with recommended compute budget settings.

### Event structure

```rust
#[event]
pub struct PriorityFeeSet {
    pub compute_unit_limit: u32,  // Recommended CU limit
    pub compute_unit_price: u64,  // Recommended price in micro-lamports
}
```

### Calculation logic

```rust
// Base: 200,000 CU
// + 30,000 per venue
// + 10,000 per fallback
let cu_limit = 200_000 + (venue_count * 30_000) + (fallback_count * 10_000);

// Priority fee: amount_in / 1000, clamped to [5,000..500,000] micro-lamports
let priority_fee = clamp(amount_in / 1000, 5_000, 500_000);
```

### Keeper integration

Listen for the event and set compute budget before submitting:

```typescript
import { ComputeBudgetProgram } from '@solana/web3.js';

// After simulating the swap, extract PriorityFeeSet from logs
const event = parsePriorityFeeSetEvent(simulationLogs);

// Add compute budget instructions
const transaction = new Transaction()
  .add(ComputeBudgetProgram.setComputeUnitLimit({
    units: event.compute_unit_limit,
  }))
  .add(ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: event.compute_unit_price,
  }))
  .add(swapInstruction);
```

### Recommended ranges

| Swap type | CU Limit | Priority (µ-lamports) |
|-----------|----------|----------------------|
| Single venue | 230,000 | 5,000 - 50,000 |
| Multi-venue (3) | 290,000 | 10,000 - 100,000 |
| With fallbacks | +10,000/fallback | +50% during congestion |
| Large swaps (>100 SOL) | Same | 100,000 - 500,000 |

---

## Buyback & Burn configuration

The buyback system uses dedicated accounts for collecting platform fees and executing buy-burn.

### Program & accounts

| Account | PDA Seeds | Description |
|---------|-----------|-------------|
| `buyback_state` | `["buyback_state"]` | Global buyback configuration |
| `usdc_vault` | `["usdc_vault"]` | USDC collected from platform fees |
| `back_vault` | `["back_vault", buyback_state]` | BACK tokens before burning |

### BuybackState structure

```rust
pub struct BuybackState {
    pub authority: Pubkey,           // Admin wallet
    pub back_mint: Pubkey,           // $BACK token mint
    pub usdc_vault: Pubkey,          // USDC vault address
    pub min_buyback_amount: u64,     // Minimum USDC to trigger (default: 100 USDC)
    pub total_usdc_spent: u64,       // Cumulative USDC spent
    pub total_back_burned: u64,      // Cumulative BACK burned
    pub buyback_count: u64,          // Number of buyback executions
    pub bump: u8,
}
```

### Fee flow

```
User swap
    ↓
Platform fee (0.2%)
    ↓
┌───────────────────┬────────────────────┐
│ 85% → Treasury    │ 15% → USDC Vault   │
└───────────────────┴────────────────────┘
                              ↓
                    (When balance ≥ threshold)
                              ↓
                    Buyback Keeper triggers
                              ↓
                    Jupiter swap: USDC → BACK
                              ↓
                    100% BACK → Burn 🔥
```

### Buyback Keeper configuration

Located at `oracle/src/buyback-keeper.ts`:

| Parameter | Default | Environment Variable |
|-----------|---------|---------------------|
| RPC URL | devnet | `NEXT_PUBLIC_SOLANA_RPC_URL` |
| Min threshold | 100 USDC | `MIN_BUYBACK_THRESHOLD` |
| Slippage | 2% (200 bps) | `SLIPPAGE_BPS` |
| Poll interval | 1 hour | `POLLING_INTERVAL_MS` |
| Circuit breaker | 3 failures | `MAX_CONSECUTIVE_FAILURES` |

### Monitoring integration

The buyback keeper supports Discord, Slack, and Telegram alerts:

```bash
# Set environment variables
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
export TELEGRAM_BOT_TOKEN="123456:ABC..."
export TELEGRAM_CHAT_ID="-100123456789"
```

### Running the buyback keeper

```bash
# Start the keeper
cd oracle && npx tsx src/buyback-keeper.ts

# Or via script
./scripts/start-buyback-keeper.sh
```

---

## Related documentation

- [ROUTING.md](./ROUTING.md) - Venue weights, VenueScore, fallback logic
- [SLIPPAGE.md](./SLIPPAGE.md) - Dynamic slippage configuration
- [TECHNICAL.md](./TECHNICAL.md) - Program architecture details
- [DCA.md](./DCA.md) - DCA plan structure and keeper

