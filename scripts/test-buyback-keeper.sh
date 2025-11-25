#!/bin/bash
# Test Buyback Keeper - Dry Run

set -e

echo "🧪 Testing Buyback Keeper (Dry Run)"
echo "===================================="
echo ""

cd /workspaces/SwapBack/oracle

echo "📦 Installing dependencies..."
npm install axios @solana/spl-token --save 2>&1 | grep -E "(added|up to date)" || true

echo ""
echo "🔍 Checking USDC Vault Balance..."
node -e "
const { Connection, PublicKey } = require('@solana/web3.js');

(async () => {
  const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
  const BUYBACK_PROGRAM_ID = new PublicKey('F8S1r81FcTsSBb9vP3jFNuVoTMYNrxaCptbvkzSXcEce');
  
  const [vaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('usdc_vault')],
    BUYBACK_PROGRAM_ID
  );
  
  console.log('   Vault PDA:', vaultPDA.toString());
  
  try {
    const info = await conn.getTokenAccountBalance(vaultPDA);
    console.log('   Balance:', info.value.uiAmount, 'USDC');
    console.log('   Lamports:', info.value.amount);
    
    const threshold = 100;
    if (parseFloat(info.value.uiAmount || '0') >= threshold) {
      console.log('   ✅ Balance ≥ threshold (' + threshold + ' USDC)');
      console.log('   🚀 Buyback would be triggered!');
    } else {
      console.log('   ⏳ Balance < threshold (' + threshold + ' USDC)');
      console.log('   Waiting for more USDC...');
    }
  } catch (e) {
    console.log('   ❌ Vault not found or error:', e.message);
    console.log('   Need to initialize buyback state with new Program ID');
  }
})();
"

echo ""
echo "🧪 Testing Jupiter API Quote..."
node -e "
const axios = require('axios');

(async () => {
  try {
    const USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; // Devnet
    const BACK_MINT = '862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux';
    const amount = 100 * 1e6; // 100 USDC
    
    console.log('   Input: 100 USDC');
    console.log('   Output: BACK token');
    console.log('   Fetching quote...');
    
    const response = await axios.get('https://quote-api.jup.ag/v6/quote', {
      params: {
        inputMint: USDC_MINT,
        outputMint: BACK_MINT,
        amount: amount.toString(),
        slippageBps: 200,
      },
      timeout: 10000,
    });
    
    if (response.data) {
      const quote = response.data;
      console.log('   ✅ Quote received:');
      console.log('      In:', (quote.inAmount / 1e6).toFixed(2), 'USDC');
      console.log('      Out:', (quote.outAmount / 1e9).toFixed(2), 'BACK');
      console.log('      Price Impact:', quote.priceImpactPct + '%');
      console.log('      Route:', quote.routePlan?.map(r => r.swapInfo?.label).join(' → ') || 'N/A');
    }
  } catch (e) {
    console.log('   ❌ Failed:', e.message);
    if (e.response?.data) {
      console.log('   Error data:', JSON.stringify(e.response.data, null, 2));
    }
  }
})();
"

echo ""
echo "📝 Next Steps:"
echo "   1. Initialize new buyback state with Program ID: F8S1r81FcTsSBb9vP3jFNuVoTMYNrxaCptbvkzSXcEce"
echo "   2. Fund vault with test USDC (via swap)"
echo "   3. Run keeper: ts-node oracle/src/buyback-keeper.ts"
echo "   4. Monitor logs for automatic buyback execution"
echo ""
echo "💡 To run keeper in production:"
echo "   pm2 start oracle/src/buyback-keeper.ts --name buyback-keeper"
echo "   pm2 logs buyback-keeper"
echo ""
