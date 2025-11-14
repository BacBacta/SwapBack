#!/bin/bash
set -e

echo "=============================================="
echo "🚀 PHASE 4: DÉPLOIEMENT SUR DEVNET"
echo "=============================================="
echo ""

# Source l'environnement
source $HOME/.cargo/env
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

cd /workspaces/SwapBack

# Vérifier que le programme est buildé
if [ ! -f "target/deploy/swapback_cnft.so" ]; then
    echo "❌ Erreur: Le programme n'est pas buildé"
    echo "Exécute d'abord: ./scripts/3-build-program.sh"
    exit 1
fi

# Configurer Solana pour devnet
echo "🔧 Configuration Solana..."
solana config set --url devnet

# Vérifier le wallet
echo ""
echo "💰 Vérification du wallet..."
solana address
BALANCE=$(solana balance | awk '{print $1}')
echo "Balance: $BALANCE SOL"

# Demander un airdrop si nécessaire
if (( $(echo "$BALANCE < 2" | bc -l) )); then
    echo "⚠️  Balance insuffisante, demande d'airdrop..."
    solana airdrop 2 || echo "⚠️  Airdrop échoué (peut-être rate-limité)"
fi

# Afficher le Program ID
PROGRAM_ID=$(solana-keygen pubkey target/deploy/swapback_cnft-keypair.json)
echo ""
echo "📋 Program ID: $PROGRAM_ID"

# Vérifier si le programme existe déjà
echo ""
echo "🔍 Vérification du programme sur devnet..."
if solana program show $PROGRAM_ID --url devnet &> /dev/null; then
    echo "⚠️  Programme déjà déployé, upgrade en cours..."
    ACTION="upgrade"
else
    echo "✅ Nouveau déploiement"
    ACTION="deploy"
fi

# Déployer avec Anchor
echo ""
echo "🚀 Déploiement du programme..."
anchor deploy --provider.cluster devnet --program-name swapback_cnft

# Vérifier le déploiement
echo ""
echo "🔍 Vérification du déploiement..."
if solana program show $PROGRAM_ID --url devnet &> /dev/null; then
    echo ""
    echo "=============================================="
    echo "✅ DÉPLOIEMENT RÉUSSI !"
    echo "=============================================="
    solana program show $PROGRAM_ID --url devnet | head -n 10
    echo ""
    echo "Program ID: $PROGRAM_ID"
    echo "Explorer: https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
    echo ""
    echo "🎯 Prochaine étape: Mettre à jour Vercel env var"
    echo "   NEXT_PUBLIC_CNFT_PROGRAM_ID=$PROGRAM_ID"
    echo ""
else
    echo "❌ Erreur: Le programme n'est pas visible sur devnet"
    exit 1
fi
