#!/bin/bash
# Fix Cargo dependencies for Solana BPF (rustc 1.75)

set -e

echo "🔧 Fixing Cargo dependencies for Solana BPF..."

# Downgrade incompatible packages
cargo update proc-macro-crate --precise 2.0.2
cargo update toml_edit@0.23.5 --precise 0.22.20  
cargo update borsh --precise 1.3.1
cargo update borsh-derive --precise 1.3.1

echo "✅ Dependencies fixed!"
echo "Now try: anchor build --program-name swapback_cnft"
