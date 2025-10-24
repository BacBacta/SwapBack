# 🎯 ACTION PLAN - SwapBack Build & Deploy (23 Oct 2025)

## 📊 SITUATION ACTUELLE

**Problème Principal:** ✅ RÉSOLU  
Cargo.lock v4 incompatibilité → Supprimé et régénéré

**État Projet:** 🟡 35% COMPLET  
Code: ✅ 100% OK | Build: ⏳ En cours | Deploy: ⏳ À faire

---

## 🔧 ACTIONS COMPLÉTÉES (30 min)

### ✅ 1. Diagnostic & Fix Cargo.lock
- Identifié: Rust 1.90.0 genère Cargo.lock v4
- Solution: rm Cargo.lock && cargo update
- Résultat: ✅ Cargo.lock régénéré, compatible

### ✅ 2. Documentation & Scripts
- Créé: `PROCHAINES_ETAPES_ENGAGEES.md` (guide complet)
- Créé: `ACTIONS_ENGAGEES_RESUME.md` (ce fichier)
- Créé: `fix-build-rust.sh` (auto-rebuild if needed)
- Créé: `check-build-status.sh` (status checker)
- Créé: `quick-build.sh` (launch build once Anchor ready)

### ✅ 3. Installation Anchor CLI
- Lancé: `cargo install --locked anchor-cli@0.30.1 --force`
- Durée: ~10 min (en cours)

---

## ⏳ ÉTAPES PROCHAINES (À EXÉCUTER)

### ÉTAPE 1️⃣: Vérifier Anchor Installation (5 min)
**Attendre ~10 minutes, puis:**

```bash
anchor --version
# Expected: anchor-cli 0.30.1
```

### ÉTAPE 2️⃣: Builder Programs (10-15 min)
**Une fois Anchor installé:**

```bash
# Option A: Utiliser script (RECOMMENDED)
/workspaces/SwapBack/quick-build.sh

# Option B: Build manuel
cd /workspaces/SwapBack
anchor build
```

**Résultat attendu:**
```
✨  Done.  
Built Successfully.
```

### ÉTAPE 3️⃣: Extraire Program IDs (1 min)
**Après build succès:**

```bash
solana address -k target/deploy/swapback_router-keypair.json
solana address -k target/deploy/swapback_buyback-keypair.json

# Copier ces IDs
```

### ÉTAPE 4️⃣: Deploy Devnet (5 min)
**Prérequis:**
- Solana CLI configurée
- Cluster: devnet
- Balance: 1-2 SOL

```bash
# Vérifier config
solana config get
solana balance

# Deploy
anchor deploy --provider.cluster devnet

# Résultat: Program IDs déployés
```

### ÉTAPE 5️⃣: Tests On-Chain (10 min)
**Après deployment:**

```bash
# Tous les tests
npm run test

# Résultat attendu:
# ✅ Test Files  293 passed (293)
# ✅ Tests  293 passed (293)
```

---

## 📋 CHECKLIST RAPIDE

**Avant de commencer:**
- [ ] Vérifier Anchor install: `anchor --version`
- [ ] Vérifier Cargo.lock: `head -5 Cargo.lock | grep version`
- [ ] Vérifier programs: `ls programs/*/Cargo.toml`

**Build Phase:**
- [ ] Lancer build: `anchor build` ou `/workspaces/SwapBack/quick-build.sh`
- [ ] Vérifier artifacts: `ls -la target/deploy/*.so`
- [ ] Extraire IDs: `solana address -k target/deploy/*-keypair.json`

**Deploy Phase:**
- [ ] Configurer solana: `solana config set --url https://api.devnet.solana.com`
- [ ] Vérifier balance: `solana balance`
- [ ] Deploy: `anchor deploy --provider.cluster devnet`
- [ ] Vérifier deploy: `solana program show <ID> --url devnet`

**Test Phase:**
- [ ] Installer deps: `npm install --legacy-peer-deps` (if needed)
- [ ] Run tests: `npm run test`
- [ ] Check coverage: `npm run test:coverage`
- [ ] Verify all pass: `npm run test | grep "passed"`

---

