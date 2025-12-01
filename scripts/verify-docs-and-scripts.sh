#!/usr/bin/env bash
# ============================================================================
# verify-docs-and-scripts.sh
# ============================================================================
# Gate script that validates:
# 1. Documentation files exist
# 2. Required sections in docs
# 3. Keeper scripts run successfully (offline)
# 4. JSON outputs validate against schemas
#
# Usage: ./scripts/verify-docs-and-scripts.sh
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
echo "🔍 SwapBack Docs & Scripts Verification"
echo "=============================================="

# Create tmp directory
mkdir -p tmp

FAILED=false

# ============================================================================
# [1/5] Check documentation files exist
# ============================================================================
echo -e "\n${YELLOW}[1/5] Checking documentation files...${NC}"

REQUIRED_DOCS=(
  "docs/KEEPER.md"
  "docs/CPI_ACCOUNTS.md"
  "docs/ROUTING.md"
  "docs/SLIPPAGE.md"
  "docs/EXAMPLES.md"
)

for doc in "${REQUIRED_DOCS[@]}"; do
  if [[ -f "$doc" ]]; then
    echo -e "${GREEN}✅ $doc exists${NC}"
  else
    echo -e "${RED}❌ $doc missing${NC}"
    FAILED=true
  fi
done

# ============================================================================
# [2/5] Check required sections in docs
# ============================================================================
echo -e "\n${YELLOW}[2/5] Checking required sections in docs...${NC}"

# KEEPER.md required sections
KEEPER_SECTIONS=(
  "## Overview"
  "## Transaction building"
  "## Inputs"
  "## Determinism & safety"
  "## Examples"
)

if [[ -f "docs/KEEPER.md" ]]; then
  KEEPER_OK=true
  for section in "${KEEPER_SECTIONS[@]}"; do
    if ! grep -q "^$section" docs/KEEPER.md; then
      echo -e "${RED}❌ KEEPER.md missing section: $section${NC}"
      KEEPER_OK=false
      FAILED=true
    fi
  done
  if [[ "$KEEPER_OK" == "true" ]]; then
    echo -e "${GREEN}✅ KEEPER.md has all required sections${NC}"
  fi
fi

# CPI_ACCOUNTS.md required sections
CPI_SECTIONS=(
  "## Jupiter CPI replay"
  "## Account ordering"
  "## Writable/Signer flags"
  "## Common pitfalls"
  "## Mock route"
)

if [[ -f "docs/CPI_ACCOUNTS.md" ]]; then
  CPI_OK=true
  for section in "${CPI_SECTIONS[@]}"; do
    if ! grep -q "^$section" docs/CPI_ACCOUNTS.md; then
      echo -e "${RED}❌ CPI_ACCOUNTS.md missing section: $section${NC}"
      CPI_OK=false
      FAILED=true
    fi
  done
  if [[ "$CPI_OK" == "true" ]]; then
    echo -e "${GREEN}✅ CPI_ACCOUNTS.md has all required sections${NC}"
  fi
fi

# ============================================================================
# [3/5] Run offline scripts
# ============================================================================
echo -e "\n${YELLOW}[3/5] Running offline scripts...${NC}"

# Check if node_modules exists, if not install
if [[ ! -d "node_modules" ]]; then
  echo "Installing dependencies..."
  npm install --silent
fi

# prepare-mock-route.ts
echo "Running prepare-mock-route.ts..."
if npx tsx scripts/prepare-mock-route.ts \
  --from 7nYUqxrLEDYjBxAUjKpVQ8Dwn4wGxPjPHhMGvMPKPxKP \
  --to 8xYUqxrLEDYjBxAUjKpVQ8Dwn4wGxPjPHhMGvMPKPxKQ \
  --authority 9aYUqxrLEDYjBxAUjKpVQ8Dwn4wGxPjPHhMGvMPKPxKR \
  --amount 1000000000 \
  --output tmp/keeper_route.json > /dev/null 2>&1; then
  echo -e "${GREEN}✅ prepare-mock-route.ts succeeded${NC}"
