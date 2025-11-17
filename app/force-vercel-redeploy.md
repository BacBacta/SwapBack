# 🚀 FORCER LE REDÉPLOIEMENT VERCEL

## Problème
Les variables d'environnement sont à jour sur Vercel, mais le bundle JS déployé contient encore les anciennes valeurs compilées.

## Solution : Forcer un redéploiement

### Option 1 : Via l'interface Vercel (RECOMMANDÉ)
1. Va sur https://vercel.com/dashboard
2. Sélectionne ton projet SwapBack
3. Onglet "Deployments"
4. Trouve le dernier déploiement (commit ced840d)
5. Clique sur les 3 points ⋯ → **"Redeploy"**
6. Confirme avec **"Redeploy"** (pas "Redeploy with existing Build Cache")

### Option 2 : Pousser un commit vide
```bash
git commit --allow-empty -m "chore: force Vercel rebuild with new env vars"
git push origin main
```

## Vérification après redéploiement
Une fois le build terminé (2-3 minutes), vérifie :
```bash
# Dans la console browser de l'app déployée :
console.log(process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID)
# Devrait afficher : 36oiDSdezLJVJp7pYN1ii1PuFepXjDD6NeSHrNc9yLaB
```

## Variables Vercel confirmées ✅
- NEXT_PUBLIC_CNFT_PROGRAM_ID=36oiDSdezLJVJp7pYN1ii1PuFepXjDD6NeSHrNc9yLaB
- NEXT_PUBLIC_BACK_MINT=862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux
- NEXT_PUBLIC_COLLECTION_CONFIG=5Lz4eHdqAgVsXu3Antp3TVqncuoCdUj2WEnc6PQuVzMT

## État actuel
- ✅ Code source à jour (commit ced840d)
- ✅ Variables Vercel à jour
- ❌ Bundle déployé utilise encore anciennes valeurs
