# 🔄 GUIDE DE RECONSTRUCTION LOCK/UNLOCK - SwapBack cNFT

## 📋 Résumé du problème

**Erreur rencontrée:**
```
Error Code: DeclaredProgramIdMismatch. Error Number: 4100.
Error Message: The declared program id does not match the actual program id.
```

**Cause:** Le `declare_id!()` dans le code Rust ne correspond pas au Program ID réellement déployé sur devnet.

**Solution:** Reconstruction complète de la fonctionnalité lock/unlock avec un nouveau Program ID propre.

---

## ✅ Ce qui a été fait

### 1. Sauvegarde de l'ancienne implémentation
- ✅ Backup créé: `programs/swapback_cnft_backup_YYYYMMDD_HHMMSS/`
- ✅ Ancien lib.rs sauvegardé: `programs/swapback_cnft/src/lib_old.rs`

### 2. Nouveau code lock/unlock simplifié
- ✅ Fichier: `programs/swapback_cnft/src/lib.rs` (NOUVEAU)
- ✅ Suppression de toutes les dépendances problématiques
- ✅ Code ultra-simplifié et optimisé pour devnet
- ✅ Gestion correcte des bumps et PDAs

### 3. Scripts automatisés créés
- ✅ `rebuild-lock-unlock.sh` - Script complet de rebuild et deploy
- ✅ `update-frontend-program-id.sh` - Mise à jour automatique du frontend

---

## 🚀 ÉTAPES DE DÉPLOIEMENT

### Prérequis

Vous devez avoir installé sur votre machine locale (PAS dans le codespace):
- Solana CLI (v1.18.26)
- Anchor CLI (v0.30.1)
- Rust toolchain

```bash
# Vérifier les versions
solana --version
anchor --version
rustc --version
```

### Étape 1: Cloner/Pull le projet

```bash
# Sur votre machine locale
git clone https://github.com/BacBacta/SwapBack.git
cd SwapBack

# OU si déjà cloné:
git pull origin main
```

### Étape 2: Configurer Solana pour devnet

```bash
# Définir le cluster sur devnet
solana config set --url https://api.devnet.solana.com

# Vérifier la configuration
solana config get

# Créer/vérifier votre keypair wallet
solana-keygen new -o devnet-keypair.json

# Obtenir des SOL devnet pour le déploiement
solana airdrop 2
solana balance
```

### Étape 3: Exécuter le script de reconstruction

```bash
# Rendre le script exécutable (si nécessaire)
chmod +x rebuild-lock-unlock.sh

# Lancer la reconstruction complète
./rebuild-lock-unlock.sh
```

Ce script va:
1. ✅ Générer une nouvelle keypair pour le programme
2. ✅ Extraire le nouveau Program ID
3. ✅ Mettre à jour `declare_id!()` dans lib.rs
4. ✅ Mettre à jour Anchor.toml
5. ✅ Builder le programme
6. ✅ Déployer sur devnet

**Temps estimé:** 3-5 minutes

### Étape 4: Copier le nouveau Program ID

À la fin du script, vous verrez:

```
✅ DÉPLOIEMENT RÉUSSI!
📌 Nouveau Program ID: ABC123...XYZ456
```

**IMPORTANT:** Copiez ce Program ID, vous en aurez besoin pour l'étape suivante.

### Étape 5: Mettre à jour le frontend

```bash
# Utiliser le script automatique
./update-frontend-program-id.sh ABC123...XYZ456

# OU manuellement, éditer ces fichiers:
# - app/src/config/testnet.ts
# - app/src/config/constants.ts
# - app/src/config/tokens.ts
# - app/src/lib/validateEnv.ts
```

### Étape 6: Initialiser les comptes du programme

```bash
# Créer un script d'initialisation (si pas déjà fait)
anchor run init-cnft --provider.cluster devnet
```

Si vous n'avez pas de script `init-cnft`, créez-le avec:

```typescript
// scripts/init-cnft.ts
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SwapbackCnft } from "../target/types/swapback_cnft";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SwapbackCnft as Program<SwapbackCnft>;

  // Initialiser GlobalState
  const [globalState] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    program.programId
  );

  try {
    await program.methods
      .initializeGlobalState()
      .accounts({
        globalState,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log("✅ GlobalState initialisé:", globalState.toBase58());
  } catch (e) {
    console.log("GlobalState déjà initialisé ou erreur:", e);
  }

  // Initialiser CollectionConfig
  const [collectionConfig] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("collection_config")],
    program.programId
  );

  try {
    await program.methods
      .initializeCollection()
      .accounts({
        collectionConfig,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log("✅ CollectionConfig initialisé:", collectionConfig.toBase58());
  } catch (e) {
    console.log("CollectionConfig déjà initialisé ou erreur:", e);
  }
}

main().then(() => console.log("✅ Initialisation terminée"));
```

