# 🚀 COMMANDES RAPIDES - Reconstruction Lock/Unlock

## ⚡ Déploiement rapide (tout automatique)

```bash
# Sur votre machine locale (PAS dans le codespace)
./rebuild-lock-unlock.sh
```

Cette seule commande fait TOUT :
1. Génère une nouvelle keypair
2. Met à jour le code avec le nouveau Program ID
3. Build le programme
4. Déploie sur devnet

---

## 📝 Commandes étape par étape (manuel)

### 1. Configuration Solana

```bash
# Définir le cluster
solana config set --url https://api.devnet.solana.com

# Vérifier
solana config get

# Obtenir des SOL devnet
solana airdrop 2
solana balance
```

### 2. Génération de la keypair

```bash
# Créer le dossier si nécessaire
mkdir -p target/deploy

# Générer la keypair
solana-keygen new --no-bip39-passphrase -o target/deploy/swapback_cnft-keypair.json --force

# Extraire le Program ID
solana-keygen pubkey target/deploy/swapback_cnft-keypair.json
```

**IMPORTANT:** Copiez ce Program ID pour les étapes suivantes.

### 3. Mise à jour du code

```bash
# Éditer programs/swapback_cnft/src/lib.rs
# Remplacer la ligne 7:
declare_id!("VOTRE_NOUVEAU_PROGRAM_ID");

# OU utiliser sed (Linux/Mac):
NEW_ID=$(solana-keygen pubkey target/deploy/swapback_cnft-keypair.json)
sed -i "s/declare_id!(\"[^\"]*\")/declare_id!(\"${NEW_ID}\")/" programs/swapback_cnft/src/lib.rs
```

### 4. Mise à jour Anchor.toml

```bash
# Éditer Anchor.toml
# Section [programs.devnet], ligne ~19:
swapback_cnft = "VOTRE_NOUVEAU_PROGRAM_ID"

# OU avec sed:
NEW_ID=$(solana-keygen pubkey target/deploy/swapback_cnft-keypair.json)
sed -i "/\[programs.devnet\]/,/swapback_cnft/ s/swapback_cnft = \"[^\"]*\"/swapback_cnft = \"${NEW_ID}\"/" Anchor.toml
```

### 5. Build

```bash
# Avec optimisations pour éviter les problèmes de mémoire
export TMPDIR=/tmp
export CARGO_TARGET_DIR=/tmp/cargo-target
export RUSTFLAGS='-C target-cpu=generic -C opt-level=1'

anchor build --program-name swapback_cnft
```

### 6. Déploiement

```bash
anchor deploy --provider.cluster devnet --program-name swapback_cnft
```

### 7. Mise à jour du frontend

```bash
# Automatique
./update-frontend-program-id.sh VOTRE_NOUVEAU_PROGRAM_ID

# OU manuel - éditer ces fichiers:
# - app/src/config/testnet.ts
# - app/src/config/constants.ts
# - app/src/config/tokens.ts
# - app/src/lib/validateEnv.ts
```

### 8. Initialisation des comptes

```bash
# Compiler le script TypeScript
npm run build  # ou yarn build

# Exécuter l'initialisation
ts-node scripts/init-cnft.ts
```

### 9. Tests

```bash
# Test Anchor
anchor test --skip-deploy

# Test custom
ts-node scripts/test-lock-unlock.ts

# Frontend
cd app
npm run dev
```

---

## 🔍 Commandes de vérification

### Vérifier le déploiement

```bash
# Info sur le programme
solana program show VOTRE_PROGRAM_ID --url devnet

# Solde du programme
solana balance VOTRE_PROGRAM_ID --url devnet

# Logs du programme (en temps réel)
solana logs --url devnet VOTRE_PROGRAM_ID
```

### Vérifier les comptes PDA

```bash
# Avec le CLI Anchor
anchor account GlobalState GLOBAL_STATE_PDA --provider.cluster devnet
anchor account CollectionConfig COLLECTION_CONFIG_PDA --provider.cluster devnet
anchor account UserLock USER_LOCK_PDA --provider.cluster devnet
```

### Calculer les PDAs (pour debug)