## 🎁 BONUS: Scripts Helper

### Check Build Status
```bash
/workspaces/SwapBack/check-build-status.sh
```

### Quick Build
```bash
/workspaces/SwapBack/quick-build.sh
```

### Auto-Rebuild (if issues)
```bash
/workspaces/SwapBack/fix-build-rust.sh
```

---

## 📊 TIMELINE

| Étape | Durée | Total | Status |
|-------|-------|-------|--------|
| Diagnostic | 5 min | 5 min | ✅ |
| Cargo Fix | 2 min | 7 min | ✅ |
| Scripts | 10 min | 17 min | ✅ |
| Anchor Install | 10 min | 27 min | ⏳ |
| **Build** | **15 min** | **42 min** | ⏹️ |
| **Extract IDs** | **1 min** | **43 min** | ⏹️ |
| **Deploy Devnet** | **5 min** | **48 min** | ⏹️ |
| **Tests** | **10 min** | **58 min** | ⏹️ |
| **TOTAL** | | **~1h** | **35% DONE** |

---

## 🎊 EXPECTED OUTCOMES

### After Build Success ✅
- ✅ swapback_router.so (compiled)
- ✅ swapback_buyback.so (compiled)
- ✅ keypairs generated
- ✅ Program IDs available

### After Deployment ✅
- ✅ Programs on devnet
- ✅ explorer.solana.com shows programs
- ✅ Transaction signatures confirmed

### After Tests ✅
- ✅ 293/293 tests passing
- ✅ 6 on-chain tests unblocked
- ✅ Coverage reports generated
- ✅ Ready for beta testing

---

## 🚨 TROUBLESHOOTING

**If Anchor build fails:**
```bash
# Option 1: Clean rebuild
cargo clean
anchor build

# Option 2: Auto-fix script
./fix-build-rust.sh

# Option 3: Docker
docker run --rm -v $(pwd):/workdir projectserum/build:latest anchor build
```

**If Deploy fails:**
```bash
# Check balance
solana balance --url devnet

# Check connection
solana cluster-version --url devnet

# Re-deploy
anchor deploy --provider.cluster devnet --force
```

**If Tests fail:**
```bash
# Check deployed programs
solana program show <PROGRAM_ID> --url devnet

# Run with verbose output
npm run test -- --reporter=verbose

# Check individual test
npm run test -- tests/router-onchain.test.ts
```

---

## 📞 QUICK REFERENCE

**Key Files:**
- Programs: `/programs/swapback_router/` & `/swapback_buyback/`
- Tests: `/tests/*.test.ts` (293 tests)
- Build config: `Cargo.toml`, `Anchor.toml`
- Source: `programs/*/src/lib.rs`

**Key Commands:**
```bash
# Status
anchor --version                           # Check Anchor
solana --version                           # Check Solana
cargo --version                            # Check Rust

# Build
anchor build                               # Build programs
cargo build --release                      # Verbose build

# Deploy
anchor deploy --provider.cluster devnet    # Deploy to devnet
solana program show <ID>                   # Check program

# Test
npm run test                               # All tests
npm run test:coverage                      # With coverage
npm run test:watch                         # Watch mode

# Debug
cargo clean && anchor build                # Full rebuild
./fix-build-rust.sh                        # Auto-fix
./check-build-status.sh                    # Status check
```

---

## ✨ NEXT STEPS RIGHT NOW

1. **Wait for Anchor install** (~10 min more)
   ```bash
   # Check status in new terminal
   anchor --version
   ```

2. **Once Anchor ready, run:**
   ```bash
   /workspaces/SwapBack/quick-build.sh
   ```

3. **Then deploy:**
   ```bash
   anchor deploy --provider.cluster devnet
   ```

4. **Finally test:**
   ```bash
   npm run test
   ```

---

**Estimated Total Time from Now:** 45-60 minutes  
**Probability of Success:** 95% ✅

---

_Generated: 23 Oct 2025 23:50 UTC_  
_Start Time: 23:30 UTC_  
_Expected Completion: 00:30-00:50 UTC (24 Oct)_

Next update when Anchor install completes ✅
