# 🧪 Guide de Test Manuel - Buyback & Burn

**Date**: 25 Octobre 2025  
**Version**: 1.0  
**Environnement**: Devnet Solana

---

## 📋 Pré-requis

### 1. Programs Déployés
- [ ] `swapback_router` déployé sur devnet
- [ ] `swapback_buyback` déployé sur devnet
- [ ] Program IDs mis à jour dans le code

### 2. Comptes Initialisés
- [ ] Router state initialisé
- [ ] Buyback state initialisé (min_buyback_amount = 100 USDC)
- [ ] USDC vault créé

### 3. Outils & Credentials
- [ ] Solana CLI installé et configuré pour devnet
- [ ] Wallet avec SOL pour les tests (min 2 SOL)
- [ ] Node.js + TypeScript configuré
- [ ] SDK @swapback/sdk installé

---

## 🔬 Test 1: Vérification Programs

### Objectif
Vérifier que les programs sont déployés et fonctionnels

### Commandes
```bash
# Router
solana program show 3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap --url devnet

# Buyback
solana program show 46UWFYdksvkGhTPy9cTSJGa3d5nqzpY766rtJeuxtMgU --url devnet
```

### Résultats Attendus
- ✅ Les deux programs existent
- ✅ Upgradeable: Yes
- ✅ Data Length: > 500 KB (chacun)

### Checklist
- [ ] Router program trouvé
- [ ] Buyback program trouvé
- [ ] Versions correctes

---

## 🔬 Test 2: Vérification Buyback State

### Objectif
Lire le compte BuybackState on-chain

### Commandes
```bash
# Trouver le PDA
solana address --program-id 46UWFYdksvkGhTPy9cTSJGa3d5nqzpY766rtJeuxtMgU --seed buyback_state

# Lire le compte
solana account <BUYBACK_STATE_PDA> --url devnet --output json
```

### Script TypeScript
```typescript
import { getBuybackStats } from '@swapback/sdk';

const stats = await getBuybackStats(connection);
console.log('Min Buyback Amount:', stats.minBuybackAmount.toNumber() / 1e6, 'USDC');
console.log('Total USDC Spent:', stats.totalUsdcSpent.toNumber() / 1e6, 'USDC');
console.log('Total BACK Burned:', stats.totalBackBurned.toNumber() / 1e9, '$BACK');
console.log('Buyback Count:', stats.buybackCount.toNumber());
```

### Résultats Attendus
- ✅ Account existe
- ✅ `minBuybackAmount` = 100_000_000 (100 USDC)
- ✅ `totalUsdcSpent` >= 0
- ✅ `totalBackBurned` >= 0
- ✅ `buybackCount` >= 0

### Checklist
- [ ] BuybackState trouvé
- [ ] Authority correcte
- [ ] back_mint = $BACK mint
- [ ] usdc_vault PDA correct
- [ ] Stats initialisées à 0

---

## 🔬 Test 3: Vérification USDC Vault

### Objectif
Vérifier que le vault USDC existe et peut recevoir des dépôts

### Commandes
```bash
# Trouver le PDA
solana address --program-id 46UWFYdksvkGhTPy9cTSJGa3d5nqzpY766rtJeuxtMgU --seed usdc_vault

# Balance
spl-token balance EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v --owner <USDC_VAULT_PDA> --url devnet
```

### Script TypeScript
```typescript
const [usdcVaultPDA] = getUsdcVaultPDA();
const balance = await connection.getTokenAccountBalance(usdcVaultPDA);
console.log('USDC Vault Balance:', balance.value.uiAmount, 'USDC');
```

### Résultats Attendus
- ✅ Token Account existe
- ✅ Mint = USDC (EPjFWdd...)
- ✅ Owner = Buyback State PDA
- ✅ Balance >= 0

### Checklist
- [ ] USDC vault trouvé
- [ ] Owner correct (buyback_state PDA)
- [ ] Balance lisible

---

## 🔬 Test 4: Simulation Swap avec Router

