#!/bin/bash
# Phase 5.6 - Production Deployment Script
# Automatise le déploiement avec checks et validations

set -e

echo "🚀 Phase 5.6 - Production Deployment"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0

# Function to print check result
check_result() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}❌ $1${NC}"
        ((CHECKS_FAILED++))
    fi
}

# Function to print section header
section() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  $1"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

# ============================================
# PHASE 1: PRE-DEPLOYMENT CHECKS
# ============================================
section "PHASE 1: PRE-DEPLOYMENT CHECKS"

echo "📋 Checking environment..."

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "  Node.js: $NODE_VERSION"
    check_result "Node.js installed"
else
    echo "  Node.js: NOT FOUND"
    check_result "Node.js installed"
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "  npm: $NPM_VERSION"
    check_result "npm installed"
else
    echo "  npm: NOT FOUND"
    check_result "npm installed"
fi

# Check Anchor (optional for frontend)
if command -v anchor &> /dev/null; then
    ANCHOR_VERSION=$(anchor --version)
    echo "  Anchor: $ANCHOR_VERSION"
    check_result "Anchor installed"
else
    echo "  Anchor: NOT FOUND (optional for frontend)"
fi

# Check Solana CLI
if command -v solana &> /dev/null; then
    SOLANA_VERSION=$(solana --version)
    echo "  Solana: $SOLANA_VERSION"
    check_result "Solana CLI installed"
else
    echo "  Solana: NOT FOUND (optional for frontend)"
fi

# Check Git
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version)
    echo "  Git: $GIT_VERSION"
    check_result "Git installed"
else
    echo "  Git: NOT FOUND"
    check_result "Git installed"
fi

# ============================================
# PHASE 2: CODE VALIDATION
# ============================================
section "PHASE 2: CODE VALIDATION"

echo "🔍 Validating codebase..."

# Check if we're in workspace root
if [ ! -f "Anchor.toml" ]; then
    echo -e "${RED}❌ Not in SwapBack workspace root${NC}"
    echo "  Please run from /workspaces/SwapBack"
    exit 1
fi
check_result "Workspace root verified"

