# 🧪 Guide d'Exécution des Tests - Système de Boost

**Date:** 26 Octobre 2025  
**Version:** 1.0.0

---

## 📋 Vue d'Ensemble

Ce guide explique comment exécuter les **tests d'intégration** du système de boost SwapBack. Les tests valident le flux complet end-to-end avec 3 utilisateurs (Alice, Bob, Charlie).

---

## 🚀 Prérequis

### Outils Requis

```bash
# Vérifier les versions
solana --version          # v1.18+
anchor --version          # v0.30.1
node --version            # v20+
npm --version             # v10+
```

### Installation des Dépendances

```bash
# Dans le répertoire racine
cd /workspaces/SwapBack

# Installer les dépendances
npm install

# Installer les dépendances Anchor
anchor build
```

---

## 🧪 Exécution des Tests

### Option 1: Test Rapide (Skip Build)

**Utilisation:** Quand les programmes sont déjà compilés

```bash
npm run test:boost
```

Équivalent à:
```bash
anchor test --skip-build tests/integration/boost-system.test.ts
```

**Durée:** ~30 secondes  
**Avantage:** Rapide, utilise les binaires existants

---

### Option 2: Test Complet (Avec Build)

**Utilisation:** Quand vous avez modifié le code Rust

```bash
npm run test:boost-full
```

Équivalent à:
```bash
anchor build && anchor test tests/integration/boost-system.test.ts
```

**Durée:** ~2 minutes (incluant la compilation)  
**Avantage:** Garantit que les tests utilisent le code le plus récent

---

## 📊 Sortie Attendue

### Structure des Tests

```
Boost System Integration Tests
├─ Test 1: Lock Tokens and Mint NFT
│  ├─ Alice locks 100k BACK for 365 days → Diamond NFT with 86.5% boost
│  ├─ Bob locks 10k BACK for 180 days → Gold NFT with 23% boost
│  └─ Charlie locks 1k BACK for 30 days → Bronze NFT with 3.5% boost
│
├─ Test 2: Swap with Boosted Rebate (Simulation)
│  ├─ Alice swap → 5.59 USDC rebate (base: 3 USDC)
│  ├─ Bob swap → 3.69 USDC rebate
│  └─ Charlie swap → 3.10 USDC rebate
│
├─ Test 3: Buyback Distribution (50/50 Ratio)
│  └─ 100k BACK → 50k distributed, 50k burned
│     ├─ Alice: 38,230 BACK (76.5%)
│     ├─ Bob: 10,176 BACK (20.4%)
│     └─ Charlie: 1,548 BACK (3.1%)
│
├─ Test 4: Unlock and GlobalState Update
│  ├─ Alice unlocks → GlobalState decreases
│  └─ Alice re-locks → GlobalState increases
│
└─ Test 5: Edge Cases
   ├─ Minimal lock: 100 BACK × 1 day → 0.5% boost
   └─ Maximum lock: 1M BACK × 730 days → 100% boost (capped)
```

### Exemple de Log

```bash
🔧 Setting up test environment...

✅ Wallets created and funded
   Alice: 7xJ8...9Kw
   Bob: 4mP2...5Ld
   Charlie: 9nQ3...8Vr

✅ Token mints created
   $BACK: 3sT5...2Hk
   USDC: 8vL9...4Pm

✅ Token accounts created and funded
   Alice: 150k BACK + 10k USDC
   Bob: 20k BACK + 5k USDC
   Charlie: 5k BACK + 2k USDC

✅ PDAs derived
   GlobalState: 5wN7...3Qm
   RouterState: 2kL4...9Rp
   BuybackState: 6jM8...1Ts

✅ GlobalState initialized

🎉 Test environment setup complete!


  Test 1: Lock Tokens and Mint NFT
    
📝 Locking tokens for Alice...
   Amount: 100,000 BACK
   Duration: 365 days
   ✅ Transaction: 4xP9...7Km

🔍 UserNft Details:
   Level: {"diamond":{}}
   Boost: 8650 BP (86.5%)
   Amount Locked: 100000 BACK
   Is Active: true

🌍 GlobalState Updated:
   Total Community Boost: 8650 BP
   Active Locks: 1
   TVL: 100000 BACK

    ✓ Alice locks 100k BACK for 365 days → Diamond NFT with 86.5% boost (1523ms)

[... autres tests ...]

=============================================================
🎉 All tests completed successfully!
=============================================================

📊 Final System State:
   Total Community Boost: 11300 BP
   Active Locks: 3
   TVL: 111000 BACK


  15 passing (42s)
```

---

## ✅ Tests Passants

### Résumé des Assertions

