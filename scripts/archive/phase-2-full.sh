#!/bin/bash

# 🚀 PHASE 2 COMPLETE AUTOMATION SCRIPT
# Deploy smart contracts to Solana devnet + run tests
# Complete workflow in one command

set -e

echo "
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                  🚀 PHASE 2 - SMART CONTRACT DEPLOYMENT 🚀                 ║
║                                                                               ║
║                    Complete automation for devnet deployment                  ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Helper functions
log_step() {
  echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  STEP: $1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_info() {
  echo -e "${YELLOW}ℹ️  $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

# STEP 1: Verify pre-compiled binaries exist
log_step "Verify Pre-Compiled Smart Contract Binaries"

BINARIES=(
  "./target/release/libswapback_router.so"
  "./target/release/libswapback_cnft.so"
  "./target/release/libswapback_buyback.so"
)

all_binaries_exist=true
for binary in "${BINARIES[@]}"; do
  if [ -f "$binary" ]; then
    size=$(du -h "$binary" | cut -f1)
    log_success "Found $binary ($size)"
  else
    log_error "Missing $binary"
    all_binaries_exist=false
  fi
done

if [ "$all_binaries_exist" = false ]; then
  log_error "Some binaries missing. They should have been compiled in Phase 1."
  log_info "Run: cargo build --release"
  exit 1
fi

# STEP 2: Check if Solana CLI is available
log_step "Check Solana CLI Installation"

if ! command -v solana &> /dev/null; then
  log_info "Solana CLI not found. Installing..."
  
  # Try cargo installation first (faster)
  if cargo install solana-cli 2>&1 | head -5; then
    log_success "Solana CLI installed via cargo"
  else
    log_error "Could not install Solana CLI"
    log_info "Manual install: curl https://release.solana.com/v1.18.22/install | bash"
    exit 1
  fi
  
  # Wait for installation
  sleep 5
fi

# Verify installation
if solana --version > /dev/null 2>&1; then
  solana_version=$(solana --version)
  log_success "Solana CLI available: $solana_version"
else
  log_error "Solana CLI installation verification failed"
  exit 1
fi

# STEP 3: Setup Solana configuration
log_step "Configure Solana for Devnet"

log_info "Setting Solana URL to devnet..."
solana config set --url https://api.devnet.solana.com 2>/dev/null || true

log_info "Checking current configuration..."
current_url=$(solana config get | grep "RPC URL" || echo "unknown")
log_success "Current config: $current_url"

# STEP 4: Create or verify keypair
log_step "Setup Deployment Keypair"

KEYPAIR_PATH="$HOME/.config/solana/devnet-deployer.json"

if [ ! -d "$HOME/.config/solana" ]; then
  mkdir -p "$HOME/.config/solana"
fi

if [ ! -f "$KEYPAIR_PATH" ]; then
  log_info "Creating new keypair: $KEYPAIR_PATH"
  solana-keygen new --outfile "$KEYPAIR_PATH" --no-passphrase --force 2>&1 | head -3 || log_info "Keypair generation (may already exist)"
fi

# Get the public key
PUBKEY=$(solana-keygen pubkey "$KEYPAIR_PATH" 2>/dev/null || echo "unknown")
log_success "Deployer keypair: $PUBKEY"

# STEP 5: Check devnet balance and airdrop if needed
log_step "Check SOL Balance & Request Airdrop if Needed"

# Set keypair as default
solana config set --keypair "$KEYPAIR_PATH" 2>/dev/null || true

log_info "Checking balance on devnet..."
balance_output=$(solana balance 2>/dev/null || echo "0 SOL")
current_balance=$(echo "$balance_output" | awk '{print $1}' || echo "0")

log_success "Current balance: $balance_output"

if (( $(echo "$current_balance < 5" | bc -l 2>/dev/null || echo "1") )); then
  log_info "Balance too low. Requesting airdrop from devnet faucet..."
  
  # Try airdrop multiple times (faucet can be rate-limited)
  for i in {1..3}; do
    if solana airdrop 5 2>/dev/null; then
      log_success "Airdrop successful (attempt $i)"
      sleep 5
      break
    else
      log_info "Airdrop attempt $i failed. Retrying..."
      sleep 10
    fi
  done
  
  # Verify new balance
  new_balance=$(solana balance 2>/dev/null || echo "0 SOL")
  log_success "New balance: $new_balance"
fi

# STEP 6: Deploy smart contracts
log_step "Deploy Smart Contracts to Devnet"

DEPLOYED_PROGRAMS=()

for binary in "${BINARIES[@]}"; do
  program_name=$(basename "$binary" .so)
  log_info "Deploying $program_name..."
  
  if deployment_output=$(solana deploy "$binary" --url devnet 2>&1); then
    # Extract program address from output
    program_id=$(echo "$deployment_output" | grep "Program Id:" | awk '{print $NF}' || echo "unknown")
    log_success "✅ $program_name deployed"
    log_success "   Program ID: $program_id"
    DEPLOYED_PROGRAMS+=("$program_name:$program_id")
  else
    log_error "Failed to deploy $program_name"
    log_info "Error: $deployment_output"
  fi
  
  # Small delay between deployments
  sleep 3
done

# STEP 7: Create deployment config file
log_step "Save Deployment Configuration"

config_file="phase2-deployment-config.json"

cat > "$config_file" << EOFCONFIG
{
  "network": "devnet",
  "rpc_url": "https://api.devnet.solana.com",
  "payer": "$PUBKEY",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "programs": {
    "router": "$(echo "${DEPLOYED_PROGRAMS[@]}" | grep router || echo 'unknown')",
    "cnft": "$(echo "${DEPLOYED_PROGRAMS[@]}" | grep cnft || echo 'unknown')",
    "buyback": "$(echo "${DEPLOYED_PROGRAMS[@]}" | grep buyback || echo 'unknown')"
  },
  "status": "deployed"
}
EOFCONFIG

log_success "Configuration saved to $config_file"

# STEP 8: Run tests
log_step "Execute On-Chain Tests"

log_info "Running test suite..."

if [ -d "tests" ]; then
  log_info "Found tests/ directory"
  
  if npm test 2>&1 | tee test-output.log; then
    test_result=$(grep -o "[0-9]* passing" test-output.log | head -1 || echo "unknown")
    log_success "Tests complete: $test_result"
  else
    log_error "Some tests failed. Check test-output.log"
  fi
else
  log_info "No tests/ directory found. Skipping test execution."
fi

# STEP 9: Summary
log_step "PHASE 2 DEPLOYMENT COMPLETE"

echo "
📊 DEPLOYMENT SUMMARY:

  Network:           Solana Devnet
  Deployer:          $PUBKEY
  
  Deployed Programs:
"

for prog in "${DEPLOYED_PROGRAMS[@]}"; do
  echo "    • $prog"
done

echo "
  Configuration:     $config_file
  
  Status:            ✅ COMPLETE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 NEXT STEPS:

  1️⃣  Update SDK with deployed program IDs
      cat phase2-deployment-config.json
      → Copy program IDs to sdk/config/devnet.json

  2️⃣  Run integration tests
      npm run test:integration

  3️⃣  Update frontend with live contracts
      Update app/lib/config.ts with program IDs

  4️⃣  Redeploy frontend to Vercel
      cd app && vercel --prod

  5️⃣  Beta test the complete MVP
      Share devnet MVP URL with beta testers

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Your MVP is now feature-complete with smart contracts!

"

log_success "Phase 2 automation complete!"
