# 🔐 Variables et Secrets à Configurer - SwapBack

Ce document liste **toutes les variables d'environnement et secrets** nécessaires pour déployer SwapBack en production.

---

## 📋 Table des matières

1. [GitHub Secrets (CI/CD)](#github-secrets-cicd)
2. [Vercel Dashboard (Frontend)](#vercel-dashboard-frontend)
3. [Variables d'environnement locales](#variables-denvironnement-locales)
4. [Comment obtenir chaque secret](#comment-obtenir-chaque-secret)

---

## 🔐 GitHub Secrets (CI/CD)

À configurer dans : **GitHub → Settings → Secrets and Variables → Actions**

### Secrets CRITIQUES (Obligatoires)

| Nom du Secret | Description | Utilisé dans |
|---------------|-------------|--------------|
| `VERCEL_TOKEN` | Token d'authentification Vercel | Déploiement automatique |
| `VERCEL_ORG_ID` | ID de l'organisation Vercel | Déploiement automatique |
| `VERCEL_PROJECT_ID` | ID du projet Vercel | Déploiement automatique |
| `SOLANA_DEPLOYER_KEY` | Keypair en Base58 pour déploiement Solana | Déploiement programs Rust |
| `CODECOV_TOKEN` | Token pour upload coverage | Rapports de couverture tests |

### Secrets OPTIONNELS (Recommandés pour production)

| Nom du Secret | Description | Utilisé dans |
|---------------|-------------|--------------|
| `NEXT_PUBLIC_RPC_ENDPOINT` | URL RPC Solana (mainnet) | Build frontend |
| `NEXT_PUBLIC_HELIUS_API_KEY` | Clé API Helius pour RPC amélioré | Build frontend |
| `PROD_RPC_ENDPOINT` | URL RPC pour release (mainnet) | Release workflow |
| `PROD_HELIUS_API_KEY` | Clé API Helius pour production | Release workflow |

> **Note** : `GITHUB_TOKEN` est fourni automatiquement par GitHub Actions.

---

## 🌐 Vercel Dashboard (Frontend)

À configurer dans : **Vercel Dashboard → Project → Settings → Environment Variables**

### Variables pour PRODUCTION

| Variable | Valeur | Description |
|----------|--------|-------------|
| `NEXT_PUBLIC_SOLANA_RPC_URL` | `https://rpc.helius.xyz/?api-key=VOTRE_CLE` | URL RPC mainnet |
| `NEXT_PUBLIC_SOLANA_NETWORK` | `mainnet-beta` | Réseau Solana |
| `NEXT_PUBLIC_HELIUS_API_KEY` | Votre clé Helius | API key Helius |
| `NEXT_PUBLIC_ANALYTICS_ENABLED` | `true` | Activer analytics |
| `NEXT_PUBLIC_MIXPANEL_TOKEN` | Votre token Mixpanel | Token analytics |
| `NEXT_PUBLIC_BACK_MANUAL_PRICE` | `0.001` | Prix manuel $BACK (USD) |

### Variables pour DEVNET (Preview)

| Variable | Valeur | Description |
|----------|--------|-------------|
| `NEXT_PUBLIC_SOLANA_RPC_URL` | `https://api.devnet.solana.com` | URL RPC devnet |
| `NEXT_PUBLIC_SOLANA_NETWORK` | `devnet` | Réseau Solana |
| `NEXT_PUBLIC_ANALYTICS_ENABLED` | `false` | Désactiver analytics |

### Configuration Vercel Dashboard

```bash
# IMPORTANT : À configurer manuellement dans Vercel Dashboard
Root Directory: app
Framework Preset: Next.js
Build Command: npm run build
Output Directory: .next
Install Command: npm install --legacy-peer-deps
Node Version: 20.x
```

---

## 💻 Variables d'environnement locales

Fichier : `app/.env.local` (à créer, non commité)

```bash
# Analytics (Optionnel en développement)
NEXT_PUBLIC_ANALYTICS_ENABLED=false
NEXT_PUBLIC_MIXPANEL_TOKEN=your_mixpanel_token_here

# Helius API
NEXT_PUBLIC_HELIUS_API_KEY=your_helius_api_key_here

# Solana RPC
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=devnet

# Prix manuel $BACK (fallback si Pyth indisponible)
NEXT_PUBLIC_BACK_MANUAL_PRICE=0.001

# Optionnel : Custom RPC
# NEXT_PUBLIC_SOLANA_RPC_URL=https://rpc.helius.xyz/?api-key=YOUR_KEY
# NEXT_PUBLIC_SOLANA_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/YOUR_KEY
```

---

## 🔑 Comment obtenir chaque secret

### 1. VERCEL_TOKEN

```bash
1. Aller sur https://vercel.com/account/tokens
2. Cliquer "Create Token"
3. Nom : "GitHub Actions SwapBack"
4. Scope : Full Account
5. Copier le token (visible une seule fois)
6. Ajouter dans GitHub Secrets
```

### 2. VERCEL_ORG_ID et VERCEL_PROJECT_ID

**Méthode 1 : Via Vercel CLI**
```bash
cd app
vercel link
# Suivre les instructions
cat .vercel/project.json
# Copier "orgId" et "projectId"
```

**Méthode 2 : Via Dashboard**
```bash
# VERCEL_ORG_ID
1. Aller sur https://vercel.com/[votre-username]/settings
2. L'ID est dans l'URL : vercel.com/teams/[ORG_ID]/settings

# VERCEL_PROJECT_ID
1. Aller dans votre projet SwapBack
2. Settings → General
3. Copier "Project ID"
```

### 3. SOLANA_DEPLOYER_KEY

```bash
# Générer une nouvelle keypair
solana-keygen new --outfile deployer-keypair.json

# Vérifier l'adresse publique
solana-keygen pubkey deployer-keypair.json

# Convertir en Base58 pour GitHub Secret
cat deployer-keypair.json | jq -r '.[]' | tr -d '\n' | base58

# ⚠️ IMPORTANT : Financer cette adresse avec du SOL pour déploiement
solana airdrop 2 <ADRESSE_PUBLIQUE> --url devnet  # Pour devnet
# Pour mainnet : transférer SOL manuellement (~5 SOL recommandé)

# Ajouter le résultat dans GitHub Secrets → SOLANA_DEPLOYER_KEY
```

### 4. CODECOV_TOKEN

```bash
1. Aller sur https://codecov.io
2. Se connecter avec GitHub
3. Ajouter le repo BacBacta/SwapBack
4. Copier le token dans Settings → Repository Upload Token
5. Ajouter dans GitHub Secrets
```

### 5. NEXT_PUBLIC_HELIUS_API_KEY

```bash
1. Aller sur https://www.helius.dev/
2. Sign Up / Login
3. Dashboard → API Keys → Create New API Key
4. Nom : "SwapBack Production"
5. Copier la clé
6. Ajouter dans :
   - GitHub Secrets (pour CI/CD)
   - Vercel Dashboard (pour frontend)
```

### 6. NEXT_PUBLIC_MIXPANEL_TOKEN

```bash
1. Aller sur https://mixpanel.com/
2. Sign Up / Login
3. Create Project : "SwapBack"
4. Settings → Project Settings
5. Copier "Project Token"
6. Ajouter dans Vercel Dashboard Environment Variables
```

### 7. NEXT_PUBLIC_RPC_ENDPOINT (Production)

**Options recommandées :**

```bash
# Option 1 : Helius (Recommandé - meilleure fiabilité)
https://rpc.helius.xyz/?api-key=VOTRE_CLE_HELIUS

# Option 2 : Alchemy
https://solana-mainnet.g.alchemy.com/v2/VOTRE_CLE_ALCHEMY

# Option 3 : QuickNode
https://votre-endpoint.solana-mainnet.quiknode.pro/VOTRE_TOKEN/

# Option 4 : RPC public Solana (Non recommandé pour production - rate limits)
https://api.mainnet-beta.solana.com
```

**Obtenir Helius API Key :**
```bash
1. https://www.helius.dev/ → Sign Up
2. Dashboard → API Keys → Create
3. Plan gratuit : 100,000 requests/day
4. Plan payant recommandé pour production
```

---

## ✅ Checklist de configuration

### GitHub Secrets

- [ ] `VERCEL_TOKEN` - Token Vercel créé
- [ ] `VERCEL_ORG_ID` - ID organization récupéré
- [ ] `VERCEL_PROJECT_ID` - ID projet récupéré
- [ ] `SOLANA_DEPLOYER_KEY` - Keypair générée et financée
- [ ] `CODECOV_TOKEN` - Token Codecov créé
- [ ] `NEXT_PUBLIC_HELIUS_API_KEY` - Clé Helius obtenue
- [ ] `NEXT_PUBLIC_RPC_ENDPOINT` - URL RPC définie

### Vercel Dashboard

- [ ] `NEXT_PUBLIC_SOLANA_RPC_URL` - URL RPC Helius configurée
- [ ] `NEXT_PUBLIC_SOLANA_NETWORK` - `mainnet-beta` défini
- [ ] `NEXT_PUBLIC_HELIUS_API_KEY` - Clé Helius ajoutée
- [ ] `NEXT_PUBLIC_ANALYTICS_ENABLED` - `true` pour production
- [ ] `NEXT_PUBLIC_MIXPANEL_TOKEN` - Token Mixpanel ajouté
- [ ] **Root Directory** - Défini à `app`
- [ ] **Build Command** - Défini à `npm run build`
- [ ] **Install Command** - Défini à `npm install --legacy-peer-deps`

### Vérifications

- [ ] Tester le build local : `cd app && npm run build`
- [ ] Vérifier Vercel CLI : `vercel --prod`
- [ ] Confirmer CI/CD GitHub Actions passe
- [ ] Vérifier déploiement Vercel réussit

---

## 🚨 Sécurité

### ⚠️ NE JAMAIS commiter dans Git :

```bash
# Fichiers à ignorer (déjà dans .gitignore)
.env.local
.env.production
.env
deployer-keypair.json
*.pem
*.key
```

### ✅ Bonnes pratiques :

1. **Rotation des secrets** : Changer les tokens tous les 90 jours
2. **Accès limité** : Seuls les admins doivent avoir accès aux secrets
3. **Séparation env** : Secrets différents pour devnet/mainnet
4. **Monitoring** : Activer les alertes Vercel/GitHub pour déploiements
5. **Backup** : Sauvegarder `SOLANA_DEPLOYER_KEY` en lieu sûr

---

## 📞 Support

Si vous rencontrez des problèmes :

1. Vérifier ce guide : `VARIABLES_CONFIGURATION.md`
2. Consulter : `VERCEL_CONFIG_GUIDE.md`
3. Lire : `docs/CI_CD_SETUP.md`
4. Tester la simulation : `bash simulate-vercel-build.sh`

---

**Dernière mise à jour** : 1er novembre 2025  
**Auteur** : Équipe SwapBack  
**Version** : 1.0
