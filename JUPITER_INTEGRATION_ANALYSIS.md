# 🛠️ Jupiter Integration - Phase 5.3 Analysis

## 📊 Current State

### ✅ What's Already Implemented
- **Buyback State**: Initialized (PDA: `E3jZwEJ47FrWpBckGUkS9bQ5Au9zDLJN55wBNx8aECz9`)
- **USDC Vault**: Created (PDA: `E24ZXgV6RrnCiPnKWwgx8LprNQ4DhAjXQ3KNE4PaXzUr`)
- **Router CPI**: `deposit_to_buyback()` fully functional (lines 1846-1920)
- **Pyth Oracle**: Integrated for BACK/USD price feed
- **Distribution Logic**: 50% rebates / 50% burn (lines 210-277, 285-345)
- **Events & State Management**: Complete

### ❌ What's Missing
**File**: `programs/swapback_buyback/src/lib.rs` lines 132-140

```rust
// ✅ TRANSFERT USDC vers une pool externe (Raydium, Orca, etc.)
// Pour le MVP: on garde les USDC dans le vault
// En production: implémenter CPI vers DEX pour swap réel

// ✅ TRANSFERT BACK depuis pool vers back_vault
// NOTE: Nécessite que le back_vault soit pré-rempli ou connecté à une pool
// Pour le MVP: on assume que les tokens sont déjà dans back_vault
// En production: CPI vers pool DEX pour récupérer les BACK
```

**Problem**: The actual swap USDC → BACK is not executed. The code:
1. ✅ Calculates expected BACK amount using Pyth Oracle
2. ❌ Does NOT transfer USDC to any DEX
3. ❌ Does NOT receive BACK tokens back
4. ❌ Only updates state/emits event without real swap

---

## 🎯 Integration Strategy

### Option 1: Jupiter CPI (Direct Integration)
**Pros**:
- Direct on-chain integration
- No off-chain dependencies
- Fully decentralized

**Cons**:
- Jupiter v6 CPI complexity
- Need to handle remaining accounts dynamically
- More difficult to test
- Larger transaction size

**Implementation**:
```rust
// Add to Cargo.toml
[dependencies]
jupiter-cpi = "0.1.0"  # If available

// In execute_buyback()
let jupiter_program = /* Jupiter Program ID */;
let swap_accounts = /* Build accounts from quote */;

// CPI call
jupiter_swap::cpi::route(
    CpiContext::new_with_signer(
        jupiter_program,
        swap_accounts,
        signer_seeds
    ),
    route_plan,
    in_amount,
    quoted_out_amount,
    slippage_bps
)?;
```

### Option 2: Keeper + Jupiter API (Recommended)
**Pros**:
- Simpler implementation
- Easier to test and debug
- Use Jupiter's proven API
- Can add retry logic
- Better error handling

**Cons**:
- Requires off-chain keeper service
- Centralization point (but keeper is trustless)

**Implementation**:
1. Keep `execute_buyback()` as authorization + state update
2. Create `buyback-keeper.ts` that:
   - Polls USDC vault balance
   - Calls Jupiter API for quote
   - Executes swap via transaction
   - Calls on-chain `finalize_buyback()` to update state

---