else
  echo -e "${RED}❌ prepare-mock-route.ts failed${NC}"
  FAILED=true
fi

# validate-remaining-accounts.ts
echo "Running validate-remaining-accounts.ts..."
if npx tsx scripts/validate-remaining-accounts.ts --file tmp/keeper_route.json > /dev/null 2>&1; then
  echo -e "${GREEN}✅ validate-remaining-accounts.ts succeeded${NC}"
else
  echo -e "${RED}❌ validate-remaining-accounts.ts failed${NC}"
  FAILED=true
fi

# prepare-dynamic-plan.ts
echo "Running prepare-dynamic-plan.ts..."
if npx tsx scripts/prepare-dynamic-plan.ts \
  --venues Jupiter:7000 Orca:3000 \
  --output tmp/dynamic_plan.json > /dev/null 2>&1; then
  echo -e "${GREEN}✅ prepare-dynamic-plan.ts succeeded${NC}"
else
  echo -e "${RED}❌ prepare-dynamic-plan.ts failed${NC}"
  FAILED=true
fi

# prepare-slippage-inputs.ts
echo "Running prepare-slippage-inputs.ts..."
if npx tsx scripts/prepare-slippage-inputs.ts \
  --liquidity 1000000000 \
  --volatility-bps 125 \
  --base-bps 50 \
  --min-bps 30 \
  --max-bps 500 \
  --output tmp/slippage.json > /dev/null 2>&1; then
  echo -e "${GREEN}✅ prepare-slippage-inputs.ts succeeded${NC}"
else
  echo -e "${RED}❌ prepare-slippage-inputs.ts failed${NC}"
  FAILED=true
fi

# ============================================================================
# [4/5] Validate JSON outputs
# ============================================================================
echo -e "\n${YELLOW}[4/5] Validating JSON outputs against schemas...${NC}"

# Simple JSON validation (structure check via node)
validate_json() {
  local file=$1
  local schema=$2
  
  if [[ ! -f "$file" ]]; then
    echo -e "${RED}❌ $file not found${NC}"
    return 1
  fi
  
  if [[ ! -f "$schema" ]]; then
    echo -e "${YELLOW}⚠️  Schema $schema not found, skipping validation${NC}"
    return 0
  fi
  
  # Use node to validate
  if node -e "
    const Ajv = require('ajv');
    const fs = require('fs');
    const schema = JSON.parse(fs.readFileSync('$schema'));
    const data = JSON.parse(fs.readFileSync('$file'));
    const ajv = new Ajv();
    const valid = ajv.validate(schema, data);
    if (!valid) {
      console.error(JSON.stringify(ajv.errors));
      process.exit(1);
    }
  " 2>/dev/null; then
    echo -e "${GREEN}✅ $(basename $file) valid${NC}"
    return 0
  else
    echo -e "${RED}❌ $(basename $file) invalid${NC}"
    return 1
  fi
}

validate_json "tmp/keeper_route.json" "schemas/keeper_route.schema.json" || FAILED=true
validate_json "tmp/dynamic_plan.json" "schemas/dynamic_plan.schema.json" || FAILED=true
validate_json "tmp/slippage.json" "schemas/slippage_inputs.schema.json" || FAILED=true

# ============================================================================
# [5/5] Summary
# ============================================================================
echo -e "\n${YELLOW}[5/5] Summary${NC}"

if [[ "$FAILED" == "true" ]]; then
  echo ""
  echo "=============================================="
  echo -e "${RED}❌ Some checks failed!${NC}"
  echo "=============================================="
  exit 1
else
  echo ""
  echo "=============================================="
  echo -e "${GREEN}🎉 All checks passed!${NC}"
  echo "=============================================="
  exit 0
fi
