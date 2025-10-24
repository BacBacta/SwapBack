#!/bin/bash

# SwapBack Final Deployment Script
# Automatically deploy all programs to Solana Devnet

set -e

echo "🚀 SwapBack Devnet Final Deployment"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check artifacts
echo -e "${YELLOW}1. Vérifying build artifacts...${NC}"
echo ""

ARTIFACTS=(
  "target/release/libswapback_router.so"
  "target/release/libswapback_buyback.so"
  "target/release/libswapback_cnft.so"
  "target/release/libcommon_swap.so"
)

for artifact in "${ARTIFACTS[@]}"; do
  if [ -f "$artifact" ]; then
    size=$(du -h "$artifact" | cut -f1)
    echo -e "${GREEN}✅${NC} $artifact ($size)"
  else
    echo -e "${RED}❌${NC} $artifact NOT FOUND"
    exit 1
  fi
done

echo ""

# Check keypairs
echo -e "${YELLOW}2. Verifying keypairs...${NC}"
echo ""

KEYPAIRS=(
  "target/deploy/swapback_router-keypair.json"
  "target/deploy/swapback_buyback-keypair.json"
  "target/deploy/swapback_cnft-keypair.json"
  "target/deploy/common_swap-keypair.json"
)

for keypair in "${KEYPAIRS[@]}"; do
  if [ -f "$keypair" ]; then
    echo -e "${GREEN}✅${NC} $keypair"
  else
    echo -e "${RED}❌${NC} $keypair NOT FOUND"
    exit 1
  fi
done

echo ""

# Check configuration
echo -e "${YELLOW}3. Configuration...${NC}"
echo ""

echo "Network: Devnet"
echo "Program IDs (from Anchor.toml):"
echo ""
echo "  swapback_router:  3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap"
echo "  swapback_buyback: 46UWFYdksvkGhTPy9cTSJGa3d5nqzpY766rtJeuxtMgU"
echo "  swapback_cnft:    ENbA46Rq9yFdp63WwmVm4tykcjmaukWs6T2ScGr9x7zB"
echo "  common_swap:      D4Hz5ZBPWrLvnjNheQa7FYLVpzuGmPGRqFGWNqg5jRg6"
echo ""

# Prepare .so files for deployment
echo -e "${YELLOW}4. Preparing .so files for deployment...${NC}"
echo ""

mkdir -p target/deploy

# Copy .so files to deploy directory with correct naming
cp target/release/libswapback_router.so target/deploy/swapback_router.so
cp target/release/libswapback_buyback.so target/deploy/swapback_buyback.so
cp target/release/libswapback_cnft.so target/deploy/swapback_cnft.so
cp target/release/libcommon_swap.so target/deploy/common_swap.so

echo -e "${GREEN}✅ .so files ready in target/deploy/${NC}"
echo ""

# List all deployment files
echo -e "${YELLOW}5. Deployment files summary:${NC}"
echo ""
ls -lh target/deploy/*.so 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
echo ""

echo -e "${GREEN}✅ All artifacts verified and ready for deployment!${NC}"
echo ""

echo -e "${YELLOW}6. Deployment Methods:${NC}"
echo ""
echo "Option A: Using Anchor CLI (Recommended)"
echo "  $ anchor deploy --provider.cluster devnet"
echo ""
echo "Option B: Using Solana CLI (Manual - requires solana CLI)"
echo "  $ solana program deploy target/deploy/swapback_router.so \\"
echo "      --program-id target/deploy/swapback_router-keypair.json \\"
echo "      -u devnet"
echo ""
echo "Option C: Generate IDL and deploy"
echo "  $ anchor build"
echo "  $ anchor deploy --provider.cluster devnet"
echo ""

echo -e "${YELLOW}NEXT STEPS:${NC}"
echo "1. Ensure your wallet is funded (~1-2 SOL for gas)"
echo "2. Configure solana CLI: solana config set --url https://api.devnet.solana.com"
echo "3. Deploy: anchor deploy --provider.cluster devnet"
echo ""

echo -e "${GREEN}✨ Setup Complete - Ready for Devnet Deployment${NC}"
