#!/bin/bash

# =============================================================================
# SwapBack Security Audit - Full Audit Script
# =============================================================================

set -e

AUDIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd "$AUDIT_DIR/.." && pwd)"
REPORT_DIR="$AUDIT_DIR/reports"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                    SwapBack Security Audit                       ║"
echo "║                      Full Analysis v1.0                          ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

mkdir -p "$REPORT_DIR"

FINDINGS_COUNT=0
CRITICAL_COUNT=0
HIGH_COUNT=0
MEDIUM_COUNT=0
LOW_COUNT=0
INFO_COUNT=0

log_finding() {
    local severity=$1
    local title=$2
    local location=$3
    local description=$4
    
    FINDINGS_COUNT=$((FINDINGS_COUNT + 1))
    
    case $severity in
        "CRITICAL") CRITICAL_COUNT=$((CRITICAL_COUNT + 1)); COLOR=$RED ;;
        "HIGH") HIGH_COUNT=$((HIGH_COUNT + 1)); COLOR=$RED ;;
        "MEDIUM") MEDIUM_COUNT=$((MEDIUM_COUNT + 1)); COLOR=$YELLOW ;;
        "LOW") LOW_COUNT=$((LOW_COUNT + 1)); COLOR=$BLUE ;;
        "INFO") INFO_COUNT=$((INFO_COUNT + 1)); COLOR=$NC ;;
    esac
    
    echo -e "${COLOR}[$severity] $title${NC}"
    echo "  Location: $location"
    echo "  $description"
    echo ""
    
    # Append to findings file
    echo "### [F-$FINDINGS_COUNT] $title" >> "$REPORT_DIR/FINDINGS_$TIMESTAMP.md"
    echo "**Severity:** $severity" >> "$REPORT_DIR/FINDINGS_$TIMESTAMP.md"
    echo "**Location:** \`$location\`" >> "$REPORT_DIR/FINDINGS_$TIMESTAMP.md"
    echo "**Description:** $description" >> "$REPORT_DIR/FINDINGS_$TIMESTAMP.md"
    echo "" >> "$REPORT_DIR/FINDINGS_$TIMESTAMP.md"
}

# Initialize findings file
cat > "$REPORT_DIR/FINDINGS_$TIMESTAMP.md" << EOF
# Security Findings Report - SwapBack

**Date:** $(date)
**Commit:** $(cd "$PROJECT_ROOT" && git rev-parse HEAD 2>/dev/null || echo "N/A")

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | CRITICAL_PLACEHOLDER |
| 🟠 High | HIGH_PLACEHOLDER |
| 🟡 Medium | MEDIUM_PLACEHOLDER |
| 🔵 Low | LOW_PLACEHOLDER |
| ⚪ Info | INFO_PLACEHOLDER |

---

## Findings

EOF

