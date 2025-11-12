#!/bin/bash

# Script de compilation et redéploiement de swapback_cnft
# Résout DeclaredProgramIdMismatch en recompilant avec le declare_id! actuel

set -e

echo "🔧 Compilation et redéploiement de swapback_cnft"
echo "================================================"
echo ""

cd /workspaces/SwapBack

# Vérifier que cargo-build-sbf est disponible
if ! command -v cargo-build-sbf &> /dev/null; then
    echo "❌ cargo-build-sbf n'est pas installé"
    echo "   Installation..."
    cargo install cargo-build-sbf
fi

# Afficher le declare_id! actuel dans le code
DECLARED_ID=$(grep 'declare_id!' programs/swapback_cnft/src/lib.rs | grep -oE '[1-9A-HJ-NP-Za-km-z]{32,44}')
echo "📋 Program ID dans le code source:"
echo "   $DECLARED_ID"
echo ""

# Compiler le programme
echo "🔨 Compilation de swapback_cnft..."
cargo build-sbf --manifest-path programs/swapback_cnft/Cargo.toml

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de la compilation"
    exit 1
fi

BINARY="target/deploy/swapback_cnft.so"
BINARY_SIZE=$(du -h "$BINARY" | cut -f1)

echo ""
echo "✅ Compilation réussie !"
echo "   Binary: $BINARY ($BINARY_SIZE)"
echo ""

# Vérifier l'upgrade authority
PROGRAM_ID="26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru"
echo "🔍 Vérification de l'upgrade authority..."
CURRENT_AUTHORITY=$(solana program show $PROGRAM_ID --url devnet 2>&1 | grep "Authority:" | awk '{print $2}')
MY_ADDRESS=$(solana address)

if [ "$CURRENT_AUTHORITY" != "$MY_ADDRESS" ]; then
    echo "❌ ERREUR: Vous n'êtes pas l'upgrade authority"
    echo "   Authority actuelle: $CURRENT_AUTHORITY"
    echo "   Votre adresse: $MY_ADDRESS"
    exit 1
fi

echo "✅ Upgrade authority confirmée"
echo ""

# Confirmer le déploiement
echo "⚠️  Déploiement du nouveau binaire sur devnet"
read -p "Continuer ? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy]([Ee][Ss])?$ ]]; then
    echo "❌ Déploiement annulé"
    exit 0
fi

# Déployer
echo "🚀 Déploiement en cours..."
solana program deploy \
    --url devnet \
    --program-id target/deploy/swapback_cnft-keypair.json \
    --upgrade-authority ~/.config/solana/id.json \
    "$BINARY"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Déploiement réussi !"
    echo ""
    echo "🔍 Vérification..."
    solana program show $PROGRAM_ID --url devnet
    echo ""
    echo "📝 Testez maintenant la fonction lock depuis Vercel"
else
    echo "❌ Erreur lors du déploiement"
    exit 1
fi
