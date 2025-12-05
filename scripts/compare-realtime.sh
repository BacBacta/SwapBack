#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# SwapBack vs Jupiter - Real-time Comparison
# ═══════════════════════════════════════════════════════════════════════════

# Token mints (Mainnet)
SOL="So11111111111111111111111111111111111111112"
USDC="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
BONK="DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
JUP="JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"
WIF="EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# SwapBack rebate tiers (basis points)
REBATE_BASE=10      # 0.10%
REBATE_BRONZE=15    # 0.15%
REBATE_SILVER=25    # 0.25%
REBATE_GOLD=40      # 0.40%
REBATE_PLATINUM=60  # 0.60%

# Use Silver tier for comparison
CURRENT_REBATE_BPS=$REBATE_SILVER

print_header() {
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}🔄 SWAPBACK vs JUPITER - COMPARAISON EN TEMPS RÉEL${NC}"
    echo -e "${CYAN}📊 Tier: SILVER (0.25% rebate)${NC}"
    echo -e "${CYAN}📅 $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════════════════${NC}"
}

compare_swap() {
    local NAME="$1"
    local INPUT_MINT="$2"
    local OUTPUT_MINT="$3"
    local AMOUNT="$4"
    local INPUT_DECIMALS="$5"
    local OUTPUT_DECIMALS="$6"
    local INPUT_SYMBOL="$7"
    local OUTPUT_SYMBOL="$8"

    echo ""
    echo -e "${YELLOW}┌──────────────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${YELLOW}│ 💱 ${NAME}${NC}"
    echo -e "${YELLOW}├──────────────────────────────────────────────────────────────────────┤${NC}"

    # Jupiter quote
    local JUP_START=$(date +%s%3N)
    local JUP_RESULT=$(curl -s --connect-timeout 10 "https://quote-api.jup.ag/v6/quote?inputMint=${INPUT_MINT}&outputMint=${OUTPUT_MINT}&amount=${AMOUNT}&slippageBps=50" 2>/dev/null)
    local JUP_END=$(date +%s%3N)
    local JUP_LATENCY=$((JUP_END - JUP_START))

    local JUP_OUT=$(echo "$JUP_RESULT" | jq -r '.outAmount // "0"' 2>/dev/null || echo "0")
    local JUP_IMPACT=$(echo "$JUP_RESULT" | jq -r '.priceImpactPct // "0"' 2>/dev/null || echo "0")
    local JUP_ROUTE=$(echo "$JUP_RESULT" | jq -r '.routePlan[0].swapInfo.label // "Direct"' 2>/dev/null || echo "Direct")

    # Convert to human readable
    local JUP_OUT_HUMAN=$(echo "scale=6; ${JUP_OUT:-0} / (10 ^ $OUTPUT_DECIMALS)" | bc 2>/dev/null || echo "0")
    
    if [ "$JUP_OUT" == "0" ] || [ -z "$JUP_OUT" ]; then
        echo -e "${YELLOW}│ ⚡ JUPITER:  ${RED}❌ Error fetching quote${NC}"
    else
        printf "${YELLOW}│ ⚡ JUPITER:  ${NC}%-15s %s  Route: %-20s  [%dms]\n" "$JUP_OUT_HUMAN" "$OUTPUT_SYMBOL" "$JUP_ROUTE" "$JUP_LATENCY"
    fi

    # SwapBack quote (via our API)
    local SB_START=$(date +%s%3N)
    local SB_RESULT=$(curl -s --connect-timeout 10 "https://swapback-api.fly.dev/api/swap/quote?inputMint=${INPUT_MINT}&outputMint=${OUTPUT_MINT}&amount=${AMOUNT}&slippageBps=50" 2>/dev/null)
    local SB_END=$(date +%s%3N)
    local SB_LATENCY=$((SB_END - SB_START))

    local SB_OUT=$(echo "$SB_RESULT" | jq -r '.quote.outAmount // .outAmount // "0"' 2>/dev/null || echo "0")
    local SB_ROUTE=$(echo "$SB_RESULT" | jq -r '.quote.routePlan[0].swapInfo.label // .routePlan[0].swapInfo.label // "Direct"' 2>/dev/null || echo "Direct")

    # Convert to human readable
    local SB_OUT_HUMAN=$(echo "scale=6; ${SB_OUT:-0} / (10 ^ $OUTPUT_DECIMALS)" | bc 2>/dev/null || echo "0")
    
    # Calculate rebate (Silver tier = 0.25%)
    local REBATE=$(echo "scale=8; $SB_OUT_HUMAN * $CURRENT_REBATE_BPS / 10000" | bc 2>/dev/null || echo "0")
    local NET_OUT=$(echo "scale=6; $SB_OUT_HUMAN + $REBATE" | bc 2>/dev/null || echo "0")

    if [ "$SB_OUT" == "0" ] || [ -z "$SB_OUT" ]; then
        echo -e "${YELLOW}│ 🔷 SWAPBACK: ${RED}❌ Error fetching quote${NC}"
    else
        printf "${YELLOW}│ 🔷 SWAPBACK: ${NC}%-15s %s + ${GREEN}%.6f rebate${NC} = ${GREEN}%-15s${NC} [%dms]\n" "$SB_OUT_HUMAN" "$OUTPUT_SYMBOL" "$REBATE" "$NET_OUT" "$SB_LATENCY"
    fi

    echo -e "${YELLOW}├──────────────────────────────────────────────────────────────────────┤${NC}"

    # Calculate advantage
    if [ "$JUP_OUT_HUMAN" != "0" ] && [ "$NET_OUT" != "0" ]; then
        local DIFF=$(echo "scale=8; $NET_OUT - $JUP_OUT_HUMAN" | bc 2>/dev/null || echo "0")
        local DIFF_PCT=$(echo "scale=4; ($DIFF / $JUP_OUT_HUMAN) * 100" | bc 2>/dev/null || echo "0")
        
        local IS_POSITIVE=$(echo "$DIFF > 0" | bc 2>/dev/null || echo "0")
        
        if [ "$IS_POSITIVE" == "1" ]; then
            printf "${YELLOW}│ ${GREEN}🏆 SWAPBACK GAGNE: +%.6f %s (+%.4f%%)${NC}\n" "$DIFF" "$OUTPUT_SYMBOL" "$DIFF_PCT"
            echo "SWAPBACK"
        else
            local ABS_DIFF=$(echo "scale=8; -1 * $DIFF" | bc 2>/dev/null || echo "0")
            local ABS_PCT=$(echo "scale=4; -1 * $DIFF_PCT" | bc 2>/dev/null || echo "0")
            printf "${YELLOW}│ ${BLUE}⚡ JUPITER GAGNE: +%.6f %s (+%.4f%%)${NC}\n" "$ABS_DIFF" "$OUTPUT_SYMBOL" "$ABS_PCT"
            echo "JUPITER"
        fi
    else
        echo -e "${YELLOW}│ ${RED}⚠️  Impossible de comparer (données manquantes)${NC}"
        echo "ERROR"
    fi
    
    echo -e "${YELLOW}└──────────────────────────────────────────────────────────────────────┘${NC}"
}

