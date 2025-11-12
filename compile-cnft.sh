#!/usr/bin/env bash
set -e

echo "🔨 Compiling swapback_cnft program..."
cd /workspaces/SwapBack

# Export Solana tools
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Remove solana toolchain to force use of system Rust
rustup toolchain uninstall solana 2>/dev/null || true

# Build with cargo-build-sbf
cargo build-sbf \
  --manifest-path programs/swapback_cnft/Cargo.toml \
  --sbf-out-dir target/deploy \
  2>&1 | tee /tmp/build.log

# Check if .so was created
if [ -f "target/deploy/swapback_cnft.so" ]; then
  echo "✅ Compilation successful!"
  ls -lh target/deploy/swapback_cnft.so
  solana program show CzxpYBeKbcA6AJH7yz8ggkJ1cWen3ejKUuikE6stHEaF --url devnet || echo "Program not yet deployed"
else
  echo "❌ Compilation failed - check /tmp/build.log"
  tail -50 /tmp/build.log
  exit 1
fi
