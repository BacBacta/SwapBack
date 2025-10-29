# 🚀 Guide de Déploiement Vercel - SwapBack

**Date**: 29 Octobre 2025  
**Plateforme**: Vercel  
**Framework**: Next.js 14

---

## ✅ Oui, l'API Jupiter est Configurable comme Variable d'Environnement

### 📋 Réponse Rapide

**Oui !** L'API Jupiter (`JUPITER_API_URL`) est maintenant une variable d'environnement configurable sur Vercel.

**Fichier modifié**: `/app/src/app/api/swap/quote/route.ts`

```typescript
// Avant (hardcodé)
const JUPITER_API = "https://quote-api.jup.ag/v6";

// Après (variable d'environnement)
const JUPITER_API = process.env.JUPITER_API_URL || "https://quote-api.jup.ag/v6";
```

---

## 🎯 Configuration Vercel - 3 Méthodes

### Méthode 1: Dashboard Vercel (Recommandée)

1. **Aller sur** https://vercel.com/dashboard
2. **Sélectionner** votre projet SwapBack
3. **Cliquer** Settings → Environment Variables
4. **Ajouter** les variables:

| Variable | Value (Preview/Testnet) | Value (Production/Mainnet) |
|----------|-------------------------|----------------------------|
| `JUPITER_API_URL` | `https://quote-api.jup.ag/v6` | `https://quote-api.jup.ag/v6` |
| `USE_MOCK_QUOTES` | `false` | `false` |
| `NEXT_PUBLIC_SOLANA_NETWORK` | `testnet` | `mainnet-beta` |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | `https://api.testnet.solana.com` | `https://mainnet.helius-rpc.com/?api-key=XXX` |

5. **Sauvegarder** et **Redéployer**

### Méthode 2: Vercel CLI

```bash
# Installer CLI
npm install -g vercel

# Login
vercel login

# Ajouter variables
vercel env add JUPITER_API_URL
# → Entrer: https://quote-api.jup.ag/v6
# → Sélectionner: Production, Preview, Development

vercel env add USE_MOCK_QUOTES
# → Entrer: false
```

### Méthode 3: Script Automatisé

Utiliser le script fourni :

```bash
# Preview (Testnet)
cd /workspaces/SwapBack/app
./deploy-vercel.sh

# Production (Mainnet)
./deploy-vercel.sh prod
```

---

## 📁 Fichiers de Configuration Créés

### 1. `vercel.json` ✅
Configuration principale avec toutes les variables par défaut (testnet).

### 2. `VERCEL_ENV_VARIABLES.md` ✅
Documentation complète de toutes les variables disponibles.

### 3. `.env.production.template` ✅
Template pour l'environnement production (mainnet).

### 4. `.env.preview.template` ✅
Template pour l'environnement preview (testnet).

### 5. `deploy-vercel.sh` ✅
Script automatisé de déploiement avec checks et tests.

---

## 🔧 Variables Critiques

### API Configuration

```bash
# URL de l'API Jupiter V6
JUPITER_API_URL=https://quote-api.jup.ag/v6

# Mode MOCK (false en production)
USE_MOCK_QUOTES=false
```

### Réseau Solana

**Testnet (Preview)**:
```bash
NEXT_PUBLIC_SOLANA_NETWORK=testnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.testnet.solana.com
```

**Mainnet (Production)**:
```bash
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
```

---

## 🚀 Déploiement Étape par Étape

### Étape 1: Prérequis

```bash
# Vérifier le build local
cd /workspaces/SwapBack/app
npm run build

# Vérifier les types
npm run type-check
```

### Étape 2: Déploiement Preview (Testnet)

```bash
# Option A: CLI manuelle
vercel

# Option B: Script automatisé
./deploy-vercel.sh
```

### Étape 3: Tests sur Preview

1. **Ouvrir** l'URL de preview (ex: `https://swapback-xyz.vercel.app`)
2. **Tester** l'API:
   ```bash
   curl https://swapback-xyz.vercel.app/api/health
   ```
3. **Connecter** wallet Phantom/Solflare
4. **Tester** un swap SOL → USDC
5. **Vérifier** les logs dans Vercel Dashboard

### Étape 4: Déploiement Production (Mainnet)

⚠️ **Checklist avant production**:
- [ ] Program IDs mainnet déployés
- [ ] Token BACK mint créé sur mainnet
- [ ] RPC premium configuré (Helius/QuickNode)
- [ ] Tests complets sur preview passés
- [ ] Domaine custom configuré (optionnel)
- [ ] Monitoring configuré (Sentry, etc.)

```bash
# Déployer en production
./deploy-vercel.sh prod

# OU via CLI
vercel --prod
```

---

## 🔍 Vérification Post-Déploiement

### Test de Santé

