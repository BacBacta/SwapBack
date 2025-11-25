// 01-simple-swap.ts
// Exemple basique : Swap SOL → USDC

import { SwapBackClient } from '@swapback/sdk';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';

dotenv.config();

// Mints communs
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

async function simpleSwap() {
  console.log('🔄 SwapBack - Simple Swap Example\n');

  // 1. Setup connexion
  const connection = new Connection(
    process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    'confirmed'
  );

  // 2. Setup wallet (remplacer par votre clé privée)
  const wallet = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(process.env.WALLET_PRIVATE_KEY!))
  );

  console.log(`Wallet: ${wallet.publicKey.toBase58()}\n`);

  // 3. Initialiser client SDK
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
    routerProgramId: new PublicKey(
      process.env.ROUTER_PROGRAM_ID || 'SwapRouter11111111111111111111111111111111'
    ),
    buybackProgramId: new PublicKey(
      process.env.BUYBACK_PROGRAM_ID || 'BuybackBurn111111111111111111111111111111'
    ),
    oracleEndpoint: process.env.ORACLE_ENDPOINT || 'https://oracle.swapback.io'
  });

  try {
    // 4. Simuler le swap
    console.log('📊 Simulating route...');
    const route = await client.simulateRoute(
      SOL_MINT,
      USDC_MINT,
      0.1,    // 0.1 SOL
      0.5     // 0.5% slippage
    );

    console.log(`✅ Route trouvée:`);
    console.log(`   Type: ${route.route}`);
    console.log(`   Input: ${route.inputAmount} SOL`);
    console.log(`   Output estimé: ${route.estimatedOutput.toFixed(2)} USDC`);
    console.log(`   Price impact: ${route.priceImpact.toFixed(3)}%`);
    console.log(`   NPI: ${route.npi.toFixed(2)}%`);
    console.log(`   Rebate: ${route.rebateAmount.toFixed(4)} $BACK`);
    console.log(`   Burn: ${route.burnAmount.toFixed(4)} $BACK`);
    console.log(`   Frais: $${route.estimatedFeeUSD.toFixed(4)}\n`);

    // 5. Confirmation utilisateur
    console.log('💡 Press Ctrl+C to cancel, or wait 5s to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 6. Exécuter le swap
    console.log('⚡ Executing swap...');
    const minimumOutput = route.estimatedOutput * 0.995; // 0.5% slippage

    const result = await client.executeSwap(
      SOL_MINT,
      USDC_MINT,
      0.1,
      minimumOutput,
      route
    );

    console.log(`\n✅ Swap réussi!`);
    console.log(`   Signature: ${result.signature}`);
    console.log(`   Output reçu: ${result.actualOutput.toFixed(2)} USDC`);
    console.log(`   NPI réalisé: ${result.npiRealized.toFixed(2)}%`);
    console.log(`   Rebate gagné: ${result.rebateEarned.toFixed(4)} $BACK`);
    console.log(`   $BACK brûlé: ${result.burnAmount.toFixed(4)}`);
    console.log(`\n🔗 Voir sur Solscan: https://solscan.io/tx/${result.signature}`);

    // 7. Afficher stats après swap
    const stats = await client.getUserStats();
    console.log(`\n📊 Vos stats:`);
    console.log(`   Total swaps: ${stats.totalSwaps}`);
    console.log(`   Volume: $${stats.totalVolumeUSD.toFixed(2)}`);
    console.log(`   Rebates gagnés: ${stats.totalRebatesEarned.toFixed(2)} $BACK`);
    console.log(`   Savings: $${stats.totalSavingsUSD.toFixed(2)}`);

  } catch (error: any) {
    console.error(`\n❌ Erreur: ${error.message}`);
    if (error.logs) {
      console.error('Logs:', error.logs);
    }
    process.exit(1);
  }
}

// Exécuter
simpleSwap()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
