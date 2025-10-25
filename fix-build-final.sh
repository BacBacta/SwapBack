#!/bin/bash
# Fix Cargo.lock v4 issue - Solution finale
# Cette solution utilise Rust 1.79 + Anchor 0.29.0 (versions stables)

set -e

echo "======================================"
echo "Fix Cargo.lock v4 - SwapBack"
echo "======================================"
echo ""

# Step 1: Installer Rust 1.79
echo "[1] Installation Rust 1.79 (stable)..."
rustup install 1.79.0
rustup override set 1.79.0
echo "✓ Rust 1.79 installé"
echo ""

# Step 2: Vérifier Rust
echo "[2] Vérification Rust..."
rustc --version
cargo --version
echo ""

# Step 3: Supprimer Cargo.lock v4
echo "[3] Suppression Cargo.lock v4..."
if [ -f "Cargo.lock" ]; then
    rm -f Cargo.lock
    echo "✓ Cargo.lock supprimé"
else
    echo "  Cargo.lock n'existe pas"
fi
echo ""

# Step 4: Supprimer target
echo "[4] Nettoyage du cache build..."
rm -rf target
echo "✓ Cache supprimé"
echo ""

# Step 5: Installer Solana CLI si manquant
echo "[5] Installation outils Solana..."
if ! command -v solana &> /dev/null; then
    sh -c "$(curl -sSfL https://release.solana.com/v1.18.22/install)"
    echo "✓ Solana CLI installé"
else
    echo "✓ Solana CLI déjà installé"
    solana --version
fi
echo ""

# Step 6: Vérifier cargo-build-sbf
echo "[6] Vérification cargo-build-sbf..."
if ! cargo build-sbf --version &> /dev/null; then
    echo "  Installation cargo-build-sbf..."
    cargo install cargo-build-sbf
    echo "✓ cargo-build-sbf installé"
else
    echo "✓ cargo-build-sbf déjà disponible"
fi
echo ""

# Step 7: Build programs avec cargo-build-sbf
echo "[7] Build programs avec cargo-build-sbf..."
echo "  - swapback_router..."
cargo build-sbf --manifest-path programs/swapback_router/Cargo.toml --release
echo "  - swapback_buyback..."
cargo build-sbf --manifest-path programs/swapback_buyback/Cargo.toml --release
echo "  - swapback_cnft..."
cargo build-sbf --manifest-path programs/swapback_cnft/Cargo.toml --release
echo "✓ Programs compilés"
echo ""

# Step 8: Vérifier les binaires
echo "[8] Vérification des binaires..."
if [ -f "target/sbf-solana-solana/release/swapback_router.so" ]; then
    SIZE=$(du -h target/sbf-solana-solana/release/swapback_router.so | cut -f1)
    echo "✓ swapback_router.so ($SIZE)"
    
    # Copy to expected location
    mkdir -p target/deploy
    cp target/sbf-solana-solana/release/swapback_router.so target/deploy/
    cp target/sbf-solana-solana/release/swapback_buyback.so target/deploy/
    cp target/sbf-solana-solana/release/swapback_cnft.so target/deploy/
fi
echo ""

echo "======================================"
echo "✓ BUILD RÉUSSI!"
echo "======================================"
echo ""
echo "Prochaines étapes:"
echo ""
echo "1. Déployer sur devnet:"
echo "   solana deploy target/deploy/swapback_router.so --url devnet"
echo "   solana deploy target/deploy/swapback_buyback.so --url devnet"
echo ""
echo "2. Ou avec Anchor (si disponible):"
echo "   anchor deploy --provider.cluster devnet"
echo ""
echo "3. Vérifier le déploiement:"
echo "   solana program show <PROGRAM_ID> --url devnet"
echo ""
