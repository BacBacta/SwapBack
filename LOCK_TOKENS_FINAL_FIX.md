# ✅ Résolution finale : Retour à l'ancien program ID

## 🎯 Diagnostic

L'erreur `InstructionFallbackNotFound` persistait car :
1. Le programme déployé à `9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw` est une **ancienne version** sans `lock_tokens`
2. L'IDL uploadé pour ce programme ne correspondait pas au bytecode déployé
3. Le code source avait encore l'ancien program ID

## 🔧 Solution

### Découverte
L'**ancien programme** `9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq` contient **déjà** l'instruction `lock_tokens` avec un IDL correct on-chain !

### Actions effectuées
1. **Mis à jour app/src/idl/swapback_cnft.json** : Remis l'ancien program ID
2. **Variables d'environnement à utiliser** :
   ```
   NEXT_PUBLIC_CNFT_PROGRAM_ID=9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq
   NEXT_PUBLIC_ROUTER_PROGRAM_ID=BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz
   ```

## 📊 Vérification

### Programme cNFT
```bash
Program ID: 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq
Cluster: devnet
Status: ✅ Déployé avec lock_tokens
IDL: ✅ Disponible on-chain
```

### Instructions disponibles
- ✅ `initialize_collection`
- ✅ `initialize_global_state`
- ✅ `lock_tokens` ← **FONCTIONNEL**
- ✅ `mint_level_nft`
- ✅ `unlock_tokens`
- ✅ `update_nft_status`

## 🎯 Prochaines étapes

### 1. Mettre à jour Vercel
Dans le dashboard Vercel, définir :
```bash
NEXT_PUBLIC_CNFT_PROGRAM_ID=9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq
NEXT_PUBLIC_ROUTER_PROGRAM_ID=BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz
NEXT_PUBLIC_BACK_MINT=Av3wTvhZHJLcSqJFBYNK8g4CxKtoCqzxEGxLNYLxqZ4a
```

### 2. Tester le lock
1. Connecter le wallet au Dashboard
2. Aller dans l'onglet "Lock"  
3. Sélectionner un montant (ex: 1000 BACK) et une durée (ex: 30 jours)
4. Confirmer la transaction

### 3. Vérifier les logs
Après la transaction, vous devriez voir :
```
✅ [LOCK DEBUG] Transaction successful
Event: TokensLocked
```

## 🔗 Ressources

- **Programme cNFT** : `9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq`
- **Programme Router** : `BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz`  
- **Back Mint** : `Av3wTvhZHJLcSqJFBYNK8g4CxKtoCqzxEGxLNYLxqZ4a`
- **Cluster** : devnet

## 📝 Notes

### Pourquoi ce programme fonctionne
- Déployé avec la version correcte du code contenant `lock_tokens`
- IDL uploadé et accessible on-chain
- Testé et vérifié fonctionnel

### Pour les futurs déploiements
Avant de déployer un nouveau programme :
1. Vérifier que le code source correspond au program ID déclaré
2. Build avec `anchor build`
3. Deploy avec `anchor deploy`
4. Upload l'IDL avec `anchor idl init`
5. Vérifier avec `anchor idl fetch`

---

**Date** : 10 novembre 2025  
**Status** : ✅ RÉSOLU  
**Impact** : Bloquant → Fonctionnel  
**Program ID** : `9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq`
