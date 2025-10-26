# 🔄 Rebuild Status - 26 Octobre 2025

## Objectif
Rebuild Anchor complet pour générer le fichier IDL manquant `swapback_router.json`

## Actions Effectuées

### 1. Nettoyage ✅
```bash
anchor clean
cargo clean
```
- ✅ Artefacts de build supprimés

### 2. Corrections Code Router ✅
**Fichier**: `programs/swapback_router/src/lib.rs`

**Problème**: Imports Token/TokenAccount incorrects causant erreur compilation IDL
```rust
// AVANT (incorrect)
use anchor_spl::token;
pub user_token_account_a: Account<'info, token::TokenAccount>,
pub token_program: Program<'info, token::Token>,

// APRÈS (corrigé)
use anchor_spl::token::{self, Token, TokenAccount};
pub user_token_account_a: Account<'info, TokenAccount>,
pub token_program: Program<'info, Token>,
```

**Changements**:
- Ligne 2: Import explicite de `Token` et `TokenAccount`
- Lignes 122, 125, 128, 131, 150: `token::TokenAccount` → `TokenAccount`
- Ligne 160: `token::Token` → `Token`

**Résultat**: ✅ Compilation Rust réussie
```bash
cargo build-sbf --manifest-path programs/swapback_router/Cargo.toml
# ✅ Finished `release` profile [optimized] target(s) in 3.99s
```

### 3. Tentatives Génération IDL ❌

#### Tentative A: `anchor idl build -p swapback_router`
**Résultat**: ❌ BLOQUÉ
```
error: custom attribute panicked
  --> programs/swapback_router/src/lib.rs:40:1
   |
40 | #[program]
   | ^^^^^^^^^^
   |
   = help: message: Safety checks failed: Failed to get program path
```
**Cause**: Macro `#[program]` incompatible avec feature `idl-build` dans l'environnement actuel

#### Tentative B: `anchor build --skip-lint`
**Résultat**: ❌ BLOQUÉ
```
Error: Function _ZN14spl_token_20229extension21confidential_transfer...
Stack offset of 4264 exceeded max offset of 4096 by 168 bytes
```
**Cause**: Dépendance `spl-token-2022` a des problèmes de stack overflow lors de la compilation BPF

#### Tentative C: `cargo build-sbf --features idl-build`
**Résultat**: ❌ BLOQUÉ
- Même erreur macro `#[program]` que tentative A

#### Tentative D: Build avec variable d'environnement
```bash
ANCHOR_IDL=1 anchor build
```
**Résultat**: ❌ BLOQUÉ
- Même erreur spl-token stack overflow

### 4. IDL Existants Copiés ✅
```bash
cp target/idl/*.json app/public/idl/
```
✅ **Fichiers disponibles**:
- `app/public/idl/swapback_buyback.json` (19 KB)
- `app/public/idl/swapback_cnft.json` (12 KB)

❌ **Manquant**:
- `app/public/idl/swapback_router.json` - **TOUJOURS ABSENT**

---

## 🚧 Diagnostic du Blocage

### Problème Principal
Le programme **swapback_router** compile correctement en BPF mais **ne génère pas son IDL** à cause de :
1. **Incompatibilité toolchain**: Anchor 0.30.1 (Anchor.toml) vs 0.32.1 (installé)
2. **Bug macro `#[program]`**: Échec sécurité lors extraction métadonnées IDL
3. **Dépendances conflictuelles**: spl-token-2022 cause erreurs lors build complet

### Impact
- ⚠️ **Frontend ne peut pas importer le Router IDL**
- ⚠️ **Scripts d'initialisation TypeScript bloqués** (`init-router-state.ts` a des erreurs de type car pas d'IDL)
- ⚠️ **Tests E2E impossibles** sans interface TypeScript générée

---

## 🔧 Solutions Proposées

### Option 1: Extraction Manuelle IDL (RECOMMANDÉ - Court Terme)
**Durée**: 1-2 heures  
**Approche**: Créer manuellement le fichier JSON IDL à partir du code source

**Avantages**:
- ✅ Rapide
- ✅ Aucune modification code requis
- ✅ Déblocage immédiat scripts TypeScript

**Inconvénients**:
- ⚠️ IDL peut ne pas être 100% conforme au standard Anchor
- ⚠️ Maintenance manuelle si modifications du programme

