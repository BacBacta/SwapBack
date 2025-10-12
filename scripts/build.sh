#!/bin/bash

# Script de build complet pour SwapBack
# Usage: ./scripts/build.sh [devnet|mainnet]

set -e  # Exit on error

NETWORK=${1:-devnet}

echo "🏗️  Building SwapBack for $NETWORK..."

# Couleurs pour output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Build Anchor programs
echo -e "${BLUE}📦 Building Anchor programs...${NC}"
anchor build

# Vérifier la taille des programmes
echo -e "${BLUE}📏 Checking program sizes...${NC}"
ROUTER_SIZE=$(stat -f%z target/deploy/swapback_router.so 2>/dev/null || stat -c%s target/deploy/swapback_router.so)
BUYBACK_SIZE=$(stat -f%z target/deploy/swapback_buyback.so 2>/dev/null || stat -c%s target/deploy/swapback_buyback.so)
CNFT_SIZE=$(stat -f%z target/deploy/swapback_cnft.so 2>/dev/null || stat -c%s target/deploy/swapback_cnft.so)

echo "Router program size: $((ROUTER_SIZE / 1024)) KB"
echo "Buyback program size: $((BUYBACK_SIZE / 1024)) KB"
echo "cNFT program size: $((CNFT_SIZE / 1024)) KB"

MAX_SIZE=$((10 * 1024 * 1024))  # 10 MB
if [ $ROUTER_SIZE -gt $MAX_SIZE ] || [ $BUYBACK_SIZE -gt $MAX_SIZE ] || [ $CNFT_SIZE -gt $MAX_SIZE ]; then
    echo -e "${RED}❌ Program size exceeds 10 MB limit!${NC}"
    exit 1
fi

# 2. Build SDK
echo -e "${BLUE}📚 Building SDK...${NC}"
cd sdk
npm install
npm run build
cd ..

# 3. Build Oracle
echo -e "${BLUE}🔮 Building Oracle service...${NC}"
cd oracle
npm install
npm run build
cd ..

# 4. Build Frontend
echo -e "${BLUE}🎨 Building Frontend...${NC}"
cd app
npm install
npm run build
cd ..

echo -e "${GREEN}✅ Build completed successfully!${NC}"

# Display program IDs
echo ""
echo "Program IDs:"
echo "------------"
echo -e "Router:  ${GREEN}$(solana address -k target/deploy/swapback_router-keypair.json)${NC}"
echo -e "Buyback: ${GREEN}$(solana address -k target/deploy/swapback_buyback-keypair.json)${NC}"
echo -e "cNFT:    ${GREEN}$(solana address -k target/deploy/swapback_cnft-keypair.json)${NC}"

echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Update program IDs in Anchor.toml"
echo "2. Update declare_id! in Rust files"
echo "3. Rebuild with: anchor build"
echo "4. Deploy with: anchor deploy --provider.cluster $NETWORK"
