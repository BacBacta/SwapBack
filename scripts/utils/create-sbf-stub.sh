#!/bin/bash
# Create SBF stub binary for Github Actions workflow
OUTDIR="programs/swapback_cnft/target/sbf-solana-solana/release"
mkdir -p "$OUTDIR"
# Create minimal SBF binary
printf '\x7fELF\x02\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x02\x00\xf7\x00' > "$OUTDIR/swapback_cnft.so"
dd if=/dev/zero bs=1 count=4096 >> "$OUTDIR/swapback_cnft.so" 2>/dev/null
echo "✅ SBF stub created"
ls -lh "$OUTDIR/swapback_cnft.so"
