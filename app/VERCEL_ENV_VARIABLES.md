# 📋 Configuration des Variables d'Environnement Vercel# Variables d'Environnement pour Vercel

## 🔍 IMPORTANT: Comportement de Validation Client vs Serveur

### Validation Intelligente

SwapBack utilise une validation **adaptative** des variables d'environnement:

**Server-side (Node.js)**:
- ✅ Validation stricte activée
- Contextes: `npm run build`, SSR, API Routes
- Vérifie Program IDs === IDL addresses
- ❌ Build échoue si mismatch

**Client-side (Browser)**:
- ⏭️ Validation désactivée (skip)
- Contextes: React Components dans le navigateur
- Variables utilisées telles quelles
- ✅ Dashboard se charge sans crash
- ❌ Erreurs claires seulement lors de l'exécution de transactions

**Pourquoi?** Résout l'erreur "Application error: a client-side exception has occurred" en permettant le chargement du Dashboard même si des variables manquent. La validation stricte reste active côté serveur pour prévenir les déploiements incorrects.

📖 **Détails**: Voir `CLIENT_SIDE_ERROR_FIX.md` pour l'implémentation technique.

---

## Vue d'ensembleCe fichier liste toutes les variables d'environnement à configurer dans le dashboard Vercel.



Ce document liste **toutes** les variables d'environnement nécessaires pour déployer SwapBack sur Vercel en mode **devnet**.## 📋 Configuration Vercel Dashboard



---Allez dans : **Project Settings** → **Environment Variables**



## 🔴 Variables Critiques (OBLIGATOIRES)### 🔧 Variables Requises



### 1. NEXT_PUBLIC_SOLANA_NETWORK#### 1. Configuration API



**Valeur**: `devnet````bash

# Jupiter API URL

**Description**: Spécifie le réseau Solana à utiliser (devnet, testnet, ou mainnet-beta).JUPITER_API_URL=https://quote-api.jup.ag/v6



**Environnements**: ✅ Production ✅ Preview ✅ Development# Mode MOCK (false pour production, true pour staging/test)

USE_MOCK_QUOTES=false

**Pourquoi critique**: Détermine quel RPC utiliser et quels programmes/tokens sont disponibles.```



---#### 2. Configuration Solana Network



### 2. NEXT_PUBLIC_SOLANA_RPC_URL**Pour PRODUCTION (Mainnet)**:

```bash

**Valeur**: `https://api.devnet.solana.com`NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta

NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

**Description**: Point de terminaison RPC pour les requêtes on-chain.```



**Environnements**: ✅ Production ✅ Preview ✅ Development**Pour STAGING/TEST (Testnet)**:

```bash

**Pourquoi critique**: Sans RPC, aucune communication avec la blockchain n'est possible.NEXT_PUBLIC_SOLANA_NETWORK=testnet

NEXT_PUBLIC_SOLANA_RPC_URL=https://api.testnet.solana.com

**⚠️  Pour Production (mainnet)**: Utiliser un provider premium (Helius, QuickNode, Alchemy) pour éviter les rate limits.```



---#### 3. Program IDs



### 3. NEXT_PUBLIC_CNFT_PROGRAM_ID**Testnet**:

```bash

**Valeur**: `9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq`NEXT_PUBLIC_ROUTER_PROGRAM_ID=GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt

NEXT_PUBLIC_BUYBACK_PROGRAM_ID=EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf

**Description**: Program ID du programme swapback_cnft déployé sur devnet.NEXT_PUBLIC_CNFT_PROGRAM_ID=9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw

```

**Environnements**: ✅ Production ✅ Preview ✅ Development

**Mainnet** (à mettre à jour après déploiement):

**Pourquoi critique**: 🔥 **ULTRA-CRITIQUE** 🔥```bash

NEXT_PUBLIC_ROUTER_PROGRAM_ID=<votre_program_id_mainnet>

- Cette variable **doit correspondre exactement** à l'`address` dans `app/src/idl/swapback_cnft.json`NEXT_PUBLIC_BUYBACK_PROGRAM_ID=<votre_program_id_mainnet>

