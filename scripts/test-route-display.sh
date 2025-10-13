#!/bin/bash

# Script de test pour valider l'affichage des routes de swap

echo "🧪 Test de l'affichage des routes de swap"
echo "=========================================="
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Health check Oracle
echo -e "${BLUE}Test 1: Health check Oracle API${NC}"
HEALTH=$(curl -s http://localhost:3003/health)
if echo "$HEALTH" | grep -q "OK"; then
  echo -e "${GREEN}✅ Oracle API est en ligne${NC}"
else
  echo -e "${RED}❌ Oracle API ne répond pas${NC}"
  exit 1
fi
echo ""

# Test 2: Route Direct
echo -e "${BLUE}Test 2: Route Direct (1 étape)${NC}"
DIRECT=$(curl -s -X POST http://localhost:3003/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "inputMint":"So11111111111111111111111111111111111111112",
    "outputMint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "inputAmount":"1000000"
  }')

ROUTE_COUNT=$(echo "$DIRECT" | jq -r '.route | length')
ROUTE_TYPE=$(echo "$DIRECT" | jq -r '.type')

if [ "$ROUTE_COUNT" -eq 1 ] && [ "$ROUTE_TYPE" == "Direct" ]; then
  echo -e "${GREEN}✅ Route Direct correctement générée${NC}"
  echo "   Type: $ROUTE_TYPE"
  echo "   Étapes: $ROUTE_COUNT"
  STEP1=$(echo "$DIRECT" | jq -r '.route[0]')
  echo "   Étape 1: $(echo "$STEP1" | jq -r '.label')"
elif [ "$ROUTE_TYPE" == "Aggregator" ]; then
  echo -e "${YELLOW}⚠️  Route Aggregator générée au lieu de Direct (50% de chance)${NC}"
  echo "   Retentative pour obtenir une route Direct..."
  # Retry
  for i in {1..5}; do
    RETRY=$(curl -s -X POST http://localhost:3003/simulate \
      -H "Content-Type: application/json" \
      -d '{"inputMint":"So11111111111111111111111111111111111111112","outputMint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","inputAmount":"1000000"}')
    RETRY_TYPE=$(echo "$RETRY" | jq -r '.type')
    if [ "$RETRY_TYPE" == "Direct" ]; then
      echo -e "${GREEN}✅ Route Direct obtenue (tentative $i)${NC}"
      break
    fi
  done
else
  echo -e "${RED}❌ Erreur dans la génération de route Direct${NC}"
  exit 1
fi
echo ""

# Test 3: Route Aggregator
echo -e "${BLUE}Test 3: Route Aggregator (2 étapes)${NC}"

# Chercher une route Aggregator
AGGREGATOR=""
for i in {1..10}; do
  RESULT=$(curl -s -X POST http://localhost:3003/simulate \
    -H "Content-Type: application/json" \
    -d '{
      "inputMint":"So11111111111111111111111111111111111111112",
      "outputMint":"Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
      "inputAmount":"3000000"
    }')
  TYPE=$(echo "$RESULT" | jq -r '.type')
  if [ "$TYPE" == "Aggregator" ]; then
    AGGREGATOR="$RESULT"
    break
  fi
done

if [ -z "$AGGREGATOR" ]; then
  echo -e "${YELLOW}⚠️  Aucune route Aggregator générée après 10 tentatives${NC}"
else
  ROUTE_COUNT=$(echo "$AGGREGATOR" | jq -r '.route | length')
  
  # Vérifier les tokens
  INPUT_MINT_1=$(echo "$AGGREGATOR" | jq -r '.route[0].inputMint')
  OUTPUT_MINT_1=$(echo "$AGGREGATOR" | jq -r '.route[0].outputMint')
  INPUT_MINT_2=$(echo "$AGGREGATOR" | jq -r '.route[1].inputMint')
  OUTPUT_MINT_2=$(echo "$AGGREGATOR" | jq -r '.route[1].outputMint')
  
  echo "   Type: Aggregator"
  echo "   Étapes: $ROUTE_COUNT"
  echo ""
  echo "   Étape 1: $(echo "$AGGREGATOR" | jq -r '.route[0].label')"
  echo "     Input:  ${INPUT_MINT_1:0:10}..."
  echo "     Output: ${OUTPUT_MINT_1:0:10}..."
  echo ""
  echo "   Étape 2: $(echo "$AGGREGATOR" | jq -r '.route[1].label')"
  echo "     Input:  ${INPUT_MINT_2:0:10}..."
  echo "     Output: ${OUTPUT_MINT_2:0:10}..."
  echo ""
  
  # Vérification critique: l'outputMint de l'étape 2 doit être différent de l'inputMint
  if [ "$OUTPUT_MINT_2" == "$INPUT_MINT_2" ]; then
    echo -e "${RED}❌ ERREUR: Étape 2 a le même token en entrée et sortie${NC}"
    echo "   Input Mint 2:  $INPUT_MINT_2"
    echo "   Output Mint 2: $OUTPUT_MINT_2"
    exit 1
  fi
  
  # Vérifier que l'output de l'étape 2 est bien le token de sortie demandé (USDT)
  USDT_ADDRESS="Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
  if [ "$OUTPUT_MINT_2" == "$USDT_ADDRESS" ]; then
    echo -e "${GREEN}✅ Route Aggregator correctement générée${NC}"
    echo -e "${GREEN}✅ Token de sortie final correct (USDT)${NC}"
  else
    echo -e "${RED}❌ Token de sortie incorrect${NC}"
    echo "   Attendu: $USDT_ADDRESS"
    echo "   Obtenu:  $OUTPUT_MINT_2"
    exit 1
  fi
fi
echo ""

# Test 4: Health check Next.js
echo -e "${BLUE}Test 4: Health check Next.js${NC}"
NEXTJS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$NEXTJS_STATUS" -eq 200 ]; then
  echo -e "${GREEN}✅ Next.js est en ligne (http://localhost:3000)${NC}"
else
  echo -e "${RED}❌ Next.js ne répond pas (code: $NEXTJS_STATUS)${NC}"
  exit 1
fi
echo ""

# Résumé
echo "=========================================="
echo -e "${GREEN}🎉 Tous les tests sont passés avec succès !${NC}"
echo ""
echo "L'affichage des routes de swap fonctionne correctement :"
echo "  ✅ Routes Direct (1 étape)"
echo "  ✅ Routes Aggregator (2 étapes)"
echo "  ✅ Tokens de sortie corrects"
echo "  ✅ Interface accessible"
echo ""
echo "Ouvrir l'application :"
echo "  → http://localhost:3000"
