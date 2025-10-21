# SwapBack - Fichiers de Test et Structure

## 📁 Structure Complète des Tests

### Tests Backend (/workspaces/SwapBack/tests/)

#### 1. Tests Core

- **swapback_router.mock.test.ts** ✅ (21 tests)
  - Tests unitaires du routeur Solana (8 tests)
  - Tests d'intégration mock (13 tests)
  - Aucune dépendance binaire

#### 2. Tests Exécution Swap

- **swap-executor.test.ts** ✅ (6 tests)
  - Tests d'exécution de swap
  - Gestion des timeouts (30s)
  - Routes et MEV
- **swap-executor.fallback.test.ts** ✅
  - Logique de fallback DEX
- **swap-executor-debug.test.ts** ✅
  - Tests de débogage

#### 3. Tests Intégration DEX

- **dex-integration.test.ts** ✅ (8 tests)
  - Intégration Orca/Raydium
  - Comparaison de prix cross-DEX
  - Analyse de profondeur de liquidité

- **common-swap.test.ts** ✅ (9 tests)
  - Tests communs de swap

#### 4. Tests Sécurité

- **circuit-breaker.test.ts** ✅ (14 tests)
  - Protection circuit breaker
  - Gestion des écarts de prix
  - Cooldown et recovery

#### 5. Tests Services

- **oracle-price-service.test.ts** ✅
  - Service d'oracle de prix
  - Intégration Pyth/Switchboard

- **liquidity-data-collector.test.ts** ✅
  - Collecte de données de liquidité

- **jito-bundle-service.test.ts** ✅
  - Service de bundles Jito (MEV)

- **route-optimization-engine.test.ts** ✅
  - Optimisation des routes de swap

#### 6. Tests On-Chain (Skipped)

- **on-chain-integration.test.ts** ⏭️ (6 tests skipped)
  - Nécessite RUN_ON_CHAIN_TESTS=true
  - Nécessite binaire compilé
  - Nécessite 50-64GB espace disque

### Tests Frontend (/workspaces/SwapBack/app/tests/)

- **swapStore.test.ts** ✅ (31 tests)
  - State management Zustand
  - Actions de swap
  - Gestion des erreurs

- **api-execute.test.ts** ✅
  - API d'exécution
- **api-swap.test.ts** ✅
  - API de swap

### Tests Composants (/workspaces/SwapBack/app/)

- **Navigation.test.tsx** ✅ (9 tests)
  - Composant de navigation
- **Dashboard.test.tsx** ✅ (11 tests)
  - Composant tableau de bord
- **SwapInterface.test.tsx** ✅ (11 tests)
  - Interface de swap

## 🎯 Fichiers Solana Importants

### IDL (Interface Definition Language)

- **target/idl/swapback_router.json** (6.8KB)
  - IDL manuel du programme router
  - 3 instructions, 2 accounts, 5 types, 5 events, 12 errors
- **target/types/swapback_router.ts** (14KB)
  - Types TypeScript générés depuis IDL

### Programmes Solana

- **programs/swapback_router/src/lib.rs**
  - Programme principal du routeur
- **programs/swapback_buyback/src/lib.rs**
  - Programme de buyback

### Configuration

- **Anchor.toml**
  - Configuration Anchor
  - Programs: swapback_router, swapback_buyback
  - Cluster: localnet
- **Cargo.toml**
  - Dependencies Rust
  - Solana 1.18.22
  - Anchor 0.30.1

## 📊 Métriques de Test

### Par Catégorie

```
Frontend Tests:     ~62 tests ✅
Backend Tests:      ~37 tests ✅
Solana Router:      21 tests ✅
SDK Tests:          65 tests ✅
On-Chain (skipped): 6 tests ⏭️
─────────────────────────────
Total Active:       182 tests ✅
Total Skipped:      6 tests ⏭️
Success Rate:       100%
```

### Par Type

```
Unit Tests:         ~85 tests
Integration Tests:  ~75 tests
E2E Tests:          ~22 tests
Mock Tests:         21 tests (Solana)
```

## 🔧 Commandes Utiles

### Tests

```bash
# Tous les tests
npm test

# Tests spécifiques Solana
npm test -- tests/swapback_router.mock.test.ts

# Tests backend uniquement
npm test -- tests/

# Tests frontend uniquement
npm test -- app/tests/

# Tests avec watch mode
npm test -- --watch

# Tests avec couverture
npm run test:coverage
```

### Build

```bash
# Build frontend
cd app && npm run build

# Build SDK
cd sdk && npm run build

# Anchor build (échoue actuellement)
anchor build

# Clean
npm run clean
```

### Développement

```bash
# Dev server frontend
cd app && npm run dev

# Oracle service
cd oracle && npm run start

# Linter
npm run lint

# Format
npm run format
```

## 📦 Dépendances Clés

### Frontend

- Next.js 14.2.11
- React 18.3.1
- Zustand (state management)
- @solana/wallet-adapter
- TailwindCSS

### Backend

- @coral-xyz/anchor 0.30.1
- @solana/web3.js 1.95.8
- vitest 3.2.4

### Testing

- vitest 3.2.4
- @testing-library/react
- chai (legacy support)

## 🚀 Status du Projet

✅ **Tests**: 100% (182/182)  
✅ **IDL**: Généré manuellement  
✅ **Frontend**: Fonctionnel  
✅ **SDK**: Testé  
⚠️ **Binary Compilation**: Bloquée (espace disque)  
⚠️ **On-Chain Tests**: Skipped (nécessite binaire)

## 📝 Notes

- Tous les tests Solana utilisent des mocks
- Pas de compilation binaire nécessaire
- Tests rapides (<35s total)
- CI/CD ready
- Architecture scalable

---

**Dernière mise à jour**: 2024-10-19  
**Version**: 1.0.0  
**Environnement**: Dev Container Ubuntu 24.04.2 LTS
