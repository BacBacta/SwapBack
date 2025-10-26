#!/bin/bash

# Script pour obtenir du SOL sur devnet via plusieurs méthodes
# Usage: ./get-devnet-sol.sh [amount]

set -e

# Configuration
AMOUNT=${1:-2}
WALLET=$(solana address)
REQUIRED_SOL=5.0

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     SwapBack - Obtention SOL Devnet                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Wallet: $WALLET"
echo "SOL requis: $REQUIRED_SOL SOL"
echo "Montant par airdrop: $AMOUNT SOL"
echo ""

# Vérifier le solde actuel
CURRENT_BALANCE=$(solana balance | awk '{print $1}')
echo "💰 Solde actuel: $CURRENT_BALANCE SOL"
echo ""

# Comparer avec le requis (bash ne supporte pas les floats natifs)
CURRENT_LAMPORTS=$(echo "$CURRENT_BALANCE * 1000000000" | bc)
REQUIRED_LAMPORTS=$(echo "$REQUIRED_SOL * 1000000000" | bc)

if (( $(echo "$CURRENT_LAMPORTS >= $REQUIRED_LAMPORTS" | bc -l) )); then
    echo "✅ Solde suffisant pour le déploiement!"
    exit 0
fi

echo "⚠️  Solde insuffisant. Tentative d'obtention de SOL..."
echo ""

# Méthode 1: Airdrop CLI avec retry
echo "🔄 Méthode 1: Airdrop CLI (avec retry toutes les 60s)"
for i in {1..5}; do
    echo "   Tentative $i/5..."
    
    if solana airdrop $AMOUNT 2>/dev/null; then
        echo "   ✅ Airdrop réussi!"
        CURRENT_BALANCE=$(solana balance | awk '{print $1}')
        echo "   💰 Nouveau solde: $CURRENT_BALANCE SOL"
        
        CURRENT_LAMPORTS=$(echo "$CURRENT_BALANCE * 1000000000" | bc)
        if (( $(echo "$CURRENT_LAMPORTS >= $REQUIRED_LAMPORTS" | bc -l) )); then
            echo ""
            echo "✅ Objectif atteint! Solde suffisant pour le déploiement."
            exit 0
        fi
    else
        echo "   ❌ Échec (rate limit ou erreur réseau)"
        if [ $i -lt 5 ]; then
            echo "   ⏳ Attente 60 secondes avant retry..."
            sleep 60
        fi
    fi
done

echo ""
echo "❌ Toutes les tentatives d'airdrop CLI ont échoué."
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  SOLUTIONS ALTERNATIVES                                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📍 Méthode 2: Faucet Web Solana (RECOMMANDÉ)"
echo "   1. Ouvrir: https://faucet.solana.com/"
echo "   2. Entrer votre adresse: $WALLET"
echo "   3. Sélectionner 'Devnet'"
echo "   4. Demander 5 SOL"
echo "   5. Vérifier: solana balance"
echo ""
echo "📍 Méthode 3: QuickNode Faucet"
echo "   1. Ouvrir: https://faucet.quicknode.com/solana/devnet"
echo "   2. Entrer: $WALLET"
echo "   3. Demander SOL"
echo ""
echo "📍 Méthode 4: SolFaucet.com"
echo "   1. Ouvrir: https://solfaucet.com/"
echo "   2. Sélectionner 'Devnet'"
echo "   3. Entrer: $WALLET"
echo ""
echo "📍 Méthode 5: Créer un Nouveau Wallet (backup)"
echo "   solana-keygen new --outfile ~/.config/solana/deploy2.json"
echo "   solana config set --keypair ~/.config/solana/deploy2.json"
echo "   solana airdrop 2"
echo "   # Transférer ensuite vers le wallet principal"
echo ""
echo "Une fois le SOL obtenu, relancer:"
echo "   ./deploy-remaining-programs.sh"
echo ""
