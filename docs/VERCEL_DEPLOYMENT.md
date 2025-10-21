# 🚀 Guide de Déploiement Vercel - SwapBack Beta

Ce guide vous explique comment déployer SwapBack sur Vercel pour la beta devnet.

## 📋 Pré-requis

- Compte Vercel (gratuit)
- Repository GitHub SwapBack
- Programmes déployés sur Solana devnet

## 🔧 Étapes de Déploiement

### 1. Connexion à Vercel

```bash
# Installer Vercel CLI
npm i -g vercel

# Login
vercel login
```

### 2. Configuration du Projet

Le fichier `vercel.json` est déjà configuré avec:
- Build command: `cd app && npm run build`
- Output directory: `app/.next`
- Variables d'environnement devnet

### 3. Variables d'Environnement

Les variables suivantes sont pré-configurées dans `vercel.json`:

```bash
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_NETWORK=devnet
NEXT_PUBLIC_ROUTER_PROGRAM_ID=3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap
NEXT_PUBLIC_BUYBACK_PROGRAM_ID=46UWFYdksvkGhTPy9cTSJGa3d5nqzpY766rtJeuxtMgU
NEXT_PUBLIC_BACK_TOKEN_MINT=862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux
NEXT_PUBLIC_ORACLE_FEED=GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR
```

### 4. Déploiement

#### Option A: Via CLI

```bash
# Depuis la racine du projet
cd /workspaces/SwapBack

# Deploy en preview
vercel

# Deploy en production
vercel --prod
```

#### Option B: Via GitHub (Recommandé)

1. **Push sur GitHub**:
   ```bash
   git add .
   git commit -m "feat: beta devnet ready for deployment"
   git push origin main
   ```

2. **Import dans Vercel**:
   - Allez sur [vercel.com/new](https://vercel.com/new)
   - Sélectionnez le repo `SwapBack`
   - Framework: Next.js (auto-détecté)
   - Root Directory: laissez vide
   - Build Command: `cd app && npm run build`
   - Output Directory: `app/.next`
   - Cliquez **Deploy**

### 5. Configuration Domaine

Une fois déployé, Vercel vous donne une URL comme:
```
https://swap-back-xyz.vercel.app
```

Pour configurer un domaine custom:
1. Vercel Dashboard → Votre projet → Settings → Domains
2. Ajoutez `devnet.swapback.io`
3. Configurez les DNS selon les instructions Vercel

## 🧪 Validation Post-Déploiement

### Checklist

- [ ] Page d'accueil charge correctement
- [ ] Connexion wallet fonctionne (Phantom/Solflare)
- [ ] Passage en devnet dans wallet
- [ ] Création d'un plan DCA test
- [ ] Dashboard affiche les plans
- [ ] Pas d'erreurs console

### Tests Manuels

1. **Test Wallet Connection**:
   ```
   - Ouvrir https://your-url.vercel.app
   - Cliquer "Connect Wallet"
   - Sélectionner Phantom
   - Vérifier connexion réussie
   ```

2. **Test DCA Plan Creation**:
   ```
   - Entrer 0.1 SOL
   - Destination: USDC
   - Interval: 1 hour
   - Swaps: 5
   - Cliquer "Create Plan"
   - Vérifier transaction Phantom
   ```

3. **Test Dashboard**:
   ```
   - Onglet Dashboard
   - Vérifier affichage plans (ou EmptyState)
   - Vérifier stats utilisateur
   ```

## 📊 Monitoring

### Vercel Analytics

Activez Vercel Analytics pour tracking:
- Visites
- Performance (Core Web Vitals)
- Erreurs runtime

### Logs

Voir les logs en temps réel:
```bash
vercel logs your-deployment-url
```

## 🔄 Mises à Jour

Pour déployer une nouvelle version:

```bash
# Via CLI
vercel --prod

# Via GitHub (auto-deploy)
git push origin main
```

Vercel redéploie automatiquement à chaque push sur `main`.

## 🐛 Troubleshooting

### Build Fails

**Erreur**: `Error: Cannot find module`
**Solution**: Vérifier que toutes les deps sont dans `app/package.json`

```bash
cd app
npm install
npm run build  # Test local
```

### Runtime Errors

**Erreur**: `ReferenceError: window is not defined`
**Solution**: Utiliser `"use client"` en haut des composants

**Erreur**: `Network request failed`
**Solution**: Vérifier les CORS et RPC endpoint

### Wallet Connection Issues

**Problème**: Wallet ne se connecte pas
**Solution**: 
1. Vérifier que wallet est en mode devnet
2. Check console pour erreurs
3. Tester avec wallet différent

## 📝 Variables Optionnelles

Pour améliorer les perfs, ajoutez:

```bash
# Helius RPC (meilleur que public devnet)
NEXT_PUBLIC_HELIUS_API_KEY=your_key_here

# Analytics (optionnel)
NEXT_PUBLIC_ANALYTICS_ID=your_id
```

## 🎯 Next Steps

Après déploiement réussi:

1. **Testez l'app** avec 5-10 utilisateurs internes
2. **Créez les invitations beta** (50 slots)
3. **Configurez monitoring** (Sentry, LogRocket)
4. **Lancez feedback loop** (Typeform, Discord)

## 🔗 Liens Utiles

- [Vercel Docs](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Solana Explorer Devnet](https://explorer.solana.com/?cluster=devnet)

---

**Questions ?** Ouvrir une issue ou contactez l'équipe sur Discord.
