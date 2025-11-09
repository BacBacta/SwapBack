# 📚 RUNBOOK: Configuration et Déploiement SwapBack Devnet

## 🎯 Objectif

Ce guide explique comment configurer correctement SwapBack pour éviter l'erreur `AccountOwnedByWrongProgram` et déployer sur Vercel.

---

## ⚠️ Prérequis Critiques

### 1. Program ID et IDL doivent correspondre

```bash
# Vérifier que NEXT_PUBLIC_CNFT_PROGRAM_ID correspond à l'IDL
cat app/src/idl/swapback_cnft.json | grep "address"
# Doit afficher: "address": "9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq"

# Vérifier votre .env.local
grep CNFT_PROGRAM_ID app/.env.local
# Doit afficher: NEXT_PUBLIC_CNFT_PROGRAM_ID=9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq
```

**Si les valeurs diffèrent** → `AccountOwnedByWrongProgram` garanti ! Les PDAs seront dérivés avec le mauvais Program ID.

### 2. Comptes initialisés sur devnet

Les comptes `collection_config` et `global_state` **doivent être initialisés** avant tout lock de tokens.

```bash
# Vérifier l'état des comptes
npm run check:init

# Si NON initialisés, exécuter:
node scripts/init-collection-config.js
```

---

## 🔧 Configuration Locale (app/.env.local)

### Variables Obligatoires

```bash
# Réseau
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com

# Programme CNFT (DOIT correspondre à l'IDL)
NEXT_PUBLIC_CNFT_PROGRAM_ID=9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq

# Token $BACK (Token-2022 devnet)
NEXT_PUBLIC_BACK_MINT=862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux

# PDA collection_config (dérivé du CNFT_PROGRAM_ID)
NEXT_PUBLIC_COLLECTION_CONFIG=5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom
```

### Vérification Automatique

```bash
# Afficher les PDAs calculés
npm run pdas:print

# Doit afficher:
# NEXT_PUBLIC_COLLECTION_CONFIG=5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom
```

---

## 🚀 Déploiement Vercel

### 1. Ajouter les Variables d'Environnement

Aller sur: **Vercel Dashboard** → **Settings** → **Environment Variables**

**Ajouter les 4 variables suivantes** (cocher les 3 environnements: Production, Preview, Development):

| Variable | Valeur |
|----------|--------|
| `NEXT_PUBLIC_SOLANA_NETWORK` | `devnet` |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | `https://api.devnet.solana.com` |
| `NEXT_PUBLIC_CNFT_PROGRAM_ID` | `9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq` |
| `NEXT_PUBLIC_BACK_MINT` | `862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux` |
| `NEXT_PUBLIC_COLLECTION_CONFIG` | `5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom` |

### 2. Déclencher un Redéploiement

```bash
# Option A: Commit vide pour forcer redéploiement
git commit --allow-empty -m "trigger: redeploy with env vars"
git push origin main

# Option B: Redéploiement manuel sur Vercel
# Deployments → ... → Redeploy
```

### 3. Vérifier le Déploiement

1. Attendre 2-3 minutes que le déploiement se termine (✓ Ready)
2. Ouvrir l'URL Vercel dans un **nouvel onglet incognito** (éviter le cache)
3. Connecter le wallet (configuré sur **devnet**)
4. Vérifier que l'indicateur réseau affiche "devnet" 🟢
5. Aller dans Lock/Unlock → solde doit s'afficher correctement
6. Tester un lock de quelques tokens

### 4. Si l'Erreur Persiste

```bash
# Sur Vercel Dashboard, vérifier:
1. Settings → Environment Variables
2. NEXT_PUBLIC_COLLECTION_CONFIG existe ?
3. Valeur = 5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom ?
4. Les 3 environnements sont cochés ?

# Si non, ajouter/corriger puis:
Deployments → Redeploy (avec "Use existing Build Cache" DÉCOCHÉ)
```

---

## 🐛 Troubleshooting

### Erreur: "AccountOwnedByWrongProgram"

**Cause**: `NEXT_PUBLIC_CNFT_PROGRAM_ID` ne correspond pas à l'IDL ou est absent.

**Solution**:
```bash
# 1. Vérifier l'IDL
cat app/src/idl/swapback_cnft.json | grep "address"

# 2. Mettre à jour .env.local
echo 'NEXT_PUBLIC_CNFT_PROGRAM_ID=9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq' >> app/.env.local

# 3. Redémarrer le serveur local
pkill -f "next dev"
npm run dev

# 4. Pour Vercel: ajouter la variable + redéployer
```

### Erreur: "collection_config NON initialisé"

**Cause**: Les comptes PDA ne sont pas créés on-chain.

**Solution**:
```bash
# Vérifier l'état
npm run check:init

# Si non initialisé, initialiser:
node scripts/init-collection-config.js

# Attendre confirmation puis relancer check:init
```

### Erreur: "Wallet not connected" ou "Network mismatch"

**Cause**: Wallet configuré sur mainnet au lieu de devnet.

**Solution**:
1. Ouvrir Phantom/Solflare
2. Settings → Developer Settings
3. Change Network → Devnet
4. Rafraîchir l'application

### Balance affiche 0 malgré des tokens

**Cause**: Token-2022 nécessite une lecture manuelle à l'offset 64.

**Solution**: Le code dans `LockInterface.tsx` est déjà corrigé. Vérifier:
```bash
# Confirmer le solde on-chain
solana balance --url devnet
spl-token balance 862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux \
  --owner VOTRE_WALLET_ADDRESS \
  --url devnet
```

---

## ✅ Checklist de Déploiement

Avant de déployer en production:

- [ ] `npm run check:init` → tous les comptes initialisés ✅
- [ ] `npm run pdas:print` → PDA correspond à `.env.local` ✅
- [ ] `npm run test` → tous les tests passent ✅
- [ ] `npm run build` → build réussit sans erreurs ✅
- [ ] Test local avec wallet devnet → lock/unlock fonctionnel ✅
- [ ] Variables Vercel configurées (4/4) ✅
- [ ] Test sur Vercel preview → pas d'erreur ✅
- [ ] Hard refresh (Ctrl+Shift+R) pour éviter le cache ✅

---

## 📖 Références

- **Documentation Vercel**: `app/VERCEL_ENV_VARIABLES.md`
- **Scripts de vérification**:
  - `npm run check:init` - Vérifier comptes initialisés
  - `npm run pdas:print` - Afficher PDAs calculés
- **Logs de débogage**: Console browser (F12) → rechercher `[LOCK TX]`

---

## 🔐 Sécurité

⚠️  **Ne JAMAIS committer `.env.local`** (déjà dans `.gitignore`)

Les templates `.env.*.template` servent de **référence** uniquement. Copier et adapter pour chaque environnement.

---

*Dernière mise à jour: Configuration devnet avec CNFT Program 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq*
