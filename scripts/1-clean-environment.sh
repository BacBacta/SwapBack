#!/bin/bash
set -e

echo "=============================================="
echo "🧹 PHASE 1: NETTOYAGE COMPLET DE L'ENVIRONNEMENT"
echo "=============================================="
echo ""

# 1. Supprimer Rust (mais garder via devcontainer si présent)
echo "📦 Nettoyage des caches Rust..."
rm -rf ~/.cargo/registry/index
rm -rf ~/.cargo/registry/cache
rm -rf ~/.cargo/git/db
rm -rf ~/.cargo/git/checkouts

# 2. Supprimer Solana CLI
echo "🗑️  Suppression de Solana CLI..."
rm -rf ~/.local/share/solana
rm -rf ~/.config/solana
rm -rf ~/.cache/solana

# 3. Supprimer Anchor
echo "🗑️  Suppression d'Anchor..."
rm -rf ~/.avm
rm -rf ~/.local/share/anchor

# 4. Supprimer les binaires Cargo
echo "🗑️  Nettoyage des binaires Cargo..."
rm -f ~/.cargo/bin/anchor
rm -f ~/.cargo/bin/solana*
rm -f ~/.cargo/bin/cargo-build-sbf
rm -f ~/.cargo/bin/cargo-build-bpf

# 5. Nettoyer le projet
echo "🗑️  Nettoyage du projet SwapBack..."
cd /workspaces/SwapBack
rm -rf target/
rm -rf .anchor/
rm -rf Cargo.lock
rm -rf programs/swapback_cnft/target/
rm -rf programs/swapback_cnft/Cargo.lock

# 6. Nettoyer les dossiers temporaires
echo "🗑️  Nettoyage des fichiers temporaires..."
rm -rf /tmp/*.json
rm -rf /tmp/*.so
rm -rf /tmp/build*.log

echo ""
echo "✅ Nettoyage complet terminé !"
echo ""