# Check critical files exist
CRITICAL_FILES=(
    "app/package.json"
    "app/src/app/buyback/page.tsx"
    "app/src/components/ClaimBuyback.tsx"
    "app/src/components/BurnVisualization.tsx"
    "app/src/components/RewardsCalculator.tsx"
    "programs/swapback_buyback/src/lib.rs"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo -e "${RED}  ✗ $file (MISSING)${NC}"
        ((CHECKS_FAILED++))
    fi
done
check_result "Critical files present"

# Check git status
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Uncommitted changes detected${NC}"
    git status --short
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled"
        exit 1
    fi
else
    check_result "Git working directory clean"
fi

# ============================================
# PHASE 3: FRONTEND BUILD
# ============================================
section "PHASE 3: FRONTEND BUILD"

echo "🔨 Building frontend..."

cd app

# Install dependencies
if [ ! -d "node_modules" ]; then
    echo "  Installing dependencies..."
    npm install
    check_result "Dependencies installed"
fi

# Run build
echo "  Running production build..."
if npm run build > /tmp/build.log 2>&1; then
    check_result "Frontend build successful"
    echo "  Build size:"
    du -sh .next/ | awk '{print "    " $1}'
else
    echo -e "${RED}  Build failed. Check /tmp/build.log for details${NC}"
    tail -20 /tmp/build.log
    check_result "Frontend build successful"
    exit 1
fi

cd ..

# ============================================
# PHASE 4: ENVIRONMENT VARIABLES CHECK
# ============================================
section "PHASE 4: ENVIRONMENT VARIABLES"

echo "🔐 Checking environment configuration..."

ENV_FILE="app/.env.local"
REQUIRED_VARS=(
    "NEXT_PUBLIC_SOLANA_RPC_URL"
    "NEXT_PUBLIC_NETWORK"
)

if [ -f "$ENV_FILE" ]; then
    check_result ".env.local exists"
    
    for var in "${REQUIRED_VARS[@]}"; do
        if grep -q "^$var=" "$ENV_FILE"; then
            VALUE=$(grep "^$var=" "$ENV_FILE" | cut -d'=' -f2)
            echo "  ✓ $var (set)"
        else
            echo -e "${YELLOW}  ⚠️  $var (missing)${NC}"
        fi
    done
else
    echo -e "${YELLOW}⚠️  .env.local not found${NC}"
    echo "  Create from template: cp app/.env.example app/.env.local"
fi

# ============================================
# PHASE 5: PROGRAM VERIFICATION
# ============================================
section "PHASE 5: PROGRAM VERIFICATION"

echo "🔍 Verifying on-chain programs..."

BUYBACK_PROGRAM="4cyYvpjwERF67UDpd5euYzZ6xZ5tcDL6XrByBaZbVVjK"
CNFT_PROGRAM="9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw"

if command -v solana &> /dev/null; then
    echo "  Checking buyback program..."
    if solana account $BUYBACK_PROGRAM --url devnet &> /dev/null; then
        check_result "Buyback program deployed"
    else
        echo -e "${YELLOW}  ⚠️  Buyback program not found on devnet${NC}"
    fi
    
    echo "  Checking cNFT program..."
    if solana account $CNFT_PROGRAM --url devnet &> /dev/null; then
        check_result "cNFT program deployed"
    else
        echo -e "${YELLOW}  ⚠️  cNFT program not found on devnet${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠️  Solana CLI not available, skipping on-chain checks${NC}"
fi

# ============================================
# PHASE 6: DEPLOYMENT OPTIONS
# ============================================
section "PHASE 6: DEPLOYMENT OPTIONS"

echo "📦 Choose deployment method:"
echo ""
echo "  1. Vercel (Recommended - Automated)"
echo "  2. Manual (Custom server)"
echo "  3. Docker Container"
echo "  4. Skip deployment (testing only)"
echo ""

read -p "Select option (1-4): " DEPLOY_OPTION

case $DEPLOY_OPTION in
    1)
        section "DEPLOYING TO VERCEL"
        
        if command -v vercel &> /dev/null; then
            echo "🚀 Deploying to Vercel..."
            cd app
            
            # Check if already linked
            if [ -f ".vercel/project.json" ]; then
                echo "  ✓ Project already linked to Vercel"
            else
                echo "  Linking project to Vercel..."
                vercel link
            fi
            
            # Deploy
            echo "  Deploying to production..."
            vercel --prod
            
            check_result "Vercel deployment"
            cd ..
        else
            echo -e "${RED}❌ Vercel CLI not installed${NC}"
            echo "  Install: npm i -g vercel"
            echo "  Then run: vercel login"
            exit 1
        fi
        ;;
        
    2)
        section "MANUAL DEPLOYMENT"
        echo "📝 Manual deployment steps:"
        echo ""
        echo "1. Upload app/.next/ to your server"
        echo "2. Upload app/public/ to your server"
        echo "3. Install dependencies: npm install --production"
        echo "4. Start server: npm start"
        echo "5. Configure nginx/Apache reverse proxy"
        echo ""
        echo "See DEPLOYMENT_GUIDE.md for details"
        ;;
        
    3)
        section "DOCKER DEPLOYMENT"
        echo "🐳 Docker deployment:"
        echo ""
        
        if [ -f "app/Dockerfile" ]; then
            echo "Building Docker image..."
            cd app
            docker build -t swapback-app:latest .
            check_result "Docker image built"
            
            echo ""
            echo "Run with:"
            echo "  docker run -p 3000:3000 --env-file .env.local swapback-app:latest"
            cd ..
        else
            echo -e "${YELLOW}⚠️  Dockerfile not found${NC}"
            echo "Create one at app/Dockerfile"
        fi
        ;;
        
    4)
        section "SKIPPING DEPLOYMENT"
        echo "✅ Build validated, deployment skipped"
        ;;
        
    *)
        echo -e "${RED}❌ Invalid option${NC}"
        exit 1
        ;;
esac

# ============================================
# PHASE 7: POST-DEPLOYMENT VERIFICATION
# ============================================
if [ "$DEPLOY_OPTION" != "4" ]; then
    section "PHASE 7: POST-DEPLOYMENT CHECKS"
    
    echo "🔍 Verifying deployment..."
    
    read -p "Enter deployed URL (or skip): " DEPLOYED_URL
    
    if [ -n "$DEPLOYED_URL" ]; then
        echo "  Testing homepage..."
        if curl -s -o /dev/null -w "%{http_code}" "$DEPLOYED_URL" | grep -q "200"; then
            check_result "Homepage accessible"
        else
            echo -e "${RED}  ⚠️  Homepage not accessible${NC}"
        fi
        
        echo "  Testing buyback page..."
        if curl -s -o /dev/null -w "%{http_code}" "$DEPLOYED_URL/buyback" | grep -q "200"; then
            check_result "Buyback page accessible"
        else
            echo -e "${RED}  ⚠️  Buyback page not accessible${NC}"
        fi
    fi
fi

# ============================================
# FINAL SUMMARY
# ============================================
section "DEPLOYMENT SUMMARY"

echo "📊 Results:"
echo "  ✅ Checks passed: $CHECKS_PASSED"
echo "  ❌ Checks failed: $CHECKS_FAILED"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All checks passed!${NC}"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Test all features on production"
    echo "  2. Monitor logs for errors"
    echo "  3. Setup analytics (Mixpanel, Amplitude)"
    echo "  4. Enable error tracking (Sentry)"
    echo "  5. Configure CDN (Cloudflare)"
    echo ""
    echo "📚 Documentation:"
    echo "  - PHASE_5_6_COMPLETE.md"
    echo "  - DEPLOYMENT_GUIDE.md"
    echo "  - MONITORING_SETUP.md"
else
    echo -e "${YELLOW}⚠️  Some checks failed (${CHECKS_FAILED})${NC}"
    echo "  Review errors above and fix before deploying"
    exit 1
fi

echo ""
echo "✨ Deployment complete!"
