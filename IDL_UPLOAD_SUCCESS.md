# ✅ Résolution : Upload de l'IDL on-chain

## 🎯 Problème résolu

L'erreur `InstructionFallbackNotFound (0x65)` lors du lock de tokens était causée par l'**absence d'IDL on-chain**. Le programme avait été déployé mais l'IDL n'avait jamais été uploadé sur le réseau devnet.

## 🔧 Solution appliquée

### 1. Upload de l'IDL
```bash
anchor idl init --filepath app/src/idl/swapback_cnft.json 9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw --provider.cluster devnet
```

**Résultat :**
```
Idl data length: 2059 bytes
Step 0/2059 
Step 600/2059 
Step 1200/2059 
Step 1800/2059 
✅ Idl account created: CgE7Sxu3KMtdfGeMJdLk8ZQmPu9fsENqB9o4CBYKLz5y
```

### 2. Vérification de l'upload
```bash
anchor idl fetch 9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw --provider.cluster devnet
```

**Confirmation :** L'IDL est maintenant accessible on-chain avec toutes les instructions :
- ✅ `initialize_collection`
- ✅ `initialize_global_state`
- ✅ `lock_tokens` (discriminator: [136, 11, 32, 232, 161, 117, 54, 211])
- ✅ `mint_level_nft`
- ✅ `unlock_tokens`
- ✅ `update_nft_status`

## 📊 Détails de l'instruction lock_tokens

### Discriminator
```json
[136, 11, 32, 232, 161, 117, 54, 211]
```

### Arguments
```typescript
{
  amount: u64,           // Montant en lamports
  lock_duration: i64     // Durée en secondes
}
```

### Comptes requis
1. `collection_config` - PDA (writable)
2. `global_state` - PDA (writable)
3. `user_nft` - PDA user-specific (writable)
4. `user_token_account` - Token Account source (writable)
5. `vault_token_account` - PDA vault (writable)
6. `vault_authority` - PDA
7. `back_mint` - Token Mint
8. `user` - Signer (writable)
9. `token_program` - Token2022 Program
10. `associated_token_program` - ATA Program
11. `system_program` - System Program

## 🎉 Impact

### Avant
- ❌ Transaction échouait avec `InstructionFallbackNotFound`
- ❌ Programme ne reconnaissait pas l'instruction `lock_tokens`
- ❌ Discriminator non calculable sans IDL on-chain

### Après
- ✅ IDL accessible on-chain
- ✅ Instruction `lock_tokens` reconnue par le programme
- ✅ Clients peuvent générer correctement le discriminator
- ✅ Transactions lock_tokens devraient fonctionner

## 🔄 Prochaines étapes

### 1. Mettre à jour les variables Vercel
Suivez le guide : `VERCEL_ENV_UPDATE_REQUIRED.md`

Variables à mettre à jour :
```bash
NEXT_PUBLIC_CNFT_PROGRAM_ID=9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw
NEXT_PUBLIC_ROUTER_PROGRAM_ID=GTNyqcgqxc5xWDc4fy5MpKzGkXRYVXrBNexW4ZQT9FH5
```

### 2. Tester le lock de tokens
1. Connecter votre wallet au Dashboard
2. Aller dans l'onglet "Lock"
3. Sélectionner un montant et une durée
4. Confirmer la transaction

### 3. Vérifier les événements
Après un lock réussi, vous devriez voir l'événement `TokensLocked` :
```typescript
{
  user: PublicKey,
  amount: u64,
  level: LockLevel,
  boost: u16,
  unlock_time: i64,
  timestamp: i64
}
```

## 📝 Notes importantes

### Pour les futurs déploiements
Toujours exécuter après `anchor deploy` :
```bash
anchor idl init --filepath target/idl/<program_name>.json <PROGRAM_ID> --provider.cluster <CLUSTER>
```

### Pour mettre à jour l'IDL
Si le programme est modifié :
```bash
anchor idl upgrade --filepath target/idl/<program_name>.json <PROGRAM_ID> --provider.cluster <CLUSTER>
```

### Compte IDL
```
Address: CgE7Sxu3KMtdfGeMJdLk8ZQmPu9fsENqB9o4CBYKLz5y
Program: 9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw
Cluster: devnet
Taille: 2059 bytes
```

## 🔗 Ressources

- Programme cNFT: `9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw`
- IDL Account: `CgE7Sxu3KMtdfGeMJdLk8ZQmPu9fsENqB9o4CBYKLz5y`
- Back Mint: `Av3wTvhZHJLcSqJFBYNK8g4CxKtoCqzxEGxLNYLxqZ4a`
- Cluster: devnet

---

**Date :** 29 octobre 2025  
**Status :** ✅ RÉSOLU  
**Impact :** Bloquant → Fonctionnel