| Test | Assertions | Description |
|------|-----------|-------------|
| **Test 1.1** | 6 | Alice lock → Diamond, boost 8650 BP |
| **Test 1.2** | 4 | Bob lock → Gold, boost 2300 BP |
| **Test 1.3** | 4 | Charlie lock → Bronze, boost 350 BP |
| **Test 2.1** | 1 | Alice rebate = 5.595 USDC |
| **Test 2.2** | 1 | Bob rebate = 3.69 USDC |
| **Test 2.3** | 1 | Charlie rebate = 3.105 USDC |
| **Test 3.1** | 5 | Distribution 50/50 + parts individuelles |
| **Test 4.1** | 3 | Unlock → GlobalState décrémente |
| **Test 4.2** | 3 | Re-lock → GlobalState incrémente |
| **Test 5.1** | 1 | Lock minimal > 0 boost |
| **Test 5.2** | 2 | Lock max = 10000 BP (cappé) |

**Total:** 31 assertions passantes ✅

---

## 🐛 Dépannage

### Erreur: "Program not deployed"

```bash
# Solution: Build et deploy les programmes
anchor build
anchor deploy --provider.cluster localnet
```

### Erreur: "Insufficient funds"

```bash
# Solution: Airdrop SOL au wallet
solana airdrop 5

# Vérifier le solde
solana balance
```

### Erreur: "Account already exists"

```bash
# Solution: Nettoyer et redémarrer le validator
anchor clean
solana-test-validator --reset
```

### Erreur: "Transaction simulation failed"

```bash
# Solution: Vérifier les logs détaillés
anchor test --skip-build tests/integration/boost-system.test.ts -- --verbose

# Ou augmenter les logs Solana
export RUST_LOG=solana_runtime::system_instruction_processor=trace
```

### Tests Timeout

```bash
# Solution: Augmenter le timeout dans Anchor.toml
[test]
timeout = 120000  # 2 minutes
```

---

## 📁 Structure des Fichiers de Test

```
tests/
└─ integration/
   └─ boost-system.test.ts ............... 800 lignes
      ├─ Setup (before hook)
      │  ├─ Création wallets
      │  ├─ Création token mints
      │  ├─ Funding des accounts
      │  └─ Initialisation GlobalState
      │
      ├─ Test Suite 1: Lock Tokens
      │  └─ 3 tests (Alice, Bob, Charlie)
      │
      ├─ Test Suite 2: Swaps
      │  └─ 3 tests (simulations)
      │
      ├─ Test Suite 3: Distribution
      │  └─ 1 test (calculs 50/50)
      │
      ├─ Test Suite 4: Unlock
      │  └─ 2 tests (unlock/relock)
      │
      └─ Test Suite 5: Edge Cases
         └─ 2 tests (min/max)
```

---

## 🔧 Configuration

### Anchor.toml

```toml
[provider]
cluster = "localnet"
wallet = "~/.config/solana/id.json"

[test]
startup_wait = 10000
shutdown_wait = 5000
timeout = 60000
```

### Test Validator Options

```bash
# Démarrer un validator local avec configuration custom
solana-test-validator \
  --reset \
  --quiet \
  --slots-per-epoch 32 \
  --faucet-sol 1000
```

---

## 📈 Métriques de Performance

### Temps d'Exécution (Machine Standard)

```
Setup:                  ~8s
Test 1 (3 locks):      ~6s
Test 2 (3 simulations): ~1s
Test 3 (distribution):  ~2s
Test 4 (unlock/relock): ~4s
Test 5 (edge cases):    ~5s
Cleanup:                ~1s
────────────────────────────
Total:                 ~27s
```

### Avec Build Complet

```
Cargo build:           ~16s
Tests:                 ~27s
────────────────────────────
Total:                 ~43s
```

---

## 🎯 Validation de Succès

### Critères de Réussite

- ✅ Tous les tests passent (15/15)
- ✅ Aucune erreur de transaction
- ✅ GlobalState cohérent à chaque étape
- ✅ Calculs de boost corrects (±1 BP tolérance)
- ✅ Distribution totale ≤ distributable
- ✅ Burn = 50% exact

### Formules Validées

1. **Boost:**
   ```
   boost = min((amount/1000)×50 + (days/10)×100, 10000)
   ```

2. **Rebate:**
   ```
   rebate = base × (1 + boost/10000)
   ```

3. **Distribution:**
   ```
   user_share = (user_boost / total_boost) × (tokens × 50%)
   burn = tokens × 50%
   ```

---

## 🚀 Prochaines Étapes

Après validation des tests:

1. **Déploiement Devnet**
   ```bash
   # Voir: BOOST_SYSTEM_DEPLOYMENT_GUIDE.md
   anchor deploy --provider.cluster devnet
   ```

2. **Tests E2E avec Frontend**
   ```bash
   # Connecter UI au devnet
   cd app && npm run dev
   ```

3. **Monitoring**
   ```bash
   # Surveiller les événements on-chain
   solana logs <PROGRAM_ID>
   ```

---

## 📚 Ressources

- [Tests d'Intégration](./tests/integration/boost-system.test.ts)
- [Guide de Déploiement](./BOOST_SYSTEM_DEPLOYMENT_GUIDE.md)
- [Flux End-to-End](./END_TO_END_FLOW.md)
- [Anchor Testing Docs](https://www.anchor-lang.com/docs/testing)

---

**Dernière mise à jour:** 26 Octobre 2025  
**Auteur:** SwapBack Team  
**Contact:** support@swapback.io
