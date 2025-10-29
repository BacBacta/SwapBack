#!/bin/bash

# ============================================================================
# Script de Déploiement Vercel - SwapBack
# ============================================================================
# Usage:
#   ./deploy-vercel.sh          # Deploy preview (testnet)
#   ./deploy-vercel.sh prod     # Deploy production (mainnet)
# ============================================================================

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running from correct directory
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ Error: package.json not found${NC}"
  echo "Please run this script from the app directory:"
  echo "  cd /workspaces/SwapBack/app"
  echo "  ./deploy-vercel.sh"
  exit 1
fi

# Detect environment
ENV="${1:-preview}"
if [ "$ENV" = "prod" ] || [ "$ENV" = "production" ]; then
  ENV="production"
  NETWORK="mainnet-beta"
  RPC_URL="https://api.mainnet-beta.solana.com"
  echo -e "${YELLOW}⚠️  PRODUCTION DEPLOYMENT${NC}"
else
  ENV="preview"
  NETWORK="testnet"
  RPC_URL="https://api.testnet.solana.com"
  echo -e "${BLUE}📦 PREVIEW DEPLOYMENT (Testnet)${NC}"
fi

echo ""
echo "=================================================="
echo "🚀 SwapBack Vercel Deployment"
echo "=================================================="
echo "Environment: $ENV"
echo "Network: $NETWORK"
echo "RPC: $RPC_URL"
echo "=================================================="
echo ""

# Step 1: Check Vercel CLI
echo -e "${BLUE}[1/6]${NC} Checking Vercel CLI..."
if ! command -v vercel &> /dev/null; then
  echo -e "${YELLOW}⚠️  Vercel CLI not found. Installing...${NC}"
  npm install -g vercel
fi
echo -e "${GREEN}✓ Vercel CLI ready${NC}"
echo ""

# Step 2: Login to Vercel
echo -e "${BLUE}[2/6]${NC} Vercel authentication..."
vercel whoami &> /dev/null || vercel login
echo -e "${GREEN}✓ Authenticated${NC}"
echo ""

# Step 3: Pre-deployment checks
echo -e "${BLUE}[3/6]${NC} Running pre-deployment checks..."

# Check TypeScript
echo "  → TypeScript check..."
npm run type-check 2>&1 | grep -q "error" && {
  echo -e "${RED}❌ TypeScript errors found. Please fix before deploying.${NC}"
  npm run type-check
  exit 1
} || echo -e "${GREEN}  ✓ TypeScript OK${NC}"

# Check build
echo "  → Build test..."
npm run build > /tmp/build.log 2>&1 || {
  echo -e "${RED}❌ Build failed. Check logs:${NC}"
  tail -50 /tmp/build.log
  exit 1
}
echo -e "${GREEN}  ✓ Build successful${NC}"

echo -e "${GREEN}✓ All checks passed${NC}"
echo ""

# Step 4: Configure environment variables
echo -e "${BLUE}[4/6]${NC} Configuring environment variables..."

if [ "$ENV" = "production" ]; then
  echo -e "${YELLOW}⚠️  WARNING: Deploying to MAINNET${NC}"
  echo "Make sure you have:"
  echo "  - Updated Program IDs to mainnet versions"
  echo "  - Configured mainnet token addresses"
  echo "  - Set up premium RPC (Helius/QuickNode/Alchemy)"
  echo ""
  read -p "Continue with MAINNET deployment? (yes/no): " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo -e "${YELLOW}Deployment cancelled${NC}"
    exit 0
  fi
  
  # Set production variables
  vercel env add NEXT_PUBLIC_SOLANA_NETWORK production --force || true
  echo "mainnet-beta" | vercel env add NEXT_PUBLIC_SOLANA_NETWORK production --force
  
  vercel env add USE_MOCK_QUOTES production --force || true
  echo "false" | vercel env add USE_MOCK_QUOTES production --force
fi

# Set common variables
echo "  → Setting JUPITER_API_URL..."
vercel env add JUPITER_API_URL $ENV --force || true
echo "https://quote-api.jup.ag/v6" | vercel env add JUPITER_API_URL $ENV --force 2>/dev/null || true

echo "  → Setting USE_MOCK_QUOTES..."
echo "false" | vercel env add USE_MOCK_QUOTES $ENV --force 2>/dev/null || true

echo -e "${GREEN}✓ Environment variables configured${NC}"
echo ""

# Step 5: Deploy
echo -e "${BLUE}[5/6]${NC} Deploying to Vercel..."

if [ "$ENV" = "production" ]; then
  vercel --prod
else
  vercel
fi

echo -e "${GREEN}✓ Deployment complete${NC}"
echo ""

# Step 6: Post-deployment verification
echo -e "${BLUE}[6/6]${NC} Post-deployment verification..."

# Get deployment URL
DEPLOY_URL=$(vercel inspect --wait | grep -oP 'https://[^ ]+' | head -1)

if [ -n "$DEPLOY_URL" ]; then
  echo "  → Testing deployment: $DEPLOY_URL"
  
  # Wait for deployment to be ready
  sleep 5
  
  # Test health endpoint
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOY_URL/api/health" || echo "000")
  
  if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}  ✓ Health check passed${NC}"
  else
    echo -e "${YELLOW}  ⚠️  Health check returned $HTTP_CODE${NC}"
  fi
  
  # Test quote endpoint
  QUOTE_TEST=$(curl -s -X POST "$DEPLOY_URL/api/swap/quote" \
    -H "Content-Type: application/json" \
    -d '{"inputMint":"So11111111111111111111111111111111111111112","outputMint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","amount":1000000000,"slippageBps":50}' \
    | jq -r '.success' 2>/dev/null || echo "false")
  
  if [ "$QUOTE_TEST" = "true" ]; then
    echo -e "${GREEN}  ✓ Quote API working${NC}"
  else
    echo -e "${YELLOW}  ⚠️  Quote API test failed${NC}"
  fi
fi

echo ""
echo "=================================================="
echo -e "${GREEN}✅ DEPLOYMENT SUCCESSFUL${NC}"
echo "=================================================="
echo ""
echo "🌐 Deployment URL:"
echo "   $DEPLOY_URL"
echo ""
echo "📊 Next steps:"
echo "   1. Test the application in your browser"
echo "   2. Connect a wallet and try a swap"
echo "   3. Check Vercel dashboard for logs"
echo "   4. Monitor error rates"
echo ""

if [ "$ENV" = "production" ]; then
  echo -e "${YELLOW}⚠️  Production checklist:${NC}"
  echo "   [ ] Domain configured?"
  echo "   [ ] SSL certificate active?"
  echo "   [ ] Analytics configured?"
  echo "   [ ] Error tracking (Sentry)?"
  echo "   [ ] RPC limits sufficient?"
  echo ""
fi

echo "=================================================="
