#!/bin/bash

# Start DCA Keeper Service
# Usage: ./scripts/start-dca-keeper.sh [dry-run]

set -e

cd "$(dirname "$0")/.."

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           🤖 DCA KEEPER - PHASE 3                           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check if oracle dependencies are installed
if [ ! -d "oracle/node_modules" ]; then
  echo "📦 Installing oracle dependencies..."
  cd oracle
  npm install
  cd ..
fi

# Check for keeper keypair
KEYPAIR_PATH="${KEEPER_KEYPAIR_PATH:-$HOME/.config/solana/id.json}"
if [ ! -f "$KEYPAIR_PATH" ]; then
  echo "❌ Keeper keypair not found at: $KEYPAIR_PATH"
  echo ""
  echo "Options:"
  echo "  1. Create a new keypair: solana-keygen new -o $KEYPAIR_PATH"
  echo "  2. Set KEEPER_KEYPAIR_PATH env var to existing keypair"
  exit 1
fi

WALLET=$(solana address -k "$KEYPAIR_PATH")
echo "🤖 Keeper wallet: $WALLET"

# Check balance
BALANCE=$(solana balance "$WALLET" 2>/dev/null || echo "0")
echo "💰 Balance: $BALANCE"

if [[ "$BALANCE" == "0"* ]]; then
  echo ""
  echo "⚠️  Warning: Low balance!"
  echo "   Request airdrop: solana airdrop 2 -k $KEYPAIR_PATH"
  echo ""
fi

# Set environment variables
export SOLANA_RPC_URL="${SOLANA_RPC_URL:-https://api.devnet.solana.com}"
export KEEPER_KEYPAIR_PATH="$KEYPAIR_PATH"

# Check for dry-run mode
if [ "$1" == "dry-run" ] || [ "$1" == "--dry-run" ]; then
  echo "🧪 Running in DRY RUN mode (no actual transactions)"
  export DRY_RUN=true
else
  echo "🚀 Running in PRODUCTION mode (will execute transactions)"
  export DRY_RUN=false
fi

echo ""
echo "Configuration:"
echo "  RPC: $SOLANA_RPC_URL"
echo "  Keypair: $KEYPAIR_PATH"
echo "  Dry Run: $DRY_RUN"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⏰ Keeper will check for ready DCA plans every 60 seconds"
echo "🛑 Press Ctrl+C to stop"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start the keeper
cd oracle
npm run keeper