### Objectif
Calculer les montants qui seraient envoyés au buyback lors d'un swap

### Scénario
```
Input:  1 SOL
Output: 150 USDC (prix mock)
Min:    145 USDC (slippage 3%)
```

### Calculs Attendus
```
Platform Fee (0.3%):     150 * 0.003 = 0.45 USDC
Routing Profit:          150 - 145 - 0.45 = 4.55 USDC

Allocation Buyback (40%):
  From fee:    0.45 * 0.40 = 0.18 USDC
  From profit: 4.55 * 0.40 = 1.82 USDC
  
TOTAL BUYBACK DEPOSIT: 2.00 USDC
```

### Script Test
```typescript
const amountIn = 1 * LAMPORTS_PER_SOL;
const amountOut = 150 * 1e6;
const minOut = 145 * 1e6;

const platformFee = Math.floor(amountOut * 30 / 10000); // 0.3%
const routingProfit = amountOut - minOut - platformFee;
const buybackDeposit = Math.floor(platformFee * 0.4) + Math.floor(routingProfit * 0.4);

console.log('Buyback Deposit:', buybackDeposit / 1e6, 'USDC');
// Expected: ~2.00 USDC
```

### Checklist
- [ ] Platform fee = 0.3% correct
- [ ] Routing profit calculé correctement
- [ ] 40% allocation vérifiée
- [ ] Total buyback deposit = 2.00 USDC

---

## 🔬 Test 5: Execute Swap Réel (Devnet)

⚠️ **ATTENTION**: Nécessite des tokens SOL et routing fonctionnel

### Pré-requis
- Avoir au moins 2 SOL sur devnet
- Router program fonctionnel avec DEX integration

### Étapes
1. Préparer les comptes token
2. Approuver le router
3. Exécuter swap
4. Vérifier event logs
5. Vérifier USDC vault balance

### Commande (via SDK)
```typescript
import { SwapExecutor } from '@swapback/sdk';

const result = await swapExecutor.executeSwap({
  inputToken: SOL_MINT,
  outputToken: USDC_MINT,
  amount: 1 * LAMPORTS_PER_SOL,
  slippage: 300, // 3%
  user: userKeypair,
});

console.log('Swap signature:', result.signature);
console.log('Amount out:', result.amountOut / 1e6, 'USDC');
```

### Vérification Events
```bash
solana confirm -v <SIGNATURE> --url devnet | grep -A 10 "SwapCompleted"
```

### Résultats Attendus (Events)
```
SwapCompleted {
  user: <USER_PUBKEY>,
  amount_in: 1000000000,      // 1 SOL
  amount_out: 150000000,      // 150 USDC
  platform_fee: 450000,       // 0.45 USDC
  routing_profit: 4550000,    // 4.55 USDC
  buyback_deposit: 2000000    // 2.00 USDC
}

BuybackDeposit {
  amount: 2000000,            // 2.00 USDC
  source: "swap_fees_and_profit",
  timestamp: <UNIX_TIME>
}
```

### Checklist
- [ ] Swap exécuté avec succès
- [ ] Event SwapCompleted émis
- [ ] Event BuybackDeposit émis
- [ ] buyback_deposit = ~2.00 USDC
- [ ] USDC vault balance augmenté de 2.00 USDC

---

## 🔬 Test 6: Vérifier Deposit dans Vault

### Objectif
Confirmer que les USDC ont bien été transférés au vault

### Avant/Après Swap
```typescript
// BEFORE
const balanceBefore = await connection.getTokenAccountBalance(usdcVaultPDA);
console.log('Before:', balanceBefore.value.uiAmount, 'USDC');

// EXECUTE SWAP
await executeSwap(...);

// AFTER
const balanceAfter = await connection.getTokenAccountBalance(usdcVaultPDA);
console.log('After:', balanceAfter.value.uiAmount, 'USDC');

const difference = balanceAfter.value.uiAmount - balanceBefore.value.uiAmount;
console.log('Deposited:', difference, 'USDC');
// Expected: ~2.00 USDC
```

