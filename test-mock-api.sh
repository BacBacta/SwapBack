#!/bin/bash

echo "🧪 Test de l'API en Mode Mock"
echo "=============================="
echo ""

# Attendre que le serveur soit prêt
echo "⏳ Attente du serveur Next.js..."
sleep 3

# Test 1: Vérifier l'environnement
echo "📋 Test 1: Variables d'environnement"
echo "-------------------------------------"
curl -s "http://localhost:3000/api/test" | jq '.environment | {SOLANA_NETWORK, USE_MOCK_QUOTES}'
echo ""

# Test 2: Quote BACK → USDC
echo "📋 Test 2: Quote 1 BACK → USDC (Mode Mock)"
echo "-------------------------------------------"
RESULT=$(curl -s "http://localhost:3000/api/swap/quote?inputMint=14rtHCJVvU7NKeFJotJsHdbsQGajnNmoQ7MHid41RLTa&outputMint=BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR&amount=1000000&slippageBps=50")

if echo "$RESULT" | jq -e '.success' > /dev/null 2>&1; then
  echo "✅ Success: $(echo "$RESULT" | jq '.success')"
  echo "📊 Out Amount: $(echo "$RESULT" | jq '.quote.outAmount')"
  echo "🛣️  Route Plan:"
  echo "$RESULT" | jq '.quote.routePlan[0]'
else
  echo "❌ Erreur:"
  echo "$RESULT" | jq '.'
fi

echo ""
echo "✅ Test terminé !"
echo ""
echo "💡 Si le mode mock fonctionne, vous devriez voir des routes simulées."
echo "🌐 Ouvrez http://localhost:3000 pour tester l'interface"
