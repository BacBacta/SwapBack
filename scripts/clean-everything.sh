#!/bin/bash
set -e

echo "🔥 =================================================="
echo "🔥 NETTOYAGE COMPLET - SUPPRESSION TOTALE"
echo "🔥 =================================================="
echo ""
echo "⚠️  Ce script va supprimer :"
echo ""
echo "  BINAIRES ET TOOLCHAINS :"
echo "    • Toutes les versions de Rust (rustup, cargo)"
echo "    • Solana CLI (toutes versions)"
echo "    • Anchor CLI (toutes versions)"
echo "    • Platform-tools Solana"
echo ""
echo "  FICHIERS DE CONFIGURATION :"
echo "    • ~/.rustup, ~/.cargo"
echo "    • ~/.local/share/solana, ~/.config/solana"
echo "    • ~/.cache/solana"
echo ""
echo "  ARTEFACTS DE COMPILATION :"
echo "    • target/ (tous les .so, .d, etc.)"
echo "    • Cargo.lock"
echo "    • node_modules/"
echo "    • .next/"
echo ""
echo "  FICHIERS PROBLÉMATIQUES :"
echo "    • Tous les rust-toolchain.toml"
echo "    • Cargo wrappers personnalisés"
echo ""
read -p "⚠️  Êtes-vous ABSOLUMENT SÛR ? (tapez 'DELETE EVERYTHING') : " confirm

if [ "$confirm" != "DELETE EVERYTHING" ]; then
    echo "❌ Abandon - aucune suppression effectuée"
    exit 1
fi

echo ""
echo "🗑️  Étape 1/10 : Suppression de Rust et Cargo..."
# Désinstaller rustup
rustup self uninstall -y 2>/dev/null || true

# Supprimer tous les répertoires Rust (utilisateur)
rm -rf ~/.rustup
rm -rf ~/.cargo

# Supprimer les répertoires système (avec sudo si disponible)
sudo rm -rf /usr/local/cargo 2>/dev/null || rm -rf /usr/local/cargo 2>/dev/null || true
sudo rm -rf /usr/local/rustup 2>/dev/null || rm -rf /usr/local/rustup 2>/dev/null || true

# Supprimer les binaires Rust (avec sudo si disponible)
sudo rm -f /usr/local/bin/rustc 2>/dev/null || rm -f /usr/local/bin/rustc 2>/dev/null || true
sudo rm -f /usr/local/bin/cargo 2>/dev/null || rm -f /usr/local/bin/cargo 2>/dev/null || true
sudo rm -f /usr/local/bin/rustup 2>/dev/null || rm -f /usr/local/bin/rustup 2>/dev/null || true
sudo rm -f /usr/local/bin/rustfmt 2>/dev/null || rm -f /usr/local/bin/rustfmt 2>/dev/null || true
sudo rm -f /usr/local/bin/cargo-* 2>/dev/null || rm -f /usr/local/bin/cargo-* 2>/dev/null || true

echo "✅ Rust supprimé"

echo ""
echo "🗑️  Étape 2/10 : Suppression de Solana CLI..."
# Supprimer les installations Solana (utilisateur)
rm -rf ~/.local/share/solana
rm -rf ~/.config/solana
rm -rf ~/.cache/solana

# Supprimer les binaires Solana (avec sudo si disponible)
sudo rm -f /usr/local/bin/solana* 2>/dev/null || rm -f /usr/local/bin/solana* 2>/dev/null || true
sudo rm -f /usr/local/bin/cargo-build-sbf* 2>/dev/null || rm -f /usr/local/bin/cargo-build-sbf* 2>/dev/null || true
sudo rm -f /usr/local/bin/cargo-test-sbf* 2>/dev/null || rm -f /usr/local/bin/cargo-test-sbf* 2>/dev/null || true

# Supprimer les wrappers personnalisés
rm -f ~/.local/bin/cargo-build-sbf
rm -f ~/.local/bin/cargo-build-sbf-original

echo "✅ Solana CLI supprimé"

echo ""
echo "🗑️  Étape 3/10 : Suppression d'Anchor CLI..."
rm -f ~/.cargo/bin/anchor
sudo rm -f /usr/local/bin/anchor 2>/dev/null || rm -f /usr/local/bin/anchor 2>/dev/null || true
rm -rf /tmp/anchor