## 🚀 Recommended Approach: Keeper + Jupiter API

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Buyback Flow                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. User Swaps (Router)                                │
│     └──> deposit_to_buyback()                          │
│          └──> USDC accumulates in vault               │
│                                                         │
│  2. Buyback Keeper (hourly check)                      │
│     ├──> Check vault balance ≥ threshold               │
│     ├──> Fetch Jupiter quote USDC → BACK               │
│     ├──> Execute Jupiter swap transaction              │
│     └──> Call finalize_buyback() on-chain              │
│                                                         │
│  3. On-Chain Finalization                              │
│     ├──> Verify BACK received                          │
│     ├──> Update buyback_state                          │
│     ├──> Split 50% distribution / 50% burn             │
│     └──> Emit BuybackExecuted event                    │
│                                                         │
│  4. Distribution (user-triggered)                      │
│     └──> distribute_buyback() based on boost           │
│                                                         │
│  5. Burn (keeper or admin)                             │
│     └──> burn_back() reduces supply                    │
└─────────────────────────────────────────────────────────┘
```

### Program Changes Needed

**File**: `programs/swapback_buyback/src/lib.rs`

#### 1. Rename `execute_buyback()` → `initiate_buyback()`
```rust
/// Initie un buyback (authorization only)
/// Le keeper Jupiter exécutera le swap off-chain
pub fn initiate_buyback(
    ctx: Context<InitiateBuyback>,
    max_usdc_amount: u64,
) -> Result<()> {
    let buyback_state = &mut ctx.accounts.buyback_state;
    
    // Vérifications
    require!(
        ctx.accounts.usdc_vault.amount >= buyback_state.min_buyback_amount,
        ErrorCode::InsufficientFunds
    );
    
    require!(
        ctx.accounts.authority.key() == buyback_state.authority,
        ErrorCode::Unauthorized
    );
    
    let actual_usdc = std::cmp::min(max_usdc_amount, ctx.accounts.usdc_vault.amount);
    
    // Émettre événement pour le keeper
    emit!(BuybackInitiated {
        usdc_amount: actual_usdc,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    Ok(())
}
```

#### 2. Add New `finalize_buyback()` Instruction
```rust
/// Finalise un buyback après swap Jupiter off-chain
/// Vérifie que les BACK ont été reçus et met à jour l'état
pub fn finalize_buyback(
    ctx: Context<FinalizeBuyback>,
    usdc_spent: u64,
    back_received: u64,
) -> Result<()> {
    let buyback_state = &mut ctx.accounts.buyback_state;
    
    // Vérifier que le back_vault a reçu les tokens
    // (On compare avec un snapshot pré-swap stocké ou on trust le keeper)
    
    // Mise à jour des stats
    buyback_state.total_usdc_spent = buyback_state
        .total_usdc_spent
        .checked_add(usdc_spent)
        .ok_or(ErrorCode::MathOverflow)?;
        
    buyback_state.buyback_count = buyback_state
        .buyback_count
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;
    
    emit!(BuybackExecuted {
        usdc_amount: usdc_spent,
        back_amount: back_received,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    Ok(())
}

#[derive(Accounts)]
pub struct FinalizeBuyback<'info> {
    #[account(mut, seeds = [b"buyback_state"], bump = buyback_state.bump)]
    pub buyback_state: Account<'info, BuybackState>,
    
    #[account(mut)]
    pub back_vault: Account<'info, TokenAccount>,
    
    pub authority: Signer<'info>,
}

#[event]
pub struct BuybackInitiated {
    pub usdc_amount: u64,
    pub timestamp: i64,
}
```

### Keeper Implementation

**File**: `oracle/src/buyback-keeper.ts`

```typescript
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import axios from 'axios';

const JUPITER_API = 'https://quote-api.jup.ag/v6';
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // Devnet
const BACK_MINT = new PublicKey('862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux');
const BUYBACK_VAULT = new PublicKey('E24ZXgV6RrnCiPnKWwgx8LprNQ4DhAjXQ3KNE4PaXzUr');

async function checkAndExecuteBuyback() {
  const connection = new Connection(process.env.SOLANA_RPC_URL!);
  
  // 1. Check vault balance
  const vaultInfo = await connection.getTokenAccountBalance(BUYBACK_VAULT);
  const usdcAmount = Number(vaultInfo.value.amount);
  
  if (usdcAmount < 100_000_000) { // 100 USDC minimum
    console.log(`Vault balance too low: ${usdcAmount / 1e6} USDC`);
    return;
  }
  
  console.log(`✅ Vault has ${usdcAmount / 1e6} USDC - Initiating buyback`);
  
  // 2. Get Jupiter quote
  const quoteResponse = await axios.get(`${JUPITER_API}/quote`, {
    params: {
      inputMint: USDC_MINT.toString(),
      outputMint: BACK_MINT.toString(),
      amount: usdcAmount,
      slippageBps: 200, // 2% max slippage
    }
  });
  
  const quote = quoteResponse.data;
  console.log(`Quote: ${usdcAmount / 1e6} USDC → ${quote.outAmount / 1e9} BACK`);
  
  // 3. Get swap transaction
  const swapResponse = await axios.post(`${JUPITER_API}/swap`, {
    quoteResponse: quote,
    userPublicKey: wallet.publicKey.toString(),
    wrapAndUnwrapSol: false,
  });
  
  const swapTx = swapResponse.data.swapTransaction;
  
  // 4. Execute swap
  const tx = Transaction.from(Buffer.from(swapTx, 'base64'));
  const signature = await connection.sendTransaction(tx, [wallet]);
  await connection.confirmTransaction(signature);
  
  console.log(`✅ Swap executed: ${signature}`);
  
  // 5. Call finalize_buyback()
  await program.methods
    .finalizeBuyback(usdcAmount, quote.outAmount)
    .accounts({
      buybackState: BUYBACK_STATE_PDA,
      backVault: BACK_VAULT,
      authority: wallet.publicKey,
    })
    .rpc();
    
  console.log(`✅ Buyback finalized on-chain`);
}

// Run every hour
setInterval(checkAndExecuteBuyback, 60 * 60 * 1000);
```

---

## 📋 Implementation Steps

### Phase 5.3.1: Program Modifications (6h)
- [ ] Rename `execute_buyback()` to `initiate_buyback()`
- [ ] Remove Pyth Oracle logic (not needed if keeper handles pricing)
- [ ] Add `finalize_buyback()` instruction
- [ ] Add `BuybackInitiated` event
- [ ] Update IDL
- [ ] Rebuild and redeploy program

### Phase 5.3.2: Keeper Development (4h)
- [ ] Create `oracle/src/buyback-keeper.ts`
- [ ] Implement Jupiter API integration
- [ ] Add retry logic (3 attempts with backoff)
- [ ] Add circuit breaker (pause if 3 consecutive failures)
- [ ] Logging with Winston
- [ ] Environment variables

### Phase 5.3.3: Testing (3h)
- [ ] Deploy updated program to devnet
- [ ] Fund vault with 100 USDC
- [ ] Run keeper manually
- [ ] Verify swap execution
- [ ] Check finalize_buyback() updates state
- [ ] Verify BACK tokens in vault
- [ ] Test distribution + burn

### Phase 5.3.4: Production Deployment (1h)
- [ ] Deploy keeper with PM2
- [ ] Setup monitoring (Datadog/Grafana)
- [ ] Create alerts (vault balance, keeper health)
- [ ] Document runbook

---

## ⚠️ Alternative: Minimal MVP Approach

If Jupiter integration is too complex for Phase 5, we can:

1. **Manual Admin Swaps**: Admin manually swaps USDC → BACK via Jupiter UI
2. **Simple Transfer**: Admin calls `deposit_back()` to fund back_vault
3. **Distribution Works**: Users can claim rebates immediately
4. **Defer Automation**: Add keeper in Phase 6 or 7

**Pros**: Fast to implement, unblocks testing
**Cons**: Not fully automated, requires manual intervention

---

## 🔧 Next Immediate Actions

1. ✅ **Verify current deposit flow**
   - Execute a swap on UI to trigger `deposit_to_buyback()`
   - Run `node scripts/test-buyback-deposit.js` to check vault balance
   
2. ⏳ **Decide on approach**
   - Option A: Full Jupiter CPI integration (10h work)
   - Option B: Keeper + Jupiter API (6h work) ← **RECOMMENDED**
   - Option C: Manual MVP (2h work, defer automation)
   
3. ⏳ **Start implementation**
   - Based on decision, follow implementation steps above

---

## 📊 Estimated Time

| Approach | Development | Testing | Total |
|----------|------------|---------|-------|
| **Option A: Jupiter CPI** | 8h | 4h | 12h |
| **Option B: Keeper + API** | 4h | 2h | 6h ← **RECOMMENDED** |
| **Option C: Manual MVP** | 1h | 1h | 2h |

**Recommendation**: Start with **Option B** (Keeper + Jupiter API) for fastest reliable implementation.