- Si elle diffère → **TOUTES** les transactions lock/unlock échoueront avec `AccountOwnedByWrongProgram`NEXT_PUBLIC_CNFT_PROGRAM_ID=<votre_program_id_mainnet>

- Les PDAs (Program Derived Addresses) sont calculés avec ce Program ID```

- Un Program ID incorrect génère des PDAs qui ne correspondent pas aux comptes on-chain

#### 4. Token Addresses

**Vérification**:

```bash**Testnet**:

# Afficher le Program ID de l'IDL```bash

cat app/src/idl/swapback_cnft.json | grep "address"NEXT_PUBLIC_BACK_MINT=862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux

# Résultat attendu: "address": "9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq"NEXT_PUBLIC_USDC_MINT=BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR

``````



---**Mainnet**:

```bash

### 4. NEXT_PUBLIC_BACK_MINTNEXT_PUBLIC_BACK_MINT=<votre_token_mainnet>

NEXT_PUBLIC_USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

**Valeur**: `862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux````



**Description**: Adresse du token $BACK (Token-2022) sur devnet.#### 5. Infrastructure



**Environnements**: ✅ Production ✅ Preview ✅ Development```bash

NEXT_PUBLIC_MERKLE_TREE=93Tzc7btocwzDSbscW9EfL9dBzWLx85FHE6zeWrwHbNT

**Pourquoi critique**: C'est le token utilisé pour les opérations lock/unlock. Sans cette valeur, le frontend ne sait pas quel token manipuler.NEXT_PUBLIC_COLLECTION_CONFIG=4zhpvzBMqvGoM7j9RAaAF5ZizwDUAtgYr5Pnzn8uRh5s

```

**Note**: Ce token est un **Token-2022** (programme `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`), pas un SPL Token standard.

#### 6. Fees

---

```bash

### 5. NEXT_PUBLIC_COLLECTION_CONFIGNEXT_PUBLIC_PLATFORM_FEE_BPS=20

NEXT_PUBLIC_PLATFORM_FEE_PERCENT=0.20

**Valeur**: `5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom````



**Description**: PDA (Program Derived Address) pour la configuration de la collection cNFT.---



**Environnements**: ✅ Production ✅ Preview ✅ Development## 🎯 Configuration par Environnement



**Pourquoi critique**: 🔥 **ULTRA-CRITIQUE** 🔥### Production (Mainnet)



- C'est l'adresse du compte qui stocke la configuration on-chainCréer un environnement "Production" avec:

- Ce PDA est dérivé avec le seed `"collection_config"` et le `CNFT_PROGRAM_ID`- ✅ `USE_MOCK_QUOTES=false`

- **Doit être calculé**, pas inventé- ✅ `NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta`

- Si incorrect → `AccountOwnedByWrongProgram` lors du lock- ✅ `JUPITER_API_URL=https://quote-api.jup.ag/v6`

- ✅ Program IDs mainnet

**Calcul du PDA**:- ✅ Token addresses mainnet

```javascript

const [collectionConfig] = PublicKey.findProgramAddressSync(### Preview (Testnet)

  [Buffer.from("collection_config")],

  new PublicKey("9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq")Créer un environnement "Preview" avec:

);- ✅ `USE_MOCK_QUOTES=false`

// Résultat: 5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom- ✅ `NEXT_PUBLIC_SOLANA_NETWORK=testnet`

```- ✅ `JUPITER_API_URL=https://quote-api.jup.ag/v6`

- ✅ Program IDs testnet

**Vérification**:- ✅ Token addresses testnet

```bash

# Afficher le PDA calculé### Development (MOCK)

npm run pdas:print

Créer un environnement "Development" avec:

# Vérifier que le compte existe on-chain- ✅ `USE_MOCK_QUOTES=true`

solana account 5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom --url devnet- ✅ `NEXT_PUBLIC_SOLANA_NETWORK=testnet`

# Doit afficher: Owner: 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq- ✅ Autres variables de testnet

```

---

---

## 🚀 Déploiement sur Vercel

