# Variables d'Environnement pour Vercel

Ce fichier liste toutes les variables d'environnement à configurer dans le dashboard Vercel.

## 📋 Configuration Vercel Dashboard

Allez dans : **Project Settings** → **Environment Variables**

### 🔧 Variables Requises

#### 1. Configuration API

```bash
# Jupiter API URL
JUPITER_API_URL=https://quote-api.jup.ag/v6

# Mode MOCK (false pour production, true pour staging/test)
USE_MOCK_QUOTES=false
```

#### 2. Configuration Solana Network

**Pour PRODUCTION (Mainnet)**:
```bash
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

**Pour STAGING/TEST (Testnet)**:
```bash
NEXT_PUBLIC_SOLANA_NETWORK=testnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.testnet.solana.com
```

#### 3. Program IDs

**Testnet**:
```bash
NEXT_PUBLIC_ROUTER_PROGRAM_ID=yeKoCvFPTmgn5oCejqFVU5mUNdVbZSxwETCXDuBpfxn
NEXT_PUBLIC_BUYBACK_PROGRAM_ID=DkaELUiGtTcFniZvHRicHn3RK11CsemDRW7h8qVQaiJi
NEXT_PUBLIC_CNFT_PROGRAM_ID=GFnJ59QDC4ANdMhsvDZaFoBTNUiq3cY3rQfHCoDYAQ3B
```

**Mainnet** (à mettre à jour après déploiement):
```bash
NEXT_PUBLIC_ROUTER_PROGRAM_ID=<votre_program_id_mainnet>
NEXT_PUBLIC_BUYBACK_PROGRAM_ID=<votre_program_id_mainnet>
NEXT_PUBLIC_CNFT_PROGRAM_ID=<votre_program_id_mainnet>
```

#### 4. Token Addresses

**Testnet**:
```bash
NEXT_PUBLIC_BACK_MINT=5UpRMH1xbHYsZdrYwjVab8cVN3QXJpFubCB5WXeB8i27
NEXT_PUBLIC_USDC_MINT=BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR
```

**Mainnet**:
```bash
NEXT_PUBLIC_BACK_MINT=<votre_token_mainnet>
NEXT_PUBLIC_USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

#### 5. Infrastructure

```bash
NEXT_PUBLIC_MERKLE_TREE=93Tzc7btocwzDSbscW9EfL9dBzWLx85FHE6zeWrwHbNT
NEXT_PUBLIC_COLLECTION_CONFIG=4zhpvzBMqvGoM7j9RAaAF5ZizwDUAtgYr5Pnzn8uRh5s
```

#### 6. Fees

```bash
NEXT_PUBLIC_PLATFORM_FEE_BPS=20
NEXT_PUBLIC_PLATFORM_FEE_PERCENT=0.20
```

---

## 🎯 Configuration par Environnement

### Production (Mainnet)

Créer un environnement "Production" avec:
- ✅ `USE_MOCK_QUOTES=false`
- ✅ `NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta`
- ✅ `JUPITER_API_URL=https://quote-api.jup.ag/v6`
- ✅ Program IDs mainnet
- ✅ Token addresses mainnet

### Preview (Testnet)

Créer un environnement "Preview" avec:
- ✅ `USE_MOCK_QUOTES=false`
- ✅ `NEXT_PUBLIC_SOLANA_NETWORK=testnet`
- ✅ `JUPITER_API_URL=https://quote-api.jup.ag/v6`
- ✅ Program IDs testnet
- ✅ Token addresses testnet

### Development (MOCK)

Créer un environnement "Development" avec:
- ✅ `USE_MOCK_QUOTES=true`
- ✅ `NEXT_PUBLIC_SOLANA_NETWORK=testnet`
- ✅ Autres variables de testnet

---

## 🚀 Déploiement sur Vercel

### Option 1: Via Dashboard (Recommandé)

1. **Aller sur** https://vercel.com
2. **Sélectionner** votre projet SwapBack
3. **Cliquer** sur "Settings" → "Environment Variables"
4. **Ajouter** chaque variable une par une:
   - Name: `JUPITER_API_URL`
   - Value: `https://quote-api.jup.ag/v6`
   - Environments: ☑️ Production ☑️ Preview ☑️ Development
5. **Répéter** pour toutes les variables

### Option 2: Via Vercel CLI

```bash
# Installer Vercel CLI
npm i -g vercel

# Login
vercel login

# Ajouter variables
vercel env add JUPITER_API_URL
# → Entrer: https://quote-api.jup.ag/v6
# → Sélectionner: Production, Preview, Development

vercel env add USE_MOCK_QUOTES
# → Entrer: false (pour prod) ou true (pour dev)

vercel env add NEXT_PUBLIC_SOLANA_NETWORK
# → Entrer: mainnet-beta (pour prod) ou testnet (pour preview)

# etc...
```

