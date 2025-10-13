#!/bin/bash

echo "======================================"
echo "   SwapBack - Tests de Validation    "
echo "======================================"
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Oracle API Health Check
echo -n "Test 1: Oracle API Health Check (port 3003)... "
HEALTH_RESPONSE=$(timeout 3s curl -s http://localhost:3003/health 2>/dev/null)
if [ $? -eq 0 ] && [[ $HEALTH_RESPONSE == *"OK"* ]]; then
    echo -e "${GREEN}✅ PASS${NC}"
    echo "   Réponse: $HEALTH_RESPONSE"
else
    echo -e "${RED}❌ FAIL${NC}"
    echo "   Erreur: Impossible de contacter l'Oracle API"
fi
echo ""

# Test 2: Oracle API Simulate Endpoint
echo -n "Test 2: Oracle API Simulate Endpoint... "
SIMULATE_RESPONSE=$(timeout 3s curl -s -X POST http://localhost:3003/simulate \
    -H "Content-Type: application/json" \
    -d '{"inputMint":"So11111111111111111111111111111111111111112","outputMint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","inputAmount":"1000000"}' \
    2>/dev/null)
if [ $? -eq 0 ] && [[ $SIMULATE_RESPONSE == *"Aggregator"* ]]; then
    echo -e "${GREEN}✅ PASS${NC}"
    echo "   Type: $(echo $SIMULATE_RESPONSE | grep -o '"type":"[^"]*"' | cut -d':' -f2 | tr -d '"')"
    echo "   Input Amount: $(echo $SIMULATE_RESPONSE | grep -o '"inputAmount":[0-9]*' | cut -d':' -f2)"
    echo "   Estimated Output: $(echo $SIMULATE_RESPONSE | grep -o '"estimatedOutput":[0-9]*' | cut -d':' -f2)"
else
    echo -e "${RED}❌ FAIL${NC}"
    echo "   Erreur: Réponse invalide de l'API"
fi
echo ""

# Test 3: Next.js Application
echo -n "Test 3: Next.js Application (port 3000)... "
APP_RESPONSE=$(timeout 3s curl -s http://localhost:3000 2>/dev/null)
if [ $? -eq 0 ] && [[ $APP_RESPONSE == *"<html"* ]] || [[ $APP_RESPONSE == *"<!DOCTYPE"* ]]; then
    echo -e "${GREEN}✅ PASS${NC}"
    echo "   Application accessible"
else
    echo -e "${RED}❌ FAIL${NC}"
    echo "   Erreur: Application non accessible"
fi
echo ""

# Test 4: Processus actifs
echo "Test 4: Vérification des processus..."
ORACLE_PROCESS=$(ps aux | grep "node dist/index.js" | grep -v grep | wc -l)
APP_PROCESS=$(ps aux | grep "next dev" | grep -v grep | wc -l)

if [ $ORACLE_PROCESS -gt 0 ]; then
    echo -e "   Oracle API: ${GREEN}✅ En cours d'exécution${NC}"
else
    echo -e "   Oracle API: ${RED}❌ Non démarré${NC}"
fi

if [ $APP_PROCESS -gt 0 ]; then
    echo -e "   Next.js App: ${GREEN}✅ En cours d'exécution${NC}"
else
    echo -e "   Next.js App: ${RED}❌ Non démarré${NC}"
fi
echo ""

# Résumé
echo "======================================"
echo "           Résumé                     "
echo "======================================"
echo "Oracle API:  http://localhost:3003"
echo "Next.js App: http://localhost:3000"
echo ""
echo "Pour accéder à l'application, ouvrez:"
echo -e "${YELLOW}http://localhost:3000${NC}"
echo ""
