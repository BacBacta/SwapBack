#!/usr/bin/env bash
set -euo pipefail

# CI helper: generate a stub SBF .so artifact without requiring Solana toolchain.
# This is NOT a deployable program binary.

PROGRAM_DIR="programs/swapback_cnft"
OUT_DIR="${PROGRAM_DIR}/target/sbf-solana-solana/release"
OUT_FILE="${OUT_DIR}/swapback_cnft.so"

mkdir -p "${OUT_DIR}"

cat > "${OUT_FILE}" <<'EOF'
SWAPBACK_CI_STUB_BINARY
This is a placeholder artifact generated in CI.
Do NOT deploy this file to any cluster.
EOF

echo "[create-sbf-stub] Wrote stub: ${OUT_FILE} ($(wc -c < "${OUT_FILE}") bytes)"
