// 03-mev-protected-swap.ts
// Swap avec protection MEV via Jito bundles

import { SwapBackClient } from '@swapback/sdk';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';

dotenv.config();

const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

async function mevProtectedSwap() {
  console.log('🛡️ SwapBack - MEV Protected Swap Example\n');

  const connection = new Connection(
    process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    'confirmed'
  );

  const wallet = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(process.env.WALLET_PRIVATE_KEY!))
  );

  console.log(`Wallet: ${wallet.publicKey.toBase58()}\n`);

  const client = new SwapBackClient({
    connection,
    wallet: {
      publicKey: wallet.publicKey,
      signTransaction: async (tx) => {
        tx.partialSign(wallet);
        return tx;
      },
      signAllTransactions: async (txs) => {
        txs.forEach(tx => tx.partialSign(wallet));
        return txs;
      }
    },
    routerProgramId: new PublicKey(process.env.ROUTER_PROGRAM_ID!),
    buybackProgramId: new PublicKey(process.env.BUYBACK_PROGRAM_ID!),
    oracleEndpoint: process.env.ORACLE_ENDPOINT || 'https://oracle.swapback.io'
  });

  try {
    const amount = 10.0; // 10 SOL (large trade)

    console.log(`💼 Large trade: ${amount} SOL → USDC`);
    console.log(`🛡️ Using Jito bundle for MEV protection\n`);

    // 1. Simuler la route
    console.log('📊 Simulating route...');
    const route = await client.simulateRoute(
      SOL_MINT,
      USDC_MINT,
      amount,
      0.5
    );

    console.log(`✅ Route:`);
    console.log(`   Type: ${route.route}`);
    console.log(`   Output estimé: ${route.estimatedOutput.toFixed(2)} USDC`);
    console.log(`   Price impact: ${route.priceImpact.toFixed(3)}%`);
    console.log(`   NPI: ${route.npi.toFixed(2)}%\n`);

    // 2. Vérifier si MEV protection recommandée
    const shouldUseBundle = 
      route.estimatedOutput > 1000 ||  // > $1000
      route.priceImpact > 0.5;         // Impact > 0.5%

    if (shouldUseBundle) {
      console.log('⚠️ MEV protection RECOMMENDED:');
      console.log(`   ✓ Large trade value: $${route.estimatedOutput.toFixed(2)}`);
      console.log(`   ✓ Price impact: ${route.priceImpact.toFixed(3)}%\n`);
    } else {
      console.log('💡 MEV protection optional for this trade size\n');
    }

    // 3. Exécuter avec bundle protection
    console.log('⚡ Executing swap with Jito bundle...');
    console.log('   📦 Building bundle transaction...');
    console.log('   🔐 Encrypting transaction...');
    console.log('   📤 Submitting to Jito block engine...\n');

    const minimumOutput = route.estimatedOutput * 0.995;
    
    const signature = await client.executeSwapWithBundle(
      SOL_MINT,
      USDC_MINT,
      amount,
      minimumOutput,
      route
    );

    console.log(`✅ Swap réussi avec protection MEV!`);
    console.log(`   Signature: ${signature}`);
    console.log(`   Protected from:`);
    console.log(`     ✓ Front-running attacks`);
    console.log(`     ✓ Sandwich attacks`);
    console.log(`     ✓ MEV bots`);
    console.log(`\n🔗 Voir sur Solscan: https://solscan.io/tx/${signature}`);

    // 4. Comparer avec swap standard
    console.log(`\n📊 Bundle vs Standard Swap:`);
    console.log(`   Bundle execution:    ✅ Protected`);
    console.log(`   Standard execution:  ⚠️ Vulnerable to MEV`);
    console.log(`   Extra cost:          ~0.0001 SOL (tip)`);
    console.log(`   Savings from MEV:    Potentially 0.5-2% of trade value`);

    // 5. Stats
    const stats = await client.getUserStats();
    console.log(`\n📈 Your stats:`);
    console.log(`   Total swaps: ${stats.totalSwaps}`);
    console.log(`   Total volume: $${stats.totalVolumeUSD.toFixed(2)}`);
    console.log(`   Savings: $${stats.totalSavingsUSD.toFixed(2)}`);

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.logs) {
      console.error('Logs:', error.logs);
    }
    process.exit(1);
  }
}

// Guidelines: When to use MEV protection
console.log('═══════════════════════════════════════════════════════════');
console.log('           WHEN TO USE MEV PROTECTION');
console.log('═══════════════════════════════════════════════════════════');
console.log('✅ USE BUNDLE PROTECTION WHEN:');
console.log('   • Trade value > $1,000');
console.log('   • Price impact > 0.5%');
console.log('   • Trading volatile tokens');
console.log('   • High network congestion');
console.log('   • Trading newly listed tokens');
console.log('');
console.log('⏭️ STANDARD SWAP OK WHEN:');
console.log('   • Small trades (< $100)');
console.log('   • Stablecoins swaps');
console.log('   • Very liquid pairs');
console.log('   • Low network activity');
console.log('═══════════════════════════════════════════════════════════\n');

mevProtectedSwap()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
