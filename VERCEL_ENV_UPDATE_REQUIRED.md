# 🔴 MISE À JOUR REQUISE : Variables d'Environnement Vercel

## Problème Actuel

Les variables d'environnement Vercel utilisent les **anciens** Program IDs qui ne correspondent plus aux programmes déployés sur devnet.

## ❌ Anciennes Variables (À REMPLACER)

```
NEXT_PUBLIC_CNFT_PROGRAM_ID = 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq
NEXT_PUBLIC_ROUTER_PROGRAM_ID = BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz
```

## ✅ Nouvelles Variables (Déploiement du 26 Oct 2025)

```
NEXT_PUBLIC_CNFT_PROGRAM_ID = 9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw
NEXT_PUBLIC_ROUTER_PROGRAM_ID = GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt
NEXT_PUBLIC_BACK_MINT = 862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux
NEXT_PUBLIC_COLLECTION_CONFIG = 5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom
NEXT_PUBLIC_SOLANA_NETWORK = devnet
NEXT_PUBLIC_SOLANA_RPC_URL = https://api.devnet.solana.com
```

## 📝 Instructions de Mise à Jour sur Vercel

1. **Aller sur Vercel Dashboard** : https://vercel.com/dashboard
2. **Sélectionner votre projet SwapBack**
3. **Aller dans Settings → Environment Variables**
4. **Modifier les variables suivantes** :
   - `NEXT_PUBLIC_CNFT_PROGRAM_ID` → `9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw`
   - `NEXT_PUBLIC_ROUTER_PROGRAM_ID` → `GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt`
5. **Sauvegarder les modifications**
6. **Redéployer l'application** : Settings → Deployments → Redeploy

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
