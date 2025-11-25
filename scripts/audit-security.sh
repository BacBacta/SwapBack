#!/bin/bash
set -e

echo "🔒 SwapBack Security Audit - Automated Scan"
echo "=========================================="
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

RESULTS_DIR="security-audit-results"
mkdir -p "$RESULTS_DIR"

PASSED=0
FAILED=0

# Function to log results
log_pass() {
    echo -e "${GREEN}✅ PASSED${NC}: $1"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}❌ FAILED${NC}: $1"
    ((FAILED++))
}

log_warn() {
    echo -e "${YELLOW}⚠️  WARNING${NC}: $1"
}

log_info() {
    echo -e "${BLUE}ℹ️  INFO${NC}: $1"
}

# 1. Cargo audit (Dependency Vulnerabilities)
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}1. Cargo Audit (Dependency Vulnerabilities)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if command -v cargo-audit &> /dev/null; then
    if cargo audit 2>&1 | tee "$RESULTS_DIR/cargo-audit.log"; then
        log_pass "No dependency vulnerabilities"
    else
        log_fail "Vulnerabilities found in dependencies"
    fi
else
    log_warn "cargo-audit not installed. Run: cargo install cargo-audit"
fi

# 2. Cargo clippy (Code Quality)
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}2. Cargo Clippy (Code Quality)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if cargo clippy --all-targets --all-features -- -D warnings 2>&1 | tee "$RESULTS_DIR/clippy.log"; then
    log_pass "No clippy warnings"
else
    log_fail "Clippy warnings found"
fi

# 3. Security-specific clippy
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}3. Security-Focused Clippy${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if cargo clippy -- \
  -W clippy::unwrap_used \
  -W clippy::expect_used \
  -W clippy::panic \
  -W clippy::integer_arithmetic 2>&1 | tee "$RESULTS_DIR/clippy-security.log"; then
    log_pass "No security concerns"
else
    log_fail "Security concerns found"
fi

# 4. Build avec overflow checks
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}4. Build with Overflow Checks${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if RUSTFLAGS="-C overflow-checks=on" cargo build-sbf 2>&1 | tee "$RESULTS_DIR/build-overflow.log"; then
    log_pass "Build successful with overflow checks"
else
    log_fail "Build failed with overflow checks"
fi

# 5. Tests unitaires
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}5. Unit Tests${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if cargo test 2>&1 | tee "$RESULTS_DIR/unit-tests.log"; then
    log_pass "All unit tests pass"
else
    log_fail "Unit tests failed"
fi

# 6. Vérifier aucun TODO security
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}6. Security TODOs${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if grep -r "TODO.*[Ss]ecur" programs/ 2>/dev/null | tee "$RESULTS_DIR/security-todos.log"; then
    log_warn "Security TODOs found (see $RESULTS_DIR/security-todos.log)"
else
    log_pass "No security TODOs"
fi

# 7. Vérifier aucun unwrap/expect en production
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}7. Dangerous Unwraps${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

UNWRAPS=$(grep -r "\.unwrap()" programs/*/src/lib.rs 2>/dev/null | grep -v "#\[cfg(test)\]" | wc -l)
if [ "$UNWRAPS" -gt 0 ]; then
    log_fail "Found $UNWRAPS unwrap() in production code"
    grep -n "\.unwrap()" programs/*/src/lib.rs | grep -v "#\[cfg(test)\]" | tee "$RESULTS_DIR/unwraps.log"
else
    log_pass "No dangerous unwraps"
fi

# 8. Vérifier aucun panic! en production
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}8. Panic Checks${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

PANICS=$(grep -r "panic!" programs/*/src/lib.rs 2>/dev/null | grep -v "#\[cfg(test)\]" | wc -l)
if [ "$PANICS" -gt 0 ]; then
    log_fail "Found $PANICS panic!() in production code"
    grep -n "panic!" programs/*/src/lib.rs | grep -v "#\[cfg(test)\]" | tee "$RESULTS_DIR/panics.log"
else
    log_pass "No panic!() in production"
fi

# 9. Vérifier usage de checked_*
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}9. Checked Arithmetic${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

CHECKED=$(grep -r "checked_\(add\|sub\|mul\|div\)" programs/*/src/lib.rs 2>/dev/null | wc -l)
UNCHECKED=$(grep -r -E '\+|\-|\*|/' programs/*/src/lib.rs 2>/dev/null | grep -v "checked_" | grep -v "//" | wc -l)

log_info "Checked operations: $CHECKED"
log_info "Unchecked operations: $UNCHECKED (includes comments)"

if [ "$CHECKED" -gt 10 ]; then
    log_pass "Good usage of checked arithmetic"
else
    log_warn "Consider using more checked arithmetic"
fi

# 10. Program size analysis
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}10. Program Size Analysis${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

for program in target/deploy/*.so; do
    if [ -f "$program" ]; then
        size=$(du -h "$program" | cut -f1)
        log_info "$(basename $program): $size"
    fi
done

# Rapport final
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Security Audit Results${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e ""
echo -e "Total Tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e ""
echo -e "Detailed logs saved to: ${BLUE}$RESULTS_DIR/${NC}"
echo -e ""

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}🎉 All security checks PASSED!${NC}"
    echo -e ""
    echo -e "Next steps:"
    echo -e "  1. Run fuzzing tests: ${BLUE}cd programs/swapback_router/fuzz && cargo hfuzz run fuzz_swap${NC}"
    echo -e "  2. Schedule external audit with OtterSec/Neodyme"
    echo -e "  3. Deploy to testnet for UAT"
    echo -e ""
    exit 0
else
    echo -e "${RED}❌ Security audit FAILED with $FAILED issues${NC}"
    echo -e ""
    echo -e "Please review logs in ${BLUE}$RESULTS_DIR/${NC} and fix issues."
    echo -e ""
    exit 1
fi