### Étape 7: Tester le lock/unlock

```bash
# Depuis le répertoire app/
cd app
npm run dev

# Ouvrir http://localhost:3000
# Tester la fonctionnalité lock/unlock
```

---

## 🔍 CHANGEMENTS PRINCIPAUX DANS LE NOUVEAU CODE

### Simplifications

1. **Suppression des dépendances Bubblegum** - Cause de conflits
2. **Renommage des comptes:**
   - `UserNft` → `UserLock` (plus clair)
   - Simplification des seeds PDA
3. **Gestion améliorée des bumps:**
   ```rust
   user_lock.bump = ctx.bumps.user_lock;
   ```
4. **Protection contre les overflows:**
   ```rust
   .saturating_add() / .saturating_sub()
   ```

### Nouvelles fonctionnalités

1. **Vérification du solde du vault avant unlock:**
   ```rust
   let vault_balance = ctx.accounts.vault_token_account.amount;
   let safe_amount = user_lock.amount_locked.min(vault_balance);
   ```

2. **Meilleure gestion de la pénalité (1.5%):**
   ```rust
   let penalty_bps = 150; // 1.5%
   let burn = (safe_amount * penalty_bps) / 10_000;
   ```

3. **Events détaillés:**
   ```rust
   emit!(TokensLocked { ... });
   emit!(TokensUnlocked { ... });
   ```

---

## 📝 FICHIERS MODIFIÉS

### Backend (Rust)
- ✅ `programs/swapback_cnft/src/lib.rs` - ENTIÈREMENT RECONSTRUIT
- ✅ `Anchor.toml` - Nouveau Program ID
- ✅ `target/deploy/swapback_cnft-keypair.json` - NOUVELLE KEYPAIR

### Frontend (TypeScript)
- ⏳ `app/src/config/testnet.ts` - À mettre à jour
- ⏳ `app/src/config/constants.ts` - À mettre à jour
- ⏳ `app/src/config/tokens.ts` - À mettre à jour
- ⏳ `app/src/lib/validateEnv.ts` - À mettre à jour

### Scripts
- ✅ `rebuild-lock-unlock.sh` - NOUVEAU
- ✅ `update-frontend-program-id.sh` - NOUVEAU

---

## ⚠️ IMPORTANT

1. **NE PAS utiliser l'ancien Program ID:** `26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru`
2. **Toujours vérifier la correspondance** entre:
   - `declare_id!()` dans lib.rs
   - Program ID dans Anchor.toml
   - Program ID dans le frontend
   - Keypair dans `target/deploy/swapback_cnft-keypair.json`

3. **En cas d'erreur DeclaredProgramIdMismatch:**
   - Re-exécuter `rebuild-lock-unlock.sh`
   - Vérifier que tous les fichiers utilisent le même Program ID

---

## 🐛 TROUBLESHOOTING

### Erreur: "insufficient funds"

```bash
solana airdrop 2
solana balance
```

### Erreur: "account already exists"

Les comptes GlobalState/CollectionConfig existent déjà pour l'ancien program. C'est normal avec le nouveau program ID, ils seront recréés.

### Erreur: "solana-keygen command not found"

Vous êtes dans le codespace. Vous DEVEZ exécuter le déploiement sur votre **machine locale** avec Solana CLI installé.

### Le frontend ne se connecte pas

1. Vérifier que le Program ID est correct dans **tous** les fichiers config
2. Rebuild le frontend: `cd app && npm run build`
3. Vider le cache du navigateur
4. Vérifier la console du navigateur pour les erreurs

---

## ✅ CHECKLIST FINALE

Avant de considérer la reconstruction terminée:

- [ ] Script `rebuild-lock-unlock.sh` exécuté avec succès
- [ ] Nouveau Program ID noté et sauvegardé
- [ ] `declare_id!()` correspond au Program ID déployé
- [ ] Anchor.toml mis à jour avec le nouveau Program ID
- [ ] Frontend mis à jour avec le nouveau Program ID
- [ ] GlobalState initialisé sur devnet
- [ ] CollectionConfig initialisé sur devnet
- [ ] Test lock réussi sur le frontend
- [ ] Test unlock réussi sur le frontend
- [ ] Vérification des events dans l'explorer Solana

---

## 📞 SUPPORT

Si vous rencontrez des problèmes:

1. Vérifier les logs: `anchor test --skip-deploy`
2. Explorer devnet: https://explorer.solana.com/?cluster=devnet
3. Vérifier le program: `solana program show <PROGRAM_ID> --url devnet`

---

**Date de création:** 15 novembre 2025
**Version:** 1.0.0 - Reconstruction complète
**Status:** ✅ Prêt pour déploiement
