#!/bin/bash
# Quick test script for Phase 5.4 - Distribution & Burn
# Tests both scripts in sequence with sample data

set -e

echo "🧪 Phase 5.4 - Distribution & Burn Test Suite"
echo "=============================================="
echo ""

# Check dependencies
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not installed"
    exit 1
fi

if [ ! -d "target/idl" ]; then
    echo "❌ IDL not found - run: anchor build && anchor idl init"
    exit 1
fi

# Set RPC URL if not set
export ANCHOR_PROVIDER_URL=${ANCHOR_PROVIDER_URL:-"https://api.devnet.solana.com"}

echo "📋 Configuration:"
echo "  RPC URL: $ANCHOR_PROVIDER_URL"
echo ""

# Test 1: Distribution
echo "🎯 Test 1: Testing distribute_buyback()..."
echo "-------------------------------------------"
if node scripts/test-distribute-buyback.js; then
    echo "✅ distribute_buyback() test passed"
else
    echo "❌ distribute_buyback() test failed"
    exit 1
fi

echo ""
echo "⏳ Waiting 5 seconds before next test..."
sleep 5
echo ""

# Test 2: Burn
echo "🔥 Test 2: Testing burn_back()..."
echo "-------------------------------------------"
BURN_AMOUNT=1000000  # 1 BACK token (assuming 6 decimals)
if node scripts/test-burn-back.js $BURN_AMOUNT; then
    echo "✅ burn_back() test passed"
else
    echo "❌ burn_back() test failed"
    exit 1
fi

echo ""
echo "=============================================="
echo "🎉 Phase 5.4 Test Suite Complete!"
echo ""
echo "📊 Summary:"
echo "  ✅ distribute_buyback() - PASSED"
echo "  ✅ burn_back()          - PASSED"
echo ""
echo "Next: Run keeper integration test"
echo "  cd oracle && npx ts-node src/buyback-keeper.ts"
