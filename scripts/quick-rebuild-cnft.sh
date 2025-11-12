#!/bin/bash
set -e

echo "🔨 Compilation rapide du programme swapback_cnft..."

# Sourcer cargo si installé
if [ -f "$HOME/.cargo/env" ]; then
    source "$HOME/.cargo/env"
fi

# Vérifier que cargo est disponible
if ! command -v cargo &> /dev/null; then
    echo "❌ Cargo non trouvé. Installation de Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
    source "$HOME/.cargo/env"
fi

echo "✅ Cargo version: $(cargo --version)"

# Vérifier le declare_id!
echo "🔍 Vérification du declare_id!..."
CURRENT_ID=$(grep 'declare_id!' programs/swapback_cnft/src/lib.rs | grep -o '"[^"]*"' | tr -d '"')
echo "   Program ID dans le code: $CURRENT_ID"

if [ "$CURRENT_ID" != "26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru" ]; then
    echo "❌ ERREUR: Le declare_id! ne correspond pas!"
    exit 1
fi

# Compiler avec cargo directement (plus rapide qu'anchor)
echo "🔨 Compilation avec cargo build-sbf..."

# Installer cargo-build-sbf si nécessaire
if ! cargo build-sbf --version &> /dev/null; then
    echo "📦 Installation de cargo-build-sbf..."
    cargo install cargo-build-sbf
fi

# Compiler le programme
cd programs/swapback_cnft
cargo build-sbf

echo ""
echo "✅ COMPILATION TERMINÉE!"
echo ""
echo "📦 Binaire: ../../target/deploy/swapback_cnft.so"
echo "📊 Taille: $(du -h ../../target/deploy/swapback_cnft.so | cut -f1)"
echo "🕐 Modifié: $(stat -c %y ../../target/deploy/swapback_cnft.so 2>/dev/null || stat -f %Sm ../../target/deploy/swapback_cnft.so)"
echo ""
echo "Pour déployer: cd ../.. && ./scripts/deploy-cnft-program.sh"
