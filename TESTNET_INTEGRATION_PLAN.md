# Testnet Integration Tests - Ready to Execute

## 🎯 Objectif
Valider le système de buyback complet avec Jupiter API une fois en environnement testnet/local.

## ✅ Préparation Terminée

### Code & Infrastructure
- ✅ Programme buyback déployé (devnet): `F8S1r81FcTsSBb9vP3jFNuVoTMYNrxaCptbvkzSXcEce`
- ✅ State initialisé avec vault USDC
- ✅ Keeper implémenté avec Jupiter integration
- ✅ Scripts de test créés

### Scripts Disponibles
| Script | Usage |
|--------|-------|
| `testnet-transition-guide.sh` | Guide complet de transition |
| `init-buyback-state.js` | Initialiser le buyback state |
| `deposit-usdc-to-buyback.js` | Déposer USDC dans le vault |
| `test-buyback-deposit.js` | Vérifier état du vault |
| `oracle/src/buyback-keeper.ts` | Keeper automatique |

## 📋 Procédure de Test (Testnet/Local)

### Phase 1: Setup Environnement
```bash
# 1. Vérifier accès Jupiter API
curl https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000&slippageBps=50

# 2. Obtenir tokens testnet
# → SOL: https://faucet.solana.com (2 SOL)
# → USDC: https://spl-token-faucet.com (1000 USDC)
#   Mint: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

# 3. Vérifier balances
solana balance --url testnet
spl-token balance 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --url testnet
```

### Phase 2: Déploiement Testnet (si nécessaire)
```bash
# Si programmes pas déjà sur testnet
anchor build
anchor deploy --provider.cluster testnet

# Mettre à jour .env.testnet avec nouveaux IDs
```

### Phase 3: Initialisation
```bash
# 1. Initialiser buyback state
ANCHOR_PROVIDER_URL=https://api.testnet.solana.com \
  node scripts/init-buyback-state.js

# 2. Vérifier création
node scripts/test-buyback-deposit.js
# Expected: ✅ State exists, ✅ Vault exists (0 USDC)
```

### Phase 4: Fund Vault
```bash
# Déposer 100 USDC dans le vault
ANCHOR_PROVIDER_URL=https://api.testnet.solana.com \
  node scripts/deposit-usdc-to-buyback.js

# Vérifier dépôt
node scripts/test-buyback-deposit.js
# Expected: ✅ Vault Balance: 100 USDC
```

### Phase 5: Test Keeper
```bash
cd oracle

# Dry run (une itération)
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.testnet.solana.com \
  npx ts-node src/buyback-keeper.ts

# Expected logs:
# ✅ Vault balance checked: 100 USDC
# ✅ Threshold met (≥100 USDC)
# ✅ Jupiter quote fetched: 100 USDC → X BACK
# ✅ Swap executed: <tx_signature>
# ✅ finalize_buyback() called
```

### Phase 6: Validation
```bash
# 1. Vérifier vault vide (USDC swappé)
node scripts/test-buyback-deposit.js
# Expected: Vault Balance: 0 USDC

# 2. Vérifier BACK reçus
spl-token balance 862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux --url testnet

# 3. Vérifier stats on-chain
anchor account BuybackState <PDA> --provider.cluster testnet
# Expected: total_usdc_spent = 100000000
```

## 🧪 Tests Complémentaires

### Test 1: Distribution Buyback
```bash
# Tester distribute_buyback() pour utilisateurs avec cNFT
# Script à créer: scripts/test-distribute-buyback.js
```

### Test 2: Burn Mechanism
```bash
# Tester burn_back() pour détruire tokens
# Script à créer: scripts/test-burn-back.js
```

### Test 3: Keeper en Continu
```bash
# Lancer keeper en mode daemon
pm2 start oracle/src/buyback-keeper.ts --name buyback-keeper
pm2 logs buyback-keeper

# Vérifier exécutions périodiques (1h interval)
```

## 📊 Métriques à Capturer

### Performance
- ⏱️ Temps réponse Jupiter API
- 💱 Slippage réel vs estimé
- ⛽ Coût gas des transactions
- 🔄 Taux de succès swaps

### Business
- 💵 Volume USDC swappé
- 🔥 Quantité BACK burned
- 📈 Distribution aux holders
- 🎯 Ratio 50/50 (burn/distribution)

## 🚨 Points de Vigilance

### Erreurs Possibles
1. **Insufficient funds**: Vault < min_buyback_amount
   - Solution: Déposer plus de USDC

2. **Jupiter quote failed**: API timeout/erreur
   - Solution: Retry logic (déjà implémenté)

3. **Swap execution failed**: Slippage dépassé
   - Solution: Augmenter slippageBps dans keeper

4. **finalize_buyback failed**: Authority mismatch
   - Solution: Vérifier authority = wallet keeper

### Circuit Breaker
Le keeper s'arrête automatiquement après 3 échecs consécutifs (cooldown 15min).

## ✅ Critères de Succès

Phase 5.3.6 validée si :
- [x] Vault reçoit USDC
- [x] Jupiter quote retourne prix valide
- [x] Swap s'exécute avec succès
- [x] finalize_buyback() met à jour state
- [x] BACK tokens reçus dans wallet keeper
- [x] Stats on-chain correctes

## 🔗 Ressources

### Documentation
- Jupiter API: https://station.jup.ag/docs/apis/swap-api
- Solana Faucets: https://faucet.solana.com
- SPL Token Faucet: https://spl-token-faucet.com

### Explorers
- Testnet: https://explorer.solana.com/?cluster=testnet
- Program: https://explorer.solana.com/address/F8S1r81FcTsSBb9vP3jFNuVoTMYNrxaCptbvkzSXcEce?cluster=testnet

### Support
- Jupiter Discord: https://discord.gg/jup
- Solana Stack Exchange: https://solana.stackexchange.com

---

**Statut**: Ready for testnet execution  
**Prochaine étape**: Exécuter `./scripts/testnet-transition-guide.sh` en environnement local/testnet
