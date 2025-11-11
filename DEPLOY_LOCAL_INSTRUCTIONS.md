# 🚀 Instructions de Déployment Local

## Le Problème
Le programme Solana compilé dans Codespaces contient des conflits de toolchain Rust. La solution est de compiler **localement sur votre machine** puis redéployer.

## Prérequis
- Git installé
- Rust 1.79+ (`rustc --version`)
- Solana CLI 1.18+ (`solana --version`)
- Anchor CLI 0.30.1 (`anchor --version`)

## Installation des Outils (si nécessaire)

### 1. Installer Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustc --version  # Devrait afficher 1.79.0 ou plus
```

### 2. Installer Solana CLI
```bash
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana --version  # Devrait afficher v1.18.x ou plus
```

### 3. Installer Anchor CLI
```bash
cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli
anchor --version  # Devrait afficher anchor-cli 0.30.1
```

## Procédure de Redéployment

### Étape 1: Cloner le Repo

```bash
# Cloner dans un nouveau dossier
git clone https://github.com/BacBacta/SwapBack.git
cd SwapBack

# Vérifier que declare_id! est correct
head -10 programs/swapback_cnft/src/lib.rs
# Devrait afficher: declare_id!("9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq");
```

### Étape 2: Compiler le Programme

```bash
# Build uniquement swapback_cnft
anchor build -p swapback_cnft

# Vérifier le binaire généré
ls -lh target/deploy/swapback_cnft.so
# Devrait afficher ~300-400 KB
```

Si erreur de compilation:
```bash
# Nettoyer et recommencer
cargo clean
rm -rf target
anchor build -p swapback_cnft
```

### Étape 3: Configurer Solana pour Devnet

```bash
# Configurer le RPC devnet
solana config set --url devnet

# Importer la keypair d'autorité (depuis Codespaces)
# Option A: Copier le fichier ~/.config/solana/id.json depuis Codespaces
# Option B: Créer une nouvelle keypair et l'airdropper

# Si nouvelle keypair:
solana-keygen new -o ~/.config/solana/id.json

# Obtenir des devnet SOL
solana airdrop 2
solana balance
```

### Étape 4: Redéployer le Programme

```bash
# Méthode 1: Upgrade (si vous avez l'autorité)
anchor upgrade target/deploy/swapback_cnft.so \
  --program-id 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq \
  --provider.cluster devnet

# Méthode 2: Deploy classique
solana program deploy target/deploy/swapback_cnft.so \
  --program-id 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq \
  --url devnet \
  --keypair ~/.config/solana/id.json
```

**Important**: Notez la signature de transaction retournée!

### Étape 5: Mettre à Jour l'IDL

```bash
# Copier le nouvel IDL généré
cp target/idl/swapback_cnft.json app/src/idl/

# Vérifier que l'adresse est correcte
head -5 app/src/idl/swapback_cnft.json
# Devrait afficher: "address": "9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq"
```

### Étape 6: Commit et Push

```bash
# Ajouter les fichiers modifiés
git add target/idl/swapback_cnft.json app/src/idl/swapback_cnft.json

# Commit
git commit -m "deploy: Recompiled and redeployed CNFT program with correct declare_id

- Fixed DeclaredProgramIdMismatch error
- Program now has matching declare_id in bytecode
- Deployment signature: <VOTRE_SIGNATURE_ICI>"

# Push
git push origin main
```

### Étape 7: Vérifier sur Solana Explorer

```bash
# URL directe (remplacer par votre signature)
echo "https://explorer.solana.com/address/9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq?cluster=devnet"

# Vérifier dans le terminal
solana program show 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq --url devnet
```

Vérifiez que "Last Deployed In Slot" est récent (< 5 minutes).

### Étape 8: Tester l'Unlock

1. Attendre le redéployment Vercel (~2 minutes après push)
2. Aller sur https://swap-back-556okzq8h-bactas-projects.vercel.app
3. Rafraîchir avec Ctrl+F5 (hard refresh)
4. Connecter le wallet
5. Tenter un unlock
6. Vérifier les logs console - **DeclaredProgramIdMismatch doit disparaître**

## Dépannage

### Erreur: "Insufficient funds for transaction fee"
```bash
solana airdrop 2
# Retry le deploy
```

### Erreur: "Error: Account data too small for instruction"
Le programme déployé est trop ancien. Redéployez avec `--upgrade-authority`:
```bash
anchor upgrade target/deploy/swapback_cnft.so \
  --program-id 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq \
  --upgrade-authority ~/.config/solana/id.json
```

### Erreur: "Incorrect program id"
Vérifiez que la keypair correspond:
```bash
solana program show 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq --url devnet | grep "Authority"
solana address
# Les deux doivent correspondre
```

### Si vous n'avez pas l'autorité sur le programme

Il faut déployer à une **nouvelle adresse**:

```bash
# 1. Générer une nouvelle keypair
solana-keygen new -o target/deploy/swapback_cnft-keypair.json

# 2. Obtenir la nouvelle adresse
NEW_PROGRAM_ID=$(solana address -k target/deploy/swapback_cnft-keypair.json)
echo "Nouvelle adresse: $NEW_PROGRAM_ID"

# 3. Mettre à jour declare_id! dans lib.rs
sed -i.bak "s/9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq/$NEW_PROGRAM_ID/g" programs/swapback_cnft/src/lib.rs

# 4. Mettre à jour Anchor.toml
sed -i.bak "s/9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq/$NEW_PROGRAM_ID/g" Anchor.toml

# 5. Recompiler
anchor build -p swapback_cnft

# 6. Déployer à la nouvelle adresse
anchor deploy -p swapback_cnft --provider.cluster devnet

# 7. Mettre à jour le frontend
echo "NEXT_PUBLIC_CNFT_PROGRAM_ID=$NEW_PROGRAM_ID" >> app/.env.local

# 8. Commit et push
git add -A
git commit -m "deploy: New CNFT program at $NEW_PROGRAM_ID"
git push origin main
```

## Checklist Complète

- [ ] Rust 1.79+ installé
- [ ] Solana CLI configuré pour devnet
- [ ] Anchor CLI 0.30.1 installé
- [ ] Repo cloné localement
- [ ] `anchor build -p swapback_cnft` réussit
- [ ] Programme redéployé (signature obtenue)
- [ ] IDL copié vers app/src/idl/
- [ ] Changes committés et pushés
- [ ] Vercel redéployé (auto après push)
- [ ] Dashboard rafraîchi (Ctrl+F5)
- [ ] Unlock testé et fonctionnel

## Contact

Si problèmes persistants, partagez:
1. La sortie de `anchor build -p swapback_cnft`
2. La sortie de `solana program deploy` (avec signature)
3. Les logs console du dashboard après tentative d'unlock

---

**Durée estimée**: 15-30 minutes (selon vitesse de compilation)

**Coût**: Gratuit sur devnet (SOL airdrop)
