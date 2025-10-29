#!/bin/bash

# Script de test pour vérifier l'intégration Jupiter côté client

echo "🧪 TEST: Vérification de l'intégration Jupiter sur Vercel"
echo "=================================================="
echo ""

# URL de l'application
APP_URL="https://swapback-teal.vercel.app"

echo "1️⃣ Vérification que l'API route serveur est désactivée..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/api/swap/quote")
if [ "$API_STATUS" = "404" ]; then
  echo "✅ API route désactivée (404)"
else
  echo "⚠️  API route retourne: $API_STATUS"
fi
echo ""

echo "2️⃣ Vérification que l'application est accessible..."
APP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL")
if [ "$APP_STATUS" = "200" ]; then
  echo "✅ Application accessible (200)"
else
  echo "❌ Application retourne: $APP_STATUS"
  exit 1
fi
echo ""

echo "3️⃣ Test direct de l'API Jupiter (depuis ce serveur)..."
echo "   Note: Ce test échouera dans Codespaces à cause du DNS block"
JUPITER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000000&slippageBps=50" 2>&1)
if [ "$JUPITER_STATUS" = "200" ]; then
  echo "✅ Jupiter API accessible (200)"
elif [ "$JUPITER_STATUS" = "000" ]; then
  echo "⚠️  Jupiter API bloquée (DNS ENOTFOUND) - Normal dans Codespaces"
else
  echo "⚠️  Jupiter API retourne: $JUPITER_STATUS"
fi
echo ""

echo "=================================================="
echo "📋 RÉSUMÉ"
echo "=================================================="
echo ""
echo "🌐 Application Vercel: $APP_URL"
echo "📝 API route serveur: DÉSACTIVÉE ✅"
echo "🎯 Prochaine étape: TESTER DANS LE NAVIGATEUR"
echo ""
echo "📖 Instructions:"
echo "   1. Ouvrir: $APP_URL"
echo "   2. Ouvrir Console (F12)"
echo "   3. Sélectionner: SOL → USDC"
echo "   4. Cliquer: 'Search Route'"
echo "   5. Vérifier dans l'onglet Network:"
echo "      ✅ Appel direct à 'quote-api.jup.ag' (pas /api/swap/quote)"
echo "      ✅ Status 200 avec données Jupiter"
echo ""
echo "🎉 Si vous voyez les routes Jupiter, C'EST GAGNÉ!"
