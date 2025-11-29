#!/bin/bash
#
# Script de monitoring des APIs Vercel SwapBack
# Usage: ./monitor-vercel-api.sh [BASE_URL]
#

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# URL de base (peut être passée en paramètre)
BASE_URL="${1:-https://swap-back-app-4ewf.vercel.app}"

# Fichier de log
LOG_FILE="vercel-api-monitor-$(date +%Y%m%d-%H%M%S).log"
JSON_RESULTS="vercel-api-results-$(date +%Y%m%d-%H%M%S).json"

echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        🔍 MONITORING API VERCEL - SWAPBACK                    ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📡 Base URL: ${BASE_URL}${NC}"
echo -e "${BLUE}📄 Log file: ${LOG_FILE}${NC}"
echo -e "${BLUE}📊 JSON results: ${JSON_RESULTS}${NC}"
echo ""

# Initialiser le fichier JSON
echo "{" > "$JSON_RESULTS"
echo "  \"timestamp\": \"$(date -Iseconds)\"," >> "$JSON_RESULTS"
echo "  \"baseUrl\": \"$BASE_URL\"," >> "$JSON_RESULTS"
echo "  \"tests\": [" >> "$JSON_RESULTS"

FIRST_TEST=true

# Fonction pour tester un endpoint
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local payload="$4"
    local expected_field="$5"
    
    echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}🧪 TEST: ${name}${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    local url="${BASE_URL}${endpoint}"
    local start_time=$(date +%s%3N)
    
    # Log dans le fichier
    echo "========================================" >> "$LOG_FILE"
    echo "TEST: $name" >> "$LOG_FILE"
    echo "Time: $(date -Iseconds)" >> "$LOG_FILE"
    echo "Method: $method" >> "$LOG_FILE"
    echo "URL: $url" >> "$LOG_FILE"
    
    # Faire la requête
    if [ "$method" = "GET" ]; then
        response=$(curl -sS -w "\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}" "$url" 2>&1)
    else
        response=$(curl -sS -X "$method" "$url" \
            -H "Content-Type: application/json" \
            -d "$payload" \
            -w "\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}" 2>&1)
    fi
    
    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))
    
    # Extraire le code HTTP et le temps
    http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    time_total=$(echo "$response" | grep "TIME_TOTAL:" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_CODE:/d' | sed '/TIME_TOTAL:/d')
    
    # Log la réponse
    echo "HTTP Code: $http_code" >> "$LOG_FILE"
    echo "Duration: ${duration}ms" >> "$LOG_FILE"
    echo "Response:" >> "$LOG_FILE"
    echo "$body" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    
    # Vérifier le code HTTP
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ HTTP 200 OK${NC}"
        
        # Vérifier le champ attendu si spécifié
        if [ -n "$expected_field" ]; then
            field_value=$(echo "$body" | jq -r ".$expected_field" 2>/dev/null)
            if [ "$field_value" != "null" ] && [ -n "$field_value" ]; then
                echo -e "${GREEN}✅ Field '$expected_field' present: $field_value${NC}"
                test_status="PASS"
            else
                echo -e "${RED}❌ Field '$expected_field' missing or null${NC}"
                test_status="WARN"
            fi
        else
            test_status="PASS"
        fi
    elif [ "$http_code" = "404" ]; then
        echo -e "${RED}❌ HTTP 404 - Endpoint not found${NC}"
        test_status="FAIL"
    elif [ "$http_code" = "500" ]; then
        echo -e "${RED}❌ HTTP 500 - Server error${NC}"
        test_status="FAIL"
        
        # Afficher l'erreur
        error_msg=$(echo "$body" | jq -r '.error' 2>/dev/null)
        if [ "$error_msg" != "null" ] && [ -n "$error_msg" ]; then
            echo -e "${RED}   Error: $error_msg${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  HTTP $http_code${NC}"
        test_status="WARN"
    fi
    
    echo -e "${BLUE}⏱️  Response time: ${duration}ms (curl: ${time_total}s)${NC}"
    
    # Afficher un extrait de la réponse
    echo -e "${CYAN}📄 Response preview:${NC}"
    echo "$body" | jq -C '.' 2>/dev/null | head -20 || echo "$body" | head -20
    
    # Ajouter au JSON des résultats
    if [ "$FIRST_TEST" = true ]; then
        FIRST_TEST=false
    else
        echo "," >> "$JSON_RESULTS"
    fi
    
    cat >> "$JSON_RESULTS" << EOF
    {
      "name": "$name",
      "method": "$method",
      "endpoint": "$endpoint",
      "httpCode": $http_code,
      "duration": $duration,
      "status": "$test_status",
      "timestamp": "$(date -Iseconds)"
    }
EOF
}

# ════════════════════════════════════════════════════════════════
# TESTS DES ENDPOINTS
# ════════════════════════════════════════════════════════════════

# Test 1: Health check - GET /api/swap
test_endpoint \
    "Health Check - /api/swap" \
    "GET" \
    "/api/swap" \
    "" \
    "status"

# Test 2: Test endpoint - GET /api/test
test_endpoint \
    "Test Endpoint - /api/test" \
    "GET" \
    "/api/test" \
    "" \
    "status"

