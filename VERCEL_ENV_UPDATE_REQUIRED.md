# ✅ MISE À JOUR : Variables d'Environnement Vercel

## ✅ Résolution

L'ancien program ID cNFT (`9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq`) est **correct** et contient déjà l'instruction `lock_tokens` !

## ✅ Variables Correctes (À UTILISER)

```
NEXT_PUBLIC_CNFT_PROGRAM_ID = 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq
NEXT_PUBLIC_ROUTER_PROGRAM_ID = BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz
NEXT_PUBLIC_BACK_MINT = Av3wTvhZHJLcSqJFBYNK8g4CxKtoCqzxEGxLNYLxqZ4a
NEXT_PUBLIC_SOLANA_NETWORK = devnet
NEXT_PUBLIC_SOLANA_RPC_URL = https://api.devnet.solana.com
```

## 📝 Instructions (Si différent sur Vercel)

1. **Aller sur Vercel Dashboard** : https://vercel.com/dashboard
2. **Sélectionner votre projet SwapBack**
3. **Aller dans Settings → Environment Variables**
4. **Vérifier les variables suivantes** :
   - `NEXT_PUBLIC_CNFT_PROGRAM_ID` = `9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq` ✅
   - `NEXT_PUBLIC_ROUTER_PROGRAM_ID` = `BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz` ✅
   - `NEXT_PUBLIC_BACK_MINT` = `Av3wTvhZHJLcSqJFBYNK8g4CxKtoCqzxEGxLNYLxqZ4a` ✅
5. **Si différent, mettre à jour et redéployer**

## 🔍 Vérification

Après le redéploiement, vérifier que :
- Le Dashboard se charge sans erreur avec wallet connecté ✅
- Les logs de la console montrent les bons Program IDs ✅
- Les transactions fonctionnent correctement ✅

## 📚 Référence

- Fichier de déploiement : `DEPLOYED_PROGRAM_IDS.txt`
- Explorer Solana (CNFT) : https://explorer.solana.com/address/9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw?cluster=devnet
- Explorer Solana (Router) : https://explorer.solana.com/address/GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt?cluster=devnet

## ⚠️ Important

**NE PAS** utiliser les anciens Program IDs. Le programme `9oGffDQP...` n'existe plus sur devnet.
