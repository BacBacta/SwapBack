# 🔧 Rapport de Progression - Régénération IDL & Script Lock/Unlock Devnet

**Date** : 31 Octobre 2025  
**Session** : Debug PDA cNFT + Fix Bump

---

## 📊 État Actuel

### ✅ Accomplissements

1. **Script Lock/Unlock/Claim créé** : `scripts/devnet-lock-unlock-claim.js`
   - ✅ Connexion devnet fonctionnelle
   - ✅ Dérivation PDA correcte (cNFT + Buyback)
   - ✅ Instruction `mint_level_nft` fonctionne (lock)
   - ❌ Instruction `update_nft_status` échoue (unlock)
   - ⏸️  Instruction `claim` non testée (bloquée par unlock)

2. **Bug identifié dans le programme cNFT déployé**
   - **Problème** : Le `bump` n'est jamais initialisé dans `mint_level_nft`
   - **Symptôme** : `user_nft.bump` reste à 0 (valeur par défaut)
   - **Impact** : Constraint `bump = user_nft.bump` dans `update_nft_status` dérive un PDA différent
   - **Exemple** :
     ```
     Compte créé : Hzs1TSnU1EkSGyCCeMTDvkWAwPv2FUyg5yQpVV3p41xB (bump=254 canonical)
     Bump stocké : 0
     PDA attendu : 6pCxCJxGWoF3r7k26yTXEc4hGN2PChnLj6mHWySbDruj (bump=0)
     => ConstraintSeeds violation (0x7d6)
     ```

3. **Fix appliqué dans le code source**
   - **Fichier** : `programs/swapback_cnft/src/lib.rs`
   - **Ligne** : 62 (fonction `mint_level_nft`)
   - **Changement** :
     ```rust
     user_nft.bump = ctx.bumps.user_nft; // 🔧 FIX: Stocker le bump canonical
     ```

4. **Outils installés**
   - ✅ Solana CLI 2.0.3 (Anza) installé
   - ✅ Rust 1.91.0 stable mis à jour
   - ⚠️  Anchor CLI bloqué par GitHub API rate limit (expire 11:31:59 UTC)

### ❌ Blocages Actuels

