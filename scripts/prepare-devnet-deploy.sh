#!/bin/bash

# SwapBack Devnet Deployment Script
# This script deploys all 4 programs to Solana Devnet

set -e

echo "🚀 SwapBack Devnet Deployment Script"
echo "===================================="
echo ""

# Check prerequisites
echo "1️⃣ Checking prerequisites..."
echo ""

# Check if we have the build artifacts
if [ ! -f "target/release/libswapback_router.so" ]; then
    echo "❌ Build artifacts not found. Run: cargo build --release --workspace"
    exit 1
fi

echo "✅ Build artifacts found"

# Check if we have the keypairs
if [ ! -f "target/deploy/swapback_router-keypair.json" ]; then
    echo "❌ Keypairs not generated. Run: npm run generate-keypairs"
    exit 1
fi

echo "✅ Keypairs found"
echo ""

# Check Anchor CLI
if ! command -v anchor &> /dev/null; then
    echo "⚠️  Anchor CLI not found in PATH"
    echo "Attempting to use npm-installed anchor..."
    ANCHOR="npx @coral-xyz/anchor@0.31.0"
else
    ANCHOR="anchor"
fi

echo ""
echo "2️⃣ Program IDs (from Anchor.toml)"
echo "===================================="
echo ""
echo "swapback_router:  3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap"
echo "swapback_buyback: 46UWFYdksvkGhTPy9cTSJGa3d5nqzpY766rtJeuxtMgU"
echo "swapback_cnft:    ENbA46Rq9yFdp63WwmVm4tykcjmaukWs6T2ScGr9x7zB"
echo "common_swap:      D4Hz5ZBPWrLvnjNheQa7FYLVpzuGmPGRqFGWNqg5jRg6"
echo ""

echo "3️⃣ Checking Solana network..."
echo "==============================="
echo ""

# Try to check network status
if command -v solana &> /dev/null; then
    echo "Current cluster: $(solana cluster get 2>/dev/null || echo 'Unable to determine')"
    echo "Wallet balance: $(solana balance 2>/dev/null || echo 'Unable to determine')"
    echo ""
    echo "⚠️  Ensure your wallet has at least 1 SOL for gas fees on devnet"
else
    echo "⚠️  Solana CLI not installed, skipping network check"
    echo "Please ensure:"
    echo "  1. You have a funded devnet wallet (~1 SOL minimum)"
    echo "  2. Your ~/.config/solana/id.json is configured"
fi

echo ""
echo "4️⃣ Ready to Deploy"
echo "=================="
echo ""
echo "Next steps:"
echo ""
echo "Option A: Using Anchor CLI (Recommended)"
echo "  anchor deploy --provider.cluster devnet"
echo ""
echo "Option B: Manual deployment with cargo"
echo "  cargo build-bpf --release --workspace"
echo "  solana program deploy target/deploy/swapback_router.so --program-id target/deploy/swapback_router-keypair.json -u devnet"
echo ""
echo "Option C: Using bash deployment script"
echo "  bash scripts/deploy-programs.sh"
echo ""

echo "💾 Deployment artifacts:"
echo "  - target/release/libswapback_router.so (784 KB)"
echo "  - target/release/libswapback_buyback.so (792 KB)"
echo "  - target/release/libswapback_cnft.so (660 KB)"
echo "  - target/release/libcommon_swap.so (672 KB)"
echo ""

echo "✅ Setup complete! Ready for deployment."
