# 🧪 Guide de Test - Buyback-Burn Flow

**Date**: 25 Octobre 2025  
**Objectif**: Tester le flow complet Swap → Deposit → Buyback → Burn

---

## 📋 Prérequis

### 1. Environment Setup
```bash
# Devnet RPC
export SOLANA_RPC_URL="https://api.devnet.solana.com"

# Admin wallet avec SOL pour gas fees
solana airdrop 2 --url devnet

# Vérifier balance
solana balance --url devnet
```

### 2. Programs Déployés
- ✅ `swapback_router`: Build + Deploy sur devnet
- ✅ `swapback_buyback`: Build + Deploy sur devnet
- ✅ `swapback_buyback` initialisé avec min 100 USDC

### 3. Tokens Nécessaires
- SOL (pour gas fees)
- USDC devnet (pour tests)
- $BACK tokens (pour vérifier burns)

---

## 🔄 Test Flow Complet

### **PHASE 1: Build & Deploy Programs**

#### 1.1 Build Router
```bash
cd /workspaces/SwapBack/programs/swapback_router
anchor build

# Vérifier taille
ls -lh target/deploy/swapback_router.so

# Expected: < 1 MB
```

**✅ Critère de succès**: Build sans erreurs, .so généré

#### 1.2 Build Buyback
```bash
cd /workspaces/SwapBack/programs/swapback_buyback
anchor build

# Vérifier taille
ls -lh target/deploy/swapback_buyback.so
```

**✅ Critère de succès**: Build sans erreurs, .so généré

#### 1.3 Deploy sur Devnet
```bash
# Router
cd /workspaces/SwapBack/programs/swapback_router
anchor deploy --provider.cluster devnet

# Buyback
cd /workspaces/SwapBack/programs/swapback_buyback
anchor deploy --provider.cluster devnet
```

**✅ Critère de succès**: 
- Program IDs affichés
- Transactions confirmées
- Balance wallet réduite (gas fees)

---

### **PHASE 2: Initialize Buyback**

#### 2.1 Créer Script d'Initialisation
```typescript
// scripts/initialize-buyback.ts
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { initializeBuyback } from '../sdk/src/buyback';
import fs from 'fs';

const connection = new Connection('https://api.devnet.solana.com');
const adminKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync('~/.config/solana/id.json', 'utf-8')))
);

async function main() {
  console.log('🔧 Initializing buyback...');
  console.log('Admin:', adminKeypair.publicKey.toBase58());
  
  const signature = await initializeBuyback(
    connection,
    adminKeypair,
    100_000_000 // 100 USDC minimum
  );
  
  console.log('✅ Initialized:', signature);
  console.log('🔍 View:', `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
}

main();
```

#### 2.2 Exécuter
```bash
cd /workspaces/SwapBack
npx ts-node scripts/initialize-buyback.ts
```

**✅ Critères de succès**:
- Transaction confirmée
- BuybackState account créé
- USDC vault créé
- Explorer montre accounts initialisés

#### 2.3 Vérifier State
```bash
# Get buyback state PDA
solana account <buyback_state_pda> --url devnet --output json

# Expected fields:
# - authority: <admin_pubkey>
# - back_mint: <BACK_mint>
# - usdc_vault: <vault_pda>
# - min_buyback_amount: 100000000
# - total_usdc_spent: 0
# - total_back_burned: 0
# - buyback_count: 0
```

---

### **PHASE 3: Test Swap with Router**

#### 3.1 Mock Swap (Sans Router Déployé)
```typescript
// scripts/test-swap-deposit.ts
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';

const connection = new Connection('https://api.devnet.solana.com');

async function testSwap() {
  console.log('💱 Testing swap with buyback deposit...');
  
  // Simulation values
  const amountIn = 1_000_000_000; // 1 SOL
  const amountOut = 150_000_000; // 150 USDC
  const minOut = 145_000_000; // Min 145 USDC (3% slippage)
  
  // Calculate fees & profits
  const platformFee = Math.floor(amountOut * 0.003); // 0.3%
  const routingProfit = amountOut - minOut - platformFee;
  
  console.log('📊 Swap Details:');
  console.log('  Input:  1 SOL');
  console.log('  Output: 150 USDC');
  console.log('  Min:    145 USDC');
  console.log('  Fee:    ', platformFee / 1e6, 'USDC');
  console.log('  Profit: ', routingProfit / 1e6, 'USDC');
  
  // Buyback allocation (40% each)
  const feeForBuyback = Math.floor(platformFee * 0.4);
  const profitForBuyback = Math.floor(routingProfit * 0.4);
  const totalBuyback = feeForBuyback + profitForBuyback;
  
  console.log('\n🔥 Buyback Allocation (40%):');
  console.log('  From fees:   ', feeForBuyback / 1e6, 'USDC');
  console.log('  From profit: ', profitForBuyback / 1e6, 'USDC');
  console.log('  TOTAL:       ', totalBuyback / 1e6, 'USDC');
  
  return totalBuyback;
}

