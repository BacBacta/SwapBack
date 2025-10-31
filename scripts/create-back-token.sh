#!/bin/bash

# Script de création du token $BACK sur Devnet
# Token-2022 avec Transfer Hook pour burn automatique

set -e

echo "💰 Création du Token \$BACK sur Devnet"
echo "======================================="
echo ""

# Vérifier la connexion devnet
echo "🔍 Vérification configuration Solana..."
CLUSTER=$(solana config get | grep "RPC URL" | awk '{print $3}')
echo "Cluster actuel: $CLUSTER"

if [[ ! "$CLUSTER" =~ "devnet" ]]; then
    echo "⚠️  Configuration vers devnet..."
    solana config set --url devnet
fi

# Vérifier le balance
echo ""
echo "💳 Vérification du balance..."
WALLET=$(solana address)
BALANCE=$(solana balance)
echo "Wallet: $WALLET"
echo "Balance: $BALANCE"

# Airdrop si nécessaire
BALANCE_NUM=$(echo $BALANCE | cut -d' ' -f1)
if (( $(echo "$BALANCE_NUM < 2" | bc -l) )); then
    echo "💸 Airdrop de 2 SOL..."
    solana airdrop 2 || echo "⚠️  Airdrop échoué (rate limit possible), continuons..."
    sleep 2
fi

echo ""
echo "🔨 Création du mint $BACK (Token-2022)..."

# Créer le token avec Token-2022 (supporte les extensions)
# Note: Pour l'instant sans Transfer Hook (simplifié)
# Le Transfer Hook sera ajouté plus tard après résolution du programme

TOKEN_MINT=$(spl-token create-token \
    --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb \
    --decimals 9 \
    2>&1 | grep "Creating token" | awk '{print $3}')

if [ -z "$TOKEN_MINT" ]; then
    echo "❌ Erreur lors de la création du token"
    exit 1
fi

echo "✅ Token $BACK créé: $TOKEN_MINT"

# Créer le compte de token pour le wallet
echo ""
echo "📦 Création du compte de token..."
spl-token create-account $TOKEN_MINT

# Mint supply initial pour tests (1 million de tokens)
echo ""
echo "⚡ Mint de 1,000,000 $BACK pour tests..."
spl-token mint $TOKEN_MINT 1000000 \
    --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

# Vérifier le supply
echo ""
echo "📊 Informations du token:"
spl-token supply $TOKEN_MINT --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

# Sauvegarder les informations
echo ""
echo "💾 Sauvegarde des informations..."
cat > token-back-devnet.json <<EOF
{
  "name": "SwapBack Token",
  "symbol": "BACK",
  "decimals": 9,
  "mint": "$TOKEN_MINT",
  "program": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  "network": "devnet",
  "supply_initial": 1000000,
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "creator": "$WALLET"
}
EOF

cat token-back-devnet.json

echo ""
echo "✅ Token \$BACK créé avec succès sur Devnet !"
echo ""
echo "📝 Informations sauvegardées dans: token-back-devnet.json"
echo ""
echo "🔗 Mint Address: $TOKEN_MINT"
echo "🌐 Explorer: https://explorer.solana.com/address/$TOKEN_MINT?cluster=devnet"
echo ""
echo "📋 Prochaines étapes:"
echo "   1. Mettre à jour les constantes dans le code"
echo "   2. Créer des pools de liquidité (BACK/USDC, BACK/SOL)"
echo "   3. Tester le lock/unlock avec le vrai token"