### Option 3: Import depuis fichier

Créer `vercel.env` (ne PAS commit ce fichier):

```bash
# Production
JUPITER_API_URL=https://quote-api.jup.ag/v6
USE_MOCK_QUOTES=false
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_ROUTER_PROGRAM_ID=<mainnet_id>
NEXT_PUBLIC_BACK_MINT=<mainnet_mint>
```

Puis:
```bash
vercel env pull .env.production
```

---

## 🔒 Bonnes Pratiques

### Variables Publiques vs Privées

**Préfixe `NEXT_PUBLIC_`** = Accessible côté client (browser)
- ✅ Token addresses
- ✅ Program IDs
- ✅ Network (mainnet/testnet)
- ✅ RPC URL

**Sans préfixe** = Privé côté serveur uniquement
- ✅ `JUPITER_API_URL` (utilisé dans API routes)
- ✅ `USE_MOCK_QUOTES` (utilisé dans API routes)
- ✅ API keys (si vous en avez)

### Sécurité

⚠️ **NE JAMAIS commit**:
- `.env.local`
- `.env.production`
- `.env.development`
- `vercel.env`

✅ **Ajouter à `.gitignore`**:
```bash
# Environment files
.env*.local
.env.production
.env.development
vercel.env
```

---

## 🧪 Tester Avant Déploiement

### Test en local avec variables Vercel

```bash
# 1. Pull les variables depuis Vercel
vercel env pull .env.local

# 2. Vérifier
cat .env.local

# 3. Tester
npm run dev
```

### Test du build

```bash
# Build comme sur Vercel
npm run build

# Servir le build
npm start
```

---

## 📊 Monitoring des Variables

### Vérifier quelle valeur est utilisée

Ajouter dans votre API route:

```typescript
// /app/src/app/api/health/route.ts
export async function GET() {
  return Response.json({
    environment: process.env.NODE_ENV,
    network: process.env.NEXT_PUBLIC_SOLANA_NETWORK,
    jupiterApi: process.env.JUPITER_API_URL,
    useMock: process.env.USE_MOCK_QUOTES,
    // NE PAS exposer les secrets/keys!
  });
}
```

Puis tester:
```bash
curl https://votre-app.vercel.app/api/health
```

---

## 🔄 Mise à Jour des Variables

### Via Dashboard

1. Settings → Environment Variables
2. Cliquer sur "Edit" à côté de la variable
3. Modifier la valeur
4. **Important**: Redéployer pour appliquer les changements

### Via CLI

```bash
# Supprimer ancienne valeur
vercel env rm JUPITER_API_URL production

# Ajouter nouvelle valeur
vercel env add JUPITER_API_URL production
```

### Redéploiement Automatique

Après modification des variables:
```bash
# Redéployer la branche main
vercel --prod

# OU trigger via git push
git commit --allow-empty -m "Trigger redeploy"
git push origin main
```

---

## 📝 Checklist Déploiement

Avant de déployer sur Vercel:

- [ ] Toutes les variables sont ajoutées dans Vercel dashboard
- [ ] `USE_MOCK_QUOTES=false` pour production
- [ ] `NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta` pour prod
- [ ] Program IDs sont corrects (mainnet)
- [ ] Token addresses sont corrects (mainnet)
- [ ] `.env*.local` sont dans `.gitignore`
- [ ] Build réussit en local (`npm run build`)
- [ ] Tests passent (`npm test`)
- [ ] RPC URL est configuré (éviter rate limits publics)

---

## 🎯 RPC Recommandés pour Production

Au lieu de l'RPC public gratuit, utiliser un provider premium:

### Helius (Recommandé)
```bash
NEXT_PUBLIC_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=<votre_key>
```
- ✅ 100k requests/jour gratuit
- ✅ Très rapide
- ✅ Support websocket

### QuickNode
```bash
NEXT_PUBLIC_SOLANA_RPC_URL=https://your-endpoint.solana-mainnet.quiknode.pro/<token>/
```
- ✅ Reliable
- ✅ Analytics dashboard
- ✅ Support 24/7

### Alchemy
```bash
NEXT_PUBLIC_SOLANA_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/<api-key>
```
- ✅ Gratuit jusqu'à 300M compute units
- ✅ Dashboard complet

---

**Prochaine étape**: Configurer ces variables dans Vercel Dashboard avant le déploiement