testSwap();
```

**✅ Critères de succès**:
- Calculs corrects
- 40% allocation vérifiée
- Total buyback > 0

#### 3.2 Vérifier USDC Vault
```bash
# Get vault balance
solana account <usdc_vault_pda> --url devnet

# Parse token balance
spl-token balance <usdc_vault_pda> --url devnet

# Expected: Augmentation après chaque swap
```

---

### **PHASE 4: Execute Buyback**

#### 4.1 Vérifier Vault >= Min
```bash
# Check vault balance
VAULT_BALANCE=$(spl-token balance <usdc_vault_pda> --url devnet)
echo "Vault: $VAULT_BALANCE USDC"

# Min required: 100 USDC
if [ $(echo "$VAULT_BALANCE >= 100" | bc) -eq 1 ]; then
  echo "✅ Ready for buyback"
else
  echo "❌ Need more USDC (min 100)"
fi
```

#### 4.2 Get Jupiter Quote
```bash
# Get quote for USDC → $BACK
curl "https://quote-api.jup.ag/v6/quote?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=<BACK_MINT>&amount=100000000&slippageBps=50"

# Expected response:
# {
#   "inputMint": "USDC...",
#   "outputMint": "BACK...",
#   "inAmount": "100000000",
#   "outAmount": "25000000000",  // ~25k $BACK for 100 USDC
#   "route": [...]
# }
```

#### 4.3 Execute Buyback
```typescript
// scripts/execute-buyback.ts
import { executeBuyback } from '../sdk/src/buyback';

async function runBuyback() {
  console.log('🔥 Executing buyback...');
  
  const signature = await executeBuyback(
    connection,
    adminKeypair,
    100_000_000,    // Max 100 USDC
    25_000_000_000  // Min 25k $BACK (from Jupiter quote)
  );
  
  console.log('✅ Buyback executed:', signature);
}

runBuyback();
```

**✅ Critères de succès**:
- Transaction confirmée
- USDC vault balance diminué
- $BACK reçus dans back_vault
- BuybackState updated:
  - `total_usdc_spent` += amount
  - `buyback_count` += 1

#### 4.4 Vérifier Logs
```bash
# Get transaction logs
solana confirm -v <buyback_tx_signature> --url devnet

# Expected events:
# - BuybackExecuted { usdc_amount, back_amount, timestamp }
# - Jupiter swap logs
# - Token transfers
```

---

### **PHASE 5: Verify Burn**

#### 5.1 Check Total Burned
```bash
# Get buyback state
solana account <buyback_state_pda> --url devnet --output json | jq '.data.total_back_burned'

# Expected: > 0 after buyback
```

#### 5.2 Verify Token Supply
```bash
# Get $BACK total supply BEFORE buyback
SUPPLY_BEFORE=$(spl-token supply <BACK_MINT> --url devnet)

# Execute buyback + burn

# Get $BACK total supply AFTER
SUPPLY_AFTER=$(spl-token supply <BACK_MINT> --url devnet)

# Calculate burned
BURNED=$((SUPPLY_BEFORE - SUPPLY_AFTER))
echo "🔥 Burned: $BURNED tokens"
```

**✅ Critères de succès**:
- Supply diminuée
- Burned amount == back_amount from buyback
- Explorer montre burn transaction

---

### **PHASE 6: Frontend Integration**

#### 6.1 Dashboard Stats
```bash
# Access dashboard
curl http://localhost:3001/dashboard > /tmp/dashboard.html

# Check for buyback stats
grep -o "BUYBACK" /tmp/dashboard.html
grep -o "USDC Spent" /tmp/dashboard.html
grep -o "BACK Burned" /tmp/dashboard.html
```

#### 6.2 Vérifier Auto-Refresh
```typescript
// Manual test dans browser console
const { useBuybackStats } = require('../hooks/useBuybackStats');

