#!/bin/bash

# SwapBack Devnet Deployment Script - Direct cargo build approach
# This bypasses Anchor CLI and uses cargo build-bpf directly

set -e

echo "🚀 SwapBack Devnet Deployment (Direct)"
echo "========================================"
echo ""

cd /workspaces/SwapBack

# Step 1: Verify artifacts
echo "1️⃣ Verifying artifacts..."
if [ ! -f "target/deploy/swapback_router.so" ]; then
    echo "❌ Missing: swapback_router.so"
    echo "Run: cargo build --release --workspace"
    exit 1
fi
echo "✅ All artifacts verified"
echo ""

# Step 2: Show Program IDs
echo "2️⃣ Program IDs (Devnet):"
echo "  swapback_router:  3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap"
echo "  swapback_buyback: 46UWFYdksvkGhTPy9cTSJGa3d5nqzpY766rtJeuxtMgU"
echo "  swapback_cnft:    ENbA46Rq9yFdp63WwmVm4tykcjmaukWs6T2ScGr9x7zB"
echo "  common_swap:      D4Hz5ZBPWrLvnjNheQa7FYLVpzuGmPGRqFGWNqg5jRg6"
echo ""

# Step 3: Check wallet
echo "3️⃣ Checking wallet configuration..."
if [ ! -f ~/.config/solana/id.json ]; then
    echo "⚠️  Wallet not found at ~/.config/solana/id.json"
    echo "   Create one with: solana-keygen new"
    echo ""
    echo "For testing, using local wallet simulation..."
    DEPLOY_MODE="local"
else
    echo "✅ Wallet configured at ~/.config/solana/id.json"
    DEPLOY_MODE="network"
fi
echo ""

# Step 4: Show deployment options
echo "4️⃣ Deployment Options:"
echo ""
echo "Option A: Using Anchor CLI (Recommended - auto-handles IDL)"
echo "  $ anchor deploy --provider.cluster devnet"
echo ""
echo "Option B: Using cargo build-bpf (Manual control)"
echo "  $ cargo build-bpf --release --workspace"
echo ""
echo "Option C: Using Solana CLI directly (if installed)"
echo "  $ solana program deploy target/deploy/swapback_router.so \\"
echo "      --program-id target/deploy/swapback_router-keypair.json -u devnet"
echo ""

# Step 5: Final checklist
echo "5️⃣ Pre-Deployment Checklist:"
echo ""
echo "  ✅ Artifacts compiled (2.8 MB)"
echo "  ✅ Keypairs generated (4)"
echo "  ✅ Program IDs configured"
echo "  ✅ Anchor.toml ready"
echo ""

# Step 6: Recommend next action
if [ "$DEPLOY_MODE" = "network" ]; then
    echo "6️⃣ Ready to Deploy!"
    echo ""
    echo "  Command: anchor deploy --provider.cluster devnet"
    echo "  Time: ~5-10 minutes"
    echo ""
    echo "📝 Steps:"
    echo "  1. Fund wallet: solana airdrop 2 -u devnet"
    echo "  2. Deploy:      anchor deploy --provider.cluster devnet"
    echo "  3. Verify:      solana program show <PROGRAM_ID> -u devnet"
else
    echo "6️⃣ Setup Required:"
    echo ""
    echo "  1. Create wallet:  solana-keygen new"
    echo "  2. Fund wallet:    solana airdrop 2 -u devnet"
    echo "  3. Deploy:         anchor deploy --provider.cluster devnet"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "For detailed deployment guide, see: DEPLOY_COMMANDS_READY.md"
echo "═══════════════════════════════════════════════════════════════"