```bash
# Dans node ou script TypeScript:
import { PublicKey } from "@solana/web3.js";

const programId = new PublicKey("VOTRE_PROGRAM_ID");

const [globalState] = PublicKey.findProgramAddressSync(
  [Buffer.from("global_state")],
  programId
);

const [collectionConfig] = PublicKey.findProgramAddressSync(
  [Buffer.from("collection_config")],
  programId
);

const [userLock, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from("user_lock"), wallet.publicKey.toBuffer()],
  programId
);

console.log("GlobalState:", globalState.toBase58());
console.log("CollectionConfig:", collectionConfig.toBase58());
console.log("UserLock:", userLock.toBase58(), "bump:", bump);
```

---

## 🐛 Commandes de débogage

### Erreur: "Program already deployed"

```bash
# Fermer le programme existant (récupère les SOL)
solana program close ANCIEN_PROGRAM_ID --url devnet

# Ou utiliser une nouvelle keypair
solana-keygen new -o target/deploy/swapback_cnft-keypair.json --force
```

### Erreur: "Insufficient funds"

```bash
# Vérifier le solde
solana balance --url devnet

# Airdrop
solana airdrop 2 --url devnet

# Si l'airdrop échoue, utiliser un faucet web
# https://faucet.solana.com/
```

### Erreur: "Account already exists"

```bash
# Les comptes GlobalState/CollectionConfig existent déjà
# C'est normal si vous redéployez avec un NOUVEAU program ID
# Ils seront recréés automatiquement
```

### Voir les logs en direct

```bash
# Terminal 1: Lancer les logs
solana logs --url devnet

# Terminal 2: Exécuter votre transaction
# Les logs apparaîtront dans le Terminal 1
```

### Reset complet (si tout est cassé)

```bash
# 1. Nettoyer
rm -rf target/
rm -rf node_modules/
rm -rf app/node_modules/

# 2. Réinstaller
npm install
cd app && npm install && cd ..

# 3. Nouvelle keypair
solana-keygen new -o target/deploy/swapback_cnft-keypair.json --force

# 4. Recommencer depuis l'étape 3
```

---

## 📊 Explorer Solana

### Liens utiles

```bash
# Programme
https://explorer.solana.com/address/VOTRE_PROGRAM_ID?cluster=devnet

# Transaction
https://explorer.solana.com/tx/VOTRE_TX_SIGNATURE?cluster=devnet

# Compte
https://explorer.solana.com/address/VOTRE_COMPTE_ADDRESS?cluster=devnet
```

---

## 💡 Tips

1. **Toujours vérifier la correspondance des Program IDs:**
   - `declare_id!()` dans lib.rs
   - Anchor.toml
   - Frontend config files
   - Keypair dans target/deploy/

2. **Sauvegarder le Program ID quelque part:**
   ```bash
   echo "PROGRAM_ID=$(solana-keygen pubkey target/deploy/swapback_cnft-keypair.json)" >> .env
   ```

3. **Build incrémental pour gagner du temps:**
   ```bash
   # Ne rebuild que ce qui a changé
   anchor build
   
   # Build un seul programme
   anchor build --program-name swapback_cnft
   ```

4. **Tester localement avant devnet:**
   ```bash
   # Démarrer un validateur local
   solana-test-validator
   
   # Dans un autre terminal
   anchor test
   ```

---

## ⚙️ Configuration recommandée

### .bashrc ou .zshrc

```bash
# Alias pour Solana devnet
alias sol-dev="solana config set --url https://api.devnet.solana.com"
alias sol-local="solana config set --url http://localhost:8899"
alias sol-main="solana config set --url https://api.mainnet-beta.solana.com"

# Alias pour Anchor
alias ab="anchor build"
alias at="anchor test"
alias ad="anchor deploy"

# Alias pour les logs
alias sol-logs="solana logs --url devnet"

# Variables d'environnement pour Anchor
export TMPDIR=/tmp
export CARGO_TARGET_DIR=/tmp/cargo-target
export RUSTFLAGS='-C target-cpu=generic -C opt-level=1'
```

---

## 📞 En cas de problème

1. **Lire les logs attentivement** - L'erreur est souvent explicite
2. **Vérifier l'explorer Solana** - Voir si la transaction est passée
3. **Vérifier les soldes** - SOL, tokens BACK
4. **Comparer les Program IDs** - Entre code, config et keypair
5. **Recommencer depuis zéro** - Parfois plus rapide que de debug

---

**Date:** 15 novembre 2025  
**Version:** 1.0.0  
**Status:** ✅ Prêt à l'emploi