# Test 3: Quote API - SOL → USDC
test_endpoint \
    "Quote SOL → USDC (0.1 SOL)" \
    "POST" \
    "/api/swap/quote" \
    '{"inputMint":"So11111111111111111111111111111111111111112","outputMint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","amount":100000000,"slippageBps":50}' \
    "success"

# Test 4: Quote API - USDC → SOL
test_endpoint \
    "Quote USDC → SOL (100 USDC)" \
    "POST" \
    "/api/swap/quote" \
    '{"inputMint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","outputMint":"So11111111111111111111111111111111111111112","amount":100000000,"slippageBps":50}' \
    "success"

# Test 5: Quote API - SOL → BONK
test_endpoint \
    "Quote SOL → BONK (0.01 SOL)" \
    "POST" \
    "/api/swap/quote" \
    '{"inputMint":"So11111111111111111111111111111111111111112","outputMint":"DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263","amount":10000000,"slippageBps":100}' \
    "success"

# Test 6: Quote API - Montant invalide
test_endpoint \
    "Quote Invalid Amount (0 SOL)" \
    "POST" \
    "/api/swap/quote" \
    '{"inputMint":"So11111111111111111111111111111111111111112","outputMint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","amount":0,"slippageBps":50}' \
    "error"

# Test 7: Quote API - Champs manquants
test_endpoint \
    "Quote Missing Fields" \
    "POST" \
    "/api/swap/quote" \
    '{"inputMint":"So11111111111111111111111111111111111111112"}' \
    "error"

# Test 8: Swap endpoint - GET health
test_endpoint \
    "Swap Endpoint Health - GET /api/swap" \
    "GET" \
    "/api/swap" \
    "" \
    "rpc"

# Test 9: Execute endpoint - Invalid payload
test_endpoint \
    "Execute Invalid Payload" \
    "POST" \
    "/api/execute" \
    '{"invalid":"data"}' \
    "error"

# Test 10: Beta feedback GET
test_endpoint \
    "Beta Feedback GET" \
    "GET" \
    "/api/beta/feedback" \
    "" \
    "feedbacks"

# Fermer le JSON
echo "" >> "$JSON_RESULTS"
echo "  ]," >> "$JSON_RESULTS"
echo "  \"completed\": \"$(date -Iseconds)\"" >> "$JSON_RESULTS"
echo "}" >> "$JSON_RESULTS"

# ════════════════════════════════════════════════════════════════
# RÉSUMÉ
# ════════════════════════════════════════════════════════════════

echo -e "\n${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    📊 RÉSUMÉ DES TESTS                        ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"

# Compter les résultats
total_tests=$(jq '.tests | length' "$JSON_RESULTS")
passed=$(jq '[.tests[] | select(.status == "PASS")] | length' "$JSON_RESULTS")
failed=$(jq '[.tests[] | select(.status == "FAIL")] | length' "$JSON_RESULTS")
warnings=$(jq '[.tests[] | select(.status == "WARN")] | length' "$JSON_RESULTS")

echo ""
echo -e "${BLUE}Total tests: ${total_tests}${NC}"
echo -e "${GREEN}✅ Passed: ${passed}${NC}"
echo -e "${RED}❌ Failed: ${failed}${NC}"
echo -e "${YELLOW}⚠️  Warnings: ${warnings}${NC}"
echo ""

# Afficher les temps de réponse
echo -e "${CYAN}⏱️  Response Times:${NC}"
jq -r '.tests[] | "  \(.name): \(.duration)ms (HTTP \(.httpCode))"' "$JSON_RESULTS"

echo ""
echo -e "${BLUE}📄 Detailed logs: ${LOG_FILE}${NC}"
echo -e "${BLUE}📊 JSON results: ${JSON_RESULTS}${NC}"

# Vérifier les erreurs dans les logs
echo ""
echo -e "${CYAN}🔍 Checking for common errors in responses...${NC}"

if grep -q "ENOTFOUND" "$LOG_FILE"; then
    echo -e "${RED}⚠️  Found ENOTFOUND errors in logs${NC}"
    grep "ENOTFOUND" "$LOG_FILE" | head -5
else
    echo -e "${GREEN}✅ No ENOTFOUND errors detected${NC}"
fi

if grep -q "token.jup.ag" "$LOG_FILE"; then
    echo -e "${YELLOW}⚠️  Found token.jup.ag references in logs${NC}"
    grep "token.jup.ag" "$LOG_FILE" | head -5
else
    echo -e "${GREEN}✅ No token.jup.ag validation attempts detected${NC}"
fi

if grep -q "TypeError" "$LOG_FILE"; then
    echo -e "${RED}⚠️  Found TypeError in logs${NC}"
    grep "TypeError" "$LOG_FILE" | head -5
else
    echo -e "${GREEN}✅ No TypeError detected${NC}"
fi

echo ""
echo -e "${GREEN}✅ Monitoring completed!${NC}"
echo ""

# Code de sortie basé sur les résultats
if [ "$failed" -gt 0 ]; then
    exit 1
else
    exit 0
fi
