#!/bin/bash

# Script d'initialisation des programmes SwapBack sur Devnet
# Usage: ./scripts/init-devnet.sh

set -e

echo "🚀 Initialisation des programmes SwapBack sur Devnet"
echo "======================================================"
echo ""

# Configuration
CLUSTER="devnet"
BUYBACK_PROGRAM="71vALqj3cmQWDmq9bi9GYYDPQqpoRstej3snUbikpCHW"
CNFT_PROGRAM="HAtZ7hJt2YFZSYnAaVwRg3jGTAbr8u6nze3KkSHfwFrf"
WALLET=$(solana address)

echo "📍 Configuration:"
echo "   Cluster: $CLUSTER"
echo "   Wallet: $WALLET"
echo "   Buyback Program: $BUYBACK_PROGRAM"
echo "   cNFT Program: $CNFT_PROGRAM"
echo ""

# Vérifier le solde
BALANCE=$(solana balance --url $CLUSTER | awk '{print $1}')
echo "💰 Balance actuelle: $BALANCE SOL"

if (( $(echo "$BALANCE < 1" | bc -l) )); then
    echo "⚠️  Solde faible, demande d'airdrop..."
    solana airdrop 2 --url $CLUSTER
    sleep 2
    BALANCE=$(solana balance --url $CLUSTER | awk '{print $1}')
    echo "✅ Nouveau solde: $BALANCE SOL"
fi

echo ""
echo "📝 Étape 1: Création des tokens de test"
echo "========================================"
echo ""

# Fichier cache pour les tokens
CACHE_FILE=".devnet-tokens.json"

if [ -f "$CACHE_FILE" ]; then
    echo "✅ Tokens récupérés depuis le cache:"
    BACK_MINT=$(cat $CACHE_FILE | grep backMint | cut -d'"' -f4)
    USDC_MINT=$(cat $CACHE_FILE | grep usdcMint | cut -d'"' -f4)
    echo "   \$BACK Mint: $BACK_MINT"
    echo "   USDC Mint: $USDC_MINT"
else
    echo "🔨 Création de nouveaux tokens..."
    
    # Créer token $BACK (9 decimals)
    BACK_MINT=$(spl-token create-token --decimals 9 --url $CLUSTER 2>&1 | grep "Creating token" | awk '{print $3}')
    echo "✅ Token \$BACK créé: $BACK_MINT"
    
    # Créer token USDC (6 decimals)
    USDC_MINT=$(spl-token create-token --decimals 6 --url $CLUSTER 2>&1 | grep "Creating token" | awk '{print $3}')
    echo "✅ Token USDC créé: $USDC_MINT"
    
    # Sauvegarder dans le cache
    cat > $CACHE_FILE <<EOF
{
  "backMint": "$BACK_MINT",
  "usdcMint": "$USDC_MINT",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    echo "💾 Tokens sauvegardés dans $CACHE_FILE"
fi

echo ""
echo "🪙 Création des token accounts..."

# Créer token account pour $BACK
BACK_ACCOUNT=$(spl-token create-account $BACK_MINT --url $CLUSTER 2>&1 | grep "Creating account" | awk '{print $3}' || spl-token accounts $BACK_MINT --url $CLUSTER 2>&1 | grep "$BACK_MINT" | awk '{print $1}')
echo "   \$BACK Account: $BACK_ACCOUNT"

# Créer token account pour USDC
USDC_ACCOUNT=$(spl-token create-account $USDC_MINT --url $CLUSTER 2>&1 | grep "Creating account" | awk '{print $3}' || spl-token accounts $USDC_MINT --url $CLUSTER 2>&1 | grep "$USDC_MINT" | awk '{print $1}')
echo "   USDC Account: $USDC_ACCOUNT"

echo ""
echo "💵 Mint de tokens de test..."

# Vérifier et mint des tokens
BACK_BALANCE=$(spl-token balance $BACK_MINT --url $CLUSTER 2>/dev/null || echo "0")
if (( $(echo "$BACK_BALANCE < 1" | bc -l) )); then
    spl-token mint $BACK_MINT 1000000 --url $CLUSTER -- $BACK_ACCOUNT
    echo "✅ Minté 1,000,000 \$BACK"
else
    echo "✅ Balance \$BACK: $BACK_BALANCE"
fi

USDC_BALANCE=$(spl-token balance $USDC_MINT --url $CLUSTER 2>/dev/null || echo "0")
if (( $(echo "$USDC_BALANCE < 1" | bc -l) )); then
    spl-token mint $USDC_MINT 10000 --url $CLUSTER -- $USDC_ACCOUNT
    echo "✅ Minté 10,000 USDC"
else
    echo "✅ Balance USDC: $USDC_BALANCE"
fi

echo ""
echo "============================================================"
echo "✅ Initialisation des tokens terminée!"
echo ""
echo "📊 Résumé:"
echo "   • Token \$BACK: $BACK_MINT"
echo "   • Token USDC: $USDC_MINT"
echo "   • \$BACK Account: $BACK_ACCOUNT"
echo "   • USDC Account: $USDC_ACCOUNT"
echo ""
echo "🎯 Prochaines étapes:"
echo "   1. Copier ces adresses dans votre frontend/SDK"
echo "   2. Initialiser le programme buyback avec ces tokens"
echo "   3. Tester un swap sur l'interface"
echo ""
echo "📝 Pour initialiser le programme buyback, utilise:"
echo "   anchor run init-buyback --provider.cluster devnet"
echo ""
echo "💡 Les adresses sont sauvegardées dans $CACHE_FILE"
echo "============================================================"