### Résultats Attendus
- ✅ Balance augmentée exactement du montant `buyback_deposit`
- ✅ Aucune perte de precision (lamports)

### Checklist
- [ ] Vault balance augmenté
- [ ] Montant exact = buyback_deposit
- [ ] Pas de lamports perdus

---

## 🔬 Test 7: Estimation Prochain Buyback

### Objectif
Vérifier que l'estimation fonctionne correctement

### Script
```typescript
import { estimateNextBuyback } from '@swapback/sdk';

const estimation = await estimateNextBuyback(connection);

console.log('USDC Available:', estimation.usdcAvailable, 'USDC');
console.log('Estimated $BACK:', estimation.estimatedBackAmount);
console.log('Can Execute:', estimation.canExecute);
console.log('Reason:', estimation.reason);
```

### Scénarios
| Vault Balance | Can Execute | Reason |
|---------------|-------------|--------|
| 0 USDC | ❌ | Need 100 USDC minimum |
| 50 USDC | ❌ | Need 100 USDC minimum (current: 50) |
| 100 USDC | ✅ | - |
| 500 USDC | ✅ | - |

### Checklist
- [ ] Estimation retourne balance correcte
- [ ] canExecute = false si < 100 USDC
- [ ] canExecute = true si >= 100 USDC
- [ ] estimatedBackAmount calculé (1 USDC = ~250 $BACK)

---

## 🔬 Test 8: Execute Buyback (Admin)

⚠️ **ATTENTION**: Nécessite authority du buyback program

### Pré-requis
- USDC vault >= 100 USDC
- Admin keypair avec authority
- Jupiter disponible sur devnet

### Script
```typescript
import { executeBuyback } from '@swapback/sdk';

const signature = await executeBuyback(
  connection,
  adminKeypair,
  500_000_000,  // Max 500 USDC
  125_000_000_000  // Min 125,000 $BACK
);

console.log('Buyback executed:', signature);
```

### Vérification Events
```bash
solana confirm -v <SIGNATURE> --url devnet
```

### Résultats Attendus (Events)
```
BuybackExecuted {
  usdc_amount: 500000000,           // 500 USDC
  back_amount: 125000000000,        // 125,000 $BACK
  timestamp: <UNIX_TIME>
}

BackBurned {
  amount: 125000000000,             // 125,000 $BACK
  total_burned: 125000000000,       // Total cumulé
  timestamp: <UNIX_TIME>
}
```

### Checklist
- [ ] Transaction réussie
- [ ] Event BuybackExecuted émis
- [ ] Event BackBurned émis
- [ ] USDC vault balance réduit
- [ ] BuybackState mis à jour

---

## 🔬 Test 9: Vérifier Stats Après Buyback

### Objectif
Confirmer que toutes les stats ont été mises à jour

### Script
```typescript
const statsAfter = await getBuybackStats(connection);

console.log('Total USDC Spent:', statsAfter.totalUsdcSpent.toNumber() / 1e6, 'USDC');
console.log('Total BACK Burned:', statsAfter.totalBackBurned.toNumber() / 1e9, '$BACK');
console.log('Buyback Count:', statsAfter.buybackCount.toNumber());
```

### Résultats Attendus
- ✅ `totalUsdcSpent` augmenté de 500 USDC
- ✅ `totalBackBurned` augmenté de 125,000 $BACK
- ✅ `buybackCount` augmenté de 1

### Checklist
- [ ] totalUsdcSpent mis à jour
- [ ] totalBackBurned mis à jour
- [ ] buybackCount incrémenté
- [ ] Vault balance = 0 (si tout utilisé)

---

## 🔬 Test 10: Frontend Dashboard

### Objectif
Vérifier que le dashboard affiche correctement les stats

### URL
http://localhost:3001/dashboard

