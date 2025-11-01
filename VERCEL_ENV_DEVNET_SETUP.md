# Configuration Vercel - Variables d'Environnement MAINNET

## 🎯 Objectif
Configurer les variables d'environnement sur Vercel pour que l'application fonctionne avec Jupiter API sur MAINNET.

## ⚠️ Pourquoi MAINNET ?

**Jupiter ne supporte pas devnet/testnet** - il fonctionne uniquement sur mainnet où il y a de la vraie liquidité.

Voir: [`DEVNET_NO_ROUTES_SOLUTION.md`](DEVNET_NO_ROUTES_SOLUTION.md) pour plus de détails.

## 📝 Instructions

### 1. Accéder au Dashboard Vercel

1. Aller sur : https://vercel.com/bacbactas-projects/swap-back-app
2. Cliquer sur **Settings** (⚙️)
3. Cliquer sur **Environment Variables**

### 2. Ajouter les Variables d'Environnement

Ajouter **chacune** des variables suivantes :

| Variable | Valeur | Environnement |
|----------|--------|---------------|
| `NEXT_PUBLIC_SOLANA_NETWORK` | `mainnet-beta` | Production, Preview, Development |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` | Production, Preview, Development |
| `NEXT_PUBLIC_BACK_MINT` | `So11111111111111111111111111111111111111112` | Production, Preview, Development |
| `NEXT_PUBLIC_USDC_MINT` | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | Production, Preview, Development |

**Note sur les tokens:**
- `NEXT_PUBLIC_BACK_MINT` : Actuellement configuré avec SOL pour les tests
- `NEXT_PUBLIC_USDC_MINT` : USDC officiel sur mainnet
- Remplacez `NEXT_PUBLIC_BACK_MINT` par votre token $BACK quand il sera déployé sur mainnet

### 3. Redéployer l'Application

Après avoir ajouté les variables :

**Option A - Via Dashboard**
1. Aller sur **Deployments**
2. Cliquer sur le dernier déploiement
3. Cliquer sur **⋮** (3 points)
4. Cliquer sur **Redeploy**

**Option B - Via Git Push**
```bash
git commit --allow-empty -m "trigger: redeploy with new env vars"
git push origin main
```

### 4. Tester l'Application en Production

1. Ouvrir : https://swap-back-app-4ewf.vercel.app
2. Connecter le wallet Phantom/Solflare
3. **Assurez-vous d'être sur MAINNET** dans le wallet
4. Les routes Jupiter devraient s'afficher pour les swaps SOL ↔ USDC

### 5. Vérifier les Routes

L'application devrait maintenant :
- ✅ Afficher "MAINNET" comme réseau
- ✅ Trouver des routes Jupiter pour les swaps
- ✅ Afficher les vrais prix de marché
- ✅ Permettre des swaps réels (avec de vrais frais)

## 🔧 Dépannage

### Les routes ne s'affichent toujours pas ?

**Vérifications :**

1. **Le wallet est-il sur MAINNET ?**
   - Dans Phantom : Settings → Change Network → Mainnet Beta
   - Dans Solflare : Settings → Network → Mainnet Beta

2. **Les variables d'environnement sont-elles bien configurées ?**
   ```bash
   # Vérifier via Vercel CLI
   vercel env ls
   ```

3. **Le déploiement a-t-il bien eu lieu APRÈS l'ajout des variables ?**
   - Les variables ne sont chargées que lors du build
   - Il faut redéployer après chaque modification de variable

4. **Vérifier les logs du build Vercel**
   - Dashboard → Deployments → Dernier déploiement → Build Logs
   - Chercher : "Environments: .env.local"

### L'affichage montre toujours "TESTNET" ou "DEVNET" ?

Le composant `NetworkStatusIndicator` détecte automatiquement le réseau via le genesis hash.
- Si votre **wallet** est sur devnet, il affichera "DEVNET"
- Changez le réseau du wallet vers **Mainnet Beta**
- L'indicateur se mettra à jour automatiquement

## 📚 Ressources

- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [Jupiter API Documentation](https://station.jup.ag/docs/apis/swap-api)
- [Pourquoi pas DEVNET ?](DEVNET_NO_ROUTES_SOLUTION.md)

---

**Dernière mise à jour** : 1er novembre 2025  
**Note** : Ce fichier a été mis à jour pour refléter la migration vers MAINNET (Jupiter ne supporte pas devnet/testnet)
