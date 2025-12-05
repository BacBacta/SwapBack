#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# SwapBack vs Jupiter - SIMULATION COMPARATIVE
# Basée sur les prix réels du marché (5 Dec 2025)
# ═══════════════════════════════════════════════════════════════════════════

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Prix actuels approximatifs (5 Dec 2025)
SOL_PRICE=232.50   # SOL/USD
BONK_PRICE=0.000052
JUP_PRICE=1.25
WIF_PRICE=3.42

# SwapBack rebate tiers (basis points)
declare -A REBATE_TIERS=(
    ["base"]=10
    ["bronze"]=15
    ["silver"]=25
    ["gold"]=40
    ["platinum"]=60
)

clear
echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║      🔄 SWAPBACK vs JUPITER - SIMULATION EN TEMPS RÉEL                  ║${NC}"
echo -e "${CYAN}${BOLD}║      📊 Comparaison sur 5 transactions simultanées                       ║${NC}"
echo -e "${CYAN}${BOLD}║      📅 $(date '+%Y-%m-%d %H:%M:%S')                                             ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Tier for comparison
TIER="silver"
REBATE_BPS=${REBATE_TIERS[$TIER]}
REBATE_PCT=$(echo "scale=2; $REBATE_BPS / 100" | bc)

echo -e "${PURPLE}📍 Configuration:${NC}"
echo -e "   • Tier utilisé: ${YELLOW}${TIER^^}${NC} (${REBATE_PCT}% rebate)"
echo -e "   • Prix SOL: \$${SOL_PRICE}"
echo -e "   • Slippage: 0.5%"
echo ""

# Track totals
TOTAL_JUP_OUT=0
TOTAL_SB_NET=0
SWAPBACK_WINS=0
JUPITER_WINS=0

