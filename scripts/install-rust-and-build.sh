#!/bin/bash
set -e

echo "🦀 Installation de Rust et Cargo..."

# Installer Rust dans le home directory (pas en root)
if ! command -v cargo &> /dev/null; then
    export CARGO_HOME="$HOME/.cargo"
    export RUSTUP_HOME="$HOME/.rustup"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
    source "$HOME/.cargo/env"
    export PATH="$HOME/.cargo/bin:$PATH"
fi

# Sourcer l'environnement cargo si déjà installé
if [ -f "$HOME/.cargo/env" ]; then
    source "$HOME/.cargo/env"
fi

if ! command -v cargo &> /dev/null; then
    echo "❌ ERREUR: Cargo n'est toujours pas disponible"
    echo "Installez Rust manuellement avec:"
    echo "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    echo "  source \$HOME/.cargo/env"
    exit 1
fi

echo "✅ Rust installé: $(rustc --version)"
echo "✅ Cargo installé: $(cargo --version)"

# Installer Solana CLI
echo "⚡ Installation de Solana CLI..."
if ! command -v solana &> /dev/null; then
    sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
fi

echo "✅ Solana installé: $(solana --version)"

# Installer Anchor CLI
echo "⚓ Installation de Anchor CLI..."
if ! command -v anchor &> /dev/null; then
    cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
    avm install latest
    avm use latest
fi

echo "✅ Anchor installé: $(anchor --version)"

# Configurer Solana pour devnet
echo "🔧 Configuration de Solana pour devnet..."
solana config set --url devnet

# Vérifier le declare_id!
echo "🔍 Vérification du declare_id! dans le code source..."
CURRENT_ID=$(grep 'declare_id!' programs/swapback_cnft/src/lib.rs | grep -o '"[^"]*"' | tr -d '"')
echo "Program ID dans le code: $CURRENT_ID"

if [ "$CURRENT_ID" != "26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru" ]; then
    echo "❌ ERREUR: Le declare_id! ne correspond pas!"
    echo "Attendu: 26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru"
    echo "Trouvé: $CURRENT_ID"
    exit 1
fi

echo "✅ Le declare_id! est correct"

# Compiler le programme
echo "🔨 Compilation du programme swapback_cnft..."
anchor build --program-name swapback_cnft

echo ""
echo "✅ COMPILATION TERMINÉE!"
echo ""
echo "📦 Binaire généré: target/deploy/swapback_cnft.so"
echo "🔑 Keypair: target/deploy/swapback_cnft-keypair.json"
echo ""
echo "Pour déployer, exécutez:"
echo "  ./scripts/deploy-cnft-program.sh"
