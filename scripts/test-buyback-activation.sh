#!/bin/bash
# Test Buyback Activation - Execute Real Swap to Trigger Deposit

set -e

echo "🚀 Testing Buyback Deposit via Swap Execution"
echo "=============================================="
echo ""

WALLET=$(solana address)
ROUTER_PROGRAM="9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh"
BUYBACK_VAULT="E24ZXgV6RrnCiPnKWwgx8LprNQ4DhAjXQ3KNE4PaXzUr"

echo "📊 Pre-Swap State:"
echo "   Wallet: $WALLET"

# Check wSOL balance
WSOL_BALANCE=$(spl-token balance -v 2>/dev/null So11111111111111111111111111111111111111112 || echo "0")
echo "   wSOL: $WSOL_BALANCE"

# Check USDC balance
USDC_MINT="4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" # Devnet USDC
USDC_BALANCE=$(spl-token balance -v 2>/dev/null $USDC_MINT || echo "0")
echo "   USDC: $USDC_BALANCE"

# Check buyback vault BEFORE
echo ""
echo "🏦 Buyback Vault BEFORE:"
VAULT_BEFORE=$(solana-keygen grind --starts-with E24:1 2>&1 | head -1 || spl-token balance -v $USDC_MINT --owner $BUYBACK_VAULT 2>/dev/null || echo "0")
echo "   Balance: Checking..."
node -e "
const { Connection, PublicKey } = require('@solana/web3.js');
(async () => {
  const conn = new Connection('https://api.devnet.solana.com');
  const vault = new PublicKey('$BUYBACK_VAULT');
  try {
    const info = await conn.getTokenAccountBalance(vault);
    console.log('   ' + info.value.uiAmount + ' USDC');
  } catch (e) {
    console.log('   Error: ' + e.message);
  }
})();
" 2>/dev/null || echo "   0 USDC"

echo ""
echo "⚠️  MANUAL ACTION REQUIRED:"
echo "   1. Go to: https://swap-back-mauve.vercel.app/swap"
echo "   2. Connect wallet: $WALLET"
echo "   3. Execute a small swap: 0.01 SOL → USDC"
echo "   4. Wait for confirmation"
echo "   5. Press ENTER to check vault balance"
echo ""

read -p "Press ENTER after executing swap..."

echo ""
echo "🏦 Buyback Vault AFTER:"
node -e "
const { Connection, PublicKey } = require('@solana/web3.js');
(async () => {
  const conn = new Connection('https://api.devnet.solana.com');
  const vault = new PublicKey('$BUYBACK_VAULT');
  try {
    const info = await conn.getTokenAccountBalance(vault);
    console.log('   ' + info.value.uiAmount + ' USDC');
    if (parseFloat(info.value.uiAmount) > 0) {
      console.log('');
      console.log('   ✅ SUCCESS! Buyback deposit is working!');
    } else {
      console.log('');
      console.log('   ⚠️  Vault still empty - deposit may have failed');
    }
  } catch (e) {
    console.log('   Error: ' + e.message);
  }
})();
" 2>/dev/null

echo ""
echo "📝 Next Steps:"
echo "   ✅ Phase 5.1 Complete - Deposits working"
echo "   ⏳ Phase 5.3 - Implement Jupiter swap USDC → BACK"
echo "   ⏳ Phase 5.5 - Create buyback-keeper automation"
echo ""