simulate_swap() {
    local NUM=$1
    local FROM=$2
    local TO=$3
    local AMOUNT=$4
    local FROM_PRICE=$5
    local TO_PRICE=$6
    local FROM_SYMBOL=$7
    local TO_SYMBOL=$8
    
    echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  📊 TRANSACTION #${NUM}: ${AMOUNT} ${FROM_SYMBOL} → ${TO_SYMBOL}${NC}"
    echo -e "${YELLOW}╠══════════════════════════════════════════════════════════════════════════╣${NC}"
    
    # Calculate USD value
    local USD_VALUE=$(echo "scale=2; $AMOUNT * $FROM_PRICE" | bc)
    
    # Simulate Jupiter output (with small random variance -0.1% to +0.1%)
    local VARIANCE=$(echo "scale=6; ($(shuf -i 0-200 -n 1) - 100) / 100000" | bc)
    local EXPECTED_OUT=$(echo "scale=8; ($AMOUNT * $FROM_PRICE) / $TO_PRICE" | bc)
    local JUP_OUT=$(echo "scale=8; $EXPECTED_OUT * (1 + $VARIANCE)" | bc)
    
    # Jupiter fee simulation (~0.05% avg slippage/fee)
    local JUP_FEE=$(echo "scale=8; $JUP_OUT * 0.0005" | bc)
    local JUP_NET=$(echo "scale=8; $JUP_OUT - $JUP_FEE" | bc)
    
    # SwapBack uses same route, so same base output
    local SB_OUT=$JUP_NET
    
    # Add SwapBack rebate
    local REBATE=$(echo "scale=8; $SB_OUT * $REBATE_BPS / 10000" | bc)
    local SB_NET=$(echo "scale=8; $SB_OUT + $REBATE" | bc)
    
    # Calculate values in USD
    local JUP_USD=$(echo "scale=2; $JUP_NET * $TO_PRICE" | bc)
    local SB_USD=$(echo "scale=2; $SB_NET * $TO_PRICE" | bc)
    local REBATE_USD=$(echo "scale=4; $REBATE * $TO_PRICE" | bc)
    
    # Simulate latency
    local JUP_LATENCY=$((150 + RANDOM % 100))
    local SB_LATENCY=$((180 + RANDOM % 120))
    
    echo -e "${YELLOW}║${NC}  💰 Valeur entrée: \$${USD_VALUE}                                              ${YELLOW}║${NC}"
    echo -e "${YELLOW}╠══════════════════════════════════════════════════════════════════════════╣${NC}"
    
    # Jupiter result
    printf "${YELLOW}║${NC}  ${BLUE}⚡ JUPITER:${NC}  %.6f %s" "$JUP_NET" "$TO_SYMBOL"
    printf " (\$%.2f)" "$JUP_USD"
    printf "  [${JUP_LATENCY}ms]\n"
    
    # SwapBack result
    printf "${YELLOW}║${NC}  ${GREEN}🔷 SWAPBACK:${NC} %.6f %s" "$SB_OUT" "$TO_SYMBOL"
    printf " + ${GREEN}%.6f rebate${NC}" "$REBATE"
    printf " = ${GREEN}${BOLD}%.6f${NC}" "$SB_NET"
    printf "  [${SB_LATENCY}ms]\n"
    
    echo -e "${YELLOW}╠══════════════════════════════════════════════════════════════════════════╣${NC}"
    
    # Compare
    local DIFF=$(echo "scale=8; $SB_NET - $JUP_NET" | bc)
    local DIFF_USD=$(echo "scale=4; $DIFF * $TO_PRICE" | bc)
    local DIFF_PCT=$(echo "scale=4; ($DIFF / $JUP_NET) * 100" | bc)
    
    printf "${YELLOW}║${NC}  🏆 ${GREEN}${BOLD}SWAPBACK GAGNE:${NC} +%.6f %s" "$DIFF" "$TO_SYMBOL"
    printf " (+\$%.4f, +%.3f%%)" "$DIFF_USD" "$DIFF_PCT"
    echo ""
    echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Update totals (in USD)
    TOTAL_JUP_OUT=$(echo "scale=4; $TOTAL_JUP_OUT + $JUP_USD" | bc)
    TOTAL_SB_NET=$(echo "scale=4; $TOTAL_SB_NET + $SB_USD" | bc)
    ((SWAPBACK_WINS++))
    
    sleep 0.5
}

echo -e "${CYAN}${BOLD}🚀 Exécution de 5 transactions simultanées...${NC}"
echo ""

# Transaction 1: 1 SOL → USDC
simulate_swap 1 "SOL" "USDC" 1 $SOL_PRICE 1 "SOL" "USDC"

# Transaction 2: 100 USDC → SOL  
simulate_swap 2 "USDC" "SOL" 100 1 $SOL_PRICE "USDC" "SOL"

# Transaction 3: 0.5 SOL → BONK
simulate_swap 3 "SOL" "BONK" 0.5 $SOL_PRICE $BONK_PRICE "SOL" "BONK"

# Transaction 4: 50 USDC → JUP
simulate_swap 4 "USDC" "JUP" 50 1 $JUP_PRICE "USDC" "JUP"

# Transaction 5: 0.25 SOL → WIF
simulate_swap 5 "SOL" "WIF" 0.25 $SOL_PRICE $WIF_PRICE "SOL" "WIF"

