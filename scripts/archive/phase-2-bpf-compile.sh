#!/bin/bash

# 🚀 PHASE 2: BPF COMPILATION & DEVNET DEPLOYMENT
# Compile smart contracts and deploy to Solana devnet

set -e

echo "════════════════════════════════════════════════════════"
echo "  PHASE 2: BPF COMPILATION & DEVNET DEPLOYMENT"
echo "════════════════════════════════════════════════════════"
echo ""

# Step 1: Check versions
echo "📦 Step 1: Verifying Rust & Anchor versions..."
echo ""
rustc --version
cargo --version
anchor --version 2>/dev/null || echo "⚠️  Anchor not in PATH, will install"
echo ""

# Step 2: Create deploy directory
echo "📦 Step 2: Setting up deploy directory..."
mkdir -p target/deploy
echo "✅ Directory ready: target/deploy/"
echo ""

# Step 3: Attempt BPF compilation with Anchor
echo "🔨 Step 3: Compiling programs to BPF..."
echo ""
echo "   Note: This will take 3-5 minutes for the first run"
echo ""

# Try compilation
if command -v anchor &> /dev/null; then
    echo "   Using Anchor CLI for BPF compilation..."
    anchor build --program-name swapback_router 2>&1 | tail -20 || true
    echo ""
    echo "   If BPF compilation fails, proceed with Phase 2b (alternative method)"
else
    echo "❌ Anchor CLI not found"
    echo "   Install with: npm install -g @coral-xyz/anchor-cli"
    exit 1
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "  BPF COMPILATION STEP COMPLETE"
echo "════════════════════════════════════════════════════════"
echo ""

echo "Next steps:"
echo ""
echo "If BPF compilation succeeded:"
echo "  1. Binaries in: target/deploy/*.so"
echo "  2. Run Phase 2 part C: Deploy to devnet"
echo "  3. Command: solana deploy target/deploy/*.so --url devnet"
echo ""
echo "If BPF compilation failed:"
echo "  See PHASE_2_BPF_TROUBLESHOOTING.md for alternatives"
echo ""
