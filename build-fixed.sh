#!/bin/bash

# Build script to patch getrandom for Solana SBF compatibility

set -e

echo "Building swapback_router with getrandom patch..."

# Create temporary directory for build
BUILD_DIR="/tmp/solana-build"
mkdir -p "$BUILD_DIR"

# Set environment variables
export TMPDIR=/tmp
export CARGO_TARGET_DIR="$BUILD_DIR"

# Find getrandom source in cargo registry
GETRANDOM_PATH=$(find ~/.cargo/registry/src -name "*getrandom*" -type d | head -1)
if [ -z "$GETRANDOM_PATH" ]; then
    echo "getrandom source not found in registry, downloading..."
    cargo fetch
    GETRANDOM_PATH=$(find ~/.cargo/registry/src -name "*getrandom*" -type d | head -1)
fi

if [ -n "$GETRANDOM_PATH" ]; then
    echo "Patching getrandom at $GETRANDOM_PATH"

    # Backup original file
    cp "$GETRANDOM_PATH/src/lib.rs" "$GETRANDOM_PATH/src/lib.rs.backup"

    # Patch the lib.rs to support sbf-solana-solana target
    sed -i 's/"x86", "x86_64", "arm", "aarch64", "mips", "mips64", "powerpc64", "riscv64", "s390x"/"x86", "x86_64", "arm", "aarch64", "mips", "mips64", "powerpc64", "riscv64", "s390x", "sbf"/g' "$GETRANDOM_PATH/src/lib.rs"

    # Add sbf target support
    sed -i '/target_arch = "x86_64"/a \    || target_arch = "sbf"' "$GETRANDOM_PATH/src/lib.rs"
fi

# Build with cargo build-sbf
echo "Building with cargo build-sbf..."
if cargo build-sbf --manifest-path programs/swapback_router/Cargo.toml; then
    echo "Build successful!"

    # Restore original file
    if [ -n "$GETRANDOM_PATH" ]; then
        mv "$GETRANDOM_PATH/src/lib.rs.backup" "$GETRANDOM_PATH/src/lib.rs"
    fi

    exit 0
else
    echo "Build failed"

    # Restore original file
    if [ -n "$GETRANDOM_PATH" ]; then
        mv "$GETRANDOM_PATH/src/lib.rs.backup" "$GETRANDOM_PATH/src/lib.rs"
    fi

    exit 1
fi