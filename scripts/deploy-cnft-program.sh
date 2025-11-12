#!/bin/bash
set -e

echo "🚀 Déploiement du programme swapback_cnft sur devnet..."

# Vérifier que le binaire existe
if [ ! -f "target/deploy/swapback_cnft.so" ]; then
    echo "❌ ERREUR: target/deploy/swapback_cnft.so introuvable"
    echo "Exécutez d'abord: ./scripts/install-rust-and-build.sh"
    exit 1
fi

# Vérifier que la keypair existe
if [ ! -f "target/deploy/swapback_cnft-keypair.json" ]; then
    echo "❌ ERREUR: target/deploy/swapback_cnft-keypair.json introuvable"
    exit 1
fi

# Afficher le program ID
PROGRAM_ID=$(solana-keygen pubkey target/deploy/swapback_cnft-keypair.json)
echo "📍 Program ID: $PROGRAM_ID"

# Vérifier que c'est le bon ID
if [ "$PROGRAM_ID" != "26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru" ]; then
    echo "⚠️  ATTENTION: Le program ID ne correspond pas!"
    echo "Attendu: 26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru"
    echo "Trouvé: $PROGRAM_ID"
    echo ""
    echo "Voulez-vous continuer quand même? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Vérifier l'upgrade authority
echo "🔐 Vérification de l'upgrade authority..."
CURRENT_WALLET=$(solana address)
echo "Wallet actuelle: $CURRENT_WALLET"

EXPECTED_AUTHORITY="578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf"
PROGRAM_INFO=$(solana program show "$PROGRAM_ID" --url devnet 2>/dev/null || echo "")

if [ -n "$PROGRAM_INFO" ]; then
    CURRENT_AUTHORITY=$(echo "$PROGRAM_INFO" | grep "Authority:" | awk '{print $2}')
    echo "Authority actuelle du programme: $CURRENT_AUTHORITY"
    
    if [ "$CURRENT_WALLET" != "$CURRENT_AUTHORITY" ]; then
        echo "❌ ERREUR: Vous n'avez pas l'autorité pour upgrader ce programme"
        echo "Wallet actuelle: $CURRENT_WALLET"
        echo "Authority requise: $CURRENT_AUTHORITY"
        exit 1
    fi
fi

# Vérifier le solde
BALANCE=$(solana balance --url devnet | awk '{print $1}')
echo "💰 Solde devnet: $BALANCE SOL"

# Déployer le programme
echo ""
echo "📤 Déploiement en cours..."
echo "   Authority utilisée: $CURRENT_WALLET"
echo ""

solana program deploy \
    --url devnet \
    --program-id target/deploy/swapback_cnft-keypair.json \
    target/deploy/swapback_cnft.so

echo ""
echo "✅ DÉPLOIEMENT RÉUSSI!"
echo ""

# Vérifier le déploiement
echo "🔍 Vérification du déploiement..."
solana program show "$PROGRAM_ID" --url devnet

echo ""
echo "✅ Programme mis à jour avec succès!"
echo ""
echo "📋 Prochaines étapes:"
echo "  1. Attendre 30 secondes pour la propagation"
echo "  2. Tester sur: https://swap-back-pc5qkn6em-bactas-projects.vercel.app/"
echo "  3. Vérifier que l'erreur DeclaredProgramIdMismatch a disparu"
echo ""
echo "Pour vérifier le declare_id! dans le binaire déployé:"
echo "  solana program dump $PROGRAM_ID /tmp/verify.so --url devnet"
echo "  strings /tmp/verify.so | grep -i 26kzow1K"
