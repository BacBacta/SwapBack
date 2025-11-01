# Configuration Vercel - Variables d'Environnement DEVNET

## 🎯 Objectif
Configurer les variables d'environnement sur Vercel pour que l'application affiche correctement les soldes de tokens $BACK et USDC sur DEVNET.

## 📝 Instructions

### 1. Accéder au Dashboard Vercel

1. Aller sur : https://vercel.com/bacbactas-projects/swap-back-app
2. Cliquer sur **Settings** (⚙️)
3. Cliquer sur **Environment Variables**

### 2. Ajouter les Variables d'Environnement

Ajouter **chacune** des variables suivantes :

| Variable | Valeur | Environnement |
|----------|--------|---------------|
| `NEXT_PUBLIC_SOLANA_NETWORK` | `devnet` | Production, Preview, Development |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | `https://api.devnet.solana.com` | Production, Preview, Development |
| `NEXT_PUBLIC_BACK_MINT` | `14rtHCJVvU7NKeFJotJsHdbsQGajnNmoQ7MHid41RLTa` | Production, Preview, Development |
| `NEXT_PUBLIC_USDC_MINT` | `BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR` | Production, Preview, Development |

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
3. **Changer le réseau vers DEVNET** dans le wallet
4. Importer le wallet de test :
   - Clé privée : voir `devnet-keypair-base58.txt`
   - Adresse : `3PiZ1xdHbPbj1UaPS8pfzKnHpmQQLfR8zrhy5RcksqAt`

### 5. Vérifier les Soldes

Les soldes devraient maintenant s'afficher :
- ✅ **$BACK** : 999,999,900 tokens
- ✅ **USDC** : 999,990 tokens

## 🔧 Dépannage

### Les soldes s'affichent toujours à zéro ?

**Vérifications :**

1. **Le wallet est-il sur DEVNET ?**
   - Dans Phantom : Settings → Change Network → Devnet
   - Dans Solflare : Settings → Network → Devnet

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

### Le wallet de test n'apparaît pas ?

```bash
# Vérifier le solde sur devnet
spl-token accounts --owner 3PiZ1xdHbPbj1UaPS8pfzKnHpmQQLfR8zrhy5RcksqAt --url devnet
```

## 📚 Ressources

- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [Solana Devnet Faucet](https://faucet.solana.com/)

---

**Dernière mise à jour** : 1er novembre 2025
