// 05-claim-rebates.ts
// Claim accumulated $BACK rebates

import { SwapBackClient } from '@swapback/sdk';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function claimRebates() {
  console.log('💸 SwapBack - Claim Rebates Example\n');

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
    // 1. Vérifier solde rebates
    console.log('📊 Checking rebate balance...');
    const balance = await client.getRebateBalance();
    const amount = balance.toNumber() / 1e9; // Convert lamports to $BACK

    console.log(`💰 Available rebates: ${amount.toFixed(4)} $BACK\n`);

    if (amount === 0) {
      console.log('⚠️ No rebates to claim');
      console.log('💡 Make some swaps to earn rebates!\n');
      
      // Afficher stats pour contexte
      const stats = await client.getUserStats();
      console.log('📈 Your stats:');
      console.log(`   Total swaps: ${stats.totalSwaps}`);
      console.log(`   Total volume: $${stats.totalVolumeUSD.toFixed(2)}`);
      console.log(`   Total rebates earned: ${stats.totalRebatesEarned.toFixed(4)} $BACK`);
      console.log(`   (Already claimed: ${(stats.totalRebatesEarned - amount).toFixed(4)} $BACK)`);
      
      process.exit(0);
    }

    // 2. Afficher valeur en USD (estimée)
    const backPriceUSD = 0.50; // Prix estimé $BACK (à remplacer par prix réel)
    const valueUSD = amount * backPriceUSD;
    
    console.log(`💵 Estimated value: $${valueUSD.toFixed(2)} USD`);
    console.log(`   (at $BACK price: $${backPriceUSD})\n`);

    // 3. Vérifier s'il vaut la peine de claim
    const claimCostSOL = 0.000005; // ~0.000005 SOL transaction fee
    const solPriceUSD = 100; // Prix SOL estimé
    const claimCostUSD = claimCostSOL * solPriceUSD;

    console.log('💡 Claim Analysis:');
    console.log(`   Rebate value:  $${valueUSD.toFixed(4)}`);
    console.log(`   Claim cost:    $${claimCostUSD.toFixed(4)}`);
    console.log(`   Net profit:    $${(valueUSD - claimCostUSD).toFixed(4)}\n`);

    if (valueUSD < claimCostUSD * 2) {
      console.log('⚠️ WARNING: Rebate value is low compared to claim cost');
      console.log('💡 Consider waiting to accumulate more rebates\n');
    }

    // 4. Claim rebates
    console.log('💸 Claiming rebates...');
    console.log('   Please wait...\n');

    const claimTx = await client.claimRewards();

    console.log('✅ Rebates claimed successfully!');
    console.log(`   Transaction: ${claimTx}`);
    console.log(`   Amount: ${amount.toFixed(4)} $BACK`);
    console.log(`   Value: ~$${valueUSD.toFixed(2)} USD`);
    console.log(`\n🔗 View on Solscan: https://solscan.io/tx/${claimTx}`);

    // 5. Vérifier nouveau solde
    console.log('\n📊 Verifying new balance...');
    const newBalance = await client.getRebateBalance();
    const newAmount = newBalance.toNumber() / 1e9;

    console.log(`   Remaining rebates: ${newAmount.toFixed(4)} $BACK`);
    
    if (newAmount > 0.0001) {
      console.log('   (Some rebates may still be pending)');
    }

    // 6. Stats mises à jour
    const stats = await client.getUserStats();
    console.log('\n📈 Updated stats:');
    console.log(`   Total rebates earned: ${stats.totalRebatesEarned.toFixed(4)} $BACK`);
    console.log(`   Total swaps: ${stats.totalSwaps}`);
    console.log(`   Total volume: $${stats.totalVolumeUSD.toFixed(2)}`);
    console.log(`   Total savings: $${stats.totalSavingsUSD.toFixed(2)}`);
    console.log(`   Current boost: ${stats.rebateBoost}x\n`);

    // 7. Conseils
    console.log('💡 TIPS:');
    console.log('   • Rebates accrue from every swap');
    console.log('   • Claim frequency: weekly recommended for active traders');
    console.log('   • Lock $BACK to boost future rebates up to 10x');
    console.log('   • Higher volume = more rebates');
    console.log('   • All rebates are in $BACK tokens\n');

  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    if (error.logs) {
      console.error('Logs:', error.logs);
    }
    process.exit(1);
  }
}

claimRebates()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
