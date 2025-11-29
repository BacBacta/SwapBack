#!/bin/bash

# Script pour airdrop des tokens BACK à un wallet sur devnet
# Usage: ./airdrop-back-tokens.sh <WALLET_ADDRESS> <AMOUNT>

set -e

WALLET_ADDRESS="${1:-3PiZ1xdHbPbj1UaPS8pfzKnHpmQQLfR8zrhy5RcksqAt}"
AMOUNT="${2:-100000}"
BACK_MINT="862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux"
RPC_URL="https://api.devnet.solana.com"
MINT_AUTHORITY_BASE58="38dNwvVFzAyxKNojqRwQ5yKSpMc7Mp18kBENyS69km5xT5xRDwbRQQNzh4pv31Wf9ik9dmvGpNayBXoWra9V3Beb"

echo "🚀 Airdrop de tokens BACK sur devnet"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 Wallet destination : $WALLET_ADDRESS"
echo "💰 Montant           : $AMOUNT BACK"
echo "🪙 Token BACK        : $BACK_MINT"
echo ""

# Créer un keypair temporaire à partir du base58
TEMP_KEYPAIR="/tmp/mint-authority-$$.json"
echo "Converting base58 to keypair..."
echo "$MINT_AUTHORITY_BASE58" | solana-keygen pubkey --outfile "$TEMP_KEYPAIR" --force 2>&1 || {
    # Alternative: utiliser bs58 decode si disponible
    echo "Trying alternative method..."
    node -e "
    const bs58 = require('bs58');
    const fs = require('fs');
    const secretKey = bs58.decode('$MINT_AUTHORITY_BASE58');
    fs.writeFileSync('$TEMP_KEYPAIR', JSON.stringify(Array.from(secretKey)));
    " 2>/dev/null || {
        echo "❌ Impossible de convertir le keypair"
        echo "ℹ️  Vous devez avoir le fichier keypair JSON original"
        exit 1
    }
}

# Vérifier la clé publique
MINT_AUTHORITY_PUBKEY=$(solana-keygen pubkey "$TEMP_KEYPAIR")
echo "✅ Mint Authority    : $MINT_AUTHORITY_PUBKEY"
echo ""

# Vérifier que c'est bien la bonne autorité
EXPECTED_AUTHORITY="578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf"
if [ "$MINT_AUTHORITY_PUBKEY" != "$EXPECTED_AUTHORITY" ]; then
    echo "❌ ERREUR: L'autorité ne correspond pas!"
    echo "   Attendu : $EXPECTED_AUTHORITY"
    echo "   Obtenu  : $MINT_AUTHORITY_PUBKEY"
    rm -f "$TEMP_KEYPAIR"
    exit 1
fi

# Créer ou obtenir l'ATA du destinataire
echo "📦 Création/Vérification de l'Associated Token Account..."
spl-token create-account "$BACK_MINT" --owner "$WALLET_ADDRESS" --url "$RPC_URL" 2>/dev/null || echo "   (déjà existant)"

# Mint les tokens
echo ""
echo "💎 Mint de $AMOUNT tokens BACK..."
spl-token mint "$BACK_MINT" "$AMOUNT" "$WALLET_ADDRESS" \
    --owner "$TEMP_KEYPAIR" \
    --url "$RPC_URL"

# Vérifier le solde
echo ""
echo "📊 Vérification du nouveau solde..."
BALANCE=$(spl-token balance "$BACK_MINT" --owner "$WALLET_ADDRESS" --url "$RPC_URL")
echo "✅ Nouveau solde: $BALANCE BACK"

# Nettoyage
rm -f "$TEMP_KEYPAIR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Airdrop terminé avec succès!"
echo "🔗 Vérifiez sur Solana Explorer:"
echo "   https://explorer.solana.com/address/$WALLET_ADDRESS?cluster=devnet"
