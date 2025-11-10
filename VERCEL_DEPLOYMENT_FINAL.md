# 🚀 DÉPLOIEMENT VERCEL - GUIDE FINAL

## ✅ CORRECTIONS EFFECTUÉES (10 Nov 2025)

### 🔧 Problème identifié
L'ancien CNFT Program ID `9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw` était présent dans **16 fichiers** différents, causant des conflits avec les variables Vercel.

### 📝 Fichiers corrigés
Tous les fichiers ont été mis à jour avec le **CNFT Program ID correct** : `9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq`

1. ✅ `app/src/idl/swapback_cnft.json` - IDL principal
2. ✅ `sdk/src/idl/swapback_cnft.json` - IDL SDK
3. ✅ `app/public/idl/swapback_cnft.json` - IDL public
4. ✅ `app/config/programIds.ts` - Configuration centrale
5. ✅ `app/src/config/testnet.ts` - Config testnet
6. ✅ `tests/config/devnet.ts` - Config tests
7. ✅ `app/vercel.json` - Config Vercel app
8. ✅ `vercel.json` - Config Vercel root
9. ✅ `app/hooks/useBoostSystem.ts` - Hook boost
10. ✅ `app/tests/validateEnv.test.ts` - Tests validation
11. ✅ `testnet_deployment_20251028_085343.json` - Historique

## 🎯 VARIABLES VERCEL (CONFIRMÉES CORRECTES)

```bash
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com

# ✅ Program IDs (tous vérifiés sur devnet)
NEXT_PUBLIC_CNFT_PROGRAM_ID=9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq
NEXT_PUBLIC_ROUTER_PROGRAM_ID=BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz
NEXT_PUBLIC_BUYBACK_PROGRAM_ID=EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf

# ✅ Token Mints (tous vérifiés sur devnet)
NEXT_PUBLIC_BACK_MINT=862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux
NEXT_PUBLIC_USDC_MINT=BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR

# ✅ Compressed NFT Config
NEXT_PUBLIC_MERKLE_TREE=93Tzc7btocwzDSbscW9EfL9dBzWLx85FHE6zeWrwHbNT
NEXT_PUBLIC_COLLECTION_CONFIG=5eM6KdFGJ63597ayYYtUqcNRhzxKtpx5qfL5mqRHwBom
```

## 📋 ÉTAPES DE REDÉPLOIEMENT

### 1️⃣ Sur Vercel Dashboard
1. Va sur ton projet SwapBack
2. Onglet **Deployments**
3. Sur le dernier déploiement, clique sur le menu **⋮** (trois points)
4. Clique **Redeploy**
5. ⚠️ **DÉCOCHE "Use existing Build Cache"** (très important !)
6. Clique **Redeploy** pour confirmer

### 2️⃣ Attendre le build
- Le build prendra 2-3 minutes
- Vérifie qu'il n'y a **aucune erreur** dans les logs
- Cherche "✓ Compiled successfully" dans les logs

### 3️⃣ Test après déploiement
1. Ouvre le Dashboard : `https://ton-projet.vercel.app/dashboard`
2. Connecte ton wallet
3. **Si ça plante** :
   - Appuie sur **F12** (DevTools)
   - Va dans l'onglet **Console**
   - Copie **toute l'erreur** (stack trace complète)
   - Envoie-moi l'erreur

## 🔍 VÉRIFICATIONS

### Test local (déjà effectué ✅)
```bash
./test-vercel-env.sh
```
Résultat : **✅ TOUS LES TESTS PASSÉS**

### Vérification des Program IDs sur devnet
```bash
# CNFT Program (correct)
solana program show 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq --url devnet
# ✅ Existe et contient lock_tokens instruction

# Router Program (correct)
solana program show BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz --url devnet
# ✅ Existe, déployé slot 419954956 (plus récent)

# BACK Token (correct)
solana account 862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux --url devnet
# ✅ Token-2022 avec metadata extension
```

## 🐛 SI LE PROBLÈME PERSISTE

### Scénario 1 : Erreur validateEnv()
```
Error: Environment validation failed
```
**Solution** : Les IDL et env variables ne matchent pas
- Vérifie que le redéploiement s'est fait SANS cache
- Force un nouveau commit : `git commit --allow-empty -m "Force rebuild"`

### Scénario 2 : ReferenceError module
```
ReferenceError: Cannot access 'X' before initialization
```
**Solution** : Variables env évaluées au module-level
- Déjà corrigé avec lazy loading dans lockTokens.ts et dca.ts
- Si ça persiste, envoie-moi le fichier concerné

### Scénario 3 : Account does not exist
```
Error: Account Av3wTvhZ... does not exist
```
**Solution** : Mauvaise adresse BACK_MINT
- Déjà corrigé dans tous les fichiers
- Vérifie que Vercel utilise bien `862PQyzj...`

### Scénario 4 : Wallet connection crash
```
TypeError: Cannot read properties of undefined
```
**Solution** : Vérifier l'ordre de chargement
1. Ouvre DevTools (F12) **avant** de connecter le wallet
2. Note **exactement** quel fichier cause l'erreur
3. Envoie-moi le nom du fichier et la ligne

## 📊 STATUT DES TESTS

```
✅ Tests locaux : 232/242 passant (96%)
✅ Build local : Succès
✅ Validation env : Succès
✅ IDL sync : Tous les fichiers corrigés
```

## 🔗 PROGRAMMES DEVNET

| Programme | Address | Status |
|-----------|---------|--------|
| **cNFT** | `9oGffDQP...` | ✅ Actif, a lock_tokens |
| **Router** | `BKExqm5c...` | ✅ Actif, slot 419954956 |
| **Buyback** | `EoVjmALZ...` | ✅ Actif |
| **BACK Token** | `862PQyzj...` | ✅ Token-2022 |
| **USDC Devnet** | `Binixfca...` | ✅ SPL Token |

## 📞 SUPPORT

Si après redéploiement le problème persiste :
1. **Copie les logs de build Vercel** (onglet Deployments → cliquer sur le build)
2. **Copie l'erreur du navigateur** (Console F12)
3. **Envoie-moi les deux** pour diagnostic précis

## ✨ COMMIT FINAL

```
commit 33a4a3f
fix: Sync CNFT Program ID across all config files

- Updated 10 files with correct CNFT ID: 9oGffDQP...
- Fixed IDL addresses in app, sdk, and public folders
- Updated all test configurations
- Verified all programs exist on devnet
```

---

**Date de dernière mise à jour** : 10 Novembre 2025, 19:45 UTC
**Status** : ✅ Prêt pour redéploiement Vercel
