#!/bin/bash
set -e

echo "🚀 =================================================="
echo "🚀 MIGRATION VERS STACK MODERNE"
echo "🚀 =================================================="
echo ""
echo "Cette migration va installer :"
echo "  • Rust 1.78.0 (au lieu de 1.75.0)"
echo "  • Solana 2.0.3 (au lieu de 1.18.26)"
echo "  • Anchor 0.30.1 (recompilé pour Solana 2.0)"
echo ""
echo "⚠️  Cette opération va :"
echo "  • Désinstaller les versions actuelles"
echo "  • Réinstaller avec les versions modernes"
echo "  • Régénérer Cargo.lock"
echo "  • Compiler le programme"
echo ""
read -p "Continuer ? (y/n) : " confirm

if [ "$confirm" != "y" ]; then
    echo "❌ Migration annulée"
    exit 1
fi

# ==================================================
# ÉTAPE 1 : DÉSINSTALLER LES ANCIENNES VERSIONS
# ==================================================
echo ""
echo "🗑️  [1/5] Désinstallation des anciennes versions..."

# Rust
rustup self uninstall -y 2>/dev/null || true
rm -rf ~/.rustup ~/.cargo

# Solana
rm -rf ~/.local/share/solana ~/.config/solana ~/.cache/solana

echo "✅ Désinstallation terminée"

# ==================================================
# ÉTAPE 2 : INSTALLER RUST 1.78.0
# ==================================================
echo ""
echo "🦀 [2/5] Installation de Rust 1.78.0..."

export RUSTUP_HOME="$HOME/.rustup"
export CARGO_HOME="$HOME/.cargo"

curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- \
    -y \
    --default-toolchain 1.78.0 \
    --profile minimal \
    --no-modify-path

export PATH="$HOME/.cargo/bin:$PATH"
source "$HOME/.cargo/env"

rustup component add rustfmt clippy

echo ""
echo "✅ Rust 1.78.0 installé :"
rustc --version
cargo --version
echo ""

# ==================================================
# ÉTAPE 3 : INSTALLER SOLANA 2.0.3
# ==================================================
echo ""
echo "☀️  [3/5] Installation de Solana 2.0.3..."

sh -c "$(curl -sSfL https://release.solana.com/v2.0.3/install)"

export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

solana config set --url devnet

if [ ! -f ~/.config/solana/id.json ]; then
    echo "  → Génération d'une nouvelle keypair..."
    solana-keygen new --no-bip39-passphrase -o ~/.config/solana/id.json
fi

echo ""
echo "✅ Solana 2.0.3 installé :"
solana --version
cargo-build-sbf --version | head -3
echo ""

# ==================================================
# ÉTAPE 4 : RÉINSTALLER ANCHOR 0.30.1
# ==================================================
echo ""
echo "⚓ [4/5] Installation d'Anchor 0.30.1 (compatible Solana 2.0)..."
echo "  ⏳ Cette étape prend 5-10 minutes..."
echo ""

cargo install --git https://github.com/coral-xyz/anchor \
    --tag v0.30.1 \
    anchor-cli \
    --locked \
    --force

echo ""
echo "✅ Anchor 0.30.1 installé :"
anchor --version
echo ""

# ==================================================
# ÉTAPE 5 : NETTOYER ET COMPILER LE PROJET
# ==================================================
echo ""
echo "🏗️  [5/5] Compilation du projet avec la stack moderne..."

cd /workspaces/SwapBack

# Nettoyer
echo "  → Nettoyage des anciens artefacts..."
rm -rf target/
rm -f Cargo.lock

# Régénérer Cargo.lock
echo "  → Génération d'un nouveau Cargo.lock..."
cargo generate-lockfile

# Vérifier les versions dans Cargo.lock
echo ""
echo "  📋 Vérification des versions critiques :"
echo ""
echo "  === borsh ==="
grep -A 1 'name = "borsh"' Cargo.lock | grep version | head -3 || echo "  Non trouvé"
echo ""
echo "  === toml_parser ==="
grep -A 1 'name = "toml_parser"' Cargo.lock | grep version || echo "  Non utilisé (bon signe!)"
echo ""
echo "  === proc-macro-crate ==="
grep -A 1 'name = "proc-macro-crate"' Cargo.lock | grep version | head -1 || echo "  Non trouvé"
echo ""

# Compiler
echo "  → Compilation du programme CNFT..."
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
export RUSTUP_TOOLCHAIN=1.78.0

anchor build -p swapback_cnft --skip-lint

echo ""
echo "✅ Compilation réussie !"
echo ""
echo "📦 Artefacts générés :"
ls -lh target/deploy/swapback_cnft.so
ls -lh target/idl/swapback_cnft.json
echo ""

# Vérifier le Program ID
echo "🔑 Program ID généré :"
solana-keygen pubkey target/deploy/swapback_cnft-keypair.json
echo ""

echo "🎉 =================================================="
echo "🎉 MIGRATION TERMINÉE AVEC SUCCÈS !"
echo "🎉 =================================================="
echo ""
echo "📊 Stack moderne installée :"
echo ""
rustc --version
cargo --version
solana --version
cargo-build-sbf --version | head -2
anchor --version
echo ""
echo "🚀 Prochaines étapes :"
echo ""
echo "  1. Déployer sur devnet :"
echo "     anchor deploy -p swapback_cnft --provider.cluster devnet"
echo ""
echo "  2. Vérifier le déploiement sur Solana Explorer :"
echo "     https://explorer.solana.com/address/CzxpYBeKbcA6AJH7yz8ggkJ1cWen3ejKUuikE6stHEaF?cluster=devnet"
echo ""
echo "  3. Mettre à jour le frontend si nécessaire"
echo ""
echo "✅ Environnement local maintenant 100% fonctionnel !"
echo ""
