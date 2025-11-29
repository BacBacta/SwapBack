#!/bin/bash

# 🧪 Test Rapide Post-Déploiement Vercel

if [ -z "$1" ]; then
    echo "Usage: ./test-vercel-deployment.sh <VERCEL_URL>"
    echo "Exemple: ./test-vercel-deployment.sh https://swapback-abc.vercel.app"
    exit 1
fi

VERCEL_URL="$1"

echo "════════════════════════════════════════════════════════════"
echo "🧪 TEST VERCEL DEPLOYMENT"
echo "URL: $VERCEL_URL"
echo "════════════════════════════════════════════════════════════"
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test 1: Site accessible
echo "TEST 1: Site accessible"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$VERCEL_URL")
if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}✅ Site accessible (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}❌ Site non accessible (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# Test 2: API Quote (SOL → USDC Mainnet)
echo "TEST 2: API Quote (SOL → USDC Mainnet)"
RESPONSE=$(curl -s -X POST "$VERCEL_URL/api/swap/quote" \
  -H "Content-Type: application/json" \
  -d '{
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amount": 1000000000,
    "slippageBps": 50
  }')

SUCCESS=$(echo "$RESPONSE" | jq -r '.success // "null"')
IS_MOCK=$(echo "$RESPONSE" | jq -r '.quote._isMockData // "null"')

if [ "$SUCCESS" == "true" ]; then
    echo -e "${GREEN}✅ API répond avec succès${NC}"
    
    if [ "$IS_MOCK" == "true" ]; then
        echo -e "${YELLOW}⚠️  MOCK DATA (USE_MOCK_QUOTES=true)${NC}"
    elif [ "$IS_MOCK" == "null" ] || [ "$IS_MOCK" == "false" ]; then
        echo -e "${GREEN}✅ DONNÉES RÉELLES Jupiter${NC}"
    fi
    
    echo ""
    echo "Quote reçu:"
    echo "$RESPONSE" | jq '{success, quote: {inAmount, outAmount, priceImpactPct}}'
else
    echo -e "${RED}❌ API échoue${NC}"
    echo ""
    echo "Erreur:"
    echo "$RESPONSE" | jq '.'
fi
echo ""

# Test 3: API Quote (SOL → USDC Testnet)
echo "TEST 3: API Quote (SOL → USDC Testnet)"
RESPONSE2=$(curl -s -X POST "$VERCEL_URL/api/swap/quote" \
  -H "Content-Type: application/json" \
  -d '{
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR",
    "amount": 1000000000,
    "slippageBps": 50
  }')

SUCCESS2=$(echo "$RESPONSE2" | jq -r '.success // "null"')

if [ "$SUCCESS2" == "true" ]; then
    echo -e "${GREEN}✅ Testnet token fonctionne${NC}"
else
    echo -e "${YELLOW}⚠️  Testnet token échoue (attendu si USE_MOCK_QUOTES=false)${NC}"
    ERROR=$(echo "$RESPONSE2" | jq -r '.error // "unknown"')
    echo "Erreur: $ERROR"
fi
echo ""

echo "════════════════════════════════════════════════════════════"
echo "📊 RÉSUMÉ"
echo "════════════════════════════════════════════════════════════"
echo "Site: $([[ "$HTTP_CODE" == "200" ]] && echo -e "${GREEN}✅${NC}" || echo -e "${RED}❌${NC}")"
echo "API Mainnet: $([[ "$SUCCESS" == "true" ]] && echo -e "${GREEN}✅${NC}" || echo -e "${RED}❌${NC}")"
echo "Données: $([[ "$IS_MOCK" == "null" ]] || [[ "$IS_MOCK" == "false" ]] && echo -e "${GREEN}REAL${NC}" || echo -e "${YELLOW}MOCK${NC}")"
echo ""
