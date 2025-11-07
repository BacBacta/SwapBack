#!/bin/bash

echo "🔍 Test de détection des wallets Solana"
echo "======================================"
echo ""

# Test Phantom
if [ -n "$PHANTOM_WALLET_DETECTED" ]; then
    echo "✅ Phantom Wallet: DÉTECTÉ"
else
    echo "❌ Phantom Wallet: NON DÉTECTÉ"
    echo "   💡 Installez l'extension Phantom depuis: https://phantom.app/"
fi

# Test Solflare
if [ -n "$SOLFLARE_WALLET_DETECTED" ]; then
    echo "✅ Solflare Wallet: DÉTECTÉ"
else
    echo "❌ Solflare Wallet: NON DÉTECTÉ"
    echo "   💡 Installez l'extension Solflare depuis: https://solflare.com/"
fi

echo ""
echo "📋 Instructions pour l'application SwapBack:"
echo "1. Ouvrez l'application: http://localhost:3000"
echo "2. Cliquez sur 'Connect Wallet'"
echo "3. Le modal affiche maintenant le statut de détection des wallets"
echo "4. Si un wallet n'est pas détecté, cliquez dessus pour l'ouvrir"
echo "5. Connectez-vous dans l'onglet du wallet, puis revenez à l'application"
echo ""
echo "🔄 La détection se met à jour automatiquement toutes les 2 secondes"