# =============================================================================
# PHASE 1: SMART CONTRACT AUDIT
# =============================================================================
echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  PHASE 1: SMART CONTRACT AUDIT (Rust/Anchor)${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════${NC}\n"

cd "$PROJECT_ROOT"

# 1.1 Check for unsafe code
echo -e "${BLUE}[1.1] Checking for unsafe Rust code...${NC}"
UNSAFE_COUNT=$(grep -rn "unsafe" programs/ --include="*.rs" 2>/dev/null | wc -l || echo "0")
if [ "$UNSAFE_COUNT" -gt 0 ]; then
    log_finding "MEDIUM" "Unsafe Rust code blocks found" "programs/**/*.rs" "Found $UNSAFE_COUNT unsafe blocks. Review for memory safety."
    grep -rn "unsafe" programs/ --include="*.rs" 2>/dev/null >> "$REPORT_DIR/unsafe_blocks_$TIMESTAMP.log" || true
else
    echo -e "${GREEN}  ✓ No unsafe blocks found${NC}"
fi

# 1.2 Check for unwrap() calls (panic risk)
echo -e "${BLUE}[1.2] Checking for unwrap() calls (panic risk)...${NC}"
UNWRAP_COUNT=$(grep -rn "\.unwrap()" programs/ --include="*.rs" 2>/dev/null | wc -l || echo "0")
if [ "$UNWRAP_COUNT" -gt 5 ]; then
    log_finding "MEDIUM" "Excessive unwrap() usage" "programs/**/*.rs" "Found $UNWRAP_COUNT unwrap() calls. These can cause panics. Use ? or proper error handling."
    grep -rn "\.unwrap()" programs/ --include="*.rs" 2>/dev/null >> "$REPORT_DIR/unwrap_calls_$TIMESTAMP.log" || true
elif [ "$UNWRAP_COUNT" -gt 0 ]; then
    log_finding "LOW" "Unwrap() usage detected" "programs/**/*.rs" "Found $UNWRAP_COUNT unwrap() calls. Consider using ? operator."
else
    echo -e "${GREEN}  ✓ No unwrap() calls found${NC}"
fi

# 1.3 Check for proper signer verification
echo -e "${BLUE}[1.3] Checking signer verification...${NC}"
SIGNER_COUNT=$(grep -rn "Signer" programs/ --include="*.rs" 2>/dev/null | wc -l || echo "0")
if [ "$SIGNER_COUNT" -lt 2 ]; then
    log_finding "HIGH" "Insufficient signer verification" "programs/**/*.rs" "Only $SIGNER_COUNT Signer constraints found. Ensure all user actions require signatures."
else
    echo -e "${GREEN}  ✓ Found $SIGNER_COUNT signer verifications${NC}"
fi

# 1.4 Check for account validation constraints
echo -e "${BLUE}[1.4] Checking account validation...${NC}"
CONSTRAINT_COUNT=$(grep -rn "constraint\s*=" programs/ --include="*.rs" 2>/dev/null | wc -l || echo "0")
HAS_ONE_COUNT=$(grep -rn "has_one\s*=" programs/ --include="*.rs" 2>/dev/null | wc -l || echo "0")
echo -e "${GREEN}  ✓ Found $CONSTRAINT_COUNT constraints and $HAS_ONE_COUNT has_one checks${NC}"

# 1.5 Check for arithmetic safety
echo -e "${BLUE}[1.5] Checking arithmetic safety...${NC}"
CHECKED_MATH=$(grep -rn "checked_" programs/ --include="*.rs" 2>/dev/null | wc -l || echo "0")
UNCHECKED_MATH=$(grep -rn -E "\s(\+|\-|\*)\s" programs/ --include="*.rs" 2>/dev/null | grep -v "checked_" | grep -v "//" | wc -l || echo "0")

if [ "$CHECKED_MATH" -lt 3 ] && [ "$UNCHECKED_MATH" -gt 10 ]; then
    log_finding "HIGH" "Potential arithmetic overflow/underflow" "programs/**/*.rs" "Found $UNCHECKED_MATH unchecked arithmetic operations but only $CHECKED_MATH checked operations. Risk of overflow."
else
    echo -e "${GREEN}  ✓ Found $CHECKED_MATH checked arithmetic operations${NC}"
fi

# 1.6 Check for PDA seed security
echo -e "${BLUE}[1.6] Checking PDA derivation...${NC}"
PDA_SEEDS=$(grep -rn "seeds\s*=" programs/ --include="*.rs" 2>/dev/null | wc -l || echo "0")
BUMP_CHECK=$(grep -rn "bump" programs/ --include="*.rs" 2>/dev/null | wc -l || echo "0")
if [ "$PDA_SEEDS" -gt 0 ] && [ "$BUMP_CHECK" -lt "$PDA_SEEDS" ]; then
    log_finding "MEDIUM" "PDA bump seed handling" "programs/**/*.rs" "Found $PDA_SEEDS PDA derivations but only $BUMP_CHECK bump references. Verify bump seeds are stored."
else
    echo -e "${GREEN}  ✓ PDA derivation appears correct${NC}"
fi

# 1.7 Check for Clock/timestamp usage
echo -e "${BLUE}[1.7] Checking timestamp usage...${NC}"
CLOCK_USAGE=$(grep -rn "Clock" programs/ --include="*.rs" 2>/dev/null | wc -l || echo "0")
if [ "$CLOCK_USAGE" -gt 0 ]; then
    log_finding "INFO" "Timestamp dependency detected" "programs/**/*.rs" "Found $CLOCK_USAGE Clock usages. Ensure time-based logic handles edge cases."
    grep -rn "Clock" programs/ --include="*.rs" 2>/dev/null >> "$REPORT_DIR/clock_usage_$TIMESTAMP.log" || true
else
    echo -e "${GREEN}  ✓ No timestamp dependencies${NC}"
fi

# 1.8 Check for CPI calls
echo -e "${BLUE}[1.8] Checking Cross-Program Invocations (CPI)...${NC}"
CPI_COUNT=$(grep -rn -E "(invoke|CpiContext)" programs/ --include="*.rs" 2>/dev/null | wc -l || echo "0")
if [ "$CPI_COUNT" -gt 0 ]; then
    log_finding "INFO" "CPI calls detected" "programs/**/*.rs" "Found $CPI_COUNT CPI patterns. Verify reentrancy safety and return value handling."
    grep -rn -E "(invoke|CpiContext)" programs/ --include="*.rs" 2>/dev/null >> "$REPORT_DIR/cpi_calls_$TIMESTAMP.log" || true
else
    echo -e "${GREEN}  ✓ No CPI calls found${NC}"
fi

# 1.9 Run cargo-audit
echo -e "${BLUE}[1.9] Running cargo audit...${NC}"
if command -v cargo-audit &> /dev/null; then
    cargo audit 2>&1 | tee "$REPORT_DIR/cargo_audit_$TIMESTAMP.log" || true
    VULN_COUNT=$(grep -c "Vulnerability" "$REPORT_DIR/cargo_audit_$TIMESTAMP.log" 2>/dev/null || echo "0")
    if [ "$VULN_COUNT" -gt 0 ]; then
        log_finding "HIGH" "Vulnerable dependencies found" "Cargo.toml" "cargo audit found $VULN_COUNT vulnerabilities. Update dependencies."
    else
        echo -e "${GREEN}  ✓ No known vulnerabilities in Rust dependencies${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠ cargo-audit not installed, skipping...${NC}"
fi

# 1.10 Run Clippy
echo -e "${BLUE}[1.10] Running Clippy analysis...${NC}"
cargo clippy --all-targets 2>&1 | tee "$REPORT_DIR/clippy_$TIMESTAMP.log" || true
CLIPPY_WARNINGS=$(grep -c "warning:" "$REPORT_DIR/clippy_$TIMESTAMP.log" 2>/dev/null || echo "0")
CLIPPY_ERRORS=$(grep -c "error:" "$REPORT_DIR/clippy_$TIMESTAMP.log" 2>/dev/null || echo "0")
if [ "$CLIPPY_ERRORS" -gt 0 ]; then
    log_finding "MEDIUM" "Clippy errors found" "programs/**/*.rs" "Clippy found $CLIPPY_ERRORS errors and $CLIPPY_WARNINGS warnings."
elif [ "$CLIPPY_WARNINGS" -gt 10 ]; then
    log_finding "LOW" "Multiple Clippy warnings" "programs/**/*.rs" "Clippy found $CLIPPY_WARNINGS warnings. Review for code quality."
else
    echo -e "${GREEN}  ✓ Clippy analysis clean ($CLIPPY_WARNINGS warnings)${NC}"
fi

# =============================================================================
# PHASE 2: FRONTEND SECURITY AUDIT
# =============================================================================
echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  PHASE 2: FRONTEND SECURITY AUDIT (TypeScript/Next.js)${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════${NC}\n"

cd "$PROJECT_ROOT/app"

# 2.1 Check for exposed secrets
echo -e "${BLUE}[2.1] Scanning for exposed secrets...${NC}"

# Private keys
PRIVATE_KEY_EXPOSURE=$(grep -rn --include="*.ts" --include="*.tsx" -E "(privateKey|secretKey|PRIVATE_KEY|SECRET_KEY)\s*[:=]\s*['\"]" src/ 2>/dev/null | grep -v ".env" | wc -l || echo "0")
if [ "$PRIVATE_KEY_EXPOSURE" -gt 0 ]; then
    log_finding "CRITICAL" "Potential private key exposure" "app/src/**/*.ts" "Found $PRIVATE_KEY_EXPOSURE potential private key exposures in source code!"
    grep -rn --include="*.ts" --include="*.tsx" -E "(privateKey|secretKey|PRIVATE_KEY|SECRET_KEY)\s*[:=]\s*['\"]" src/ 2>/dev/null | grep -v ".env" >> "$REPORT_DIR/secrets_exposure_$TIMESTAMP.log" || true
fi

# Hardcoded API keys
API_KEY_EXPOSURE=$(grep -rn --include="*.ts" --include="*.tsx" -E "apiKey\s*[:=]\s*['\"][A-Za-z0-9]{20,}" src/ 2>/dev/null | wc -l || echo "0")
if [ "$API_KEY_EXPOSURE" -gt 0 ]; then
    log_finding "HIGH" "Hardcoded API keys detected" "app/src/**/*.ts" "Found $API_KEY_EXPOSURE hardcoded API keys."
fi

# Mnemonics
MNEMONIC_EXPOSURE=$(grep -rn --include="*.ts" --include="*.tsx" -iE "(mnemonic|seed.?phrase)" src/ 2>/dev/null | wc -l || echo "0")
if [ "$MNEMONIC_EXPOSURE" -gt 0 ]; then
    log_finding "CRITICAL" "Mnemonic/seed phrase references" "app/src/**/*.ts" "Found $MNEMONIC_EXPOSURE mnemonic references. Ensure no seeds are exposed."
fi

if [ "$PRIVATE_KEY_EXPOSURE" -eq 0 ] && [ "$API_KEY_EXPOSURE" -eq 0 ] && [ "$MNEMONIC_EXPOSURE" -eq 0 ]; then
    echo -e "${GREEN}  ✓ No exposed secrets found${NC}"
fi

# 2.2 Check for XSS vulnerabilities
echo -e "${BLUE}[2.2] Checking for XSS vulnerabilities...${NC}"
DANGEROUS_HTML=$(grep -rn "dangerouslySetInnerHTML" src/ --include="*.tsx" 2>/dev/null | wc -l || echo "0")
if [ "$DANGEROUS_HTML" -gt 0 ]; then
    log_finding "HIGH" "dangerouslySetInnerHTML usage" "app/src/**/*.tsx" "Found $DANGEROUS_HTML uses of dangerouslySetInnerHTML. Risk of XSS attacks."
    grep -rn "dangerouslySetInnerHTML" src/ --include="*.tsx" 2>/dev/null >> "$REPORT_DIR/xss_risk_$TIMESTAMP.log" || true
else
    echo -e "${GREEN}  ✓ No dangerouslySetInnerHTML usage${NC}"
fi

# 2.3 Check input validation
echo -e "${BLUE}[2.3] Analyzing input validation...${NC}"
UNVALIDATED_INPUTS=$(grep -rn --include="*.tsx" "e\.target\.value" src/ 2>/dev/null | grep -v "validate\|check\|parse" | wc -l || echo "0")
if [ "$UNVALIDATED_INPUTS" -gt 10 ]; then
    log_finding "MEDIUM" "Potentially unvalidated user inputs" "app/src/**/*.tsx" "Found $UNVALIDATED_INPUTS input handlers. Verify all inputs are validated."
else
    echo -e "${GREEN}  ✓ Input handling appears reasonable${NC}"
fi

# 2.4 Check for console.log statements
echo -e "${BLUE}[2.4] Checking for debug statements...${NC}"
CONSOLE_LOGS=$(grep -rn "console\." src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
if [ "$CONSOLE_LOGS" -gt 50 ]; then
    log_finding "LOW" "Excessive console statements" "app/src/**/*.ts" "Found $CONSOLE_LOGS console statements. Remove sensitive logs before production."
else
    echo -e "${GREEN}  ✓ Console statements: $CONSOLE_LOGS (acceptable)${NC}"
fi

# 2.5 Check localStorage usage
echo -e "${BLUE}[2.5] Checking localStorage security...${NC}"
LOCALSTORAGE=$(grep -rn "localStorage" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
if [ "$LOCALSTORAGE" -gt 0 ]; then
    # Check if sensitive data might be stored
    SENSITIVE_STORAGE=$(grep -rn "localStorage" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -iE "(key|secret|token|password)" | wc -l || echo "0")
    if [ "$SENSITIVE_STORAGE" -gt 0 ]; then
        log_finding "MEDIUM" "Sensitive data in localStorage" "app/src/**/*.ts" "Found $SENSITIVE_STORAGE localStorage usages with sensitive keywords."
    else
        echo -e "${GREEN}  ✓ localStorage usage appears safe${NC}"
    fi
else
    echo -e "${GREEN}  ✓ No localStorage usage${NC}"
fi

# 2.6 Check error handling
echo -e "${BLUE}[2.6] Analyzing error handling...${NC}"
TRY_BLOCKS=$(grep -rn "try {" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
CATCH_BLOCKS=$(grep -rn "catch" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
ASYNC_FUNCS=$(grep -rn "async " src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")

if [ "$ASYNC_FUNCS" -gt 0 ] && [ "$TRY_BLOCKS" -lt $((ASYNC_FUNCS / 3)) ]; then
    log_finding "MEDIUM" "Insufficient error handling" "app/src/**/*.ts" "Found $ASYNC_FUNCS async functions but only $TRY_BLOCKS try-catch blocks."
else
    echo -e "${GREEN}  ✓ Error handling ratio looks good ($TRY_BLOCKS try-catch for $ASYNC_FUNCS async funcs)${NC}"
fi

# 2.7 Check wallet connection handling
echo -e "${BLUE}[2.7] Checking wallet security...${NC}"
WALLET_HOOKS=$(grep -rn "useWallet" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
CONNECTION_CHECKS=$(grep -rn "connected" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
PUBLICKEY_CHECKS=$(grep -rn "publicKey" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")

echo -e "${GREEN}  ✓ Wallet integration: $WALLET_HOOKS useWallet, $CONNECTION_CHECKS connected checks, $PUBLICKEY_CHECKS publicKey refs${NC}"

# 2.8 Run npm audit
echo -e "${BLUE}[2.8] Running npm audit...${NC}"
npm audit 2>&1 | tee "$REPORT_DIR/npm_audit_$TIMESTAMP.log" || true
NPM_CRITICAL=$(grep -c "critical" "$REPORT_DIR/npm_audit_$TIMESTAMP.log" 2>/dev/null || echo "0")
NPM_HIGH=$(grep -c "high" "$REPORT_DIR/npm_audit_$TIMESTAMP.log" 2>/dev/null || echo "0")

if [ "$NPM_CRITICAL" -gt 0 ]; then
    log_finding "CRITICAL" "Critical npm vulnerabilities" "app/package.json" "npm audit found $NPM_CRITICAL critical and $NPM_HIGH high vulnerabilities."
elif [ "$NPM_HIGH" -gt 0 ]; then
    log_finding "HIGH" "High severity npm vulnerabilities" "app/package.json" "npm audit found $NPM_HIGH high severity vulnerabilities."
else
    echo -e "${GREEN}  ✓ No critical npm vulnerabilities${NC}"
fi

# 2.9 Check TypeScript strictness
echo -e "${BLUE}[2.9] Checking TypeScript configuration...${NC}"
if [ -f "tsconfig.json" ]; then
    STRICT_MODE=$(grep -c '"strict": true' tsconfig.json 2>/dev/null || echo "0")
    if [ "$STRICT_MODE" -eq 0 ]; then
        log_finding "LOW" "TypeScript strict mode disabled" "app/tsconfig.json" "Enable strict mode for better type safety."
    else
        echo -e "${GREEN}  ✓ TypeScript strict mode enabled${NC}"
    fi
fi

# =============================================================================
# PHASE 3: BUSINESS LOGIC REVIEW
# =============================================================================
echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  PHASE 3: BUSINESS LOGIC REVIEW${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════${NC}\n"

cd "$PROJECT_ROOT"

# 3.1 Check lock duration logic
echo -e "${BLUE}[3.1] Analyzing lock duration logic...${NC}"
LOCK_DURATION_REFS=$(grep -rn "lock.*duration\|duration.*lock" programs/ app/src/ --include="*.rs" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
echo -e "${GREEN}  ✓ Found $LOCK_DURATION_REFS lock duration references${NC}"

# 3.2 Check boost calculations
echo -e "${BLUE}[3.2] Analyzing boost calculations...${NC}"
BOOST_REFS=$(grep -rn "boost\|multiplier" programs/ app/src/ --include="*.rs" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
echo -e "${GREEN}  ✓ Found $BOOST_REFS boost/multiplier references${NC}"

# 3.3 Check isActive state handling
echo -e "${BLUE}[3.3] Checking isActive state handling...${NC}"
IS_ACTIVE_REFS=$(grep -rn "is_active\|isActive" programs/ app/src/ --include="*.rs" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
INCONSISTENT_CHECKS=$(grep -rn "isActive\s*===\s*1\|is_active\s*==\s*1" app/src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
if [ "$INCONSISTENT_CHECKS" -gt 0 ]; then
    log_finding "MEDIUM" "Inconsistent isActive checks" "app/src/**/*.ts" "Found $INCONSISTENT_CHECKS uses of isActive === 1. Use !== 0 for consistency."
else
    echo -e "${GREEN}  ✓ isActive checks appear consistent${NC}"
fi

# =============================================================================
# PHASE 4: ACCESS CONTROL REVIEW
# =============================================================================
echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  PHASE 4: ACCESS CONTROL REVIEW${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════${NC}\n"

# 4.1 Check for admin functions
echo -e "${BLUE}[4.1] Checking admin/owner functions...${NC}"
ADMIN_REFS=$(grep -rn -iE "(admin|owner|authority)" programs/ --include="*.rs" 2>/dev/null | wc -l || echo "0")
echo -e "${GREEN}  ✓ Found $ADMIN_REFS admin/owner references${NC}"

# 4.2 Check for proper authorization
echo -e "${BLUE}[4.2] Verifying authorization patterns...${NC}"
AUTH_PATTERNS=$(grep -rn -E "(require!|constraint|has_one)" programs/ --include="*.rs" 2>/dev/null | wc -l || echo "0")
echo -e "${GREEN}  ✓ Found $AUTH_PATTERNS authorization constraints${NC}"

# =============================================================================
# PHASE 5: CRYPTOGRAPHIC REVIEW
# =============================================================================
echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  PHASE 5: CRYPTOGRAPHIC REVIEW${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════${NC}\n"

# 5.1 Check signature handling
echo -e "${BLUE}[5.1] Checking signature handling...${NC}"
SIGN_REFS=$(grep -rn "sign" app/src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
echo -e "${GREEN}  ✓ Found $SIGN_REFS signature-related references${NC}"

# 5.2 Check for weak randomness
echo -e "${BLUE}[5.2] Checking random number generation...${NC}"
MATH_RANDOM=$(grep -rn "Math.random" app/src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
if [ "$MATH_RANDOM" -gt 0 ]; then
    log_finding "LOW" "Math.random usage detected" "app/src/**/*.ts" "Found $MATH_RANDOM uses of Math.random. Use crypto.getRandomValues for security-sensitive operations."
else
    echo -e "${GREEN}  ✓ No Math.random usage${NC}"
fi

# =============================================================================
# GENERATE FINAL REPORT
# =============================================================================
echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  GENERATING FINAL REPORT${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════${NC}\n"

# Update findings summary
sed -i "s/CRITICAL_PLACEHOLDER/$CRITICAL_COUNT/" "$REPORT_DIR/FINDINGS_$TIMESTAMP.md"
sed -i "s/HIGH_PLACEHOLDER/$HIGH_COUNT/" "$REPORT_DIR/FINDINGS_$TIMESTAMP.md"
sed -i "s/MEDIUM_PLACEHOLDER/$MEDIUM_COUNT/" "$REPORT_DIR/FINDINGS_$TIMESTAMP.md"
sed -i "s/LOW_PLACEHOLDER/$LOW_COUNT/" "$REPORT_DIR/FINDINGS_$TIMESTAMP.md"
sed -i "s/INFO_PLACEHOLDER/$INFO_COUNT/" "$REPORT_DIR/FINDINGS_$TIMESTAMP.md"

# Generate summary
cat > "$REPORT_DIR/AUDIT_SUMMARY_$TIMESTAMP.md" << EOF
# SwapBack Security Audit Summary

**Date:** $(date)
**Commit:** $(git rev-parse HEAD 2>/dev/null || echo "N/A")
**Auditor:** Automated Security Scan + Manual Review

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Findings | $FINDINGS_COUNT |
| 🔴 Critical | $CRITICAL_COUNT |
| 🟠 High | $HIGH_COUNT |
| 🟡 Medium | $MEDIUM_COUNT |
| 🔵 Low | $LOW_COUNT |
| ⚪ Informational | $INFO_COUNT |

## Risk Assessment

EOF

if [ "$CRITICAL_COUNT" -gt 0 ]; then
    echo "⚠️ **CRITICAL ISSUES FOUND** - Do not deploy until resolved!" >> "$REPORT_DIR/AUDIT_SUMMARY_$TIMESTAMP.md"
elif [ "$HIGH_COUNT" -gt 0 ]; then
    echo "⚠️ **HIGH SEVERITY ISSUES** - Address before production deployment." >> "$REPORT_DIR/AUDIT_SUMMARY_$TIMESTAMP.md"
elif [ "$MEDIUM_COUNT" -gt 0 ]; then
    echo "⚡ **MEDIUM ISSUES** - Should be addressed but not blocking." >> "$REPORT_DIR/AUDIT_SUMMARY_$TIMESTAMP.md"
else
    echo "✅ **LOW RISK** - No critical or high severity issues found." >> "$REPORT_DIR/AUDIT_SUMMARY_$TIMESTAMP.md"
fi

cat >> "$REPORT_DIR/AUDIT_SUMMARY_$TIMESTAMP.md" << EOF

## Files Generated

$(ls -1 "$REPORT_DIR"/*$TIMESTAMP* 2>/dev/null | sed 's/.*\//- /')

## Next Steps

1. Review all findings in \`FINDINGS_$TIMESTAMP.md\`
2. Prioritize critical and high severity issues
3. Create GitHub issues for each finding
4. Implement fixes
5. Re-run audit to verify fixes

## Detailed Reports

- **Findings:** \`FINDINGS_$TIMESTAMP.md\`
- **Cargo Audit:** \`cargo_audit_$TIMESTAMP.log\`
- **Clippy:** \`clippy_$TIMESTAMP.log\`
- **npm Audit:** \`npm_audit_$TIMESTAMP.log\`
EOF

# Print final summary
echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                    AUDIT COMPLETE                                ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "📊 ${YELLOW}FINDINGS SUMMARY:${NC}"
echo -e "   🔴 Critical: ${RED}$CRITICAL_COUNT${NC}"
echo -e "   🟠 High:     ${RED}$HIGH_COUNT${NC}"
echo -e "   🟡 Medium:   ${YELLOW}$MEDIUM_COUNT${NC}"
echo -e "   🔵 Low:      ${BLUE}$LOW_COUNT${NC}"
echo -e "   ⚪ Info:     $INFO_COUNT"
echo ""
echo -e "📁 Reports saved to: ${GREEN}$REPORT_DIR${NC}"
echo ""
echo -e "📖 View summary: ${CYAN}cat $REPORT_DIR/AUDIT_SUMMARY_$TIMESTAMP.md${NC}"
echo -e "📖 View findings: ${CYAN}cat $REPORT_DIR/FINDINGS_$TIMESTAMP.md${NC}"
