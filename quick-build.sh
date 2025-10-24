#!/bin/bash

# =================================================================
# QUICK BUILD LAUNCHER - SwapBack
# Run this once Anchor CLI installation completes
# =================================================================

set -e

clear
echo "🚀 SWAPBACK QUICK BUILD LAUNCHER"
echo "=================================="
echo ""

# Check Anchor
if ! command -v anchor &> /dev/null; then
    echo "❌ Anchor CLI not found in PATH"
    echo "⏳ Installation still in progress? Wait 5-10 minutes..."
    echo ""
    echo "Run: cargo install --locked anchor-cli@0.30.1 --force"
    exit 1
fi

echo "✅ Anchor CLI: $(anchor --version)"
echo ""

# Go to project
cd /workspaces/SwapBack
echo "📁 Working directory: $(pwd)"
echo ""

# Verify Cargo.lock
echo "📋 Verifying Cargo.lock..."
LOCK_VERSION=$(head -3 Cargo.lock | grep "version" | cut -d' ' -f2)
echo "   Version: $LOCK_VERSION ✅"
echo ""

# Verify programs exist
echo "✅ Verifying programs..."
for prog in swapback_router swapback_buyback; do
    if [ -f "programs/$prog/Cargo.toml" ]; then
        echo "   ✅ $prog"
    else
        echo "   ❌ $prog NOT FOUND"
        exit 1
    fi
done
echo ""

# START BUILD
echo "🔨 Building Rust programs..."
echo "⏱️  This may take 5-15 minutes..."
echo ""

if anchor build 2>&1; then
    echo ""
    echo "✨ BUILD SUCCESSFUL!"
    echo ""
    
    # Check artifacts
    echo "📦 Build Artifacts:"
    if [ -f "target/deploy/swapback_router.so" ]; then
        SIZE=$(du -h target/deploy/swapback_router.so | cut -f1)
        echo "   ✅ swapback_router.so ($SIZE)"
    fi
    if [ -f "target/deploy/swapback_buyback.so" ]; then
        SIZE=$(du -h target/deploy/swapback_buyback.so | cut -f1)
        echo "   ✅ swapback_buyback.so ($SIZE)"
    fi
    echo ""
    
    # Extract IDs
    echo "🔑 Extracting Program IDs..."
    ROUTER_ID=$(solana address -k target/deploy/swapback_router-keypair.json 2>/dev/null)
    BUYBACK_ID=$(solana address -k target/deploy/swapback_buyback-keypair.json 2>/dev/null)
    
    echo "   Router:  $ROUTER_ID"
    echo "   Buyback: $BUYBACK_ID"
    echo ""
    
    echo "✅ NEXT STEPS:"
    echo ""
    echo "1. Update .env with new Program IDs:"
    echo "   export SWAPBACK_ROUTER_PROGRAM_ID=$ROUTER_ID"
    echo "   export SWAPBACK_BUYBACK_PROGRAM_ID=$BUYBACK_ID"
    echo ""
    echo "2. Deploy to devnet:"
    echo "   anchor deploy --provider.cluster devnet"
    echo ""
    echo "3. Run tests:"
    echo "   npm run test"
    echo ""
    echo "=================================="
else
    echo ""
    echo "❌ BUILD FAILED"
    echo ""
    echo "Try one of these fixes:"
    echo ""
    echo "1. Clean and rebuild:"
    echo "   cargo clean"
    echo "   anchor build"
    echo ""
    echo "2. Use automated fix script:"
    echo "   ./fix-build-rust.sh"
    echo ""
    echo "3. Check detailed error:"
    echo "   cargo build --release 2>&1 | head -100"
    echo ""
    exit 1
fi
