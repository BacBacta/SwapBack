// 06-dca-order.ts
// Dollar-Cost Averaging (DCA) automatisé

import { SwapBackClient, DCAOrderParams } from '@swapback/sdk';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';

dotenv.config();

const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

async function dcaExample() {
  console.log('📅 SwapBack - DCA Order Example\n');

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
    console.log('═══════════════════════════════════════════════════════════');
    console.log('           DCA (DOLLAR-COST AVERAGING)');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('💡 Concept:');
    console.log('   Investir un montant fixe à intervalles réguliers pour');
    console.log('   réduire l\'impact de la volatilité');
    console.log('');
    console.log('✅ Avantages:');
    console.log('   • Réduit le risque de timing');
    console.log('   • Lisse le prix d\'entrée moyen');
    console.log('   • Automatisé, pas d\'émotions');
    console.log('   • Idéal pour investisseurs long terme');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Exemple 1: DCA quotidien pendant un mois
    console.log('📊 Exemple 1: DCA Quotidien (USDC → SOL)');
    console.log('   Stratégie: Acheter SOL tous les jours avec 10 USDC');
    console.log('   Durée: 30 jours');
    console.log('   Investissement total: 300 USDC\n');

    const dailyDcaParams: DCAOrderParams = {
      inputMint: USDC_MINT,
      outputMint: SOL_MINT,
      amountPerSwap: 10,        // 10 USDC par swap
      intervalSeconds: 86400,    // 24 heures
      totalSwaps: 30,            // 30 jours
      minOutPerSwap: 0.05        // Minimum 0.05 SOL par swap
    };

    console.log('💡 To create this DCA order, uncomment below:\n');
    
    /*
    console.log('📝 Creating DCA order...');
    const dailyOrderPda = await client.createDCAOrder(dailyDcaParams);
    
    console.log('✅ DCA order created!');
    console.log(`   Order PDA: ${dailyOrderPda.toBase58()}`);
    console.log(`   Schedule: Every 24 hours`);
    console.log(`   Start: ${new Date().toLocaleString()}`);
    console.log(`   End: ${new Date(Date.now() + 30 * 86400000).toLocaleString()}`);
    */

    // Exemple 2: DCA hebdomadaire pendant 3 mois
    console.log('\n📊 Exemple 2: DCA Hebdomadaire (USDC → SOL)');
    console.log('   Stratégie: Acheter SOL chaque semaine avec 50 USDC');
    console.log('   Durée: 12 semaines (3 mois)');
    console.log('   Investissement total: 600 USDC\n');

    const weeklyDcaParams: DCAOrderParams = {
      inputMint: USDC_MINT,
      outputMint: SOL_MINT,
      amountPerSwap: 50,         // 50 USDC par swap
      intervalSeconds: 604800,   // 7 jours
      totalSwaps: 12,            // 12 semaines
      minOutPerSwap: 0.2         // Minimum 0.2 SOL par swap
    };

    console.log('💡 Weekly strategy is good for longer-term investors\n');

    // Exemple 3: DCA toutes les heures (day trading)
    console.log('📊 Exemple 3: DCA Horaire (USDC → SOL)');
    console.log('   Stratégie: Acheter SOL toutes les heures avec 5 USDC');
    console.log('   Durée: 24 heures');
    console.log('   Investissement total: 120 USDC\n');

    const hourlyDcaParams: DCAOrderParams = {
      inputMint: USDC_MINT,
      outputMint: SOL_MINT,
      amountPerSwap: 5,          // 5 USDC par swap
      intervalSeconds: 3600,     // 1 heure
      totalSwaps: 24,            // 24 heures
      minOutPerSwap: 0.025       // Minimum 0.025 SOL par swap
    };

    console.log('⚠️ Hourly strategy has higher risk but can catch dips\n');

    // Afficher tous les ordres DCA existants
    console.log('📋 Checking existing DCA orders...');
    const existingOrders = await client.getDCAOrders();

    if (existingOrders.length === 0) {
      console.log('   No active DCA orders found\n');
    } else {
      console.log(`   Found ${existingOrders.length} active orders:\n`);

      for (let i = 0; i < existingOrders.length; i++) {
        const order = existingOrders[i];
        const progress = (order.executedSwaps / order.totalSwaps) * 100;

        console.log(`   Order ${i + 1}:`);
        console.log(`     PDA: ${order.planPda.toBase58()}`);
        console.log(`     Token In: ${order.tokenIn.toBase58()}`);
        console.log(`     Token Out: ${order.tokenOut.toBase58()}`);
        console.log(`     Progress: ${order.executedSwaps}/${order.totalSwaps} (${progress.toFixed(1)}%)`);
        console.log(`     Amount per swap: ${order.amountPerSwap}`);
        console.log(`     Interval: ${order.intervalSeconds}s (${order.intervalSeconds / 3600}h)`);
        console.log(`     Next execution: ${order.nextExecution.toLocaleString()}`);
        console.log(`     Active: ${order.isActive ? '✅' : '❌'}`);
        console.log(`     Invested: ${order.totalInvested}`);
        console.log(`     Received: ${order.totalReceived}`);
        
        if (order.totalInvested > 0) {
          const avgPrice = order.totalInvested / order.totalReceived;
          console.log(`     Average price: ${avgPrice.toFixed(4)}`);
        }
        
        console.log('');
      }
    }

    // Calculer ROI théorique du DCA
    console.log('💰 DCA vs Lump Sum Comparison:');
    console.log('');
    console.log('   Scenario: Invest 300 USDC in SOL');
    console.log('');
    console.log('   Strategy 1: LUMP SUM (buy all at once)');
    console.log('     Risk: HIGH - All at current price');
    console.log('     If price goes down: Maximum loss');
    console.log('     If price goes up: Maximum gain');
    console.log('');
    console.log('   Strategy 2: DCA (30 days, 10 USDC/day)');
    console.log('     Risk: MEDIUM - Averaged over 30 days');
    console.log('     If price goes down: Lower average price');
    console.log('     If price goes up: Higher average price');
    console.log('     If price volatile: Smoothed entry');
    console.log('');
    console.log('   🎯 DCA is typically better in volatile markets\n');

    // Tips
    console.log('💡 DCA BEST PRACTICES:');
    console.log('   ✅ Set realistic minOutPerSwap to avoid bad prices');
    console.log('   ✅ Choose intervals based on your investment horizon');
    console.log('   ✅ Monitor your orders regularly');
    console.log('   ✅ Cancel if market conditions change drastically');
    console.log('   ✅ DCA works best for long-term holdings');
    console.log('   ⚠️ Not suitable for very short-term trading');
    console.log('   ⚠️ Fees can add up with very frequent swaps\n');

    // Gestion des ordres
    console.log('🔧 MANAGING DCA ORDERS:\n');
    console.log('   View orders:');
    console.log('   const orders = await client.getDCAOrders();');
    console.log('');
    console.log('   Cancel order:');
    console.log('   const signature = await client.cancelDCAOrder(orderPda);');
    console.log('');
    console.log('   Monitor progress:');
    console.log('   Check order.executedSwaps / order.totalSwaps');
    console.log('');

    // Tableau comparatif des stratégies
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║              DCA STRATEGY COMPARISON                         ║');
    console.log('╠═══════════╦══════════╦═══════════╦══════════╦═══════════════╣');
    console.log('║  Strategy ║ Interval ║   Swaps   ║  Amount  ║  Best For     ║');
    console.log('╠═══════════╬══════════╬═══════════╬══════════╬═══════════════╣');
    console.log('║  Hourly   ║   1h     ║    24     ║  5 USDC  ║  Day traders  ║');
    console.log('║  Daily    ║   24h    ║    30     ║  10 USDC ║  Active inv.  ║');
    console.log('║  Weekly   ║   7d     ║    12     ║  50 USDC ║  Long-term    ║');
    console.log('║  Monthly  ║   30d    ║    12     ║ 100 USDC ║  Hodlers      ║');
    console.log('╚═══════════╩══════════╩═══════════╩══════════╩═══════════════╝\n');

  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

dcaExample()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
