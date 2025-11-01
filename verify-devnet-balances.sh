#!/bin/bash
# Script de vérification des soldes sur DEVNET

echo ""
echo "🔍 Vérification de la Configuration DEVNET"
echo "=========================================="
echo ""

# Vérifier les variables d'environnement
echo "📋 Variables d'environnement:"
echo "-----------------------------"
grep "NEXT_PUBLIC_SOLANA_NETWORK\|NEXT_PUBLIC_BACK_MINT\|NEXT_PUBLIC_USDC_MINT" app/.env.local

echo ""
echo "💰 Soldes du wallet de test sur DEVNET:"
echo "----------------------------------------"
echo "Wallet: 3PiZ1xdHbPbj1UaPS8pfzKnHpmQQLfR8zrhy5RcksqAt"
echo ""

spl-token accounts --owner 3PiZ1xdHbPbj1UaPS8pfzKnHpmQQLfR8zrhy5RcksqAt --url devnet

echo ""
echo "✅ Si vous voyez des balances ci-dessus, le serveur Next.js devrait maintenant les afficher !"
echo ""
echo "🌐 Ouvrez http://localhost:3000 et connectez le wallet de test"
echo ""