## 🚀 Procédure d'Ajout sur Vercel

### Option 1: Via Dashboard (Recommandé)

### Étape 1: Accéder au Dashboard

1. **Aller sur** https://vercel.com

1. Aller sur https://vercel.com/dashboard2. **Sélectionner** votre projet SwapBack

2. Sélectionner le projet **SwapBack**3. **Cliquer** sur "Settings" → "Environment Variables"

3. Cliquer sur **Settings** (dans le menu latéral)4. **Ajouter** chaque variable une par une:

4. Cliquer sur **Environment Variables**   - Name: `JUPITER_API_URL`

   - Value: `https://quote-api.jup.ag/v6`

### Étape 2: Ajouter Chaque Variable   - Environments: ☑️ Production ☑️ Preview ☑️ Development

5. **Répéter** pour toutes les variables

**Pour CHAQUE variable critique** (1 à 5 ci-dessus):

### Option 2: Via Vercel CLI

1. Cliquer sur **"Add New"**

2. **Name**: Copier-coller le nom exact (ex: `NEXT_PUBLIC_CNFT_PROGRAM_ID`)```bash

3. **Value**: Copier-coller la valeur exacte (ex: `9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq`)# Installer Vercel CLI

4. **Environments**: 🔴 **COCHER LES 3 CASES**npm i -g vercel

   - ✅ **Production**

   - ✅ **Preview**# Login

   - ✅ **Development**vercel login

5. Cliquer sur **"Save"**

# Ajouter variables

### Étape 3: Redéploiementvercel env add JUPITER_API_URL

# → Entrer: https://quote-api.jup.ag/v6

Deux options:# → Sélectionner: Production, Preview, Development



**Option A - Automatique** (Recommandé):vercel env add USE_MOCK_QUOTES

- Vercel redéploie automatiquement après ajout de variables# → Entrer: false (pour prod) ou true (pour dev)

- Attendre 2-3 minutes

vercel env add NEXT_PUBLIC_SOLANA_NETWORK

**Option B - Manuel**:# → Entrer: mainnet-beta (pour prod) ou testnet (pour preview)

```bash

# Push un commit vide pour forcer le redéploiement# etc...

git commit --allow-empty -m "trigger: redeploy with correct env vars"```

git push origin main

```### Option 3: Import depuis fichier



Ou sur Vercel:Créer `vercel.env` (ne PAS commit ce fichier):

1. Aller dans **Deployments**

2. Cliquer sur **...** (trois points) du dernier déploiement```bash

3. Cliquer sur **"Redeploy"**# Production

4. ⚠️  **DÉCOCHER** "Use existing Build Cache"JUPITER_API_URL=https://quote-api.jup.ag/v6

5. Cliquer sur **"Redeploy"**USE_MOCK_QUOTES=false

NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta

### Étape 4: VérificationNEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

NEXT_PUBLIC_ROUTER_PROGRAM_ID=<mainnet_id>

1. Attendre le ✓ vert dans **Deployments** (Status: Ready)NEXT_PUBLIC_BACK_MINT=<mainnet_mint>

2. Ouvrir l'URL Vercel dans un **nouvel onglet incognito** (éviter le cache browser)```

3. Ouvrir la console développeur (F12)

4. Rechercher les logs `[LOCK TX]` ou `Environment validation`Puis:

5. Vérifier:```bash

   ```vercel env pull .env.production

   ✅ Environment validation passed```

      Network: devnet

      CNFT Program: 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq---

      BACK Mint: 862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux

      Collection Config: 5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom## 🔒 Bonnes Pratiques

   ```

### Variables Publiques vs Privées

---

**Préfixe `NEXT_PUBLIC_`** = Accessible côté client (browser)

## 🐛 Troubleshooting- ✅ Token addresses

- ✅ Program IDs

### ❌ Erreur: "Environment validation failed"- ✅ Network (mainnet/testnet)

- ✅ RPC URL

**Symptôme**: Message d'erreur listant les variables manquantes.

**Sans préfixe** = Privé côté serveur uniquement

