// 02-compare-routes.ts
// Comparer différentes routes et choisir la meilleure

import { SwapBackClient, RouteSimulation } from '@swapback/sdk';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';

dotenv.config();

const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

async function compareRoutes() {
  console.log('🔍 SwapBack - Route Comparison Example\n');

  const connection = new Connection(
    process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    'confirmed'
  );

  const wallet = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(process.env.WALLET_PRIVATE_KEY!))
  );

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
    const amount = 1.0; // 1 SOL

    console.log(`📊 Comparing routes for ${amount} SOL → USDC\n`);

    // Simuler avec différents paramètres de slippage
    const routes = await Promise.all([
      client.simulateRoute(SOL_MINT, USDC_MINT, amount, 0.1),  // Conservative
      client.simulateRoute(SOL_MINT, USDC_MINT, amount, 0.5),  // Standard
      client.simulateRoute(SOL_MINT, USDC_MINT, amount, 1.0),  // Aggressive
    ]);

    // Afficher comparaison
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    ROUTE COMPARISON                        ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    
    routes.forEach((route, idx) => {
      const slippages = [0.1, 0.5, 1.0];
      console.log(`║ Route ${idx + 1} (Slippage: ${slippages[idx]}%)                            ║`);
      console.log(`║   Type: ${route.route.padEnd(46)} ║`);
      console.log(`║   Output: ${route.estimatedOutput.toFixed(2).padEnd(43)} USDC ║`);
      console.log(`║   Price Impact: ${(route.priceImpact.toFixed(3) + '%').padEnd(38)} ║`);
      console.log(`║   NPI: ${(route.npi.toFixed(2) + '%').padEnd(47)} ║`);
      console.log(`║   Rebate: ${(route.rebateAmount.toFixed(4) + ' $BACK').padEnd(40)} ║`);
      console.log(`║   Burn: ${(route.burnAmount.toFixed(4) + ' $BACK').padEnd(42)} ║`);
      console.log(`║   Fees: $${route.estimatedFeeUSD.toFixed(4).padEnd(44)} ║`);
      if (idx < routes.length - 1) {
        console.log('╟────────────────────────────────────────────────────────────╢');
      }
    });
    
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Trouver la meilleure route (par NPI)
    const bestRoute = routes.reduce((best, current) => 
      current.npi > best.npi ? current : best
    );

    const bestIndex = routes.indexOf(bestRoute);
    const slippages = [0.1, 0.5, 1.0];

    console.log(`🏆 Meilleure route: Route ${bestIndex + 1} (Slippage ${slippages[bestIndex]}%)`);
    console.log(`   NPI: ${bestRoute.npi.toFixed(2)}%`);
    console.log(`   Output: ${bestRoute.estimatedOutput.toFixed(2)} USDC`);
    console.log(`   Rebate: ${bestRoute.rebateAmount.toFixed(4)} $BACK\n`);

    // Calculer les différences
    const worstRoute = routes.reduce((worst, current) => 
      current.npi < worst.npi ? current : worst
    );

    const npiDiff = bestRoute.npi - worstRoute.npi;
    const outputDiff = bestRoute.estimatedOutput - worstRoute.estimatedOutput;
    const rebateDiff = bestRoute.rebateAmount - worstRoute.rebateAmount;

    console.log(`📈 Amélioration vs pire route:`);
    console.log(`   NPI: +${npiDiff.toFixed(2)}%`);
    console.log(`   Output: +${outputDiff.toFixed(2)} USDC`);
    console.log(`   Rebate: +${rebateDiff.toFixed(4)} $BACK\n`);

    // Option: Exécuter la meilleure route
    console.log('💡 To execute best route, uncomment the code below\n');
    
    /*
    const minOutput = bestRoute.estimatedOutput * 0.995;
    const result = await client.executeSwap(
      SOL_MINT,
      USDC_MINT,
      amount,
      minOutput,
      bestRoute
    );
    console.log(`✅ Swap executed: ${result.signature}`);
    */

  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

compareRoutes()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