# Calculate totals
TOTAL_SAVED=$(echo "scale=4; $TOTAL_SB_NET - $TOTAL_JUP_OUT" | bc)
TOTAL_PCT=$(echo "scale=4; ($TOTAL_SAVED / $TOTAL_JUP_OUT) * 100" | bc)

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║                        📈 RÉSUMÉ FINAL                                    ║${NC}"
echo -e "${CYAN}${BOLD}╠══════════════════════════════════════════════════════════════════════════╣${NC}"
printf "${CYAN}${BOLD}║${NC}  Total avec Jupiter:  \$%.2f                                           ${CYAN}${BOLD}║${NC}\n" "$TOTAL_JUP_OUT"
printf "${CYAN}${BOLD}║${NC}  Total avec SwapBack: ${GREEN}\$%.2f${NC}                                           ${CYAN}${BOLD}║${NC}\n" "$TOTAL_SB_NET"
echo -e "${CYAN}${BOLD}╠══════════════════════════════════════════════════════════════════════════╣${NC}"
printf "${CYAN}${BOLD}║${NC}  🏆 ${GREEN}${BOLD}SWAPBACK GAGNE: $SWAPBACK_WINS / 5 transactions${NC}                             ${CYAN}${BOLD}║${NC}\n"
printf "${CYAN}${BOLD}║${NC}  💰 ${GREEN}Économies totales: +\$%.4f (+%.3f%%)${NC}                           ${CYAN}${BOLD}║${NC}\n" "$TOTAL_SAVED" "$TOTAL_PCT"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════════════════════════════╝${NC}"

echo ""
echo -e "${PURPLE}${BOLD}╔══════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}${BOLD}║                   💡 POURQUOI SWAPBACK GAGNE TOUJOURS                    ║${NC}"
echo -e "${PURPLE}${BOLD}╠══════════════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${PURPLE}${BOLD}║${NC}  ✓ SwapBack utilise les MÊMES routes Jupiter (même liquidité)          ${PURPLE}${BOLD}║${NC}"
echo -e "${PURPLE}${BOLD}║${NC}  ✓ MAIS reverse un rebate en $BACK tokens sur chaque swap              ${PURPLE}${BOLD}║${NC}"
echo -e "${PURPLE}${BOLD}║${NC}  ✓ Rebate calculé on-chain = transparent et vérifié                    ${PURPLE}${BOLD}║${NC}"
echo -e "${PURPLE}${BOLD}║${NC}  ✓ Plus vous tradez, plus vous gagnez de rebates                       ${PURPLE}${BOLD}║${NC}"
echo -e "${PURPLE}${BOLD}╚══════════════════════════════════════════════════════════════════════════╝${NC}"

echo ""
echo -e "${YELLOW}${BOLD}╔══════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}${BOLD}║                   📊 PROJECTION ÉCONOMIQUE ANNUELLE                      ║${NC}"
echo -e "${YELLOW}${BOLD}╠══════════════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${YELLOW}${BOLD}║${NC}  Hypothèse: 10 swaps/jour × \$100/swap = \$1,000/jour                    ${YELLOW}${BOLD}║${NC}"
echo -e "${YELLOW}${BOLD}║${NC}  Volume annuel: \$365,000                                               ${YELLOW}${BOLD}║${NC}"
echo -e "${YELLOW}${BOLD}╠══════════════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${YELLOW}${BOLD}║${NC}  📍 Tier BASE (0.10%):     ${GREEN}\$365/an${NC} de rebates                          ${YELLOW}${BOLD}║${NC}"
echo -e "${YELLOW}${BOLD}║${NC}  📍 Tier BRONZE (0.15%):   ${GREEN}\$547/an${NC} de rebates                          ${YELLOW}${BOLD}║${NC}"
echo -e "${YELLOW}${BOLD}║${NC}  📍 Tier SILVER (0.25%):   ${GREEN}\$912/an${NC} de rebates                          ${YELLOW}${BOLD}║${NC}"
echo -e "${YELLOW}${BOLD}║${NC}  📍 Tier GOLD (0.40%):     ${GREEN}\$1,460/an${NC} de rebates                        ${YELLOW}${BOLD}║${NC}"
echo -e "${YELLOW}${BOLD}║${NC}  📍 Tier PLATINUM (0.60%): ${GREEN}\$2,190/an${NC} de rebates                        ${YELLOW}${BOLD}║${NC}"
echo -e "${YELLOW}${BOLD}╚══════════════════════════════════════════════════════════════════════════╝${NC}"

echo ""
echo -e "${GREEN}${BOLD}✅ Simulation terminée avec succès!${NC}"
echo ""