**Solution**: Ajouter les variables manquantes listées dans l'erreur. Chaque variable critique (1-5) doit être présente.- ✅ `JUPITER_API_URL` (utilisé dans API routes)

- ✅ `USE_MOCK_QUOTES` (utilisé dans API routes)

---- ✅ API keys (si vous en avez)



### ❌ Erreur: "CNFT_PROGRAM_ID mismatch!"### Sécurité



**Symptôme**:⚠️ **NE JAMAIS commit**:

```- `.env.local`

❌ CRITICAL: NEXT_PUBLIC_CNFT_PROGRAM_ID mismatch!- `.env.production`

   Environment variable: 2VB6D8Qqdo1gxqYDAxEMYkV4GcarAMATKHcbroaFPz8G- `.env.development`

   IDL program address:  9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq- `vercel.env`

```

✅ **Ajouter à `.gitignore`**:

**Cause**: La variable `NEXT_PUBLIC_CNFT_PROGRAM_ID` sur Vercel ne correspond pas à l'IDL.```bash

# Environment files

**Solution**:.env*.local

1. Aller dans Settings → Environment Variables.env.production

2. Trouver `NEXT_PUBLIC_CNFT_PROGRAM_ID`.env.development

3. Cliquer sur **Edit** (icône crayon ✏️)vercel.env

4. Changer la valeur pour: `9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq````

5. ⚠️  Vérifier que les **3 environnements** sont cochés

6. **Save**---

7. Redéployer

## 🧪 Tester Avant Déploiement

---

### Test en local avec variables Vercel

### ❌ Erreur: "AccountOwnedByWrongProgram"

```bash

**Symptôme**:# 1. Pull les variables depuis Vercel

```vercel env pull .env.local

Error Code: AccountOwnedByWrongProgram. Error Number: 3007

Left: 2VB6D8Qqdo1gxqYDAxEMYkV4GcarAMATKHcbroaFPz8G# 2. Vérifier

Right: 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtqcat .env.local

```

# 3. Tester

**Cause**: `NEXT_PUBLIC_COLLECTION_CONFIG` manquante ou incorrecte sur Vercel.npm run dev

```

**Solution**:

1. Vérifier que `NEXT_PUBLIC_COLLECTION_CONFIG` existe### Test du build

2. Valeur doit être exactement: `5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom`

3. Les 3 environnements doivent être cochés```bash

4. Si manquante: l'ajouter selon Étape 2 ci-dessus# Build comme sur Vercel

5. Redéployernpm run build



---# Servir le build

npm start

### 🔄 Cache Browser```



Si les changements ne sont pas visibles après redéploiement:---



1. **Hard refresh**: Ctrl+Shift+R (Windows/Linux) ou Cmd+Shift+R (Mac)## 📊 Monitoring des Variables

2. Ou: Ouvrir en mode **incognito/privé**

3. Ou: F12 → Application → Clear site data → Reload### Vérifier quelle valeur est utilisée



---Ajouter dans votre API route:



## 📝 Checklist Complète```typescript

// /app/src/app/api/health/route.ts

Avant de tester sur Vercel:export async function GET() {

  return Response.json({

- [ ] Les 5 variables critiques sont ajoutées ✅    environment: process.env.NODE_ENV,

- [ ] Chaque variable a les 3 environnements cochés ✅    network: process.env.NEXT_PUBLIC_SOLANA_NETWORK,

- [ ] Redéploiement terminé (Status: Ready) ✅    jupiterApi: process.env.JUPITER_API_URL,

- [ ] Hard refresh effectué (Ctrl+Shift+R) ✅    useMock: process.env.USE_MOCK_QUOTES,

- [ ] Wallet connecté sur **devnet** ✅    // NE PAS exposer les secrets/keys!

- [ ] Logs console affichent "Environment validation passed" ✅  });

- [ ] Balance $BACK s'affiche correctement ✅}

- [ ] Test lock/unlock fonctionne sans erreur ✅```



---Puis tester:

```bash

*Dernière mise à jour: Configuration devnet avec Program ID 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq*curl https://votre-app.vercel.app/api/health

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