1. **Build du programme impossible**
   - `cargo build-sbf` échoue : dépendances incompatibles avec Rust 1.75 (Solana BPF toolchain)
   - `anchor build` bloqué : GitHub API rate limit empêche installation d'Anchor via AVM
   - **Deadline** : Rate limit expire à 11:31:59 UTC (dans ~10 minutes au moment de l'erreur)

2. **Déploiement en attente**
   - Programme cNFT fixé mais non compilé
   - Deux comptes UserNft corrompus sur devnet :
     * `Hzs1...` (wallet `578DG...`) - 50 BACK locked
     * `7x8J8...` (wallet `FdpVz...`) - 100 BACK locked
   - Impossible de les close sans instruction dédiée dans le programme

3. **IDL non régénérés**
   - `target/idl/swapback_cnft.json` non à jour
   - `app/public/idl/*.json` non à jour
   - `sdk/src/idl/*.json` non à jour

---

## 🎯 Actions Nécessaires

### Priority 1 : Rebuild & Redeploy cNFT

1. **Attendre expiration du rate limit GitHub** (11:31:59 UTC)
2. **Installer Anchor CLI** :
   ```bash
   avm install 0.30.1
   avm use 0.30.1
   ```
3. **Build le programme** :
   ```bash
   anchor build --program-name swapback_cnft
   ```
4. **Déployer sur devnet** :
   ```bash
   anchor deploy --program-name swapback_cnft --provider.cluster devnet
   ```
5. **Vérifier le program ID** : `9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw`

### Priority 2 : Test du Script

1. **Créer un nouveau wallet de test** (pour éviter compte corrompu)
2. **Exécuter le script complet** :
   ```bash
   node scripts/devnet-lock-unlock-claim.js /path/to/new/keypair.txt
   ```
3. **Valider les 3 étapes** :
   - ✅ ÉTAPE 1 : Lock (mint cNFT)
   - ✅ ÉTAPE 2 : Unlock (update_nft_status)
   - ✅ ÉTAPE 3 : Claim (buyback distribution)

### Priority 3 : Régénération IDL

1. **Générer les IDL** :
   ```bash
   anchor build --idl target/idl
   ```
2. **Copier vers le frontend** :
   ```bash
   cp target/idl/swapback_cnft.json app/public/idl/
   cp target/idl/swapback_buyback.json app/public/idl/
   cp target/idl/swapback_router.json app/public/idl/
   ```
3. **Copier vers le SDK** :
   ```bash
   cp target/idl/*.json sdk/src/idl/
   ```
4. **Mettre à jour les discriminators** dans `app/scripts/init-*.js` et `sdk/src/*.ts`

---

## 📁 Fichiers Modifiés

### Code Source
- ✅ `programs/swapback_cnft/src/lib.rs` (ligne 62) : Ajout `user_nft.bump = ctx.bumps.user_nft;`

### Scripts de Test
- ✅ `scripts/devnet-lock-unlock-claim.js` : Script complet lock→unlock→claim
- ✅ `scripts/close-corrupted-usernft.js` : Analyse des comptes corrompus
- ✅ `debug-bump.js` : Utilitaire de debug PDA/bump

### Configuration
- ⚠️  `Anchor.toml` : `anchor_version` commenté (workaround temporaire)

### Wallets de Test
- ✅ `devnet-test-keypair.json` : Nouveau wallet FdpVz... (2 SOL)
- ✅ `devnet-test-keypair-base58.txt` : Format base58
- ℹ️  `devnet-keypair-base58.txt` : Wallet principal 578DG... (19.4 SOL)

---

## 🐛 Bugs Corrigés (Code)

1. **`programs/swapback_cnft/src/lib.rs:62`** : Ajout initialisation du bump
   ```rust
   // AVANT (bug)
   user_nft.is_active = true;
   
   // APRÈS (fix)
   user_nft.is_active = true;
   user_nft.bump = ctx.bumps.user_nft; // 🔧 FIX
   ```

2. **`scripts/devnet-lock-unlock-claim.js:216`** : Ajout parsing du bump
   ```javascript
   // Ajouté
   const bump = data.readUInt8(offset);
   return { ...nft, bump };
   ```

---

## 🔄 Prochaines Étapes

1. ⏰ **Attendre 11:32 UTC** → Installer Anchor CLI via AVM
2. 🔨 **Build** → `anchor build --program-name swapback_cnft`
3. 🚀 **Deploy** → `anchor deploy --program-name swapback_cnft`
4. ✅ **Test** → `node scripts/devnet-lock-unlock-claim.js`
5. 📦 **IDL** → Régénérer et copier vers frontend/SDK
6. 📝 **Commit** → Commit des changements avec message clair

---

## 💡 Notes Techniques

### Cause Racine du Bug

Le programme Anchor utilise `#[account(init, ..., bump)]` qui dérive automatiquement le PDA avec le bump canonical, mais **ne stocke PAS automatiquement** le bump dans la structure.

**Règle Anchor** : Toujours assigner manuellement `account.bump = ctx.bumps.account_name;` dans les instructions `init`.

### PDA Derivation

```rust
// Constraint dans update_nft_status
#[account(
    mut,
    seeds = [b"user_nft", user.key().as_ref()],
    bump = user_nft.bump  // ← Utilise le bump STOCKÉ dans le compte
)]
pub user_nft: Account<'info, UserNft>,
```

Anchor re-dérive le PDA côté programme avec `seeds` + `bump` stocké, puis vérifie que le compte fourni correspond.

### Comptes Corrompus

Les comptes `Hzs1...` et `7x8J8...` resteront corrompus jusqu'à ce que :
1. Le programme soit upgradé avec une instruction `close_user_nft`
2. OU les utilisateurs créent de nouveaux comptes avec un wallet différent

**Impact** : Les 150 BACK lockés dans ces comptes sont **inaccessibles** jusqu'au redéploiement.

---

## ✅ Checklist de Validation Post-Deploy

- [ ] Program ID identique : `9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw`
- [ ] Nouveau wallet peut mint un cNFT
- [ ] Le bump stocké est égal au bump canonical (254 généralement)
- [ ] Unlock fonctionne sans ConstraintSeeds error
- [ ] Claim distribue les tokens correctement
- [ ] IDL régénérés et copiés
- [ ] Frontend peut interagir avec les nouveaux IDL
- [ ] Discriminators corrects dans les scripts d'init

---

**Status** : 🟡 EN ATTENTE - Déblocage à 11:32 UTC pour install Anchor CLI
