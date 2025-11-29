#!/bin/bash

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  🧪 TEST DE L'INTERFACE SWAPBACK - SUITE COMPLÈTE           ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3001"
PASS=0
FAIL=0

# Function to test API endpoint
test_api() {
    local name="$1"
    local endpoint="$2"
    local method="$3"
    local data="$4"
    local expected="$5"
    
    echo -n "Testing $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s "$BASE_URL$endpoint")
    else
        response=$(curl -s -X POST "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    if echo "$response" | grep -q "$expected"; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((PASS++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        echo "Expected: $expected"
        echo "Got: $response"
        ((FAIL++))
        return 1
    fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  1. TESTS API BACKEND"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Health check
test_api "Health Check" "/api/swap/quote" "GET" "" "status"

# Test 2: Quote SOL -> USDC
test_api "Quote SOL→USDC" "/api/swap/quote" "POST" \
    '{"inputMint":"So11111111111111111111111111111111111111112","outputMint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","amount":"1000000000","slippageBps":50}' \
    "outAmount"

# Test 3: Quote USDC -> SOL (reverse)
test_api "Quote USDC→SOL" "/api/swap/quote" "POST" \
    '{"inputMint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","outputMint":"So11111111111111111111111111111111111111112","amount":"150000000","slippageBps":50}' \
    "outAmount"

# Test 4: Invalid amount
test_api "Invalid Amount" "/api/swap/quote" "POST" \
    '{"inputMint":"So11111111111111111111111111111111111111112","outputMint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","amount":"-100","slippageBps":50}' \
    "error"

# Test 5: Missing fields
test_api "Missing Fields" "/api/swap/quote" "POST" \
    '{"inputMint":"So11111111111111111111111111111111111111112"}' \
    "error"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  2. TESTS INTERFACE FRONTEND"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 6: Page loads
echo -n "Testing Page Load... "
if curl -s $BASE_URL | grep -q "SwapBack"; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((PASS++))
else
    echo -e "${RED}❌ FAIL${NC}"
    ((FAIL++))
fi

# Test 7: Token selector present
echo -n "Testing Token Selector... "
if curl -s $BASE_URL | grep -q "SOL\|USDC"; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((PASS++))
else
    echo -e "${RED}❌ FAIL${NC}"
    ((FAIL++))
fi

# Test 8: Settings panel
echo -n "Testing Settings Panel... "
if curl -s $BASE_URL | grep -q "Slippage\|MEV"; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((PASS++))
else
    echo -e "${RED}❌ FAIL${NC}"
    ((FAIL++))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  3. TEST DES DONNÉES MOCK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 9: Mock data flag
echo -n "Testing Mock Data Flag... "
response=$(curl -s -X POST "$BASE_URL/api/swap/quote" \
    -H "Content-Type: application/json" \
    -d '{"inputMint":"So11111111111111111111111111111111111111112","outputMint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","amount":"1000000000","slippageBps":50}')

if echo "$response" | grep -q '"_isMockData":true'; then
    echo -e "${GREEN}✅ PASS${NC} (Mock mode active)"
    ((PASS++))
else
    echo -e "${YELLOW}⚠️  WARN${NC} (Real API mode)"
    ((PASS++))
fi

# Test 10: Price calculation
echo -n "Testing Price Calculation... "
price=$(echo "$response" | jq -r '.price')
if [ "$price" != "null" ] && [ -n "$price" ]; then
    echo -e "${GREEN}✅ PASS${NC} (Price: $price)"
    ((PASS++))
else
    echo -e "${RED}❌ FAIL${NC}"
    ((FAIL++))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📊 RÉSULTATS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "  ${GREEN}Passed: $PASS${NC}"
echo -e "  ${RED}Failed: $FAIL${NC}"
echo -e "  Total:  $((PASS + FAIL))"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED! 🎉${NC}"
    echo ""
    echo "L'interface est prête pour les tests manuels:"
    echo "  1. Ouvrez http://localhost:3001 dans le Simple Browser"
    echo "  2. Testez la sélection de tokens"
    echo "  3. Entrez un montant pour voir le quote automatique"
    echo "  4. Testez le settings panel (⚙️)"
    echo "  5. Vérifiez la route visualization sidebar"
    echo ""
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    echo ""
    echo "Vérifiez les logs du serveur:"
    echo "  tail -50 /tmp/nextjs-server.log"
    echo ""
    exit 1
fi