// Should fetch every 30s
// Check Network tab for repeated calls to RPC
```

**✅ Critères de succès**:
- Stats affichées correctement
- Valeurs correspondent à on-chain
- Auto-refresh fonctionne
- Manual refresh fonctionne

---

## 📊 Résultats Attendus

### Après 1 Swap (1 SOL → 150 USDC):
```
Platform Fee:      0.45 USDC
Routing Profit:    5 USDC
Buyback Deposit:   2.18 USDC (40% of 5.45)
Vault Balance:     2.18 USDC
```

### Après 50 Swaps (moyenne):
```
Total Deposits:    ~109 USDC
Vault Balance:     109 USDC (si pas de buyback)
Ready for Buyback: YES (> 100 USDC min)
```

### Après 1 Buyback (100 USDC):
```
USDC Spent:        100 USDC
$BACK Received:    ~25,000 (dépend du prix)
$BACK Burned:      ~25,000
Vault Balance:     9 USDC (remaining)
Buyback Count:     1
Total Supply:      Réduit de 25,000
```

### Dashboard Stats:
```
[USDC SPENT]:           $100.00
[$BACK BURNED]:         25,000
[BUYBACKS EXECUTED]:    1
[VAULT BALANCE]:        $9.00
```

---

## ⚠️ Checklist de Validation

### Pre-Deploy
- [ ] Router build sans erreurs
- [ ] Buyback build sans erreurs
- [ ] Tests unitaires passent (si créés)
- [ ] Audit sécurité basique (PDA seeds, authority checks)

### Deployment
- [ ] Router déployé sur devnet
- [ ] Buyback déployé sur devnet
- [ ] Program IDs mis à jour dans constants
- [ ] Buyback initialisé avec admin correct

### Flow Testing
- [ ] Swap calcule fees/profits correctement
- [ ] CPI deposit vers buyback fonctionne
- [ ] USDC vault reçoit les deposits
- [ ] Stats BuybackState updated après deposit

### Buyback Execution
- [ ] Jupiter quote retourne prix réaliste
- [ ] Execute buyback avec min amount check
- [ ] $BACK reçus dans back_vault
- [ ] Burn transaction confirmée
- [ ] Total supply réduit

### Frontend
- [ ] Hook useBuybackStats lit on-chain data
- [ ] BuybackStatsCard affiche stats correctes
- [ ] Auto-refresh fonctionne (30s)
- [ ] Manual refresh fonctionne
- [ ] Pas d'erreurs console

### Production Ready
- [ ] Multi-sig pour admin authority
- [ ] Rate limiting sur execute_buyback
- [ ] Monitoring + alertes configurés
- [ ] Documentation mise à jour
- [ ] Runbook pour opérations

---

## 🐛 Troubleshooting

### Erreur: "InsufficientFunds"
```bash
# Check vault balance
spl-token balance <usdc_vault_pda> --url devnet

# Should be >= min_buyback_amount (100 USDC)
```

### Erreur: "InvalidJupiterProgram"
```rust
// Verify Jupiter program ID in code
pub jupiter_program: Option<AccountInfo<'info>>

// Should match: JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4
```

### Erreur: "SlippageExceeded"
```typescript
// Increase slippage tolerance
const signature = await executeBuyback(
  connection,
  admin,
  100_000_000,
  20_000_000_000  // Reduce min amount (more slippage allowed)
);
```

### Dashboard ne charge pas
```bash
# Clear Next.js cache
rm -rf /workspaces/SwapBack/app/.next

# Restart server
cd /workspaces/SwapBack/app
npm run dev
```

### Hook retourne null
```typescript
// Check connection
console.log('Connection:', connection.rpcEndpoint);

// Check PDA derivation
const [pda, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from('buyback_state')],
  BUYBACK_PROGRAM_ID
);
console.log('Expected PDA:', pda.toBase58());
```

---

## 📈 Métriques de Succès

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Buyback Frequency | 1x/jour | Count buyback_count increments |
| USDC → Vault | 40% fees+profits | Monitor vault deposits vs swaps |
| Slippage | < 0.5% | Check Jupiter quote vs actual |
| $BACK Burned/Day | > 10k | Track total_back_burned daily |
| Frontend Load Time | < 2s | Chrome DevTools Network tab |
| Auto-Refresh | Every 30s | Console log timestamps |

---

## 🎯 Prochaines Étapes Après Tests

1. **Monitoring**:
   - Setup Grafana dashboard
   - Alert on buyback failures
   - Track supply reduction

2. **Optimizations**:
   - Batch buybacks (6-12h)
   - Dynamic slippage
   - MEV protection

3. **Audit**:
   - Security audit complet
   - Gas optimization
   - Error handling review

4. **Mainnet**:
   - Deploy sur mainnet-beta
   - Initialize avec real funds
   - Monitor 24h avant announce

---

**Date**: 25 Octobre 2025  
**Status**: ✅ Guide de test complet  
**Prêt pour**: Execution des tests
