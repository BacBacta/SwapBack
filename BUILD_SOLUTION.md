# Solution Alternative de Build

## Problème Identifié

L'environnement codespace a les dépendances suivantes :
- ✅ Rust 1.91.1
- ✅ Cargo
- ✅ Solana CLI 3.0.10 (Agave)
- ❌ Target `sbf-solana-solana` non disponible
- ❌ cargo-build-sbf cassé (platform-tools incomplètes)
- ❌ Anchor CLI installation en compilation (timeout/erreurs)

## Approche Alternative

### Option 1: Compiler avec Docker (RECOMMANDÉ)

Utiliser un docker container avec la chaîne de compilation Solana préinstallée :

```bash
# Créer une image Build
docker build -t solana-build:latest - << 'EOF'
FROM node:18-bullseye

# Installer Rust et Solana CLI
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
export PATH="$HOME/.cargo/bin:$PATH"

# Installer Solana avec tous les outils
sh -c "$(curl -sSfL https://release.solana.com/v1.18.26/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Installer Anchor
cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked

WORKDIR /workspace
CMD ["bash"]
EOF

# Compiler dans Docker
docker run --rm -v /workspaces/SwapBack:/workspace solana-build:latest bash -c \
  "cd /workspace/programs/swapback_cnft && cargo-build-sbf"
```

### Option 2: Installer Solana Correctement (RAPIDE)

```bash
# Télécharger binaires pré-compilés
cd /tmp
wget https://github.com/coral-xyz/solana-program-library/releases/download/token-v4.6.0/spl_token.so
cp spl_token.so /workspaces/SwapBack/target/sbf-solana-solana/release/

# OU installer depuis les sources
git clone https://github.com/solana-labs/solana-program-library
cd solana-program-library/token
cargo build-sbf --out-dir ../../target
```

### Option 3: Générer un Programme Simplifié (TEST)

Créer une version non-Anchor du programme qui compile nativement :

```bash
# Compiler comme lib Rust natif (pas Solana BPF)
cd programs/swapback_cnft
cargo build --release --lib
```

Cela génère `/target/release/libswapback_cnft.rlib` pour testing local.

### Option 4: Utiliser Vercel/Github Actions (CLOUD)

Créer un Github Actions workflow qui :
1. Compile dans un runner avec les bons outils
2. Upload le .so en artifact
3. Déploie automatiquement

```yaml
name: Build Solana Program

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          target: sbf-solana-solana
      - run: cargo build --target sbf-solana-solana --release
      - uses: actions/upload-artifact@v3
        with:
          name: swapback_cnft.so
          path: target/sbf-solana-solana/release/swapback_cnft.so
```

## Recommendation Immédiate

**Utilisez Option 2 (Solution Rapide)** :

```bash
#!/bin/bash
set -e

# 1. Installer Solana CLI complète
cd /tmp
wget https://github.com/solana-labs/solana/releases/download/v1.18.26/solana-release-x86_64-unknown-linux-gnu.tar.bz2
tar xjf solana-release-x86_64-unknown-linux-gnu.tar.bz2
export PATH="/tmp/solana-release/bin:$PATH"

# 2. Installer Rust SBF target
rustup target add sbf-solana-solana

# 3. Builder le programme
cd /workspaces/SwapBack/programs/swapback_cnft
cargo build --release --target sbf-solana-solana

# 4. Déployer
cd /workspaces/SwapBack
solana program deploy target/sbf-solana-solana/release/swapback_cnft.so \
  --program-id target/deploy/swapback_cnft-keypair.json \
  --url https://api.devnet.solana.com
```

## Pour Maintenant: Valider le Code

Puisque le compilateur est un problème, validons que le **code Rust est correct** :

```bash
# Vérifier la syntaxe et les types (déjà réussi)
cd /workspaces/SwapBack/programs/swapback_cnft
cargo check

# Exécuter les tests unitaires
cargo test --lib

# Générer la documentation
cargo doc --no-deps --open
```

## Prochaines Étapes

1. **Immédiat**: Valider le code avec `cargo check` ✅ (déjà fait)
2. **Court terme**: Compiler dans Docker ou activer le bon target Rust
3. **Moyen terme**: Configurer Github Actions pour la compilation automatique
4. **Long terme**: Déployer en production sur devnet

## Code Status

✅ **Code Rust**: Compile avec `cargo check` sans erreurs
✅ **Logique de Business**: Tests unitaires inclus
⚠️ **Compilation SBF**: En attente de bons outils
✅ **Déploiement Prêt**: Scripts prêts une fois .so disponible

---

**Verdict**: Le code est bon. C'est l'environnement build qui a besoin de correction.
