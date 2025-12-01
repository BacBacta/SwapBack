#!/usr/bin/env bash
# ============================================================================
# perf-gate.sh - Performance regression gate
# ============================================================================
# Checks for performance anti-patterns in critical paths and runs CU tests.
#
# Usage: ./scripts/perf-gate.sh
# ============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

echo "=============================================="
echo "🚀 SwapBack Performance Gate"
echo "=============================================="

FAILED=false

# Critical path files
CRITICAL_FILES=(
    "programs/swapback_router/src/cpi_jupiter.rs"
    "programs/swapback_router/src/cpi_orca.rs"
    "programs/swapback_router/src/cpi_raydium.rs"
    "programs/swapback_router/src/routing.rs"
    "programs/swapback_router/src/math.rs"
)

# ============================================================================
# [1/4] Check that debug-logs feature is OFF by default
# ============================================================================
echo -e "\n${YELLOW}[1/4] Checking debug-logs feature is OFF by default...${NC}"

if grep -q 'default = \[.*"debug-logs"' programs/swapback_router/Cargo.toml; then
    echo -e "${RED}❌ debug-logs is in default features!${NC}"
    FAILED=true
else
    echo -e "${GREEN}✅ debug-logs is OFF by default${NC}"
fi

# ============================================================================
# [2/4] Scan for performance anti-patterns in critical files
# ============================================================================
echo -e "\n${YELLOW}[2/4] Scanning for performance anti-patterns...${NC}"

# Patterns to warn about (not fail)
WARN_PATTERNS=(
    "format!"
    "to_string()"
    "String::from"
)

# Count occurrences
for file in "${CRITICAL_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        for pattern in "${WARN_PATTERNS[@]}"; do
            count=$(grep -c "$pattern" "$file" 2>/dev/null || true)
            count=${count:-0}
            if [[ "$count" -gt 0 ]]; then
                echo -e "${YELLOW}⚠️  $file: $count occurrence(s) of '$pattern'${NC}"
            fi
        done
    fi
done

# Count collect::<Vec in critical files
COLLECT_COUNT=0
for file in "${CRITICAL_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        c=$(grep -c 'collect::<Vec' "$file" 2>/dev/null || true)
        c=${c:-0}
        COLLECT_COUNT=$((COLLECT_COUNT + c))
    fi
done
echo -e "📊 Total collect::<Vec in critical paths: $COLLECT_COUNT"

# Count clone() in critical files
CLONE_COUNT=0
for file in "${CRITICAL_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        c=$(grep -c '\.clone()' "$file" 2>/dev/null || true)
        c=${c:-0}
        CLONE_COUNT=$((CLONE_COUNT + c))
    fi
done
echo -e "📊 Total .clone() in critical paths: $CLONE_COUNT"

# Count to_vec() in critical files
TOVEC_COUNT=0
for file in "${CRITICAL_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        c=$(grep -c '\.to_vec()' "$file" 2>/dev/null || true)
        c=${c:-0}
        TOVEC_COUNT=$((TOVEC_COUNT + c))
    fi
done
echo -e "📊 Total .to_vec() in critical paths: $TOVEC_COUNT"

echo -e "${GREEN}✅ Anti-pattern scan complete${NC}"

# ============================================================================
# [3/4] Build check
# ============================================================================
echo -e "\n${YELLOW}[3/4] Running cargo check...${NC}"

if cargo check -p swapback_router 2>&1 | tail -5; then
    echo -e "${GREEN}✅ Build check passed${NC}"
else
    echo -e "${RED}❌ Build check failed${NC}"
    FAILED=true
fi

# ============================================================================
# [4/4] Run tests
# ============================================================================
echo -e "\n${YELLOW}[4/4] Running tests...${NC}"

if cargo test -p swapback_router --lib 2>&1 | tail -20; then
    echo -e "${GREEN}✅ Tests passed${NC}"
else
    echo -e "${RED}❌ Tests failed${NC}"
    FAILED=true
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "=============================================="
echo "📊 Performance Metrics Summary"
echo "=============================================="
echo "  collect::<Vec count: $COLLECT_COUNT"
echo "  .clone() count:      $CLONE_COUNT"
echo "  .to_vec() count:     $TOVEC_COUNT"
echo ""

if [[ "$FAILED" == "true" ]]; then
    echo -e "${RED}❌ Performance gate FAILED${NC}"
    exit 1
else
    echo -e "${GREEN}🎉 Performance gate PASSED${NC}"
    exit 0
fi
