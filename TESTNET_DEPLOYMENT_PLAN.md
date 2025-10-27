# Configuration Déploiement Testnet - SwapBack

**Date**: 27 Octobre 2025  
**Network**: Solana Testnet  
**RPC**: https://api.testnet.solana.com

## 📋 Checklist Pré-Déploiement

### 1. ✅ Configuration Fees
- [x] Platform Fee: **0.20%** (20 basis points)
- [x] Plus compétitif que Raydium (0.25%) et Orca (0.30%)
- [x] Buyback Allocation: 40% des fees
- [x] Code mis à jour: `programs/swapback_router/src/lib.rs`

### 2. 🔧 Programmes à Déployer

**3 Programmes Solana**:
1. **swapback_cnft** - Gestion des cNFTs et boost
2. **swapback_router** - Routing et swaps avec fees 0.20%
3. **swapback_buyback** - Buyback automatique et redistribution

### 3. 💰 Budget Estimé

**Testnet Airdrop Needed**:
- Deploy 3 programs: ~10-15 SOL (testnet)
- Create tokens: ~1 SOL
- Initialize states: ~2 SOL
- Create Merkle Tree: ~5 SOL
- Buffer: ~5 SOL
- **Total**: ~25-30 SOL testnet

**Get Testnet SOL**:
```bash
solana airdrop 5 --url testnet
# Répéter si besoin
```

### 4. 📦 Tokens à Créer

**BACK Token** (Testnet):
- Name: SwapBack Token
- Symbol: BACK
- Decimals: 9
- Supply: 1,000,000,000 BACK

**USDC Mock** (Testnet):
- Utiliser: `BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR` (devnet USDC)
- Ou créer nouveau mock testnet

### 5. 🌲 Merkle Tree Configuration

**Bubblegum Compressed NFT Tree**:
- Max Depth: 14 (16,384 NFTs)
- Max Buffer Size: 64
- Canopy Depth: 0
- Cost: ~5 SOL testnet

## 🚀 Étapes de Déploiement

### Étape 1: Préparation Wallet

```bash
# Vérifier wallet configuré
solana config get

# Basculer sur testnet
solana config set --url testnet

# Airdrop SOL testnet
solana airdrop 5
solana balance

# Répéter jusqu'à avoir ~30 SOL
```

### Étape 2: Build des Programmes

```bash
cd /workspaces/SwapBack

# Build tous les programmes
anchor build

# Vérifier les program IDs
ls -la target/deploy/*.so
```

### Étape 3: Déployer les Programmes

```bash
# Déployer swapback_cnft
anchor deploy --provider.cluster testnet --program-name swapback_cnft

# Déployer swapback_router
anchor deploy --provider.cluster testnet --program-name swapback_router

# Déployer swapback_buyback
anchor deploy --provider.cluster testnet --program-name swapback_buyback

# Sauvegarder les Program IDs
echo "Sauvegarder les IDs dans un fichier"
```

### Étape 4: Créer les Tokens

```bash
# Créer BACK token
spl-token create-token --decimals 9 --url testnet

# Créer token account
spl-token create-account <BACK_MINT> --url testnet

# Mint initial supply (1 milliard BACK)
spl-token mint <BACK_MINT> 1000000000 --url testnet
```

### Étape 5: Initialiser les États

```bash
# Router State
node scripts/init-router-state.js --network testnet

# Buyback State
node scripts/init-buyback-state.js --network testnet

# Global State (CNFT)
node scripts/init-global-state.js --network testnet

# Collection Config
node scripts/init-collection-config.js --network testnet
```

### Étape 6: Créer Merkle Tree

```bash
# Créer l'arbre Bubblegum pour cNFTs
node scripts/create-merkle-tree.js --network testnet --max-depth 14
```

### Étape 7: Configuration Frontend

Mettre à jour `app/.env.local`:

```env
# Testnet Configuration
NEXT_PUBLIC_SOLANA_NETWORK=testnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.testnet.solana.com

# Program IDs (à remplir après déploiement)
NEXT_PUBLIC_ROUTER_PROGRAM_ID=<TESTNET_ROUTER_ID>
NEXT_PUBLIC_BUYBACK_PROGRAM_ID=<TESTNET_BUYBACK_ID>
NEXT_PUBLIC_CNFT_PROGRAM_ID=<TESTNET_CNFT_ID>

# Token Addresses (à remplir après création)
NEXT_PUBLIC_BACK_MINT=<TESTNET_BACK_MINT>
NEXT_PUBLIC_USDC_MINT=<TESTNET_USDC_MINT>

# Merkle Tree
NEXT_PUBLIC_MERKLE_TREE=<TESTNET_TREE_ADDRESS>
```

