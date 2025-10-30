# 🚀 Guide de Déploiement Vercel - SwapBack

Guide complet pour déployer SwapBack sur Vercel et tester avec données réelles Jupiter.

---

## 📋 Pré-requis

- [x] Code committé sur GitHub (✅ fait)
- [x] Repository accessible: https://github.com/BacBacta/SwapBack
- [x] Compte Vercel (créer sur https://vercel.com si nécessaire)

---

## 🎯 Option 1: Déploiement via CLI (Recommandé)

### Étape 1: Installer Vercel CLI

```bash
cd /workspaces/SwapBack/app
npm install -g vercel
```

### Étape 2: Login Vercel

```bash
vercel login
```

Suivre les instructions (email ou GitHub).

### Étape 3: Déployer en Preview

```bash
vercel deploy
```

**Répondre aux questions**:
- `Set up and deploy?` → **Y**
- `Which scope?` → Sélectionner votre compte
- `Link to existing project?` → **N** (première fois)
- `What's your project's name?` → **swapback** (ou autre)
- `In which directory is your code located?` → **./** (default)

**Résultat attendu**:
```
✅ Production: https://swapback-abc123.vercel.app
```

### Étape 4: Configurer les Variables d'Environnement

**Via CLI**:
```bash
# Jupiter API
vercel env add JUPITER_API_URL
# Entrer: https://quote-api.jup.ag/v6

# Mock Quotes (false pour production)
vercel env add USE_MOCK_QUOTES
# Entrer: false

# Network
vercel env add NEXT_PUBLIC_SOLANA_NETWORK
# Entrer: testnet

# RPC
vercel env add NEXT_PUBLIC_SOLANA_RPC_URL
# Entrer: https://api.testnet.solana.com

# Program IDs
vercel env add NEXT_PUBLIC_ROUTER_PROGRAM_ID
# Entrer: GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt

vercel env add NEXT_PUBLIC_BUYBACK_PROGRAM_ID
# Entrer: EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf

vercel env add NEXT_PUBLIC_CNFT_PROGRAM_ID
# Entrer: 9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw

# Tokens
vercel env add NEXT_PUBLIC_BACK_MINT
# Entrer: 862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux

vercel env add NEXT_PUBLIC_USDC_MINT
# Entrer: BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR

# Fees
vercel env add NEXT_PUBLIC_PLATFORM_FEE_PERCENT
# Entrer: 0.20
```

### Étape 5: Redéployer avec Variables

```bash
vercel deploy --prod
```

### Étape 6: Tester l'API

```bash
# Remplacer YOUR-URL par l'URL Vercel
curl -X POST https://YOUR-URL.vercel.app/api/swap/quote \
  -H "Content-Type: application/json" \
  -d '{
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amount": 1000000000,
    "slippageBps": 50
  }'
```

**Résultat attendu**:
```json
{
  "success": true,
  "quote": {
    "inputMint": "So11...",
    "outputMint": "EPj...",
    "inAmount": "1000000000",
    "outAmount": "...",
    "priceImpactPct": 0.01,
    "routePlan": [...]
  }
}
```

⚠️ **PAS** de `"_isMockData": true` (sinon c'est encore du MOCK)

---

## 🎯 Option 2: Déploiement via Dashboard Vercel

### Étape 1: Aller sur Vercel

Ouvrir: https://vercel.com/dashboard

### Étape 2: Import Project

1. Cliquer **"Add New..."** → **"Project"**
2. Sélectionner **"Import Git Repository"**
3. Choisir **GitHub**
4. Autoriser Vercel à accéder à GitHub
5. Sélectionner le repository **BacBacta/SwapBack**

### Étape 3: Configurer le Projet

**Framework Preset**: Next.js  
**Root Directory**: `app`  
**Build Command**: `npm run build`  
**Output Directory**: `.next`

### Étape 4: Variables d'Environnement

Dans "Environment Variables", ajouter:

| Key | Value | Environment |
|-----|-------|-------------|
| `JUPITER_API_URL` | `https://quote-api.jup.ag/v6` | Production |
| `USE_MOCK_QUOTES` | `false` | Production |
| `NEXT_PUBLIC_SOLANA_NETWORK` | `testnet` | Production |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | `https://api.testnet.solana.com` | Production |
| `NEXT_PUBLIC_ROUTER_PROGRAM_ID` | `GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt` | Production |
| `NEXT_PUBLIC_BUYBACK_PROGRAM_ID` | `EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf` | Production |
| `NEXT_PUBLIC_CNFT_PROGRAM_ID` | `9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw` | Production |
| `NEXT_PUBLIC_BACK_MINT` | `862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux` | Production |
| `NEXT_PUBLIC_USDC_MINT` | `BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR` | Production |
| `NEXT_PUBLIC_PLATFORM_FEE_PERCENT` | `0.20` | Production |

### Étape 5: Déployer

Cliquer **"Deploy"**

Attendre ~2-3 minutes pour le build.

### Étape 6: Récupérer l'URL

Une fois déployé, Vercel affiche:
```
🎉 Your project is live!
https://swapback-xyz.vercel.app
```

---

## 🧪 Tests Post-Déploiement

### Test 1: Vérifier que le site charge

Ouvrir l'URL Vercel dans un navigateur:
```
https://YOUR-URL.vercel.app
```

**Attendu**: Interface SwapBack s'affiche

### Test 2: Vérifier les Variables d'Environnement

Ouvrir la console du navigateur et vérifier:
```javascript
console.log(process.env.NEXT_PUBLIC_SOLANA_NETWORK)
// Devrait afficher: testnet
```

### Test 3: Tester l'API Quote

**Via navigateur** (ouvrir la console):
```javascript
fetch('https://YOUR-URL.vercel.app/api/swap/quote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    inputMint: 'So11111111111111111111111111111111111111112',
    outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    amount: 1000000000,
    slippageBps: 50
  })
})
.then(r => r.json())
.then(console.log)
```

**Ou via curl**:
```bash
curl -X POST https://YOUR-URL.vercel.app/api/swap/quote \
  -H "Content-Type: application/json" \
  -d '{
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amount": 1000000000,
    "slippageBps": 50
  }' | jq
```

### Test 4: Tester via l'Interface

1. Ouvrir https://YOUR-URL.vercel.app
2. Connecter un wallet testnet
3. Sélectionner SOL → USDC
4. Entrer un montant (ex: 1 SOL)
5. Cliquer **"🔍 Search Route"**

**Vérifier**:
- ✅ Bouton passe à "Finding Best Route..."
- ✅ Après ~2-3 secondes, affiche un quote
- ✅ `Output Amount` non vide
- ✅ Aucune erreur dans la console

### Test 5: Vérifier les Logs Vercel

**Via Dashboard**:
1. Aller sur https://vercel.com/dashboard
2. Sélectionner le projet SwapBack
3. Onglet **"Logs"**
4. Filtrer par `/api/swap/quote`

**Via CLI**:
```bash
vercel logs https://YOUR-URL.vercel.app --follow
```

**Chercher**:
```
✅ "Fetching Jupiter quote"
✅ "Quote fetched successfully"
❌ AUCUNE erreur "ENOTFOUND" ou "fetch failed"
```

---

## 🚨 Résolution de Problèmes

### Problème 1: "ENOTFOUND quote-api.jup.ag"

**Symptôme**: Même erreur que dans Codespaces

**Cause**: Variable `USE_MOCK_QUOTES` encore à `true`

**Solution**:
```bash
vercel env rm USE_MOCK_QUOTES
vercel env add USE_MOCK_QUOTES
# Entrer: false (pas true!)

vercel deploy --prod
```

### Problème 2: "_isMockData: true" dans la réponse

**Symptôme**: L'API retourne toujours des données MOCK

**Cause**: `USE_MOCK_QUOTES` pas défini ou à `true`

**Solution**:
```bash
# Vérifier la valeur
vercel env ls

# Si absent ou true:
vercel env add USE_MOCK_QUOTES
# Entrer: false

vercel deploy --prod
```

### Problème 3: Erreur "No liquidity"

**Symptôme**: Jupiter retourne une erreur

**Cause**: Token testnet non supporté par Jupiter (normal)

**Solution**: Tester avec tokens mainnet:

```json
{
  "inputMint": "So11111111111111111111111111111111111111112",
  "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "amount": 1000000000
}
```

**Ou** garder `USE_MOCK_QUOTES=true` pour testnet.

### Problème 4: Build échoue

**Symptôme**: Vercel build fails

**Logs possibles**:
```
Error: Cannot find module 'xyz'
```

**Solution**:
```bash
# Localement, vérifier les dépendances
cd /workspaces/SwapBack/app
npm install
npm run build

# Si ça marche localement:
git add .
git commit -m "fix: dependencies"
git push origin main

# Vercel redéploiera automatiquement
```

### Problème 5: Variables d'environnement non chargées

**Symptôme**: `undefined` dans le code

**Cause**: Variables pas préfixées `NEXT_PUBLIC_` côté client

**Rappel**:
- `JUPITER_API_URL` → Serveur uniquement
- `USE_MOCK_QUOTES` → Serveur uniquement
- `NEXT_PUBLIC_*` → Disponible côté client

**Solution**: Vérifier que seules les variables `NEXT_PUBLIC_*` sont utilisées côté client.

---

## 📊 Checklist de Validation

### Avant Déploiement

- [x] Code committé sur GitHub
- [x] Tests locaux passent (MOCK)
- [x] `vercel.json` configuré
- [x] Variables d'environnement listées

### Après Déploiement

- [ ] Site accessible via URL Vercel
- [ ] Page d'accueil se charge
- [ ] Wallet se connecte
- [ ] API `/api/swap/quote` répond HTTP 200
- [ ] Réponse contient `success: true`
- [ ] **PAS** de `_isMockData: true`
- [ ] Quote contient `inAmount`, `outAmount`, `priceImpactPct`
- [ ] Bouton "Search Route" fonctionne
- [ ] Output amount s'affiche correctement
- [ ] Aucune erreur dans console navigateur
- [ ] Aucune erreur dans logs Vercel

---

## 🎯 Scénarios de Test Détaillés

### Scénario 1: SOL → USDC (Mainnet Tokens)

**Configuration**:
```env
USE_MOCK_QUOTES=false
NEXT_PUBLIC_SOLANA_NETWORK=testnet
```

**Requête**:
```json
{
  "inputMint": "So11111111111111111111111111111111111111112",
  "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "amount": 1000000000
}
```

**Attendu**: ✅ Quote valide (Jupiter supporte ces tokens mainnet)

### Scénario 2: SOL → USDC (Testnet Token)

**Configuration**:
```env
USE_MOCK_QUOTES=false
NEXT_PUBLIC_SOLANA_NETWORK=testnet
```

**Requête**:
```json
{
  "inputMint": "So11111111111111111111111111111111111111112",
  "outputMint": "BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR",
  "amount": 1000000000
}
```

**Attendu**: ❌ Probablement erreur "Token not found" (Jupiter ne connaît pas ce token testnet)

**Solution**: Utiliser `USE_MOCK_QUOTES=true` pour testnet.

### Scénario 3: Configuration Recommandée Testnet

**Pour garder testnet + données réalistes**:

```env
USE_MOCK_QUOTES=true
NEXT_PUBLIC_SOLANA_NETWORK=testnet
NEXT_PUBLIC_USDC_MINT=BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR
```

**Résultat**: Données simulées réalistes pour développement testnet

### Scénario 4: Configuration Production Mainnet

**Pour production avec vraies données**:

```env
USE_MOCK_QUOTES=false
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

---

## 📈 Monitoring Post-Déploiement

### Logs en Temps Réel

```bash
vercel logs --follow
```

### Métriques Vercel

Dashboard → Analytics:
- Requests per minute
- Error rate
- Response time
- Bandwidth

### Alerts

Configurer dans Vercel Dashboard → Settings → Notifications:
- ✅ Deployment failed
- ✅ Build errors
- ✅ High error rate

---

## 🔄 Workflow de Développement

### Développement Local

```bash
# Codespaces ou local
cd /workspaces/SwapBack/app

# Utiliser MOCK pour testnet
echo "USE_MOCK_QUOTES=true" > .env.local

npm run dev
```

### Preview sur Vercel

```bash
# Tester avant production
vercel deploy

# Tester l'URL preview
curl https://swapback-preview-abc.vercel.app/api/swap/quote ...
```

### Production

```bash
# Quand tout est validé
vercel deploy --prod
```

---

## 📚 Ressources

### Documentation

- Vercel CLI: https://vercel.com/docs/cli
- Next.js Deployment: https://nextjs.org/docs/deployment
- Jupiter API: https://station.jup.ag/docs/apis/swap-api

### Support

- Vercel Support: https://vercel.com/support
- SwapBack GitHub: https://github.com/BacBacta/SwapBack/issues

---

## ✅ Commandes Rapides

### Installation

```bash
npm install -g vercel
```

### Déploiement

```bash
cd /workspaces/SwapBack/app
vercel login
vercel deploy --prod
```

### Test API

```bash
curl -X POST https://YOUR-URL.vercel.app/api/swap/quote \
  -H "Content-Type: application/json" \
  -d '{"inputMint":"So11111111111111111111111111111111111111112","outputMint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","amount":1000000000,"slippageBps":50}' | jq
```

### Logs

```bash
vercel logs --follow
```

### Variables d'environnement

```bash
# Lister
vercel env ls

# Ajouter
vercel env add VARIABLE_NAME

# Supprimer
vercel env rm VARIABLE_NAME
```

---

**Status**: 🟢 Prêt pour déploiement  
**Temps estimé**: 10 minutes  
**Difficulté**: Facile
