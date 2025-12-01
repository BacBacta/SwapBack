# Examples

Quick-reference commands for keeper tooling. All commands run **offline** (no network required).

---

## Prerequisites

```bash
# Install dependencies
npm install

# Or with pnpm
pnpm install
```

---

## Prepare mock route JSON

Generate a mock swap route using SPL token transfer (simulates Jupiter instruction):

```bash
npx tsx scripts/prepare-mock-route.ts \
  --from 7nYUqxrLEDYjBxAUjKpVQ8Dwn4wGxPjPHhMGvMPKPxKP \
  --to 8xYUqxrLEDYjBxAUjKpVQ8Dwn4wGxPjPHhMGvMPKPxKQ \
  --authority 9aYUqxrLEDYjBxAUjKpVQ8Dwn4wGxPjPHhMGvMPKPxKR \
  --amount 1000000000
```

**Output** (`tmp/keeper_route.json`):
```json
{
  "program_id": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "ix_data": "AwAAAADC6wsAAAAAAA==",
  "remaining_accounts": [
    { "pubkey": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "isSigner": false, "isWritable": false },
    { "pubkey": "7nYUqxrLEDYjBxAUjKpVQ8Dwn4wGxPjPHhMGvMPKPxKP", "isSigner": false, "isWritable": true },
    { "pubkey": "8xYUqxrLEDYjBxAUjKpVQ8Dwn4wGxPjPHhMGvMPKPxKQ", "isSigner": false, "isWritable": true },
    { "pubkey": "9aYUqxrLEDYjBxAUjKpVQ8Dwn4wGxPjPHhMGvMPKPxKR", "isSigner": true, "isWritable": false }
  ]
}
```

---

## Validate remaining_accounts JSON

Check that a route JSON has valid structure:

```bash
npx tsx scripts/validate-remaining-accounts.ts \
  --file tmp/keeper_route.json
```

**Success output:**
```
✅ Validation passed: tmp/keeper_route.json
```

**Failure output:**
```
❌ Validation failed: remaining_accounts must have at least 1 item
```

---

## Prepare dynamic plan JSON

Generate a venue weight distribution:

```bash
# With renormalization (default)
npx tsx scripts/prepare-dynamic-plan.ts \
  --venues Jupiter:7000 Orca:3000

# Strict mode (fail if sum != 10000)
npx tsx scripts/prepare-dynamic-plan.ts \
  --venues Jupiter:6000 Orca:3000 \
  --mode fail
```

**Output** (`tmp/dynamic_plan.json`):
```json
{
  "venues": [
    { "venue_type": "Jupiter", "weight_bps": 7000 },
    { "venue_type": "Orca", "weight_bps": 3000 }
  ],
  "total_weight_bps": 10000
}
```

---

## Prepare slippage inputs JSON

Generate slippage calculation inputs:

```bash
npx tsx scripts/prepare-slippage-inputs.ts \
  --liquidity 1000000000 \
  --volatility-bps 125 \
  --base-bps 50 \
  --min-bps 30 \
  --max-bps 500
```

**Output** (`tmp/slippage.json`):
```json
{
  "liquidity_estimate": 1000000000,
  "volatility_bps": 125,
  "base_slippage_bps": 50,
  "min_slippage_bps": 30,
  "max_slippage_bps": 500
}
```

---

## Verify gate script

Run full documentation and script verification:

```bash
./scripts/verify-docs-and-scripts.sh
```

**Expected output:**
```
==============================================
🔍 SwapBack Docs & Scripts Verification
==============================================

[1/5] Checking documentation files...
✅ docs/KEEPER.md exists
✅ docs/CPI_ACCOUNTS.md exists
✅ docs/ROUTING.md exists
✅ docs/SLIPPAGE.md exists
✅ docs/EXAMPLES.md exists

[2/5] Checking required sections in docs...
✅ KEEPER.md has all required sections
✅ CPI_ACCOUNTS.md has all required sections

[3/5] Running offline scripts...
✅ prepare-mock-route.ts succeeded
✅ validate-remaining-accounts.ts succeeded
✅ prepare-dynamic-plan.ts succeeded
✅ prepare-slippage-inputs.ts succeeded

[4/5] Validating JSON outputs against schemas...
✅ keeper_route.json valid
✅ dynamic_plan.json valid
✅ slippage.json valid

[5/5] Cleanup...
✅ All checks passed!
```

---

## Full pipeline example

```bash
# 1. Prepare all inputs
npx tsx scripts/prepare-mock-route.ts --from A --to B --authority C --amount 1000000
npx tsx scripts/prepare-dynamic-plan.ts --venues Jupiter:10000
npx tsx scripts/prepare-slippage-inputs.ts --liquidity 1000000000 --volatility-bps 100

# 2. Validate
npx tsx scripts/validate-remaining-accounts.ts --file tmp/keeper_route.json

# 3. Use in transaction building (pseudo-code)
const route = JSON.parse(fs.readFileSync('tmp/keeper_route.json'));
const plan = JSON.parse(fs.readFileSync('tmp/dynamic_plan.json'));
const slippage = JSON.parse(fs.readFileSync('tmp/slippage.json'));

// Build SwapArgs
const args = {
  amount_in: 1000000,
  min_out: calculateMinOut(expectedOut, slippage),
  jupiter_swap_ix_data: Buffer.from(route.ix_data, 'base64'),
  liquidity_estimate: slippage.liquidity_estimate,
  volatility_bps: slippage.volatility_bps,
  // ...
};

// Build remaining_accounts
const remainingAccounts = route.remaining_accounts.map(a => ({
  pubkey: new PublicKey(a.pubkey),
  isSigner: a.isSigner,
  isWritable: a.isWritable,
}));
```