### Étape 8: Tests de Validation

```bash
# Test E2E sur testnet
node scripts/test-e2e-boost-system.js --network testnet

# Test lock + mint
node scripts/lock-and-mint-cnft.js --network testnet --amount 100

# Test swap avec boost
node scripts/test-swap-with-boost.js --network testnet

# Test buyback
node scripts/test-buyback-flow.js --network testnet
```

## 📊 Configuration Fees Détaillée

### Fee Structure (0.20% Total)

```rust
// Router lib.rs
pub const PLATFORM_FEE_BPS: u16 = 20; // 0.20% (20 basis points)
pub const BUYBACK_ALLOCATION_BPS: u16 = 4000; // 40% des fees

// Décomposition pour un swap de 1000 USDC:
// - Fee totale: 1000 × 0.20% = 2 USDC
// - Vers buyback: 2 × 40% = 0.8 USDC
// - Protocol/LP: 2 × 60% = 1.2 USDC
```

### Rebate avec cNFT Boost

```typescript
// Exemple: Swap 1000 USDC avec boost 900 bp (9%)
const baseFee = 1000 * 0.002 = 2 USDC
const boostRebate = 2 * 0.09 = 0.18 USDC
const effectiveFee = 2 - 0.18 = 1.82 USDC
// Soit 0.182% effective fee (vs 0.25% Raydium, 0.30% Orca)
```

## 🎯 Comparaison Post-Déploiement

| Métrique | SwapBack | Raydium | Orca |
|----------|----------|---------|------|
| **Base Fee** | 0.20% | 0.25% | 0.30% |
| **Fee avec Boost (9%)** | 0.182% | N/A | N/A |
| **Fee avec Boost (20%)** | 0.16% | N/A | N/A |
| **Rebate** | Oui (cNFT) | Non | Non |
| **Buyback** | Automatique | Non | Non |

**Avantage SwapBack**:
- 📉 **20% moins cher** que Raydium
- 📉 **33% moins cher** que Orca
- 🎁 **Rebate unique** via cNFT
- 💰 **Buyback redistribué** aux holders

## 📝 Post-Déploiement

### Actions Immédiates

1. **Documenter les Addresses**
   - Sauvegarder tous les Program IDs
   - Sauvegarder tous les Token Mints
   - Sauvegarder Merkle Tree address
   - Créer `TESTNET_ADDRESSES.md`

2. **Mettre à Jour Frontend**
   - Déployer sur Vercel avec config testnet
   - Tester UI avec wallet testnet
   - Vérifier tous les flows

3. **Tests UAT sur Testnet**
   - Inviter beta testers
   - Tester avec vrais utilisateurs
   - Collecter feedback

4. **Monitoring**
   - Setup logs
   - Track transactions
   - Monitor fees collectées
   - Surveiller erreurs

### Métriques à Tracker

- Volume de swaps quotidien
- Fees collectées (0.20%)
- Buyback effectués
- Nombre de cNFTs mintés
- Boost moyen utilisé
- TVL (Total Value Locked)

## 🔄 Rollback Plan

Si problèmes critiques sur testnet:

1. **Désactiver swaps** (pause Router)
2. **Analyser logs** et erreurs
3. **Fix en local** et re-test
4. **Re-déployer** version corrigée
5. **Valider** avant mainnet

## ✅ Checklist Finale

Avant de passer à mainnet:

- [ ] Testnet déployé et opérationnel
- [ ] Tous les tests E2E passent
- [ ] UAT complété avec 10+ testeurs
- [ ] 0 bugs critiques
- [ ] Fees validées (0.20%)
- [ ] Boost cNFT fonctionne
- [ ] Buyback fonctionne
- [ ] Dashboard opérationnel
- [ ] Documentation complète
- [ ] Audit sécurité OK

**Timeline**: 1 semaine de tests testnet avant mainnet

---

**Next**: Exécuter le déploiement testnet étape par étape
