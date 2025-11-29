#!/bin/bash

# =================================================================
# STATUS CHECK - SwapBack Build & Deploy Progress
# =================================================================

echo "🔍 SWAPBACK BUILD STATUS CHECK"
echo "===================================="
echo ""

# Check Rust
echo "📦 Rust Toolchain:"
rustc --version
cargo --version
echo ""

# Check Anchor
echo "🔧 Anchor:"
if command -v anchor &> /dev/null; then
    anchor --version
    echo "✅ Anchor CLI installed"
else
    echo "⚠️  Anchor CLI not installed or not in PATH"
fi
echo ""

# Check Solana
echo "⛓️  Solana CLI:"
if command -v solana &> /dev/null; then
    solana --version
    solana config get | head -1
    echo "✅ Solana CLI installed"
else
    echo "⚠️  Solana CLI not installed"
fi
echo ""

# Check Cargo.lock
echo "📋 Cargo.lock:"
CARGO_LOCK_VERSION=$(head -3 Cargo.lock | grep "version" | cut -d' ' -f2)
echo "   Version: $CARGO_LOCK_VERSION"
if [ "$CARGO_LOCK_VERSION" = "4" ]; then
    echo "   ℹ️  v4 detected (regenerated, should work with Rust 1.90.0)"
fi
echo ""

# Check Programs
echo "🏗️  Programs Source:"
for prog in swapback_router swapback_buyback common_swap; do
    if [ -d "programs/$prog/src" ]; then
        LOC=$(wc -l < "programs/$prog/src/lib.rs" 2>/dev/null || echo "0")
        echo "   ✅ $prog: $LOC LOC"
    else
        echo "   ❌ $prog: NOT FOUND"
    fi
done
echo ""

# Check build artifacts
echo "🔨 Build Artifacts:"
if [ -f "target/deploy/swapback_router.so" ]; then
    SIZE=$(du -h target/deploy/swapback_router.so | cut -f1)
    echo "   ✅ swapback_router.so ($SIZE)"
else
    echo "   ⏳ swapback_router.so: Not built yet"
fi

if [ -f "target/deploy/swapback_buyback.so" ]; then
    SIZE=$(du -h target/deploy/swapback_buyback.so | cut -f1)
    echo "   ✅ swapback_buyback.so ($SIZE)"
else
    echo "   ⏳ swapback_buyback.so: Not built yet"
fi
echo ""

# Check Anchor.toml
echo "📄 Configuration:"
if [ -f "Anchor.toml" ]; then
    echo "   ✅ Anchor.toml exists"
    grep "cluster = " Anchor.toml || echo "   ℹ️  No cluster specified"
else
    echo "   ⚠️  Anchor.toml not found"
fi
echo ""

# Check dependencies
echo "📚 Dependencies:"
if [ -d "node_modules" ]; then
    ANCHOR_DEP=$(npm list @coral-xyz/anchor 2>/dev/null | head -1)
    echo "   ✅ npm packages installed"
    echo "   $ANCHOR_DEP"
else
    echo "   ⏳ npm install not done yet"
fi
echo ""

# Check test files
echo "✅ Test Files:"
TOTAL_TESTS=$(find tests -name "*.test.ts" 2>/dev/null | wc -l)
echo "   Found $TOTAL_TESTS test files"
echo ""

# Summary
echo "===================================="
echo "📊 SUMMARY:"
echo ""

READY=0
if rustc --version &> /dev/null; then ((READY++)); fi
if cargo --version &> /dev/null; then ((READY++)); fi
if command -v anchor &> /dev/null; then ((READY++)); fi
if [ -f "Cargo.lock" ]; then ((READY++)); fi
if [ -d "programs/swapback_router/src" ]; then ((READY++)); fi

TOTAL=5
PERCENT=$((READY * 100 / TOTAL))

echo "🟢 Ready for build: $READY/$TOTAL ($PERCENT%)"
echo ""

if [ $READY -eq 5 ]; then
    echo "✅ You can run: anchor build"
else
    echo "⚠️  Please install missing tools first"
fi
echo ""
echo "===================================="
