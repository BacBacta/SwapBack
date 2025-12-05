#!/bin/bash
# Testnet Transition Checklist & Commands
# Run these commands when moving to testnet environment

set -e

echo "🚀 SwapBack Testnet Transition Guide"
echo "====================================="
echo ""

# Configuration
TESTNET_RPC="https://api.testnet.solana.com"
BUYBACK_PROGRAM_ID="4cyYvpjwERF67UDpd5euYzZ6xZ5tcDL6XrByBaZbVVjK"

echo "📋 Pre-flight Checklist:"
echo ""
echo "  [ ] Local environment (not Codespaces)"
echo "  [ ] Solana CLI configured for testnet"
echo "  [ ] Wallet with testnet SOL (use faucet)"
echo "  [ ] Node.js v18+ installed"
echo "  [ ] Access to Jupiter API (test with curl)"
echo ""
echo "Press ENTER to continue or Ctrl+C to abort..."
read

# 1. Verify Jupiter API access
echo ""
echo "🔍 Step 1: Verify Jupiter API Access"
echo "-------------------------------------"
if curl -s -f -m 5 "https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000&slippageBps=50" > /dev/null; then
  echo "✅ Jupiter API accessible"
else
  echo "❌ Jupiter API not accessible"
  echo "   Cannot proceed with integration tests"
  exit 1
fi

# 2. Get testnet tokens
echo ""
echo "💰 Step 2: Get Testnet Tokens"
echo "------------------------------"
WALLET=$(solana address --url $TESTNET_RPC)
echo "   Wallet: $WALLET"
echo ""
echo "   Get SOL:"
echo "   → https://faucet.solana.com"
echo "   → Request 2 SOL to: $WALLET"
echo ""
echo "   Get USDC (mock):"
echo "   → https://spl-token-faucet.com"
echo "   → Mint: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
echo "   → Request 1000 USDC to: $WALLET"
echo ""
echo "Press ENTER after getting tokens..."
read

# 3. Verify balances
echo ""
echo "📊 Step 3: Verify Balances"
echo "--------------------------"
SOL_BALANCE=$(solana balance --url $TESTNET_RPC | awk '{print $1}')
echo "   SOL: $SOL_BALANCE"

if command -v spl-token &> /dev/null; then
  USDC_BALANCE=$(spl-token balance 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --url $TESTNET_RPC 2>/dev/null || echo "0")
  echo "   USDC: $USDC_BALANCE"
  
  BACK_BALANCE=$(spl-token balance 862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux --url $TESTNET_RPC 2>/dev/null || echo "0")
  echo "   BACK: $BACK_BALANCE"
fi

# 4. Deploy/verify programs
echo ""
echo "🔧 Step 4: Programs Status (Testnet)"
echo "------------------------------------"
echo "   Note: Programs need to be deployed to testnet if not already"
echo "   Current devnet IDs:"
echo "   - Router:  9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh"
echo "   - Buyback: 4cyYvpjwERF67UDpd5euYzZ6xZ5tcDL6XrByBaZbVVjK"
echo "   - cNFT:    EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP"
echo ""
echo "   If testnet deployment needed:"
echo "   $ anchor build"
echo "   $ solana program deploy --url $TESTNET_RPC target/deploy/swapback_buyback.so"
echo ""

# 5. Initialize buyback state
echo "🎯 Step 5: Initialize Buyback State (if needed)"
echo "------------------------------------------------"
echo "   Run: ANCHOR_PROVIDER_URL=$TESTNET_RPC node scripts/init-buyback-state.js"
echo ""

# 6. Fund vault
echo "💵 Step 6: Fund USDC Vault"
echo "--------------------------"
echo "   Run: ANCHOR_PROVIDER_URL=$TESTNET_RPC node scripts/deposit-usdc-to-buyback.js"
echo ""

# 7. Test keeper
echo "🤖 Step 7: Test Buyback Keeper"
echo "-------------------------------"
echo "   Dry run:"
echo "   $ cd oracle && NEXT_PUBLIC_SOLANA_RPC_URL=$TESTNET_RPC npx ts-node src/buyback-keeper.ts"
echo ""
echo "   Expected output:"
echo "   ✅ Vault balance checked"
echo "   ✅ Jupiter quote received"
echo "   ✅ Swap executed (if threshold met)"
echo "   ✅ finalize_buyback() called"
echo ""

# 8. Verify results
echo "✅ Step 8: Verify Integration"
echo "------------------------------"
echo "   Check vault balance:"
echo "   $ node scripts/test-buyback-deposit.js"
echo ""
echo "   Check on-chain state:"
echo "   $ anchor account buyback_state <PDA_ADDRESS> --provider.cluster testnet"
echo ""

echo ""
echo "🎉 Testnet transition guide complete!"
echo ""
echo "📝 Quick Command Reference:"
echo "  Faucets:  https://faucet.solana.com + https://spl-token-faucet.com"
echo "  Deploy:   anchor deploy --provider.cluster testnet"
echo "  Init:     ANCHOR_PROVIDER_URL=testnet node scripts/init-buyback-state.js"
echo "  Deposit:  ANCHOR_PROVIDER_URL=testnet node scripts/deposit-usdc-to-buyback.js"
echo "  Keeper:   cd oracle && npx ts-node src/buyback-keeper.ts"
echo "  Verify:   node scripts/test-buyback-deposit.js"
echo ""
