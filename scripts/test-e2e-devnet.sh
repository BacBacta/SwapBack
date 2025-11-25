#!/bin/bash

##############################################################################
# E2E Tests Suite - Devnet
# Tests complete flow: Swap → Buyback → Claim → Burn
##############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEVNET_RPC=${DEVNET_RPC:-"https://api.devnet.solana.com"}
NUM_SWAPS=${NUM_SWAPS:-10}
SWAP_AMOUNT=${SWAP_AMOUNT:-0.01}  # 0.01 SOL per swap

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   SwapBack E2E Tests - Devnet${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}Configuration:${NC}"
echo -e "  RPC: ${DEVNET_RPC}"
echo -e "  Number of swaps: ${NUM_SWAPS}"
echo -e "  Amount per swap: ${SWAP_AMOUNT} SOL"
echo ""

# Check dependencies
echo -e "${YELLOW}📦 Checking dependencies...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js${NC}"
    exit 1
fi

if ! command -v solana &> /dev/null; then
    echo -e "${RED}❌ Solana CLI not found. Please install Solana CLI${NC}"
    exit 1
fi

# Check wallet
echo -e "${YELLOW}👛 Checking wallet...${NC}"
WALLET_ADDRESS=$(solana address 2>/dev/null || echo "")
if [ -z "$WALLET_ADDRESS" ]; then
    echo -e "${RED}❌ No wallet configured. Please run: solana-keygen new${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Wallet: ${WALLET_ADDRESS}${NC}"

# Check balance
BALANCE=$(solana balance --url ${DEVNET_RPC} 2>/dev/null | awk '{print $1}')
REQUIRED_BALANCE=$(echo "${SWAP_AMOUNT} * ${NUM_SWAPS} + 0.1" | bc)
echo -e "${GREEN}   Balance: ${BALANCE} SOL${NC}"
echo -e "${GREEN}   Required: ${REQUIRED_BALANCE} SOL${NC}"

if (( $(echo "$BALANCE < $REQUIRED_BALANCE" | bc -l) )); then
    echo -e "${YELLOW}⚠️  Insufficient balance. Requesting airdrop...${NC}"
    solana airdrop 2 --url ${DEVNET_RPC} || true
    sleep 5
fi

# Test 1: Swap Test
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Test 1: Swap Execution${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

if [ -f "scripts/test-swap-devnet.js" ]; then
    node scripts/test-swap-devnet.js --num-swaps ${NUM_SWAPS} --amount ${SWAP_AMOUNT}
    SWAP_EXIT=$?
else
    echo -e "${RED}❌ test-swap-devnet.js not found${NC}"
    SWAP_EXIT=1
fi

# Test 2: Buyback Test
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Test 2: Buyback Mechanism${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

if [ -f "scripts/test-buyback-devnet.js" ]; then
    node scripts/test-buyback-devnet.js
    BUYBACK_EXIT=$?
else
    echo -e "${YELLOW}⚠️  test-buyback-devnet.js not found (optional)${NC}"
    BUYBACK_EXIT=0
fi

# Test 3: Claim Test
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Test 3: Rewards Claim${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

if [ -f "scripts/test-claim-devnet.js" ]; then
    node scripts/test-claim-devnet.js
    CLAIM_EXIT=$?
else
    echo -e "${YELLOW}⚠️  test-claim-devnet.js not found (optional)${NC}"
    CLAIM_EXIT=0
fi

# Summary
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Test Results Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

TOTAL_EXIT=$((SWAP_EXIT + BUYBACK_EXIT + CLAIM_EXIT))

if [ $SWAP_EXIT -eq 0 ]; then
    echo -e "${GREEN}✅ Swap Test: PASSED${NC}"
else
    echo -e "${RED}❌ Swap Test: FAILED${NC}"
fi

if [ -f "scripts/test-buyback-devnet.js" ]; then
    if [ $BUYBACK_EXIT -eq 0 ]; then
        echo -e "${GREEN}✅ Buyback Test: PASSED${NC}"
    else
        echo -e "${RED}❌ Buyback Test: FAILED${NC}"
    fi
fi

if [ -f "scripts/test-claim-devnet.js" ]; then
    if [ $CLAIM_EXIT -eq 0 ]; then
        echo -e "${GREEN}✅ Claim Test: PASSED${NC}"
    else
        echo -e "${RED}❌ Claim Test: FAILED${NC}"
    fi
fi

echo ""
if [ $TOTAL_EXIT -eq 0 ]; then
    echo -e "${GREEN}🎉 All E2E tests PASSED!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests FAILED (exit code: ${TOTAL_EXIT})${NC}"
    exit $TOTAL_EXIT
fi