# Main execution
print_header

echo ""
echo -e "${CYAN}🚀 Démarrage des 5 comparaisons en temps réel...${NC}"

# Track results
SWAPBACK_WINS=0
JUPITER_WINS=0
ERRORS=0

# Test 1: 1 SOL → USDC (1 SOL = 1,000,000,000 lamports)
RESULT=$(compare_swap "1 SOL → USDC" "$SOL" "$USDC" "1000000000" 9 6 "SOL" "USDC")
case "${RESULT##*$'\n'}" in
    SWAPBACK) ((SWAPBACK_WINS++)) ;;
    JUPITER) ((JUPITER_WINS++)) ;;
    *) ((ERRORS++)) ;;
esac

sleep 1

# Test 2: 100 USDC → SOL (100 USDC = 100,000,000 micro-USDC)
RESULT=$(compare_swap "100 USDC → SOL" "$USDC" "$SOL" "100000000" 6 9 "USDC" "SOL")
case "${RESULT##*$'\n'}" in
    SWAPBACK) ((SWAPBACK_WINS++)) ;;
    JUPITER) ((JUPITER_WINS++)) ;;
    *) ((ERRORS++)) ;;
esac

sleep 1

# Test 3: 0.5 SOL → BONK
RESULT=$(compare_swap "0.5 SOL → BONK" "$SOL" "$BONK" "500000000" 9 5 "SOL" "BONK")
case "${RESULT##*$'\n'}" in
    SWAPBACK) ((SWAPBACK_WINS++)) ;;
    JUPITER) ((JUPITER_WINS++)) ;;
    *) ((ERRORS++)) ;;
esac

sleep 1

# Test 4: 50 USDC → JUP
RESULT=$(compare_swap "50 USDC → JUP" "$USDC" "$JUP" "50000000" 6 6 "USDC" "JUP")
case "${RESULT##*$'\n'}" in
    SWAPBACK) ((SWAPBACK_WINS++)) ;;
    JUPITER) ((JUPITER_WINS++)) ;;
    *) ((ERRORS++)) ;;
esac

sleep 1

# Test 5: 0.25 SOL → WIF
RESULT=$(compare_swap "0.25 SOL → WIF" "$SOL" "$WIF" "250000000" 9 6 "SOL" "WIF")
case "${RESULT##*$'\n'}" in
    SWAPBACK) ((SWAPBACK_WINS++)) ;;
    JUPITER) ((JUPITER_WINS++)) ;;
    *) ((ERRORS++)) ;;
esac

# Summary
echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📈 RÉSUMÉ FINAL${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}│ 🔷 SwapBack gagne:  $SWAPBACK_WINS / 5 swaps${NC}"
echo -e "${BLUE}│ ⚡ Jupiter gagne:   $JUPITER_WINS / 5 swaps${NC}"
if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}│ ⚠️  Erreurs:        $ERRORS swaps${NC}"
fi
echo -e "${CYAN}════════════════════════════════════════════════════════════════════════${NC}"

# Explanation
echo ""
echo -e "${YELLOW}💡 POURQUOI SWAPBACK EST PLUS AVANTAGEUX:${NC}"
echo -e "${NC}   • SwapBack utilise les mêmes routes Jupiter (même liquidité)${NC}"
echo -e "${NC}   • MAIS ajoute un rebate de 0.25% (tier Silver) sur chaque swap${NC}"
echo -e "${NC}   • Les tiers supérieurs offrent jusqu'à 0.60% de rebate (Platinum)${NC}"
echo -e "${NC}   • Résultat: Vous gagnez plus sur CHAQUE transaction${NC}"
echo ""

echo -e "${CYAN}════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📊 PROJECTION ÉCONOMIQUE (avec SwapBack)${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${NC}│ Si vous faites 10 swaps/jour de ~\$100:${NC}"
echo -e "${NC}│   • Rebate Silver (0.25%): \$0.25/swap = \$2.50/jour = \$912/an${NC}"
echo -e "${NC}│   • Rebate Gold (0.40%):   \$0.40/swap = \$4.00/jour = \$1460/an${NC}"
echo -e "${NC}│   • Rebate Platinum (0.60%): \$0.60/swap = \$6.00/jour = \$2190/an${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════════════${NC}"
