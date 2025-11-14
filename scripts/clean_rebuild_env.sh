#!/bin/bash
set -e

echo "========================================"
echo "🧹 PHASE 1: NETTOYAGE COMPLET"
echo "========================================"

# 1. Supprimer toutes les installations Rust
echo "📦 Suppression de Rust..."
if command -v rustup &> /dev/null; then
    rustup self uninstall -y 2>/dev/null || true
fi
rm -rf ~/.rustup
rm -rf ~/.cargo

# 2. Supprimer Solana CLI
echo "📦 Suppression de Solana CLI..."
rm -rf ~/.local/share/solana
rm -rf ~/.config/solana
rm -rf ~/.cache/solana

# 3. Supprimer Anchor
echo "📦 Suppression d'Anchor..."
rm -rf ~/.avm
rm -rf ~/.local/share/anchor

# 4. Nettoyer le projet
echo "📦 Nettoyage du projet..."
cd /workspaces/SwapBack
rm -rf target/
rm -rf .anchor/
rm -rf programs/swapback_cnft/target/
rm -rf programs/swapback_router/target/
rm -rf Cargo.lock
find . -name "Cargo.lock" -type f -delete

# 5. Nettoyer les caches
echo "📦 Nettoyage des caches..."
rm -rf /tmp/solana-*
rm -rf /tmp/cargo-*

echo ""
echo "✅ Nettoyage terminé !"
echo "   - Rust: supprimé"
echo "   - Solana CLI: supprimé"
echo "   - Anchor: supprimé"
echo "   - Caches projet: nettoyés"
echo ""
