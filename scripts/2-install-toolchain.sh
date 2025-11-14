#!/bin/bash
set -e

echo "=============================================="
echo "🔧 PHASE 2: INSTALLATION TOOLCHAIN PROPRE"
echo "=============================================="
echo ""

# Versions cibles (compatibles entre elles)
RUST_VERSION="1.78.0"
SOLANA_VERSION="1.18.26"
ANCHOR_VERSION="0.30.1"

# 1. Vérifier/Installer Rust 1.78.0
echo "📦 Installation de Rust ${RUST_VERSION}..."
if ! command -v rustc &> /dev/null || ! rustc --version | grep -q "${RUST_VERSION}"; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain ${RUST_VERSION}
    source $HOME/.cargo/env
    rustup default ${RUST_VERSION}
else
    rustup default ${RUST_VERSION}
fi

source $HOME/.cargo/env
echo "✅ Rust $(rustc --version)"

# 2. Installer Solana CLI 1.18.26
echo ""
echo "📦 Installation de Solana CLI ${SOLANA_VERSION}..."
if command -v solana &> /dev/null && solana --version | grep -q "${SOLANA_VERSION}"; then
    echo "✅ Solana CLI déjà installé"
else
    sh -c "$(curl -sSfL https://release.solana.com/v${SOLANA_VERSION}/install)"
fi

export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
echo "✅ Solana $(solana --version)"

# 3. Installer Anchor CLI 0.30.1 (compilation avec Rust 1.82, puis retour à 1.78)
echo ""
echo "📦 Installation d'Anchor ${ANCHOR_VERSION}..."
if command -v anchor &> /dev/null && anchor --version | grep -q "${ANCHOR_VERSION}"; then
    echo "✅ Anchor CLI déjà installé"
else
    echo "Note: Compilation d'Anchor nécessite Rust 1.82+ temporairement..."
    
    # Installer Rust 1.82 temporairement pour compiler Anchor
    rustup install 1.82.0
    rustup default 1.82.0
    
    # Cloner Anchor pour pouvoir modifier Cargo.lock
    git clone --depth 1 --branch v${ANCHOR_VERSION} https://github.com/coral-xyz/anchor /tmp/anchor-build
    cd /tmp/anchor-build
    
    # Mettre à jour la crate time pour compatibilité Rust 1.82
    cargo update -p time --precise 0.3.36
    
    # Compiler Anchor CLI avec le Cargo.lock modifié
    cargo install --path cli --locked
    
    cd /workspaces/SwapBack
    rm -rf /tmp/anchor-build
    
    # Revenir à Rust 1.78 pour compiler le programme
    rustup default ${RUST_VERSION}
    source $HOME/.cargo/env
fi

echo "✅ Anchor $(anchor --version)"

# 4. Vérifier cargo-build-sbf
echo ""
echo "📦 Vérification de cargo-build-sbf..."
if command -v cargo-build-sbf &> /dev/null; then
    echo "✅ cargo-build-sbf $(cargo-build-sbf --version | head -n1)"
else
    echo "⚠️  cargo-build-sbf sera installé lors du premier build"
fi

# 5. Résumé
echo ""
echo "=============================================="
echo "✅ INSTALLATION TERMINÉE"
echo "=============================================="
echo "Rust:    $(rustc --version)"
echo "Cargo:   $(cargo --version)"
echo "Solana:  $(solana --version | head -n1)"
echo "Anchor:  $(anchor --version)"
echo ""
echo "Ajoute ces lignes à ton ~/.zshrc pour persistance:"
echo "export PATH=\"\$HOME/.local/share/solana/install/active_release/bin:\$PATH\""
echo "source \$HOME/.cargo/env"
echo 