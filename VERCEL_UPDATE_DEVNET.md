# 🔄 Mise à Jour Vercel - Nouveau Token $BACK (Devnet)

## ⚠️ Problème Identifié

Votre frontend déployé sur Vercel affiche un solde de 0 $BACK car il utilise les **anciennes variables d'environnement** du fichier `.env.local` de votre dépôt, alors que vous venez de créer un **nouveau token** avec une nouvelle adresse.

## 📋 Variables à Mettre à Jour sur Vercel

### 1. Accéder au Dashboard Vercel

1. Allez sur : https://vercel.com/dashboard
2. Sélectionnez votre projet **SwapBack** (ou `app`)
3. Cliquez sur **Settings** → **Environment Variables**

### 2. Mettre à Jour les Variables Devnet

Vous devez mettre à jour (ou ajouter si elles n'existent pas) les variables suivantes :

#### 🔹 Nouveau Token $BACK

```bash
NEXT_PUBLIC_BACK_MINT=8sQq53Up7KooCTygi8Dk3Gt8XDeUN5BVLNi5h6Skz43P
```

**Important** : C'est votre nouveau token avec 100,000 $BACK mintés.

#### 🔹 Configuration Réseau Devnet

```bash
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
```

#### 🔹 Program IDs (si sur Devnet)

Si vous testez sur devnet, vérifiez que ces variables utilisent vos program IDs devnet :

```bash
NEXT_PUBLIC_ROUTER_PROGRAM_ID=<votre_router_devnet>
NEXT_PUBLIC_BUYBACK_PROGRAM_ID=<votre_buyback_devnet>
NEXT_PUBLIC_CNFT_PROGRAM_ID=2VB6D8Qqdo1gxqYDAxEMYkV4GcarAMATKHcbroaFPz8G
```

### 3. Environnements Vercel

**Important** : Configurez ces variables pour les environnements suivants :

- ✅ **Production** (si vous voulez tester en production)
- ✅ **Preview** (pour les branches de test)
- ✅ **Development** (pour le dev local via Vercel)

### 4. Redéployer

Après avoir mis à jour les variables :

#### Option A : Redéploiement Automatique (Recommandé)

```bash
# Dans votre terminal local
git commit --allow-empty -m "chore: trigger Vercel redeploy with new env vars"
git push origin main
```

Vercel va automatiquement redéployer avec les nouvelles variables.

#### Option B : Redéploiement Manuel

Dans le dashboard Vercel :
1. Allez dans **Deployments**
2. Trouvez le dernier déploiement réussi
3. Cliquez sur les **trois points (•••)**
4. Sélectionnez **Redeploy**

---

## 🧪 Vérification Après Déploiement

### 1. Vérifier le Token dans l'Interface

Une fois redéployé :
1. Ouvrez votre app : `https://votre-app.vercel.app`
2. Connectez votre wallet : `578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf`
3. Allez dans **Lock/Unlock**
4. Vérifiez que le solde affiche : **100,000 BACK**

### 2. Vérifier le Réseau

Dans la console du navigateur (F12), exécutez :

```javascript
console.log('Network:', process.env.NEXT_PUBLIC_SOLANA_NETWORK);
console.log('RPC:', process.env.NEXT_PUBLIC_SOLANA_RPC_URL);
console.log('BACK Mint:', process.env.NEXT_PUBLIC_BACK_MINT);
```

Vous devriez voir :
```
Network: devnet
RPC: https://api.devnet.solana.com
BACK Mint: 8sQq53Up7KooCTygi8Dk3Gt8XDeUN5BVLNi5h6Skz43P
```

### 3. Vérifier les Logs de Build Vercel

1. Dans le dashboard Vercel, allez dans **Deployments**
2. Cliquez sur le dernier déploiement
3. Consultez les **Build Logs**
4. Recherchez : `NEXT_PUBLIC_BACK_MINT` pour confirmer la bonne valeur

---

## 📊 Résumé des Changements

| Variable | Ancienne Valeur | Nouvelle Valeur |
|----------|----------------|-----------------|
| `NEXT_PUBLIC_BACK_MINT` | `3v3xneRUmsHY3UAyZDXZgVZwVeJwXVDwx5ZRsRAxuaLn` | `8sQq53Up7KooCTygi8Dk3Gt8XDeUN5BVLNi5h6Skz43P` |
| `NEXT_PUBLIC_SOLANA_NETWORK` | ❓ (peut-être mainnet) | `devnet` |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | ❓ (peut-être mainnet RPC) | `https://api.devnet.solana.com` |

---

## 🛠️ Troubleshooting

### Le solde est toujours à 0 après redéploiement

1. **Vider le cache du navigateur** : Ctrl+Shift+R (ou Cmd+Shift+R sur Mac)
2. **Déconnecter/Reconnecter le wallet**
3. **Vérifier que Vercel a bien redéployé** : Les variables ne sont appliquées qu'après un nouveau build
4. **Vérifier les variables dans Vercel** : Dashboard → Settings → Environment Variables

### Le token $BACK n'apparaît pas dans la liste

Vérifiez que `TokenSelector.tsx` inclut bien le token sur devnet :

```tsx
...(process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'devnet' ? [{
  name: '$BACK',
  symbol: 'BACK',
  address: process.env.NEXT_PUBLIC_BACK_MINT || "8sQq53Up7KooCTygi8Dk3Gt8XDeUN5BVLNi5h6Skz43P",
  decimals: 9,
  logoURI: '/logo.png',
  chainId: 103
}] : [])
```

### L'app indique être sur mainnet

Cela signifie que `NEXT_PUBLIC_SOLANA_NETWORK` n'est **pas défini** ou mal configuré dans Vercel.
- Ajoutez la variable dans le dashboard Vercel
- Redéployez l'application

---

## ✅ Checklist Finale

- [ ] Variables mises à jour dans Vercel dashboard
- [ ] Application redéployée (commit vide ou redeploy manuel)
- [ ] Cache navigateur vidé (Ctrl+Shift+R)
- [ ] Wallet reconnecté
- [ ] Solde de 100,000 $BACK visible dans l'interface
- [ ] Réseau indique "devnet" (si indicateur de réseau présent)

---

## 📝 Notes

### Token Créé

- **Mint Address** : `8sQq53Up7KooCTygi8Dk3Gt8XDeUN5BVLNi5h6Skz43P`
- **Supply** : 100,000 tokens
- **Votre ATA** : `GnMN1acTTTSPDuYcENPnvLYDbUSN2KiR8y2ov8e1fiF1`
- **Wallet** : `578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf`
- **Standard** : Token-2022
- **Réseau** : Devnet

### Commandes de Vérification

```bash
# Vérifier le solde on-chain
spl-token accounts --owner 578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf --url devnet

# Vérifier le token
spl-token display 8sQq53Up7KooCTygi8Dk3Gt8XDeUN5BVLNi5h6Skz43P --url devnet
```

---

**Dernière mise à jour** : 9 novembre 2025
**Token Mint** : 8sQq53Up7KooCTygi8Dk3Gt8XDeUN5BVLNi5h6Skz43P
