#!/bin/bash

# 🧪 Simulation Environnement Vercel - Test avec Données Réelles
# Ce script simule l'environnement Vercel et teste l'API Jupiter réelle

set -e

echo "════════════════════════════════════════════════════════════"
echo "🚀 SIMULATION ENVIRONNEMENT VERCEL"
echo "════════════════════════════════════════════════════════════"
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Créer environnement .env.vercel.test
echo -e "${BLUE}📝 Création de l'environnement Vercel simulé...${NC}"

cat > /workspaces/SwapBack/app/.env.vercel.test << 'EOF'
# VERCEL SIMULATION - Données Réelles
JUPITER_API_URL=https://quote-api.jup.ag/v6
USE_MOCK_QUOTES=false

# Network Configuration
NEXT_PUBLIC_SOLANA_NETWORK=testnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.testnet.solana.com

# Program IDs
NEXT_PUBLIC_ROUTER_PROGRAM_ID=yeKoCvFPTmgn5oCejqFVU5mUNdVbZSxwETCXDuBpfxn
NEXT_PUBLIC_BUYBACK_PROGRAM_ID=DkaELUiGtTcFniZvHRicHn3RK11CsemDRW7h8qVQaiJi
NEXT_PUBLIC_CNFT_PROGRAM_ID=GFnJ59QDC4ANdMhsvDZaFoBTNUiq3cY3rQfHCoDYAQ3B

# Tokens
NEXT_PUBLIC_BACK_MINT=5UpRMH1xbHYsZdrYwjVab8cVN3QXJpFubCB5WXeB8i27
NEXT_PUBLIC_USDC_MINT=BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR

# Infrastructure
NEXT_PUBLIC_MERKLE_TREE=93Tzc7btocwzDSbscW9EfL9dBzWLx85FHE6zeWrwHbNT
NEXT_PUBLIC_COLLECTION_CONFIG=4zhpvzBMqvGoM7j9RAaAF5ZizwDUAtgYr5Pnzn8uRh5s

# Fees
NEXT_PUBLIC_PLATFORM_FEE_BPS=20
NEXT_PUBLIC_PLATFORM_FEE_PERCENT=0.20
EOF

echo -e "${GREEN}✅ Environnement créé: .env.vercel.test${NC}"
echo ""

# Backup de .env.local
if [ -f /workspaces/SwapBack/app/.env.local ]; then
    cp /workspaces/SwapBack/app/.env.local /workspaces/SwapBack/app/.env.local.backup
    echo -e "${YELLOW}💾 Backup créé: .env.local.backup${NC}"
fi

# Utiliser l'environnement Vercel
cp /workspaces/SwapBack/app/.env.vercel.test /workspaces/SwapBack/app/.env.local
echo -e "${GREEN}✅ Environnement Vercel activé${NC}"
echo ""

# Arrêter le serveur actuel
echo -e "${BLUE}⏹️  Arrêt du serveur actuel...${NC}"
pkill -f "next dev" 2>/dev/null || true
sleep 2

# Démarrer le serveur avec env Vercel
echo -e "${BLUE}🚀 Démarrage du serveur Next.js (mode Vercel)...${NC}"
cd /workspaces/SwapBack/app
nohup npm run dev > /tmp/vercel-sim.log 2>&1 &
sleep 5

echo -e "${GREEN}✅ Serveur démarré${NC}"
echo ""

# Vérifier que le serveur répond
echo "════════════════════════════════════════════════════════════"
echo -e "${BLUE}TEST 1: Vérification du serveur${NC}"
echo "════════════════════════════════════════════════════════════"

if curl -s http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}✅ Serveur répond sur http://localhost:3000${NC}"
else
    echo -e "${RED}❌ Serveur ne répond pas${NC}"
    exit 1
fi
echo ""

# Test de l'API avec Jupiter RÉEL
echo "════════════════════════════════════════════════════════════"
echo -e "${BLUE}TEST 2: API /api/swap/quote avec Jupiter RÉEL${NC}"
echo "════════════════════════════════════════════════════════════"

REQUEST_BODY='{
  "inputMint": "So11111111111111111111111111111111111111112",
  "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "amount": 1000000000,
  "slippageBps": 50
}'

echo "📤 Requête:"
echo "$REQUEST_BODY" | jq '.'
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/swap/quote \
  -H "Content-Type: application/json" \
  -d "$REQUEST_BODY")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo -e "${YELLOW}📥 Réponse HTTP: $HTTP_CODE${NC}"

if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}✅ API répond avec succès${NC}"
    echo ""
    echo "Réponse complète:"
    echo "$BODY" | jq '.'
    
    # Vérifier si c'est des données MOCK ou REAL
    IS_MOCK=$(echo "$BODY" | jq -r '.quote._isMockData // "null"')
    
    if [ "$IS_MOCK" == "true" ]; then
        echo ""
        echo -e "${YELLOW}⚠️  ATTENTION: L'API retourne des données MOCK!${NC}"
        echo -e "${YELLOW}   Vérifier la variable USE_MOCK_QUOTES${NC}"
    elif [ "$IS_MOCK" == "false" ] || [ "$IS_MOCK" == "null" ]; then
        echo ""
        echo -e "${GREEN}✅ Données RÉELLES de Jupiter API${NC}"
    fi
    
    # Vérifier la structure
    HAS_SUCCESS=$(echo "$BODY" | jq -r '.success')
    HAS_QUOTE=$(echo "$BODY" | jq -r '.quote // "null"')
    
    if [ "$HAS_SUCCESS" == "true" ]; then
        echo -e "${GREEN}✅ success: true${NC}"
    fi
    
    if [ "$HAS_QUOTE" != "null" ]; then
        echo -e "${GREEN}✅ Quote présent${NC}"
        
        # Détails du quote
        IN_AMOUNT=$(echo "$BODY" | jq -r '.quote.inAmount')
        OUT_AMOUNT=$(echo "$BODY" | jq -r '.quote.outAmount')
        PRICE_IMPACT=$(echo "$BODY" | jq -r '.quote.priceImpactPct')
        
        echo ""
        echo "📊 Détails du quote:"
        echo "   - Input: $IN_AMOUNT lamports"
        echo "   - Output: $OUT_AMOUNT lamports"
        echo "   - Price Impact: $PRICE_IMPACT"
    fi
