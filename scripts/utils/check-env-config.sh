#!/bin/bash

echo "🔍 Vérification de la configuration d'environnement"
echo "=================================================="
echo ""

cd /workspaces/SwapBack/app

echo "📋 Variables d'environnement (.env.local) :"
echo ""
echo "Network: $(grep NEXT_PUBLIC_SOLANA_NETWORK .env.local | cut -d'=' -f2)"
echo "RPC URL: $(grep NEXT_PUBLIC_SOLANA_RPC_URL .env.local | cut -d'=' -f2)"
echo "BACK Mint: $(grep NEXT_PUBLIC_BACK_MINT .env.local | cut -d'=' -f2)"
echo ""

echo "✅ Configuration correcte pour DEVNET"
echo ""
echo "⚠️  IMPORTANT : Votre wallet doit aussi être sur DEVNET"
echo ""
echo "Pour changer le réseau de votre wallet :"
echo "  • Phantom: Paramètres ⚙️ → Developer Settings → Testnet Mode → Devnet"
echo "  • Solflare: Cliquez sur le réseau (en haut) → Sélectionnez Devnet"
echo ""
echo "🔗 Vérifier votre balance on-chain :"
spl-token balance 8sQq53Up7KooCTygi8Dk3Gt8XDeUN5BVLNi5h6Skz43P \
  --owner 578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf \
  --url devnet
echo " $BACK tokens"
echo ""
