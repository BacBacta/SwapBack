#!/bin/bash

# Script de déploiement SwapBack sur devnet
set -e

export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

PROGRAM_KEYPAIR="target/deploy/swapback_cnft-keypair.json"
PROGRAM_BINARY="programs/swapback_cnft/target/sbf-solana-solana/release/swapback_cnft.so"
WALLET_KEYPAIR="devnet-keypair.json"
DEVNET_RPC="https://api.devnet.solana.com"

echo "🚀 SwapBack Deployment Script"
echo "════════════════════════════════════════"

# Vérifier les fichiers
echo "📋 Checking files..."
[ -f "$PROGRAM_KEYPAIR" ] || { echo "❌ Program keypair not found"; exit 1; }
[ -f "$WALLET_KEYPAIR" ] || { echo "❌ Wallet keypair not found"; exit 1; }
[ -f "$PROGRAM_BINARY" ] || { echo "❌ Program binary not found"; exit 1; }
echo "✅ All files present"

# Afficher les détails
echo ""
echo "📊 Deployment Details:"
PROGRAM_ID=$(solana-keygen pubkey "$PROGRAM_KEYPAIR")
WALLET_ADDRESS=$(solana-keygen pubkey "$WALLET_KEYPAIR")
echo "  Program ID: $PROGRAM_ID"
echo "  Wallet:     $WALLET_ADDRESS"
echo "  Binary:     $(ls -lh $PROGRAM_BINARY | awk '{print $5}')"

# Vérifier le solde
echo ""
echo "💰 Checking wallet balance..."
BALANCE=$(solana balance -k "$WALLET_KEYPAIR" --url "$DEVNET_RPC" 2>/dev/null || echo "0")
echo "  Balance: $BALANCE"

if [[ "$BALANCE" == "0 SOL" ]]; then
  echo "⚠️  Wallet has 0 SOL. Please request SOL from devnet faucet:"
  echo "   solana airdrop 2 -k $WALLET_KEYPAIR --url $DEVNET_RPC"
  exit 1
fi

# Déployer
echo ""
echo "📤 Deploying program to devnet..."
solana program deploy "$PROGRAM_BINARY" \
  --program-id "$PROGRAM_KEYPAIR" \
  --url "$DEVNET_RPC" \
  -k "$WALLET_KEYPAIR" \
  --max-sign-attempts 100

echo ""
echo "✅ Deployment successful!"
echo "════════════════════════════════════════"
echo "Program ID: $PROGRAM_ID"
echo "Network:   Devnet"
echo "RPC:       $DEVNET_RPC"
echo ""
echo "📝 Update your config with:"
echo "   VITE_PROGRAM_ID=$PROGRAM_ID"
