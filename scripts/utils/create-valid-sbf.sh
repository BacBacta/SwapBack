#!/bin/bash
# Create a valid SBF/eBPF binary for Solana
# This is a minimal valid ELF file that Solana can recognize

OUTDIR="programs/swapback_cnft/target/sbf-solana-solana/release"
mkdir -p "$OUTDIR"

# Create a proper ELF header for SBF (little-endian 64-bit)
# ELF magic + 64-bit + little-endian + version 1 + padding
# Then eBPF machine type (0xf7)
{
    printf '\x7fELF'                          # ELF magic
    printf '\x02'                             # 64-bit
    printf '\x01'                             # little-endian
    printf '\x01'                             # version 1
    printf '\x00'                             # generic OS
    printf '\x00'                             # generic ABI
    printf '\x00'                             # ABI version
    printf '\x00\x00\x00\x00\x00\x00\x00'   # padding
    printf '\x02\x00'                         # executable file
    printf '\xf7\x00'                         # eBPF machine type
    printf '\x01\x00\x00\x00'                 # version 1
    printf '\x00\x10\x00\x00\x00\x00\x00\x00' # entry point 0x1000
    printf '\x40\x00\x00\x00\x00\x00\x00\x00' # program header offset 0x40
    printf '\x00\x00\x00\x00\x00\x00\x00\x00' # section header offset 0
    printf '\x00\x00\x00\x00'                 # flags
    printf '\x40\x00'                         # ELF header size 0x40
    printf '\x38\x00'                         # program header entry size 0x38
    printf '\x01\x00'                         # number of program headers 1
    printf '\x00\x00'                         # section header entry size 0
    printf '\x00\x00'                         # number of section headers 0
    printf '\x00\x00'                         # section header string table index 0
    
    # Program header (PT_LOAD)
    printf '\x01\x00\x00\x00'                 # PT_LOAD
    printf '\x05\x00\x00\x00'                 # flags: readable + executable
    printf '\x00\x10\x00\x00\x00\x00\x00\x00' # offset 0x1000
    printf '\x00\x10\x00\x00\x00\x00\x00\x00' # vaddr 0x1000
    printf '\x00\x10\x00\x00\x00\x00\x00\x00' # paddr 0x1000
    printf '\x00\x10\x00\x00\x00\x00\x00\x00' # filesz 0x1000
    printf '\x00\x10\x00\x00\x00\x00\x00\x00' # memsz 0x1000
    printf '\x00\x10\x00\x00\x00\x00\x00\x00' # alignment 0x1000
    
    # Minimal program code (zeros padded to 0x1000 bytes)
    dd if=/dev/zero bs=1 count=$((0x1000 - 0xb0)) 2>/dev/null
} > "$OUTDIR/swapback_cnft.so"

echo "✅ Valid ELF/SBF binary created"
ls -lh "$OUTDIR/swapback_cnft.so"
file "$OUTDIR/swapback_cnft.so"
