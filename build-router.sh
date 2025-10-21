#!/bin/bash

# Build script to handle getrandom issues in Solana SBF environment

set -e

echo "Building swapback_router with getrandom workaround..."

# Create temporary directory for build
BUILD_DIR="/tmp/solana-build"
mkdir -p "$BUILD_DIR"

# Set environment variables to avoid getrandom issues
export TMPDIR=/tmp
export CARGO_TARGET_DIR="$BUILD_DIR"
export RUSTFLAGS="-C target-cpu=generic -C opt-level=1"

# Try to build with cargo build-sbf
if cargo build-sbf --manifest-path programs/swapback_router/Cargo.toml; then
    echo "Build successful!"
    exit 0
else
    echo "Standard build failed, trying alternative approach..."
fi

# Alternative: Use cargo build with custom target
export CARGO_TARGET_DIR="$BUILD_DIR"
export RUSTFLAGS="-C target-cpu=generic -C opt-level=1 --cfg getrandom_backend=\"custom\""

# Try building with custom getrandom backend
cargo build --manifest-path programs/swapback_router/Cargo.toml --target sbf-solana-solana --release

echo "Build completed successfully!"