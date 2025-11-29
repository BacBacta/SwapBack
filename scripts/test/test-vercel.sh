#!/bin/bash

# 🧪 Script de Test Vercel - Diagnostic Complet
# Usage: ./test-vercel.sh https://votre-app.vercel.app

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# URL de l'app Vercel
VERCEL_URL="${1:-}"

if [ -z "$VERCEL_URL" ]; then
  echo -e "${RED}❌ Erreur: URL Vercel requise${NC}"
  echo ""
  echo "Usage: $0 https://votre-app.vercel.app"
  echo ""
  echo "Exemple:"
  echo "  $0 https://swap-back.vercel.app"
  exit 1
fi

# Remove trailing slash
VERCEL_URL="${VERCEL_URL%/}"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🧪 Test de Diagnostic Vercel - SwapBack                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}🌐 URL testée: $VERCEL_URL${NC}"
echo ""

# ==============================================================================
# TEST 1: Application principale répond
# ==============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 1: Application principale${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$VERCEL_URL")

if [ "$HTTP_CODE" == "200" ]; then
  echo -e "${GREEN}✅ Application répond (HTTP $HTTP_CODE)${NC}"
else
  echo -e "${RED}❌ Application ne répond pas (HTTP $HTTP_CODE)${NC}"
  exit 1
fi

# ==============================================================================
# TEST 2: API Health Check (si existe)
# ==============================================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 2: API Health Endpoint${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$VERCEL_URL/api/health")

if [ "$HEALTH_CODE" == "200" ]; then
  echo -e "${GREEN}✅ API Health répond (HTTP $HEALTH_CODE)${NC}"
  curl -s "$VERCEL_URL/api/health" | jq '.' 2>/dev/null || curl -s "$VERCEL_URL/api/health"
elif [ "$HEALTH_CODE" == "404" ]; then
  echo -e "${YELLOW}⚠️  API Health n'existe pas (HTTP $HEALTH_CODE) - OK si pas implémenté${NC}"
else
  echo -e "${RED}❌ API Health erreur (HTTP $HEALTH_CODE)${NC}"
fi

# ==============================================================================
# TEST 3: API Swap Quote
# ==============================================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 3: API Swap Quote (Route principale)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

REQUEST_BODY='{
  "inputMint": "So11111111111111111111111111111111111111112",
  "outputMint": "BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR",
  "amount": 1000000000,
  "slippageBps": 50
}'

echo -e "${YELLOW}📤 Envoi de la requête...${NC}"
echo -e "${YELLOW}Body: $(echo $REQUEST_BODY | jq -c '.')${NC}"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$VERCEL_URL/api/swap/quote" \
  -H "Content-Type: application/json" \
  -d "$REQUEST_BODY")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo -e "${YELLOW}📥 Réponse (HTTP $HTTP_CODE):${NC}"

if [ "$HTTP_CODE" == "200" ]; then
  echo -e "${GREEN}✅ API Quote répond correctement${NC}"
  echo ""
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
  
  # Vérifier la structure de la réponse
  echo ""
  HAS_SUCCESS=$(echo "$BODY" | jq -r '.success' 2>/dev/null || echo "null")
  HAS_QUOTE=$(echo "$BODY" | jq -r '.quote' 2>/dev/null || echo "null")
  IS_MOCK=$(echo "$BODY" | jq -r '.quote._isMockData' 2>/dev/null || echo "null")
  
  if [ "$HAS_SUCCESS" == "true" ]; then
    echo -e "${GREEN}✅ Réponse success: true${NC}"
  else
    echo -e "${RED}❌ Réponse success: $HAS_SUCCESS${NC}"
  fi
  
  if [ "$HAS_QUOTE" != "null" ]; then
    echo -e "${GREEN}✅ Quote présent dans la réponse${NC}"
  else
    echo -e "${RED}❌ Quote absent de la réponse${NC}"
  fi
  
  if [ "$IS_MOCK" == "true" ]; then
    echo -e "${YELLOW}⚠️  Mode MOCK activé (USE_MOCK_QUOTES=true)${NC}"
    echo -e "${YELLOW}   → Pour utiliser Jupiter réel, mettre USE_MOCK_QUOTES=false${NC}"
  elif [ "$IS_MOCK" == "false" ] || [ "$IS_MOCK" == "null" ]; then
    echo -e "${GREEN}✅ Mode RÉEL (Jupiter API)${NC}"
  fi
  
elif [ "$HTTP_CODE" == "404" ]; then
  echo -e "${RED}❌ Route API n'existe pas (HTTP 404)${NC}"
  echo -e "${RED}   → Vérifier que /app/src/app/api/swap/quote/route.ts est déployé${NC}"
  echo ""
  echo "$BODY"
  exit 1
  
elif [ "$HTTP_CODE" == "500" ]; then
  echo -e "${RED}❌ Erreur serveur (HTTP 500)${NC}"
  echo -e "${RED}   → Vérifier les logs Vercel Functions${NC}"
  echo -e "${RED}   → Vérifier les variables d'environnement${NC}"
  echo ""
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
  exit 1
  
else
  echo -e "${RED}❌ Erreur HTTP $HTTP_CODE${NC}"
  echo ""
  echo "$BODY"
  exit 1
fi

# ==============================================================================
# TEST 4: Variables d'environnement (frontend)
# ==============================================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 4: Variables d'environnement Frontend${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${YELLOW}⚠️  Impossible de tester les variables NEXT_PUBLIC_ via API${NC}"
echo -e "${YELLOW}   → Ouvrir l'app dans le navigateur et vérifier la console:${NC}"
echo ""
echo -e "   ${BLUE}// Dans la console du navigateur:${NC}"
echo -e "   ${BLUE}console.log({${NC}"
echo -e "   ${BLUE}  network: process.env.NEXT_PUBLIC_SOLANA_NETWORK,${NC}"
echo -e "   ${BLUE}  rpc: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,${NC}"
echo -e "   ${BLUE}  router: process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID${NC}"
echo -e "   ${BLUE}});${NC}"

# ==============================================================================
# RÉSUMÉ
# ==============================================================================
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  📊 RÉSUMÉ DES TESTS                                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Application principale: OK${NC}"
echo -e "${GREEN}✅ API Swap Quote: OK${NC}"
echo ""
echo -e "${YELLOW}📋 Prochaines Étapes:${NC}"
echo ""
echo "1. ${BLUE}Ouvrir l'application dans le navigateur:${NC}"
echo "   $VERCEL_URL"
echo ""
echo "2. ${BLUE}Ouvrir la console (F12)${NC}"
echo ""
echo "3. ${BLUE}Connecter le wallet${NC}"
echo ""
echo "4. ${BLUE}Sélectionner tokens et montant${NC}"
echo ""
echo "5. ${BLUE}Cliquer sur \"🔍 Search Route\"${NC}"
echo ""
echo "6. ${BLUE}Vérifier les logs dans la console:${NC}"
echo "   - 🔘 handleSearchRoute clicked"
echo "   - ✅ Conditions met - calling fetchRoutes()"
echo "   - 🔄 fetchRoutes: Starting route search"
echo "   - 📤 fetchRoutes: Sending request"
echo "   - ✅ fetchRoutes: Received data"
echo ""
echo -e "${GREEN}✅ Script terminé avec succès${NC}"
echo ""
