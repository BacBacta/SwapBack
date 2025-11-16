# Fix de l'instruction lock_tokens - 2025

## Problème Initial
L'erreur `InstructionFallbackNotFound` (0x65) se produisait lors de la tentative de lock de tokens BACK.

**Cause racine** : Le frontend appelait `mintLevelNft()` mais le programme Rust déployé utilise `lock_tokens()`.

## Solutions Appliquées

### 1. Mise à jour du frontend (lockTokens.ts)
✅ **Changement de l'instruction** : `mintLevelNft()` → `lockTokens()`
✅ **Changement du PDA** : `user_nft` → `user_lock`
✅ **Programme Token** : `TOKEN_2022_PROGRAM_ID` → `TOKEN_PROGRAM_ID` (BACK utilise SPL Token standard)
✅ **Import ajouté** : `TOKEN_PROGRAM_ID` dans les imports

### 2. Mise à jour de l'IDL (swapback_cnft.json)
✅ **Instruction renommée** : `mint_level_nft` → `lock_tokens`
✅ **Comptes mis à jour** :
   - Ajout de `user_lock` (au lieu de `user_nft`)
   - Ajout de `user_token_account`
   - Ajout de `vault_token_account`
   - Ajout de `vault_authority`
   - Ajout de `back_mint`
   - Ajout de `token_program`
   - Ajout de `associated_token_program`
✅ **Arguments corrects** : `amount` (u64), `lock_duration` (i64)

### 3. Création du vault token account
✅ **Script créé** : `create-vault-token-account.js`
✅ **Vault initialisé** sur devnet :
   - Authority PDA : `EuDALrkvtLAe1JSoqWfGHEsoYEFZeFsQHEarJgPSuPXM`
   - Token Account : `HW9mj8oEkcbc6xAYQ3qiGxP9vmV3B2frgYu98s4rE3LE`
   - Owner : `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` (SPL Token)
   - Signature : `4AxQk4z5KzbTYoM29n4SVphXYZ1xZZronNq8XeXG2kTsoC3j7nAMLhnvinqTYYQFMQ64Fsrj2kqWwHJ5C4XP7wvd`

## Configuration Actuelle

### Programme cNFT
- **Program ID** : `GEkXCcq87yUjQSp5EqcWf7bw9GKrB39A1LWdsE7V3V2E`
- **Déployé sur** : devnet
- **Instruction active** : `lock_tokens(amount: u64, lock_duration: i64)`
- **Accounts struct** : `LockTokens` avec 11 comptes

### Token BACK
- **Mint** : `6tFCrUr3mZpL3BzNV2cLjYDkoL7toYA74TpMCSxFg45E`
- **Decimals** : 6 (pas 9!)
- **Programme** : SPL Token standard (`TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`)
- **Solde wallet** : 100,000 BACK

### PDAs Utilisés
```
collection_config = PDA(seeds=[b"collection_config"], program=CNFT_PROGRAM_ID)
global_state = PDA(seeds=[b"global_state"], program=CNFT_PROGRAM_ID)
user_lock = PDA(seeds=[b"user_lock", user.key()], program=CNFT_PROGRAM_ID)
vault_authority = PDA(seeds=[b"vault_authority"], program=CNFT_PROGRAM_ID)
```

## Commits Effectués
1. `c3237fc` - fix: Update frontend to use lock_tokens instruction instead of mint_level_nft
2. `0341d9a` - feat: Add script to create vault token account
3. `6b62857` - fix: Correct lock_tokens discriminator in IDL
4. `40a0ed8` - fix: Remove tree_config from initialize_collection IDL

## Infrastructure Initialisée ✅

### Global State
- **PDA** : `2vmw8vTqGUiFe5KGpdyj8FVq3cfUN3JK3oxQ46xhhDyx`
- **Status** : ✅ Initialisé
- **Signature** : `5or1m71xd5c1hyHy76eXLox8jG6g61nTr3Qizfgf3cWMX6uexKFdCBTd4vA55Ay9Zz6BR9j8ZEgpP4x5WrfVLh6D`

### Collection Config
- **PDA** : `FpxruDMjZQs7XQs2f3KrYVCnC9E4Xn1rB2DJShVrcttQ`
- **Status** : ✅ Initialisé
- **Signature** : `2vvYS9yRCZG8b6RRdoHi7zcZyRFPE3RCd9Btvfffa7zUxWef4GyNtguwtNgiwmszTKEizD2n1B6595Gvon6GMsxP`