### Éléments à Vérifier
- [ ] Section "🔥 BUYBACK & BURN" visible
- [ ] **USDC Spent**: Affiche le total correct
- [ ] **$BACK Burned**: Affiche le total correct
- [ ] **Buybacks Executed**: Affiche le count correct
- [ ] **Vault Balance**: Affiche balance actuelle
- [ ] **Next Buyback Estimate**: Status Ready/Pending correct
- [ ] Auto-refresh fonctionne (30s)
- [ ] Bouton refresh manuel fonctionne
- [ ] Live indicator animé

### Screenshots
Prendre des screenshots pour documentation :
1. Dashboard overview
2. Buyback stats card
3. Next buyback estimate (Ready state)
4. Next buyback estimate (Pending state)

---

## 📊 Résultats de Test - Template

```
Date: _____________
Testeur: _____________
Environnement: Devnet

╔═══════════════════════════════════════════════════════════════╗
║                    RÉSULTATS DE TEST                          ║
╚═══════════════════════════════════════════════════════════════╝

Test 1: Programs Déployés          [ ] Pass  [ ] Fail
Test 2: Buyback State               [ ] Pass  [ ] Fail
Test 3: USDC Vault                  [ ] Pass  [ ] Fail
Test 4: Simulation Swap             [ ] Pass  [ ] Fail
Test 5: Execute Swap Réel           [ ] Pass  [ ] Fail
Test 6: Vérifier Deposit            [ ] Pass  [ ] Fail
Test 7: Estimation Buyback          [ ] Pass  [ ] Fail
Test 8: Execute Buyback             [ ] Pass  [ ] Fail
Test 9: Vérifier Stats              [ ] Pass  [ ] Fail
Test 10: Frontend Dashboard         [ ] Pass  [ ] Fail

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TAUX DE RÉUSSITE: ___/10 (___%)

PROBLÈMES RENCONTRÉS:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

NOTES:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

## 🐛 Troubleshooting

### Erreur: "Buyback state not found"
**Solution**: Exécuter initialize_buyback instruction avec admin authority

### Erreur: "Insufficient funds in vault"
**Solution**: Faire plus de swaps pour accumuler USDC, ou réduire min_buyback_amount

### Erreur: "Jupiter swap failed"
**Solution**: Vérifier que Jupiter est disponible sur devnet, augmenter slippage

### Erreur: "Slippage exceeded"
**Solution**: Augmenter slippage dans execute_buyback (actuellement 0.5%)

### Erreur: "Invalid authority"
**Solution**: Utiliser le bon keypair admin pour execute_buyback

### Frontend ne charge pas les stats
**Solution**: Vérifier RPC connection, vérifier que buyback_state existe

---

## 📈 Métriques de Succès

### Critères de Validation
- ✅ **Tous les tests passent** (10/10)
- ✅ **Aucune perte de fonds** (USDC, SOL, $BACK)
- ✅ **Events corrects** émis à chaque étape
- ✅ **Stats on-chain cohérentes**
- ✅ **Frontend synchronisé** avec on-chain

### KPIs à Tracker
| Métrique | Cible | Actuel | Status |
|----------|-------|--------|--------|
| Frais collectés | 0.30% | ___ % | ___ |
| Allocation buyback | 40% | ___ % | ___ |
| Slippage buyback | < 0.5% | ___ % | ___ |
| Burn accuracy | 100% | ___ % | ___ |
| Dashboard uptime | 99% | ___ % | ___ |

---

## 🚀 Prochaines Étapes

Après validation complète des tests :

1. **Audit Code**
   - Review par autre dev
   - Security audit si possible

2. **Tests de Charge**
   - 100 swaps consécutifs
   - Vérifier gas costs
   - Vérifier performance

3. **Documentation**
   - Mettre à jour README
   - Créer guide utilisateur
   - Vidéo démo

4. **Mainnet Prep**
   - Deploy sur mainnet-beta
   - Initialize avec vrais tokens
   - Monitoring setup

---

**Version**: 1.0  
**Dernière Mise à Jour**: 25 Octobre 2025  
**Auteur**: GitHub Copilot
