#!/bin/bash

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          FUND TEST ACCOUNTS FOR E2E TESTING                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"

WALLET=$(solana address)
echo "🔑 Wallet: $WALLET"
echo "💰 SOL Balance: $(solana balance)"
echo ""

# Check if enough SOL
BALANCE=$(solana balance | awk '{print $1}')
if (( $(echo "$BALANCE < 0.6" | bc -l) )); then
    echo "⚠️  Low balance! Need at least 0.6 SOL for testing"
    echo "   Requesting airdrop..."
    solana airdrop 1 || echo "❌ Airdrop failed (rate limit?)"
    sleep 2
fi

# 1. Wrap SOL for testing
echo "📦 Step 1: Wrapping 0.5 SOL into wSOL..."
spl-token wrap 0.5 || {
    echo "❌ Failed to wrap SOL"
    echo "   Make sure you have enough SOL balance"
    exit 1
}

# 2. Check wSOL balance
WSOL_MINT="So11111111111111111111111111111111111111112"
echo "✅ wSOL balance:"
spl-token balance $WSOL_MINT

# 3. Get or create USDC account
USDC_MINT="BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR"
echo ""
echo "📦 Step 2: Setting up USDC account..."
spl-token create-account $USDC_MINT 2>/dev/null && echo "   ✅ USDC account created" || echo "   ✓ USDC account already exists"

# 4. Get or create BACK account  
BACK_MINT="862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux"
echo ""
echo "📦 Step 3: Setting up BACK account..."
spl-token create-account $BACK_MINT 2>/dev/null && echo "   ✅ BACK account created" || echo "   ✓ BACK account already exists"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ACCOUNTS READY FOR TESTING"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Current Balances:"
echo "   SOL:  $(solana balance)"
echo "   wSOL: $(spl-token balance $WSOL_MINT) (wrapped SOL)"
echo "   USDC: $(spl-token balance $USDC_MINT)"
echo "   BACK: $(spl-token balance $BACK_MINT)"
echo ""
echo "🎯 Next Steps:"
echo ""
echo "   1. Test Manual Swap on UI:"
echo "      https://swap-back-mauve.vercel.app/swap"
echo "      Swap 0.01 wSOL → USDC"
echo ""
echo "   2. Test DCA Keeper (automatic execution):"
echo "      ./scripts/start-dca-keeper.sh"
echo "      (Will execute the 3 pending DCA plans)"
echo ""
echo "   3. Run Performance Benchmark:"
echo "      ./scripts/benchmark-router.sh"
echo ""