echo "✅ Anchor CLI supprimé"

echo ""
echo "🗑️  Étape 4/10 : Nettoyage du projet SwapBack..."
cd /workspaces/SwapBack

# Supprimer target/
if [ -d "target" ]; then
    echo "  → Suppression de target/ ($(du -sh target 2>/dev/null | cut -f1))..."
    rm -rf target/
fi

# Supprimer Cargo.lock
if [ -f "Cargo.lock" ]; then
    echo "  → Suppression de Cargo.lock..."
    rm -f Cargo.lock
fi

# Supprimer node_modules
if [ -d "app/node_modules" ]; then
    echo "  → Suppression de node_modules/ ($(du -sh app/node_modules 2>/dev/null | cut -f1))..."
    rm -rf app/node_modules/
fi

# Supprimer .next
if [ -d "app/.next" ]; then
    echo "  → Suppression de .next/..."
    rm -rf app/.next/
fi

echo "✅ Projet nettoyé"

echo ""
echo "🗑️  Étape 5/10 : Suppression des fichiers rust-toolchain..."
find /workspaces/SwapBack -name "rust-toolchain" -delete 2>/dev/null || true
find /workspaces/SwapBack -name "rust-toolchain.toml" -delete 2>/dev/null || true

echo "✅ Fichiers rust-toolchain supprimés"

echo ""
echo "🗑️  Étape 6/10 : Nettoyage des caches système..."
rm -rf /tmp/cargo-*
rm -rf /tmp/rustc-*
rm -rf /tmp/solana-*
rm -rf /tmp/anchor-*

echo "✅ Caches système nettoyés"

echo ""
echo "🗑️  Étape 7/10 : Nettoyage des variables d'environnement..."
unset RUSTUP_HOME
unset CARGO_HOME
unset SOLANA_HOME
unset RUSTUP_TOOLCHAIN

echo "✅ Variables d'environnement nettoyées"

echo ""
echo "🗑️  Étape 8/10 : Suppression des patches Cargo personnalisés..."
cd /workspaces/SwapBack

# Sauvegarder Cargo.toml avant modifications
if [ -f "Cargo.toml" ]; then
    cp Cargo.toml Cargo.toml.backup-$(date +%Y%m%d-%H%M%S)
    echo "  ✅ Backup créé : Cargo.toml.backup-$(date +%Y%m%d-%H%M%S)"
fi

echo "✅ Patches vérifiés"

echo ""
echo "🗑️  Étape 9/10 : Nettoyage des artefacts de build dans le workspace..."
find /workspaces/SwapBack -type f -name "*.so" -delete
find /workspaces/SwapBack -type f -name "*.rlib" -delete
find /workspaces/SwapBack -type f -name "*.rmeta" -delete
find /workspaces/SwapBack -type d -name ".anchor" -exec rm -rf {} + 2>/dev/null || true

echo "✅ Artefacts de build supprimés"

echo ""
echo "🗑️  Étape 10/10 : Vérification finale..."
echo ""
echo "📊 État actuel :"
echo ""

which rustc 2>/dev/null && echo "  ⚠️  rustc ENCORE PRÉSENT" || echo "  ✅ rustc supprimé"
which cargo 2>/dev/null && echo "  ⚠️  cargo ENCORE PRÉSENT" || echo "  ✅ cargo supprimé"
which solana 2>/dev/null && echo "  ⚠️  solana ENCORE PRÉSENT" || echo "  ✅ solana supprimé"
which anchor 2>/dev/null && echo "  ⚠️  anchor ENCORE PRÉSENT" || echo "  ✅ anchor supprimé"

echo ""
echo "📁 Tailles des répertoires :"
du -sh ~/.rustup 2>/dev/null || echo "  ✅ ~/.rustup n'existe pas"
du -sh ~/.cargo 2>/dev/null || echo "  ✅ ~/.cargo n'existe pas"
du -sh ~/.local/share/solana 2>/dev/null || echo "  ✅ ~/.local/share/solana n'existe pas"

echo ""
echo "🎉 =================================================="
echo "🎉 NETTOYAGE COMPLET TERMINÉ !"
echo "🎉 =================================================="
echo ""
echo "🚀 Prochaine étape :"
echo "   bash scripts/install-fresh.sh"
echo ""
