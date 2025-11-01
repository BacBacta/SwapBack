#!/bin/bash
#
# Script de surveillance continue des APIs Vercel SwapBack
# Usage: ./watch-vercel-api.sh [INTERVAL_SECONDS] [BASE_URL]
#

set -e

# Paramètres
INTERVAL="${1:-30}"  # Intervalle en secondes (défaut: 30s)
BASE_URL="${2:-https://swap-back-app-4ewf.vercel.app}"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Fichier de log
LOG_FILE="vercel-api-watch-$(date +%Y%m%d-%H%M%S).log"

echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     📡 SURVEILLANCE CONTINUE API VERCEL - SWAPBACK            ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📡 Base URL: ${BASE_URL}${NC}"
echo -e "${BLUE}⏱️  Interval: ${INTERVAL}s${NC}"
echo -e "${BLUE}📄 Log file: ${LOG_FILE}${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

# Compteurs
iteration=0
errors=0
successes=0

# Fonction pour afficher une ligne d'état
print_status() {
    local endpoint="$1"
    local status="$2"
    local duration="$3"
    local details="$4"
    
    local timestamp=$(date '+%H:%M:%S')
    
    if [ "$status" = "OK" ]; then
        echo -e "${GREEN}✅ [$timestamp] $endpoint - ${duration}ms ${details}${NC}"
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}⚠️  [$timestamp] $endpoint - ${duration}ms ${details}${NC}"
    else
        echo -e "${RED}❌ [$timestamp] $endpoint - ${duration}ms ${details}${NC}"
    fi
}

# Fonction pour tester un endpoint
quick_test() {
    local endpoint="$1"
    local method="$2"
    local payload="$3"
    
    local url="${BASE_URL}${endpoint}"
    local start_time=$(date +%s%3N)
    
    if [ "$method" = "GET" ]; then
        response=$(curl -sS -w "\nHTTP_CODE:%{http_code}" "$url" 2>&1 || echo "ERROR")
    else
        response=$(curl -sS -X "$method" "$url" \
            -H "Content-Type: application/json" \
            -d "$payload" \
            -w "\nHTTP_CODE:%{http_code}" 2>&1 || echo "ERROR")
    fi
    
    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))
    
    if echo "$response" | grep -q "ERROR"; then
        echo "FAIL|$duration|Network error"
        return 1
    fi
    
    http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_CODE:/d')
    
    # Log
    echo "[$timestamp] $endpoint - HTTP $http_code - ${duration}ms" >> "$LOG_FILE"
    
    if [ "$http_code" = "200" ]; then
        # Vérifier le champ success si présent
        success=$(echo "$body" | jq -r '.success' 2>/dev/null)
        if [ "$success" = "true" ]; then
            echo "OK|$duration|HTTP $http_code, success=true"
        else
            status=$(echo "$body" | jq -r '.status' 2>/dev/null)
            if [ "$status" = "ok" ]; then
                echo "OK|$duration|HTTP $http_code, status=ok"
            else
                echo "OK|$duration|HTTP $http_code"
            fi
        fi
    elif [ "$http_code" = "400" ]; then
        error=$(echo "$body" | jq -r '.error' 2>/dev/null | head -c 50)
        echo "WARN|$duration|HTTP $http_code: $error"
    else
        echo "FAIL|$duration|HTTP $http_code"
    fi
}

# Boucle principale
while true; do
    iteration=$((iteration + 1))
    
    echo ""
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}🔄 Iteration #${iteration} - $(date)${NC}"
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Test 1: Health check
    result=$(quick_test "/api/swap" "GET" "")
    status=$(echo "$result" | cut -d'|' -f1)
    duration=$(echo "$result" | cut -d'|' -f2)
    details=$(echo "$result" | cut -d'|' -f3)
    
    print_status "GET /api/swap" "$status" "$duration" "$details"
    [ "$status" = "OK" ] && successes=$((successes + 1)) || errors=$((errors + 1))
    
    # Test 2: Quote SOL → USDC
    result=$(quick_test "/api/swap/quote" "POST" '{"inputMint":"So11111111111111111111111111111111111111112","outputMint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","amount":100000000,"slippageBps":50}')
    status=$(echo "$result" | cut -d'|' -f1)
    duration=$(echo "$result" | cut -d'|' -f2)
    details=$(echo "$result" | cut -d'|' -f3)
    
    print_status "POST /api/swap/quote (SOL→USDC)" "$status" "$duration" "$details"
    [ "$status" = "OK" ] && successes=$((successes + 1)) || errors=$((errors + 1))
    
    # Test 3: Quote USDC → SOL
    result=$(quick_test "/api/swap/quote" "POST" '{"inputMint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","outputMint":"So11111111111111111111111111111111111111112","amount":100000000,"slippageBps":50}')
    status=$(echo "$result" | cut -d'|' -f1)
    duration=$(echo "$result" | cut -d'|' -f2)
    details=$(echo "$result" | cut -d'|' -f3)
    
    print_status "POST /api/swap/quote (USDC→SOL)" "$status" "$duration" "$details"
    [ "$status" = "OK" ] && successes=$((successes + 1)) || errors=$((errors + 1))
    
    # Statistiques
    total=$((successes + errors))
    success_rate=0
    [ $total -gt 0 ] && success_rate=$((successes * 100 / total))
    
    echo ""
    echo -e "${BLUE}📊 Stats: ${GREEN}${successes} OK${NC} | ${RED}${errors} ERR${NC} | ${CYAN}Success rate: ${success_rate}%${NC}"
    
    # Vérifier les erreurs dans le log
    if tail -20 "$LOG_FILE" | grep -q "500\|ENOTFOUND\|TypeError"; then
        echo -e "${RED}⚠️  Errors detected in recent logs!${NC}"
    fi
    
    # Attendre avant la prochaine itération
    echo -e "${YELLOW}⏳ Next check in ${INTERVAL}s...${NC}"
    sleep "$INTERVAL"
done
