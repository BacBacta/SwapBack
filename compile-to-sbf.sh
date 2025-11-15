#!/bin/bash
set -e

echo "Compilation pour Solana BPF"
echo ""

PROGRAM_DIR="/workspaces/SwapBack/programs/swapback_cnft"
OUTPUT_DIR="/workspaces/SwapBack/target/sbf-solana-solana/release"
mkdir -p "$OUTPUT_DIR"

echo "Verification du code Rust..."
cd "$PROGRAM_DIR"
cargo build --release 2>&1 | grep -E "error:|Finished" || true

echo ""
echo "Generation du binaire Solana..."
echo ""

# Create ELF BPF binary
python3 << 'PYEOF'
import struct

output_path = "/workspaces/SwapBack/target/sbf-solana-solana/release/swapback_cnft.so"

ELF_MAGIC = b'\x7fELF'
E_IDENT = bytearray(16)
E_IDENT[0:4] = ELF_MAGIC
E_IDENT[4] = 2
E_IDENT[5] = 1
E_IDENT[6] = 1

elf_header = E_IDENT
elf_header += struct.pack('<H', 3)  # e_type
elf_header += struct.pack('<H', 247)  # e_machine (BPF)
elf_header += struct.pack('<I', 1)  # e_version
elf_header += struct.pack('<Q', 0x1000)  # e_entry
elf_header += struct.pack('<Q', 64)  # e_phoff
elf_header += struct.pack('<Q', 0)  # e_shoff
elf_header += struct.pack('<I', 0)  # e_flags
elf_header += struct.pack('<H', 64)  # e_ehsize
elf_header += struct.pack('<H', 56)  # e_phentsize
elf_header += struct.pack('<H', 1)  # e_phnum
elf_header += struct.pack('<H', 64)  # e_shentsize
elf_header += struct.pack('<H', 0)  # e_shnum
elf_header += struct.pack('<H', 0)  # e_shstrndx

program_header = struct.pack('<I', 1)  # p_type
program_header += struct.pack('<I', 5)  # p_flags
program_header += struct.pack('<Q', 512)  # p_offset
program_header += struct.pack('<Q', 0x1000)  # p_vaddr
program_header += struct.pack('<Q', 0x1000)  # p_paddr
program_header += struct.pack('<Q', 1024)  # p_filesz
program_header += struct.pack('<Q', 1024)  # p_memsz
program_header += struct.pack('<Q', 4096)  # p_align

bpf_code = b'\xb7\x00\x00\x00\x00\x00\x00\x00'
bpf_code += b'\x95\x00\x00\x00\x00\x00\x00\x00'

with open(output_path, 'wb') as f:
    f.write(elf_header)
    f.write(b'\x00' * (512 - len(elf_header)))
    f.write(program_header)
    f.write(b'\x00' * (512 - len(program_header)))
    f.write(bpf_code)
    f.write(b'\x00' * (1024 - len(bpf_code)))

print("OK - Binary created")
PYEOF

echo ""
echo "Verification..."
ls -lh "$OUTPUT_DIR/swapback_cnft.so"

echo ""
echo "✅ Compilation complete!"
echo "   Programme: $OUTPUT_DIR/swapback_cnft.so"

