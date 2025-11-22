# 🚀 Guide de Déploiement Vercel

## ✅ Corrections Effectuées

### Problème Initial
```
Export encountered errors on following paths:
  /swap-enhanced/page: /swap-enhanced
```

### Corrections Appliquées
1. ✅ Suppression de `/swap-enhanced` (double WalletProvider)
2. ✅ Suppression de `/preview/*` (pages demo obsolètes)
3. ✅ Suppression des anciennes pages (page-old.tsx, page-simple.tsx)
4. ✅ Suppression de `/api/router/accounts` (dépendances natives incompatibles)
5. ✅ Build propre sans erreurs d'export ou webpack

## 📋 Variables d'Environnement Vercel

### Configuration > Environment Variables

#### Réseau (Devnet)
```bash
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
```

#### Program IDs (Devnet)
```bash
NEXT_PUBLIC_ROUTER_PROGRAM_ID=9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh
NEXT_PUBLIC_CNFT_PROGRAM_ID=26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru
NEXT_PUBLIC_BUYBACK_PROGRAM_ID=746EPwDbanWC32AmuH6aqSzgWmLvAYfUYz7ER1LNAvc6
```

#### Tokens (Devnet)
```bash
NEXT_PUBLIC_BACK_MINT=862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux
NEXT_PUBLIC_USDC_MINT=BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR
```

#### Infrastructure
```bash
NEXT_PUBLIC_COLLECTION_CONFIG=5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom
NEXT_PUBLIC_MERKLE_TREE=93Tzc7btocwzDSbscW9EfL9dBzWLx85FHE6zeWrwHbNT
```

#### Build
```bash
HUSKY=0
```

#### Analytics (Optionnel)
```bash
NEXT_PUBLIC_ANALYTICS_ENABLED=false
NEXT_PUBLIC_MIXPANEL_TOKEN=your_token_here
NEXT_PUBLIC_APP_VERSION=0.1.0
```

## 🎯 Routes Disponibles

- `/` → Redirige vers `/dashboard`
- `/dashboard` → Dashboard principal (nécessite wallet)
- `/swap` → Interface de swap
- `/dca` → Dollar Cost Averaging
- `/buyback` → Buyback BACK tokens

## ✨ Fonctionnalités

### Navbar (Nouveau)
- Logo SwapBack cliquable
- Navigation Dashboard/Swap/DCA/Buyback
- Bouton Wallet visible en permanence
- Responsive mobile + desktop

### Dashboard
- Affiche bouton "Select Wallet" si non connecté
- Stats en temps réel après connexion
- Graphiques de volume et activité
- Historique des transactions

### Architecture
- Next.js 14 avec App Router
- Solana Wallet Adapter (Phantom, Solflare, etc.)
- Anchor programs (Router, CNFT, Buyback)
- Real-time RPC via Helius/QuickNode

## 🔒 Sécurité

Tous les programs déployés sur devnet:
- Router: `9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh` (slot 423369008)
- Oracle fallback: Switchboard → Pyth
- TWAP execution: 3-12 slices automatiques
- Fallback routes: Top 3 alternatives

## 📦 Derniers Commits

- `1be3379` - fix: remove unused preview/legacy pages
- `7b39e8a` - fix: add Navbar + wallet connection
- `261cd85` - fix: remove AMM mock fallback (100% real)
- `5118b23` - feat: TWAP + fallback plans implementation
- `cff3707` - feat: oracle fallback Switchboard→Pyth

## 🚨 Important

⚠️ **CNFT_PROGRAM_ID** doit correspondre à l'adresse dans `swapback_cnft.json` IDL
⚠️ Pour **production (mainnet)**, redéployer tous les programs et mettre à jour les IDs
⚠️ Utiliser un **RPC premium** (Helius/QuickNode/Alchemy) en production
