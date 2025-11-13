#!/bin/bash
set -e

echo "🔧 Rebuild CNFT Program Script"
echo "================================"

cd /workspaces/SwapBack

# 1. Clean
echo "📦 Cleaning previous builds..."
cargo clean
rm -rf target/deploy/*.so
rm -rf target/sbf-solana-solana/release/*.so

# 2. Mettre à jour les dépendances problématiques
echo "⬇️  Downgrading problematic dependencies..."
cargo update -p toml_edit@0.22.22 --precise 0.20.2 || true
cargo update -p proc-macro-crate@3.4.0 --precise 1.3.1 || true

# 3. Build avec cargo-build-sbf (utilise sa propre toolchain)
echo "🔨 Building with cargo-build-sbf..."
cd programs/swapback_cnft
cargo-build-sbf --features no-entrypoint

# 4. Vérifier le binaire
echo "✅ Build complete!"
ls -lh ../../target/deploy/swapback_cnft.so

echo ""
echo "🎯 Next step: Deploy with:"
echo "   solana program deploy target/deploy/swapback_cnft.so --url devnet"
