// 04-lock-and-boost.ts
// Lock $BACK tokens pour booster les rebates

import { SwapBackClient } from '@swapback/sdk';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function lockAndBoost() {
  console.log('🔒 SwapBack - Lock & Boost Example\n');

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
    // 1. Vérifier stats actuelles
    console.log('📊 Current stats:');
    const stats = await client.getUserStats();
    
    console.log(`   $BACK locked: ${stats.backTokensLocked}`);
    console.log(`   Current boost: ${stats.rebateBoost}x`);
    console.log(`   Lock expiry: ${stats.lockExpiryDate || 'None'}`);
    console.log(`   Total rebates earned: ${stats.totalRebatesEarned} $BACK\n`);

    // 2. Afficher tableau des boosts
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    BOOST TIERS                             ║');
    console.log('╠═════════════╦═══════════╦═══════════════════════════════════╣');
    console.log('║  Duration   ║   Boost   ║  Early Unlock Penalty             ║');
    console.log('╠═════════════╬═══════════╬═══════════════════════════════════╣');
    console.log('║   7 days    ║   1.2x    ║         50%                       ║');
    console.log('║  30 days    ║   2x      ║         40%                       ║');
    console.log('║  90 days    ║   4x      ║         30%                       ║');
    console.log('║ 180 days    ║   7x      ║         20%                       ║');
    console.log('║ 365 days    ║   10x     ║         10%                       ║');
    console.log('╚═════════════╩═══════════╩═══════════════════════════════════╝\n');

    // 3. Calculer ROI optimal
    const monthlyVolume = 10000; // $10k/mois estimé
    const baseRebate = monthlyVolume * 0.0099; // 0.99% base
    
    console.log('💰 Rebate Projections (monthly):');
    console.log(`   Base (1x):     ${baseRebate.toFixed(2)} $BACK`);
    console.log(`   With 2x:       ${(baseRebate * 2).toFixed(2)} $BACK (+${baseRebate.toFixed(2)})`);
    console.log(`   With 4x:       ${(baseRebate * 4).toFixed(2)} $BACK (+${(baseRebate * 3).toFixed(2)})`);
    console.log(`   With 7x:       ${(baseRebate * 7).toFixed(2)} $BACK (+${(baseRebate * 6).toFixed(2)})`);
    console.log(`   With 10x:      ${(baseRebate * 10).toFixed(2)} $BACK (+${(baseRebate * 9).toFixed(2)})\n`);

    // 4. Exemple de lock
    if (stats.backTokensLocked === 0) {
      console.log('🔓 No $BACK currently locked\n');
      console.log('💡 Example: Lock 1000 $BACK for 90 days (4x boost)\n');

      // Décommentez pour exécuter:
      /*
      const lockAmount = 1000;
      const lockDays = 90;
      
      console.log(`🔒 Locking ${lockAmount} $BACK for ${lockDays} days...`);
      const lockTx = await client.lockTokens(lockAmount, lockDays);
      
      console.log(`✅ Lock successful: ${lockTx}`);
      console.log(`   Amount: ${lockAmount} $BACK`);
      console.log(`   Duration: ${lockDays} days`);
      console.log(`   Boost: 4x`);
      console.log(`   Expiry: ${new Date(Date.now() + lockDays * 86400000).toLocaleDateString()}`);
      
      // Vérifier nouvelles stats
      const newStats = await client.getUserStats();
      console.log(`\n📊 New boost: ${newStats.rebateBoost}x`);
      */
      
      console.log('⚠️ Uncomment code above to execute lock\n');
      
    } else {
      console.log('🔒 You have $BACK locked!');
      console.log(`   Amount: ${stats.backTokensLocked}`);
      console.log(`   Boost: ${stats.rebateBoost}x`);
      console.log(`   Expiry: ${stats.lockExpiryDate}\n`);

      // Vérifier si lock expiré
      const now = new Date();
      const expiry = new Date(stats.lockExpiryDate!);
      
      if (now > expiry) {
        console.log('✅ Lock expired - you can unlock without penalty!');
        console.log('💡 Example: Unlock tokens\n');
        
        // Décommentez pour unlocklock:
        /*
        console.log('🔓 Unlocking tokens...');
        const unlockTx = await client.unlockTokens();
        console.log(`✅ Unlock successful: ${unlockTx}`);
        console.log(`   Recovered: ${stats.backTokensLocked} $BACK`);
        console.log(`   Penalty: 0 $BACK (lock expired)`);
        */
        
      } else {
        const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
        console.log(`⏰ ${daysRemaining} days remaining`);
        console.log('⚠️ Early unlock will incur penalty!');
        
        // Calculer pénalité
        let penaltyPercent = 10; // Défaut 365j
        if (stats.rebateBoost === 1.2) penaltyPercent = 50;
        else if (stats.rebateBoost === 2) penaltyPercent = 40;
        else if (stats.rebateBoost === 4) penaltyPercent = 30;
        else if (stats.rebateBoost === 7) penaltyPercent = 20;
        
        const penaltyAmount = stats.backTokensLocked * (penaltyPercent / 100);
        const recoveredAmount = stats.backTokensLocked - penaltyAmount;
        
        console.log(`   Penalty: ${penaltyPercent}% (${penaltyAmount.toFixed(2)} $BACK)`);
        console.log(`   Would recover: ${recoveredAmount.toFixed(2)} $BACK\n`);
      }
    }

    // 5. Conseils
    console.log('💡 TIPS:');
    console.log('   • Lock only what you can afford to lock');
    console.log('   • Longer locks = higher boosts');
    console.log('   • Calculate ROI based on your monthly volume');
    console.log('   • For $10k/month volume, 4x boost = extra $297/month');
    console.log('   • Penalties go to buyback/burn (benefits all holders)');
    console.log('   • You can re-lock after unlock to upgrade duration\n');

  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

lockAndBoost()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