else
    echo -e "${RED}❌ Erreur HTTP $HTTP_CODE${NC}"
    echo ""
    echo "Réponse:"
    echo "$BODY" | jq '.' || echo "$BODY"
fi

echo ""

# Test de connectivité Jupiter
echo "════════════════════════════════════════════════════════════"
echo -e "${BLUE}TEST 3: Connectivité directe à Jupiter API${NC}"
echo "════════════════════════════════════════════════════════════"

JUPITER_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET \
  "https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000000&slippageBps=50" 2>&1)

JUP_CODE=$(echo "$JUPITER_RESPONSE" | tail -n1)
JUP_BODY=$(echo "$JUPITER_RESPONSE" | sed '$d')

if [ "$JUP_CODE" == "200" ]; then
    echo -e "${GREEN}✅ Jupiter API accessible (HTTP $JUP_CODE)${NC}"
    echo ""
    echo "Extrait de la réponse:"
    echo "$JUP_BODY" | jq '{inAmount, outAmount, priceImpactPct}' 2>/dev/null || echo "Réponse OK"
elif [[ "$JUPITER_RESPONSE" == *"Could not resolve host"* ]]; then
    echo -e "${RED}❌ DNS bloqué - Impossible de résoudre quote-api.jup.ag${NC}"
    echo -e "${YELLOW}   → C'est normal dans Codespaces${NC}"
    echo -e "${YELLOW}   → Sur Vercel, ça devrait fonctionner${NC}"
else
    echo -e "${YELLOW}⚠️  Erreur Jupiter API (HTTP $JUP_CODE)${NC}"
    echo "$JUP_BODY" | head -10
fi

echo ""

# Test avec différentes paires de tokens
echo "════════════════════════════════════════════════════════════"
echo -e "${BLUE}TEST 4: Tests avec différentes paires de tokens${NC}"
echo "════════════════════════════════════════════════════════════"

# Test 1: SOL → USDC (mainnet)
echo -e "${YELLOW}Test 4.1: SOL → USDC (Mainnet)${NC}"
RESP1=$(curl -s -X POST http://localhost:3000/api/swap/quote \
  -H "Content-Type: application/json" \
  -d '{
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amount": 1000000000,
    "slippageBps": 50
  }')

if echo "$RESP1" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ SOL → USDC (mainnet) fonctionne${NC}"
else
    echo -e "${RED}❌ SOL → USDC (mainnet) échoue${NC}"
    echo "$RESP1" | jq '.error' || echo "$RESP1"
fi

# Test 2: SOL → USDC (testnet)
echo -e "${YELLOW}Test 4.2: SOL → USDC (Testnet)${NC}"
RESP2=$(curl -s -X POST http://localhost:3000/api/swap/quote \
  -H "Content-Type: application/json" \
  -d '{
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR",
    "amount": 1000000000,
    "slippageBps": 50
  }')

if echo "$RESP2" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ SOL → USDC (testnet) fonctionne${NC}"
else
    echo -e "${RED}❌ SOL → USDC (testnet) échoue${NC}"
    echo "$RESP2" | jq '.error' || echo "$RESP2"
fi

echo ""

# Vérifier les logs du serveur
echo "════════════════════════════════════════════════════════════"
echo -e "${BLUE}TEST 5: Logs du serveur${NC}"
echo "════════════════════════════════════════════════════════════"

echo "Dernières 30 lignes des logs:"
tail -30 /tmp/vercel-sim.log

echo ""

# Résumé final
echo "════════════════════════════════════════════════════════════"
echo -e "${BLUE}📊 RÉSUMÉ DE LA SIMULATION VERCEL${NC}"
echo "════════════════════════════════════════════════════════════"
echo ""

echo "Environnement:"
echo "  - USE_MOCK_QUOTES: false (données réelles)"
echo "  - JUPITER_API_URL: https://quote-api.jup.ag/v6"
echo "  - Network: testnet"
echo ""

echo "Tests effectués:"
echo "  ✅ Serveur Next.js: OK"
echo "  ? API /api/swap/quote: Vérifier ci-dessus"
echo "  ? Jupiter API directe: Vérifier ci-dessus"
echo "  ? Tests multi-paires: Vérifier ci-dessus"
echo ""

echo "Fichiers créés:"
echo "  - .env.vercel.test (environnement de simulation)"
echo "  - .env.local.backup (backup de l'ancien .env.local)"
echo "  - /tmp/vercel-sim.log (logs du serveur)"
echo ""

echo -e "${YELLOW}📋 Pour restaurer l'environnement original:${NC}"
echo "  mv /workspaces/SwapBack/app/.env.local.backup /workspaces/SwapBack/app/.env.local"
echo ""

echo -e "${GREEN}✅ Simulation terminée!${NC}"
echo ""
echo "Pour voir les logs en temps réel:"
echo "  tail -f /tmp/vercel-sim.log"
