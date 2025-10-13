#!/bin/bash
# Script de déploiement des programmes SwapBack restants sur devnet
# Usage: ./deploy_remaining.sh

set -e

export PATH="/home/codespace/.local/share/solana/install/active_release/bin:$PATH"

echo "🚀 Déploiement des programmes SwapBack restants sur devnet"
echo "============================================================"

# Vérifier le solde
BALANCE=$(solana balance | grep -oE '[0-9]+\.[0-9]+')
echo "💰 Solde actuel: $BALANCE SOL"

if (( $(echo "$BALANCE < 4" | bc -l) )); then
    echo "⚠️  Solde insuffisant pour déployer les 2 programmes"
    echo "📝 Besoin: ~4 SOL | Disponible: $BALANCE SOL"
    echo ""
    echo "💡 Solutions:"
    echo "  1. Attendre reset rate limit et exécuter: solana airdrop 5"
    echo "  2. Utiliser le faucet web: https://faucet.solana.com/"
    echo "     Adresse: 578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf"
    echo ""
    read -p "Voulez-vous continuer quand même? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

cd /workspaces/SwapBack/target/deploy

# Déployer swapback_buyback
echo ""
echo "📦 Déploiement swapback_buyback..."
echo "-----------------------------------"
if solana program deploy --program-id swapback_buyback-keypair.json swapback_buyback.so; then
    echo "✅ swapback_buyback déployé avec succès!"
    BUYBACK_ADDR=$(solana-keygen pubkey swapback_buyback-keypair.json)
    echo "   Program ID: $BUYBACK_ADDR"
else
    echo "❌ Échec du déploiement de swapback_buyback"
    exit 1
fi

# Déployer swapback_cnft
echo ""
echo "📦 Déploiement swapback_cnft..."
echo "--------------------------------"
if solana program deploy --program-id swapback_cnft-keypair.json swapback_cnft.so; then
    echo "✅ swapback_cnft déployé avec succès!"
    CNFT_ADDR=$(solana-keygen pubkey swapback_cnft-keypair.json)
    echo "   Program ID: $CNFT_ADDR"
else
    echo "❌ Échec du déploiement de swapback_cnft"
    exit 1
fi

# Résumé
echo ""
echo "🎉 Déploiement terminé!"
echo "======================="
echo ""
echo "📍 Adresses des programmes sur devnet:"
echo "  swapback_router:  FPK46poe53iX6Bcv3q8cgmc1jm7dJKQ9Qs9oESFxGN55 ✅"
echo "  swapback_buyback: $BUYBACK_ADDR ✅"
echo "  swapback_cnft:    $CNFT_ADDR ✅"
echo ""
echo "💰 Solde restant: $(solana balance)"
echo ""
echo "🔗 Explorer les programmes:"
echo "  https://explorer.solana.com/address/$BUYBACK_ADDR?cluster=devnet"
echo "  https://explorer.solana.com/address/$CNFT_ADDR?cluster=devnet"