**Actions**:
1. Analyser structure du code `programs/swapback_router/src/lib.rs`
2. Extraire toutes les instructions (functions dans #[program])
3. Extraire tous les comptes (structs avec #[derive(Accounts)])
4. Extraire tous les types (structs, enums)
5. Générer JSON conforme format Anchor IDL v0.1.0
6. Valider avec `anchor idl type`

### Option 2: Downgrade Anchor Toolchain
**Durée**: 2-3 heures  
**Approche**: Forcer installation Anchor 0.30.1 pour compatibilité

```bash
avm install 0.30.1 --force
avm use 0.30.1
anchor build
```

**Avantages**:
- ✅ IDL généré automatiquement
- ✅ Conforme standard Anchor

**Inconvénients**:
- ⚠️ Peut introduire autres incompatibilités
- ⚠️ Ne résout pas problème spl-token stack overflow

### Option 3: Upgrade Complet Anchor (Long Terme)
**Durée**: 1-2 jours  
**Approche**: Mettre à jour projet vers Anchor 0.32.1 complètement

**Actions**:
1. Mettre à jour `Anchor.toml`: `anchor_version = "0.32.1"`
2. Mettre à jour dépendances Cargo.toml (anchor-lang, anchor-spl)
3. Résoudre breaking changes API
4. Retirer dépendance spl-token-2022 problématique
5. Rebuild complet
6. Re-déployer programmes avec nouveaux Program IDs
7. Mettre à jour declare_id! dans code source

**Avantages**:
- ✅ Solution pérenne
- ✅ Résout tous problèmes de compatibilité
- ✅ IDL généré automatiquement

**Inconvénients**:
- ❌ Requiert re-déploiement (coût: ~5 SOL)
- ❌ Nouveaux Program IDs → mise à jour frontend
- ❌ Temps de développement important

### Option 4: Build Isolé Router Sans SPL-Token
**Durée**: 3-4 heures  
**Approche**: Créer workspace Cargo séparé pour router uniquement

**Actions**:
1. Créer `programs/swapback_router_idl/` (copie router sans dépendances SPL problématiques)
2. Remplacer imports SPL par stubs/mocks
3. Build IDL dans ce workspace isolé
4. Copier IDL généré vers target/idl/

**Avantages**:
- ✅ Contourne problème spl-token
- ✅ IDL conforme standard Anchor
- ✅ Pas de modification programme principal

**Inconvénients**:
- ⚠️ Maintenance workspace séparé
- ⚠️ Risque désynchronisation

---

## 📊 Recommandation

### COURT TERME (24-48h) - **Option 1: Extraction Manuelle**
Pour débloquer immédiatement Phase 11 Task 5 (Initialize Program States)

**Plan**:
1. Créer `target/idl/swapback_router.json` manuellement
2. Copier vers `app/public/idl/`
3. Fixer erreurs TypeScript dans `scripts/init-router-state.ts`
4. Continuer Phase 11 (initialisation states, E2E tests)

### MOYEN TERME (1 semaine) - **Option 3: Upgrade Anchor 0.32.1**
Avant déploiement testnet

**Plan**:
1. Créer branche `upgrade/anchor-0.32`
2. Mettre à jour toutes dépendances
3. Résoudre breaking changes
4. Tests complets (25 tests Rust + 239 tests TypeScript)
5. Re-déployer sur devnet avec nouveaux IDs
6. Mettre à jour declare_id! (résout aussi problème Program ID mismatch)
7. Upload IDL via `anchor idl init` (devrait marcher après)

### LONG TERME (Mainnet) - **Audit + Optimisation**
- Audit externe requiert IDL propre et conforme
- Optimisation stack usage (résout warnings spl-token)
- CI/CD pipeline avec génération IDL automatique

---

## 📁 Fichiers Modifiés Durant Rebuild

### Code Source
- ✅ `programs/swapback_router/src/lib.rs`
  - Ligne 2: Import Token/TokenAccount
  - Lignes 122, 125, 128, 131, 150, 160: Remplacements token::

### IDL
- ✅ `app/public/idl/swapback_buyback.json` (copié)
- ✅ `app/public/idl/swapback_cnft.json` (copié)
- ❌ `app/public/idl/swapback_router.json` (MANQUANT)

---

## 🎯 Prochaines Actions Immédiates

### 1. Décision Architecture (15 min)
Choisir entre:
- **A**: Extraction manuelle IDL Router (rapide, technique)
- **B**: Skip IDL Router temporairement, initialiser states manuellement
- **C**: Upgrade Anchor 0.32.1 maintenant (long mais définitif)

### 2. Si Option A (Extraction Manuelle)
- [ ] Analyser `programs/swapback_router/src/lib.rs` lignes 40-988
- [ ] Extraire 7 instructions: `initialize`, `swap_toc`, `add_plan`, `update_plan`, `remove_plan`, `update_vault`, `distribute_fees`
- [ ] Extraire 5+ account structs: `Initialize`, `SwapTOC`, `SwapPlan`, etc.
- [ ] Extraire 10+ types: `SwapArgs`, `Venue`, `VenueWeight`, etc.
- [ ] Générer JSON IDL complet
- [ ] Valider structure

### 3. Si Option B (Skip Temporairement)
- [ ] Modifier `scripts/init-router-state.ts` pour utiliser raw web3.js
- [ ] Créer transaction manuelle sans Anchor Program wrapper
- [ ] Dériver PDA manuellement
- [ ] Appeler instruction initialize via CPI brut

### 4. Si Option C (Upgrade Maintenant)
- [ ] Créer branche `upgrade/anchor-0.32`
- [ ] Mettre à jour Anchor.toml
- [ ] Mettre à jour 3× programs/*/Cargo.toml
- [ ] Tester compilation
- [ ] Résoudre erreurs API
- [ ] Tests complets

---

## 📌 Conclusion

**Status Rebuild**: ⚠️ **PARTIELLEMENT RÉUSSI**
- ✅ Code Router compile (BPF)
- ✅ 2/3 IDL disponibles (Buyback, CNFT)
- ❌ Router IDL toujours manquant

**Bloqueur Principal**: Incompatibilité toolchain Anchor + macro `#[program]` + spl-token stack overflow

**Impact sur Phase 11**: 
- Task 5 (Initialize States) BLOQUÉ à 10%
- Nécessite décision architecture avant de continuer

**Temps estimé déblocage**: 
- Option A: 1-2h
- Option B: 2-3h  
- Option C: 1-2 jours

---

_Document créé le 26 Octobre 2025 22:05 UTC_  
_Dernière tentative rebuild: 26 Oct 2025 22:00 UTC_
