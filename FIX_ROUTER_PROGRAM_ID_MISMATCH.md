# Fix: Router Program ID Mismatch (Critical)

## 🔴 Problème Identifié

**Incohérence critique** entre les Program IDs du Router dans différents fichiers :

| Fichier | Program ID | Status |
|---------|-----------|--------|
| **IDL** (`app/src/idl/swapback_router.json`) | `BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz` | ✅ Correct (déployé) |
| **.env.local** | `BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz` | ✅ Correct |
| **Anchor.toml devnet** (AVANT) | `opPhGcth2dGQQ7njYmkAYwfxspJ1DjgP9LV2y1jygCx` | ❌ Incorrect (pas déployé) |
| **lib.rs declare_id!** (AVANT) | `opPhGcth2dGQQ7njYmkAYwfxspJ1DjgP9LV2y1jygCx` | ❌ Incorrect |
| **Fallbacks dans app/** (AVANT) | `opPhGcth2dGQQ7njYmkAYwfxspJ1DjgP9LV2y1jygCx` | ❌ Incorrect |

### Vérification On-Chain

```bash
# ✅ Bon Program ID (déployé sur devnet)
$ solana program show BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz --url devnet
Program Id: BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz
Owner: BPFLoaderUpgradeab1e11111111111111111111111
Data Length: 389392 (0x5f110) bytes
Balance: 2.7113724 SOL

# ❌ Mauvais Program ID (n'existe pas)
$ solana program show opPhGcth2dGQQ7njYmkAYwfxspJ1DjgP9LV2y1jygCx --url devnet
Error: Unable to find the account
```

## ✅ Corrections Appliquées

### 1. **Anchor.toml**
```toml
[programs.devnet]
swapback_cnft = "26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru"
-swapback_router = "opPhGcth2dGQQ7njYmkAYwfxspJ1DjgP9LV2y1jygCx"
+swapback_router = "BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz"
swapback_buyback = "EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf"
```

### 2. **programs/swapback_router/src/lib.rs**

**declare_id!**
```rust
-// Program ID - Keypair local pour deployment
-declare_id!("opPhGcth2dGQQ7njYmkAYwfxspJ1DjgP9LV2y1jygCx");
+// Program ID - Deployed on devnet (Nov 12, 2025)
+declare_id!("BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz");
```

**CNFT_PROGRAM_ID constant**
```rust
-pub const CNFT_PROGRAM_ID: Pubkey = pubkey!("FsD6D5yakUipRtFXXbgBf5YaE1ABVEocFDTLB3z2MxnB");
+// cNFT Program ID for boost verification (deployed Nov 12, 2025)
+pub const CNFT_PROGRAM_ID: Pubkey = pubkey!("26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru");
```

### 3. **Fallbacks Frontend (app/src/)**

Mis à jour dans tous les fichiers suivants :
- ✅ `app/src/config/constants.ts` → `getRouterProgramId()`
- ✅ `app/src/config/tokens.ts` → `PROGRAM_IDS_DEVNET.router`
- ✅ `app/src/config/testnet.ts` → `TESTNET_PROGRAM_IDS.ROUTER`
- ✅ `app/src/constants/programIds.ts` → `getRouterProgramId()`
- ✅ `app/src/idl/router_idl.ts` → `getRouterProgramId()`
- ✅ `app/src/components/SwapBackDashboard.tsx` → `getRouterProgramId()`
- ✅ `app/src/components/SwapBackInterface.tsx` → `getRouterProgramId()`

**Avant** :
```typescript
process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID || "opPhGcth2dGQQ7njYmkAYwfxspJ1DjgP9LV2y1jygCx"
```

**Après** :
```typescript
process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID || "BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz"
```

## 📊 Résumé des Program IDs Corrects (Devnet)

| Programme | Program ID | Status |
|-----------|-----------|--------|
| **Router** | `BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz` | ✅ Déployé (389KB) |
| **CNFT** | `26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru` | ✅ Déployé (417KB) |
| **Buyback** | `EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf` | ✅ Déployé |

## 🎯 Impact du Fix

### Avant (Erreur)
- `validateEnv.ts` compare `NEXT_PUBLIC_ROUTER_PROGRAM_ID` avec IDL
- IDL: `BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz`
- Variable Vercel (si fallback utilisé): `opPhGcth2dGQQ7njYmkAYwfxspJ1DjgP9LV2y1jygCx`
- **MISMATCH** → Erreur "ROUTER_PROGRAM_ID mismatch!" → Application crash

### Après (Fix)
- Tous les fichiers utilisent le bon Program ID
- IDL ↔ .env.local ↔ Fallbacks ↔ Rust lib.rs : **COHÉRENTS**
- ✅ Validation passe
- ✅ Dashboard charge correctement

## 🚀 Déploiement

### 1. Commit & Push
```bash
git add \
  Anchor.toml \
  programs/swapback_router/src/lib.rs \
  app/src/config/constants.ts \
  app/src/config/tokens.ts \
  app/src/config/testnet.ts \
  app/src/constants/programIds.ts \
  app/src/idl/router_idl.ts \
  app/src/components/SwapBackDashboard.tsx \
  app/src/components/SwapBackInterface.tsx \
  FIX_ROUTER_PROGRAM_ID_MISMATCH.md

git commit -m "fix: Correct Router Program ID mismatch (BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz)

- Update Anchor.toml devnet router to deployed Program ID
- Update lib.rs declare_id! to match deployed program
- Update all fallback values in frontend code
- Fix CNFT_PROGRAM_ID constant in router lib.rs
- Ensures IDL, environment variables, and code are consistent"

git push origin main
```

### 2. Redéployer Vercel
1. **Vercel Dashboard** → Projet SwapBack
2. **Deployments** → Dernier déploiement
3. **"..." → "Redeploy"**
4. **Décocher** "Use existing Build Cache" (rebuild complet)
5. **Deploy** (2-3 minutes)

### 3. Vérification
- ✅ Build réussit sans erreur "ROUTER_PROGRAM_ID mismatch"
- ✅ Dashboard `/dashboard` charge sans "Application error"
- ✅ Console navigateur sans erreurs de validation
- ✅ DCA plans fonctionnent (utilisent router program)

## 🔍 Pourquoi Ce Bug ?

### Historique
1. **Initial**: Router déployé avec keypair → Program ID `BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz`
2. **lib.rs**: Contient ancien ID `opPhGcth2dGQQ7njYmkAYwfxspJ1DjgP9LV2y1jygCx` (jamais déployé)
3. **Anchor.toml**: Référence ancien ID dans [programs.devnet]
4. **IDL**: Généré avec le bon ID (depuis keypair déployé)
5. **Fallbacks**: Copiés depuis code avec ancien ID

### Conséquence
- Validation stricte `validateEnv.ts` détecte le mismatch
- Application refuse de démarrer pour éviter les erreurs on-chain
- Erreur "Application error: a client-side exception has occurred"

## ✅ Checklist de Validation

Après redéploiement Vercel :

- [ ] Hard refresh navigateur (`Ctrl+Shift+R`)
- [ ] Dashboard charge sans erreur
- [ ] Console (F12) sans erreurs de validation
- [ ] Onglet "DCA" affiche les plans
- [ ] Création de DCA plan fonctionne
- [ ] Stats globales s'affichent correctement

---

**Date**: 12 Novembre 2025  
**Fix**: Router Program ID consistency  
**Status**: ✅ Prêt pour redéploiement