### Vault Token Account
- **Address** : `HW9mj8oEkcbc6xAYQ3qiGxP9vmV3B2frgYu98s4rE3LE`
- **Status** : ✅ Créé
- **Signature** : `4AxQk4z5KzbTYoM29n4SVphXYZ1xZZronNq8XeXG2kTsoC3j7nAMLhnvinqTYYQFMQ64Fsrj2kqWwHJ5C4XP7wvd`

## Prochaines Étapes

### ✅ COMPLÉTÉ
- [x] Corriger l'instruction frontend (lockTokens au lieu de mintLevelNft)
- [x] Corriger le discriminator dans l'IDL (136,11,32,232,161,117,54,211)
- [x] Créer le vault token account
- [x] Initialiser global_state
- [x] Initialiser collection_config
- [x] Tous les commits poussés sur GitHub

### À Tester sur Vercel
1. **Redéployer sur Vercel** pour récupérer les changements
   - Nouveau build avec IDL corrigé
   - Discriminator correct pour lock_tokens
   - Instruction unlock_tokens ajoutée à l'IDL
   
2. **Vérifier** que les tokens BACK s'affichent correctement (100,000 avec 6 decimals)

3. **Tester le lock** :
   - Connecter le wallet `DAdb3ArBvhJ77trTRUs5wbHARGXdupoAgjSYCHpkt6gP`
   - Essayer de lock des tokens
   - **DEVRAIT MAINTENANT FONCTIONNER** ✅

### Vérifications Nécessaires
- [ ] Les 100k BACK tokens s'affichent dans l'UI
- [ ] Le bouton de lock est actif
- [ ] La transaction de lock réussit
- [ ] Le user_lock PDA est créé
- [ ] Les tokens sont transférés au vault
- [ ] Le boost est calculé correctement
- [ ] Les statistiques globales sont mises à jour

### En Cas d'Erreur
**Si l'erreur persiste après redéploiement Vercel** :
- Vérifier que le cache CDN est vidé (peut prendre quelques minutes)
- Vérifier les logs Vercel pour confirmer le nouveau build
- Tester en mode navigation privée pour éviter le cache navigateur

**Si AccountOwnedByWrongProgram** :
- Vérifier que `TOKEN_PROGRAM_ID` est bien utilisé (pas TOKEN_2022_PROGRAM_ID)
- Vérifier que les ATAs sont créés avec le bon programme

**Si InstructionMismatch ou InvalidInstructionData** :
- Vérifier que les types des arguments matchent : `amount` doit être BN (u64), `lock_duration` doit être BN (i64)
- Vérifier que tous les comptes requis sont fournis dans le bon ordre

**Si DeclaredProgramIdMismatch (0x1004)** :
- Vérifier que declare_id! dans lib.rs matche l'adresse déployée
- Notre programme : GEkXCcq87yUjQSp5EqcWf7bw9GKrB39A1LWdsE7V3V2E ✅

## Ressources
- [Programme sur Explorer](https://explorer.solana.com/address/GEkXCcq87yUjQSp5EqcWf7bw9GKrB39A1LWdsE7V3V2E?cluster=devnet)
- [BACK Mint sur Explorer](https://explorer.solana.com/address/6tFCrUr3mZpL3BzNV2cLjYDkoL7toYA74TpMCSxFg45E?cluster=devnet)
- [Vault Token Account](https://explorer.solana.com/address/HW9mj8oEkcbc6xAYQ3qiGxP9vmV3B2frgYu98s4rE3LE?cluster=devnet)
- [Wallet de test](https://explorer.solana.com/address/DAdb3ArBvhJ77trTRUs5wbHARGXdupoAgjSYCHpkt6gP?cluster=devnet)

## Notes Importantes
⚠️ **BACK utilise 6 decimals**, pas 9 ! Toutes les conversions doivent utiliser `TOKEN_DECIMALS` (6).

⚠️ **BACK utilise SPL Token standard**, pas Token-2022. Toujours utiliser `TOKEN_PROGRAM_ID`.

⚠️ Le **vault doit être créé avant le premier lock**. Le script `create-vault-token-account.js` le fait automatiquement.

⚠️ Les **PDAs doivent être dérivés avec les bonnes seeds** : `user_lock` (pas `user_nft`).
