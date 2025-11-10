# 🔍 Diagnostic Vercel - Étapes de Debug

## Variables Vercel (✅ Confirmées correctes)
```
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_CNFT_PROGRAM_ID=9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq
NEXT_PUBLIC_ROUTER_PROGRAM_ID=BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz
NEXT_PUBLIC_BUYBACK_PROGRAM_ID=EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf
NEXT_PUBLIC_BACK_MINT=862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux
NEXT_PUBLIC_USDC_MINT=BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR
NEXT_PUBLIC_MERKLE_TREE=93Tzc7btocwzDSbscW9EfL9dBzWLx85FHE6zeWrwHbNT
NEXT_PUBLIC_COLLECTION_CONFIG=5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom
```

## 🎯 Étapes de Debug

### 1. Récupérer l'erreur exacte
Sur Vercel, ouvre ton Dashboard et fais :

**A) Dans la Console Navigateur (F12)**
```
1. Ouvre https://ton-app.vercel.app
2. Appuie sur F12
3. Va dans l'onglet "Console"
4. Connecte ton wallet
5. Copie TOUTE l'erreur (stack trace complète)
```

**B) Dans les Logs Vercel**
```
1. Va sur Vercel Dashboard
2. Clique sur ton deployment
3. Va dans "Functions" ou "Logs"
4. Cherche les erreurs rouges
5. Copie le message d'erreur complet
```

### 2. Vérifier le Build
```
1. Sur Vercel → Deployments
2. Clique sur le dernier deployment
3. Va dans "Build Logs"
4. Cherche les warnings ou erreurs
```

### 3. Questions Critiques

**L'erreur se produit :**
- [ ] Au chargement de la page ?
- [ ] Lors de la connexion du wallet ?
- [ ] Lors d'une action spécifique (lock, swap, etc.) ?

**Type d'erreur :**
- [ ] "client-side exception" ?
- [ ] ReferenceError: X is not defined ?
- [ ] Error: Invalid program ID ?
- [ ] Autre (préciser) ?

## 🔧 Solutions Possibles

### Si l'erreur est "Cannot read properties of undefined"
→ Problème de chargement des env variables côté client
→ Vérifier que toutes les variables commencent par `NEXT_PUBLIC_`

### Si l'erreur est "Invalid program ID"
→ Problème de validation dans validateEnv.ts
→ Vérifier que les IDL matchent les variables Vercel

### Si l'erreur est dans lockTokens.ts ou dca.ts
→ Problème de lazy loading des env
→ Les helpers `getCnftProgramId()` et `getBackMint()` doivent être utilisés

## 📋 Checklist Avant Debug
- [x] Variables Vercel définies avec NEXT_PUBLIC_ prefix
- [x] IDL addresses correspondent aux program IDs
- [x] BACK_MINT existe sur devnet (Token-2022)
- [ ] Redeploy fait SANS cache
- [ ] Erreur exacte récupérée depuis Console/Logs