```bash
# Health check
curl https://your-app.vercel.app/api/health

# Résultat attendu:
{
  "environment": "production",
  "network": "mainnet-beta",
  "jupiterApi": "https://quote-api.jup.ag/v6",
  "useMock": "false"
}
```

### Test Quote API

```bash
curl -X POST https://your-app.vercel.app/api/swap/quote \
  -H "Content-Type: application/json" \
  -d '{
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amount": 1000000000,
    "slippageBps": 50
  }'

# Résultat attendu:
{
  "success": true,
  "quote": {
    "inAmount": "1000000000",
    "outAmount": "...",
    ...
  }
}
```

---

## 🛠️ Troubleshooting

### Problème: API Jupiter ne répond pas

**Symptôme**: Erreur "Could not resolve host: quote-api.jup.ag"

**Solution**:
1. Vérifier que `JUPITER_API_URL` est bien défini
2. Vérifier que `USE_MOCK_QUOTES=false`
3. Tester depuis Vercel (pas Codespaces):
   ```bash
   curl https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000000
   ```

### Problème: Build échoue sur Vercel

**Symptôme**: "Build failed" dans Vercel logs

**Solutions**:
1. Vérifier les erreurs TypeScript:
   ```bash
   npm run type-check
   ```

2. Vérifier le build local:
   ```bash
   npm run build
   ```

3. Vérifier les logs Vercel:
   - Dashboard → Deployments → [Votre déploiement] → Build Logs

### Problème: Variables d'environnement non chargées

**Symptôme**: L'app utilise les valeurs par défaut au lieu des variables Vercel

**Solution**:
1. Variables publiques (`NEXT_PUBLIC_*`) sont injectées au **build time**
2. Variables privées sont disponibles au **runtime** (API routes seulement)
3. **Redéployer** après modification des variables:
   ```bash
   vercel --prod --force
   ```

---

## 📊 Monitoring et Logs

### Accéder aux Logs

1. **Dashboard Vercel** → Projet → Deployments → [Deployment] → Logs
2. **Real-time logs** (CLI):
   ```bash
   vercel logs YOUR_DEPLOYMENT_URL
   ```

### Métriques Importantes

- **Requêtes API**: Dashboard → Analytics → API Routes
- **Erreurs**: Dashboard → Analytics → Errors
- **Performance**: Dashboard → Speed Insights
- **RPC Usage**: Vérifier votre provider (Helius/QuickNode/Alchemy)

---

## 🎯 Best Practices

### 1. Séparer les Environnements

- **Development**: Codespaces (MOCK)
- **Preview**: Vercel Preview (Testnet, Jupiter réel)
- **Production**: Vercel Production (Mainnet, Jupiter réel)

### 2. RPC Premium pour Production

⚠️ **NE PAS utiliser** `https://api.mainnet-beta.solana.com` en production (rate limits)

✅ **Utiliser** un provider premium:
- Helius (gratuit jusqu'à 100k req/jour)
- QuickNode (payant, très fiable)
- Alchemy (gratuit jusqu'à 300M compute units)

### 3. Secrets Management

❌ **NE JAMAIS** commit les fichiers:
- `.env.local`
- `.env.production`
- Fichiers contenant des API keys

✅ **Toujours** utiliser Vercel Environment Variables

### 4. Cache Strategy

Ajouter dans `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/api/swap/quote",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "s-maxage=10, stale-while-revalidate"
        }
      ]
    }
  ]
}
```

---

## 🔗 Liens Utiles

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Documentation Vercel**: https://vercel.com/docs
- **Jupiter API Docs**: https://station.jup.ag/docs/apis/swap-api
- **Helius RPC**: https://helius.dev
- **QuickNode**: https://quicknode.com
- **Alchemy**: https://alchemy.com

---

## 📋 Checklist Finale

### Avant le Premier Déploiement

- [ ] Variables d'environnement configurées dans Vercel
- [ ] `JUPITER_API_URL` défini
- [ ] `USE_MOCK_QUOTES=false` pour preview/production
- [ ] Build réussit en local (`npm run build`)
- [ ] Types TypeScript OK (`npm run type-check`)
- [ ] Git push sur main (déclenche auto-deploy)

### Après le Déploiement

- [ ] URL de déploiement accessible
- [ ] Health check passe (`/api/health`)
- [ ] Quote API fonctionne (`/api/swap/quote`)
- [ ] Wallet se connecte correctement
- [ ] Swap test réussi (petite quantité)
- [ ] Logs sans erreurs critiques

### Pour la Production

- [ ] Domaine custom configuré
- [ ] SSL/HTTPS actif
- [ ] RPC premium configuré
- [ ] Monitoring actif (Sentry/LogRocket)
- [ ] Analytics configurées
- [ ] Rate limiting en place
- [ ] Backup/rollback plan

---

**Résumé**: ✅ L'API Jupiter est maintenant une variable d'environnement configurable sur Vercel. Utilisez les templates et scripts fournis pour déployer facilement !
