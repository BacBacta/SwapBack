#!/bin/bash

echo "🔍 Verifying E2E Test Setup..."
echo ""

WALLET=$(solana address)
WSOL="So11111111111111111111111111111111111111112"
USDC="BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR"
BACK="862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux"

# Check balances
echo "📊 Current Balances:"
echo "   Wallet: $WALLET"
echo "   SOL:    $(solana balance)"

WSOL_BAL=$(spl-token balance $WSOL 2>/dev/null || echo "0")
USDC_BAL=$(spl-token balance $USDC 2>/dev/null || echo "0")
BACK_BAL=$(spl-token balance $BACK 2>/dev/null || echo "0")

echo "   wSOL:   $WSOL_BAL"
echo "   USDC:   $USDC_BAL"
echo "   BACK:   $BACK_BAL"
echo ""

# Validation
ALL_GOOD=true

if (( $(echo "$WSOL_BAL < 0.1" | bc -l) )); then
    echo "❌ wSOL balance too low (need at least 0.1 for testing)"
    ALL_GOOD=false
else
    echo "✅ wSOL balance sufficient"
fi

if [ "$USDC_BAL" == "0" ]; then
    echo "⚠️  USDC balance is 0 (will be filled after first swap)"
else
    echo "✅ USDC account exists"
fi

if (( $(echo "$BACK_BAL < 1000" | bc -l) )); then
    echo "⚠️  BACK balance low (${BACK_BAL})"
else
    echo "✅ BACK balance: $BACK_BAL"
fi

echo ""
if [ "$ALL_GOOD" = true ]; then
    echo "🎯 Ready for E2E Testing!"
    echo ""
    echo "Next steps:"
    echo "  1. Test DCA Keeper:"
    echo "     ./scripts/start-dca-keeper.sh"
    echo ""
    echo "  2. Benchmark router:"
    echo "     ./scripts/benchmark-router.sh"
    exit 0
else
    echo "⚠️  Setup incomplete - please wrap more SOL"
    echo "   Run: spl-token wrap 0.5"
    exit 1
fi
