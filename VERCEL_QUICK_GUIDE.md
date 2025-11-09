# 🎯 Guide Rapide : Mise à jour du token $BACK sur Vercel

## Le problème
Votre frontend Vercel montre **0 $BACK** parce qu'il utilise l'ancienne adresse de token.

## La solution en 3 étapes

### ✅ ÉTAPE 1 : Mettre à jour les variables sur Vercel (5 minutes)

1. Allez sur **https://vercel.com/dashboard**
2. Sélectionnez votre projet **SwapBack**
3. Cliquez sur **Settings** → **Environment Variables**
4. Ajoutez ou modifiez ces 3 variables :

```
NEXT_PUBLIC_SOLANA_NETWORK = devnet
NEXT_PUBLIC_SOLANA_RPC_URL = https://api.devnet.solana.com
NEXT_PUBLIC_BACK_MINT = 8sQq53Up7KooCTygi8Dk3Gt8XDeUN5BVLNi5h6Skz43P
```

⚠️ **IMPORTANT** : Pour chaque variable, cochez les 3 environnements :
- ✓ Production
- ✓ Preview  
- ✓ Development

### ✅ ÉTAPE 2 : Redéployer (1 minute)

**Option A - Depuis Vercel Dashboard :**
1. Allez dans l'onglet **Deployments**
2. Cliquez sur le dernier déploiement
3. Cliquez sur **⋯** → **Redeploy**

**Option B - Depuis votre terminal (automatique) :**
```bash
cd /workspaces/SwapBack
./redeploy-vercel.sh
```

### ✅ ÉTAPE 3 : Vérifier (2 minutes)

1. Attendez que le déploiement se termine (voyant vert ✓ sur Vercel)
2. Ouvrez votre site : `https://votre-projet.vercel.app`
3. Connectez votre wallet : `578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf`
4. Allez dans **Lock/Unlock**
5. **Votre solde devrait afficher : 100,000 $BACK** 🎉

---

## 🔍 Informations du nouveau token

| Info | Valeur |
|------|--------|
| **Mint** | `8sQq53Up7KooCTygi8Dk3Gt8XDeUN5BVLNi5h6Skz43P` |
| **Network** | Devnet |
| **Type** | Token-2022 |
| **Supply** | 100,000 $BACK |
| **Votre ATA** | `GnMN1acTTTSPDuYcENPnvLYDbUSN2KiR8y2ov8e1fiF1` |

---

## 🐛 Si le solde reste à 0

1. **Vider le cache** : Ctrl+Shift+R (Windows) ou Cmd+Shift+R (Mac)
2. **Vérifier les variables** : Retournez sur Vercel → Environment Variables
3. **Reconnecter le wallet** : Déconnectez puis reconnectez
4. **Vérifier la console** : F12 → Console, chercher des erreurs

---

## 📞 Besoin d'aide ?

**Vérifier que tout est OK :**
```bash
# Vérifier votre balance on-chain
spl-token balance 8sQq53Up7KooCTygi8Dk3Gt8XDeUN5BVLNi5h6Skz43P \
  --owner 578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf \
  --url devnet
```

Devrait afficher : `100000`

