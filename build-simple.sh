#!/bin/bash
# Build script pour SwapBack avec Rust 1.79

set -e

echo "🚀 SWAPBACK BUILD AVEC RUST 1.79.0"
echo "===================================="
echo ""

# Vérifier les versions
echo "📋 Vérification des versions..."
echo "Rust: $(rustc --version)"
echo "Cargo: $(cargo --version)"
echo ""

# Étape 1: Build Router
echo "📦 Build 1/3: swapback_router..."
cd /workspaces/SwapBack/programs/swapback_router
cargo build --release 2>&1 | tail -10
echo "✓ swapback_router compilé"
echo ""

# Étape 2: Build Buyback
echo "📦 Build 2/3: swapback_buyback..."
cd /workspaces/SwapBack/programs/swapback_buyback
cargo build --release 2>&1 | tail -10
echo "✓ swapback_buyback compilé"
echo ""

# Étape 3: Build cNFT
echo "📦 Build 3/3: swapback_cnft..."
cd /workspaces/SwapBack/programs/swapback_cnft
cargo build --release 2>&1 | tail -10
echo "✓ swapback_cnft compilé"
echo ""

# Vérifier les binaires
echo "✅ Vérification des binaires..."
cd /workspaces/SwapBack

if [ -d "target/release" ]; then
    echo "Binaires trouvés dans target/release/"
    ls -lh target/release/swapback_* 2>/dev/null || echo "Binaires .so pas trouvés en release"
fi

echo ""
echo "===================================="
echo "✓ BUILD TERMINÉ"
echo "===================================="
