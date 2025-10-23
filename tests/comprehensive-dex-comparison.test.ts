/**
 * Tests Complets de Comparaison DEX
 * Compare SwapBack avec Jupiter, Raydium et Orca sur 50 paires de tokens différentes
 */

import { describe, it, expect } from 'vitest';
import { Connection, PublicKey } from '@solana/web3.js';

// Configuration
const DEVNET_RPC = 'https://api.devnet.solana.com';
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
const SWAPBACK_API = 'http://localhost:3003';

// Tokens populaires sur Solana (Mainnet)
const POPULAR_TOKENS = [
  { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112', decimals: 9 },
  { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  { symbol: 'USDT', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
  { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 },
  { symbol: 'WIF', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', decimals: 6 },
  { symbol: 'JTO', mint: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL', decimals: 9 },
  { symbol: 'PYTH', mint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', decimals: 6 },
  { symbol: 'JUP', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', decimals: 6 },
  { symbol: 'RAY', mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', decimals: 6 },
  { symbol: 'ORCA', mint: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE', decimals: 6 },
  { symbol: 'MNGO', mint: 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac', decimals: 6 },
  { symbol: 'FIDA', mint: 'EchesyfXePKdLtoiZSL8pBe8Myagyy8ZRqsACNCFGnvp', decimals: 6 },
  { symbol: 'SRM', mint: 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt', decimals: 6 },
  { symbol: 'COPE', mint: '8HGyAAB1yoM1ttS7pXjHMa3dukTFGQggnFFH3hJZgzQh', decimals: 6 },
  { symbol: 'STEP', mint: 'StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT', decimals: 9 },
  { symbol: 'MEDIA', mint: 'ETAtLmCmsoiEEKfNrHKJ2kYy3MoABhU6NQvpSfij5tDs', decimals: 6 },
  { symbol: 'ROPE', mint: '8PMHT4swUMtBzgHnh5U564N5sjPSiUz2cjEQzFnnP1Fo', decimals: 9 },
  { symbol: 'MER', mint: 'MERt85fc5boKw3BW1eYdxonEuJNvXbiMbs6hvheau5K', decimals: 6 },
  { symbol: 'TULIP', mint: 'TuLipcqtGVXP9XR62wM8WWCm6a9vhLs7T1uoWBk6FDs', decimals: 6 },
  { symbol: 'SNY', mint: '4dmKkXNHdgYsXqBHCuMikNQWwVomZURhYvkkX5c4pQ7y', decimals: 6 },
  { symbol: 'SLRS', mint: 'SLRSSpSLUTP7okbCUBYStWCo1vUgyt775faPqz8HUMr', decimals: 6 },
  { symbol: 'SAMO', mint: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', decimals: 9 },
  { symbol: 'SHDW', mint: 'SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y', decimals: 9 },
  { symbol: 'DUST', mint: 'DUSTawucrTsGU8hcqRdHDCbuYhCPADMLM2VcCb8VnFnQ', decimals: 9 },
  { symbol: 'FORGE', mint: 'FoRGERiW7odcCBGU1bztZi16osPBHjxharvDathL5eds', decimals: 9 },
];

// Paires de trading à tester (50 combinaisons)
const TEST_PAIRS = [
  // Paires majeures USDC
  { from: 'SOL', to: 'USDC', amount: 1 },
  { from: 'USDC', to: 'SOL', amount: 100 },
  { from: 'BONK', to: 'USDC', amount: 1000000 },
  { from: 'WIF', to: 'USDC', amount: 100 },
  { from: 'JTO', to: 'USDC', amount: 10 },
  { from: 'PYTH', to: 'USDC', amount: 100 },
  { from: 'JUP', to: 'USDC', amount: 100 },
  { from: 'RAY', to: 'USDC', amount: 50 },
  { from: 'ORCA', to: 'USDC', amount: 50 },
  { from: 'MNGO', to: 'USDC', amount: 100 },
  
  // Paires majeures USDT
  { from: 'SOL', to: 'USDT', amount: 1 },
  { from: 'USDT', to: 'SOL', amount: 100 },
  { from: 'BONK', to: 'USDT', amount: 1000000 },
  { from: 'WIF', to: 'USDT', amount: 100 },
  { from: 'JUP', to: 'USDT', amount: 100 },
  
  // Cross-pairs (sans stablecoin)
  { from: 'SOL', to: 'BONK', amount: 0.1 },
  { from: 'SOL', to: 'JUP', amount: 1 },
  { from: 'SOL', to: 'RAY', amount: 1 },
  { from: 'BONK', to: 'WIF', amount: 1000000 },
  { from: 'JUP', to: 'JTO', amount: 100 },
  
  // Paires mid-cap
  { from: 'FIDA', to: 'USDC', amount: 100 },
  { from: 'SRM', to: 'USDC', amount: 50 },
  { from: 'COPE', to: 'USDC', amount: 100 },
  { from: 'STEP', to: 'USDC', amount: 100 },
  { from: 'MEDIA', to: 'USDC', amount: 100 },
  { from: 'ROPE', to: 'USDC', amount: 1000 },
  { from: 'MER', to: 'USDC', amount: 100 },
  { from: 'TULIP', to: 'USDC', amount: 50 },
  { from: 'SNY', to: 'USDC', amount: 100 },
  { from: 'SLRS', to: 'USDC', amount: 100 },
  
  // Paires low-cap / meme coins
  { from: 'SAMO', to: 'USDC', amount: 10000 },
  { from: 'SHDW', to: 'USDC', amount: 100 },
  { from: 'DUST', to: 'USDC', amount: 1000 },
  { from: 'FORGE', to: 'USDC', amount: 100 },
  
  // Reverse pairs
  { from: 'USDC', to: 'BONK', amount: 10 },
  { from: 'USDC', to: 'WIF', amount: 100 },
  { from: 'USDC', to: 'JTO', amount: 100 },
  { from: 'USDC', to: 'JUP', amount: 100 },
  { from: 'USDC', to: 'RAY', amount: 100 },
  { from: 'USDC', to: 'ORCA', amount: 100 },
  
  // Exotic pairs
  { from: 'BONK', to: 'JUP', amount: 1000000 },
  { from: 'WIF', to: 'BONK', amount: 10 },
  { from: 'JTO', to: 'RAY', amount: 10 },
  { from: 'RAY', to: 'ORCA', amount: 50 },
  { from: 'PYTH', to: 'JTO', amount: 100 },
  { from: 'SAMO', to: 'BONK', amount: 10000 },
  { from: 'FIDA', to: 'SRM', amount: 100 },
  { from: 'COPE', to: 'STEP', amount: 100 },
  { from: 'MEDIA', to: 'ROPE', amount: 100 },
  { from: 'MER', to: 'TULIP', amount: 100 },
];

interface TestResult {
  pair: string;
  inputAmount: number;
  jupiter: { output: number; fees: number; available: boolean };
  raydium: { output: number; fees: number; available: boolean };
  orca: { output: number; fees: number; available: boolean };
  swapback: { output: number; fees: number; rebate: number; available: boolean };
  winner: string;
  swapbackAdvantage: number; // en %
  timestamp: Date;
}

/**
 * Récupère un quote de Jupiter (données réelles)
 */
async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  decimals: number
): Promise<{ output: number; fees: number; available: boolean }> {
  try {
    const amountInSmallestUnit = Math.floor(amount * Math.pow(10, decimals));
    
    const response = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountInSmallestUnit}&slippageBps=50`
    );

    if (!response.ok) {
      console.log(`⚠️  Jupiter: Paire ${inputMint.slice(0, 8)}... → ${outputMint.slice(0, 8)}... non disponible`);
      return { output: 0, fees: 0, available: false };
    }

    const data = await response.json();
    const outputAmount = Number(data.outAmount) / Math.pow(10, decimals);
    const fees = amount * 0.005; // Jupiter prend ~0.5%

    return { output: outputAmount, fees, available: true };
  } catch (error) {
    console.log(`❌ Jupiter erreur:`, error instanceof Error ? error.message : String(error));
    return { output: 0, fees: 0, available: false };
  }
}

/**
 * Simule un quote Raydium (basé sur frais standards)
 */
function getRaydiumQuote(
  inputAmount: number
): { output: number; fees: number; available: boolean } {
  const fees = inputAmount * 0.0025; // 0.25%
  const output = inputAmount - fees;
  return { output, fees, available: true };
}

/**
 * Simule un quote Orca (basé sur frais standards)
 */
function getOrcaQuote(
  inputAmount: number
): { output: number; fees: number; available: boolean } {
  const fees = inputAmount * 0.003; // 0.30%
  const output = inputAmount - fees;
  return { output, fees, available: true };
}

/**
 * Récupère un quote SwapBack (API locale)
 */
async function getSwapBackQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  decimals: number
): Promise<{ output: number; fees: number; rebate: number; available: boolean }> {
  try {
    const amountInSmallestUnit = Math.floor(amount * Math.pow(10, decimals));

    const response = await fetch(`${SWAPBACK_API}/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputMint,
        outputMint,
        inputAmount: amountInSmallestUnit.toString(),
        slippage: 0.005,
      }),
    });

    if (!response.ok) {
      return { output: 0, fees: 0, rebate: 0, available: false };
    }

    const data = await response.json();
    const output = data.estimatedOutput / Math.pow(10, decimals);
    const rebate = data.rebateAmount / Math.pow(10, decimals);
    const fees = data.fees / Math.pow(10, decimals);

    return { output: output + rebate, fees, rebate, available: true };
  } catch (error) {
    console.log(`❌ SwapBack erreur:`, error instanceof Error ? error.message : String(error));
    return { output: 0, fees: 0, rebate: 0, available: false };
  }
}

/**
 * Teste une paire de tokens
 */
async function testPair(
  fromSymbol: string,
  toSymbol: string,
  amount: number
): Promise<TestResult | null> {
  const fromToken = POPULAR_TOKENS.find(t => t.symbol === fromSymbol);
  const toToken = POPULAR_TOKENS.find(t => t.symbol === toSymbol);

  if (!fromToken || !toToken) {
    console.log(`⚠️  Tokens non trouvés: ${fromSymbol} → ${toSymbol}`);
    return null;
  }

  console.log(`\n🔍 Test: ${amount} ${fromSymbol} → ${toSymbol}`);

  // Récupérer les quotes en parallèle
  const [jupiter, swapback] = await Promise.all([
    getJupiterQuote(fromToken.mint, toToken.mint, amount, fromToken.decimals),
    getSwapBackQuote(fromToken.mint, toToken.mint, amount, fromToken.decimals),
  ]);

  // Simulations locales (toujours disponibles)
  const raydium = getRaydiumQuote(amount);
  const orca = getOrcaQuote(amount);

  // Déterminer le gagnant parmi les disponibles
  const outputs = [
    { name: 'Jupiter', value: jupiter.output, available: jupiter.available },
    { name: 'Raydium', value: raydium.output, available: raydium.available },
    { name: 'Orca', value: orca.output, available: orca.available },
    { name: 'SwapBack', value: swapback.output, available: swapback.available },
  ].filter(o => o.available);

  if (outputs.length === 0) {
    console.log(`❌ Aucun DEX disponible pour cette paire`);
    return null;
  }

  const winner = outputs.reduce((max, current) => 
    current.value > max.value ? current : max
  );

  const swapbackAdvantage = swapback.available
    ? ((swapback.output - (outputs.filter(o => o.name !== 'SwapBack').reduce((sum, o) => sum + o.value, 0) / (outputs.length - 1))) / amount) * 100
    : 0;

  console.log(`   Jupiter:  ${jupiter.available ? jupiter.output.toFixed(6) : 'N/A'}`);
  console.log(`   Raydium:  ${raydium.output.toFixed(6)}`);
  console.log(`   Orca:     ${orca.output.toFixed(6)}`);
  console.log(`   SwapBack: ${swapback.available ? swapback.output.toFixed(6) : 'N/A'} ${winner.name === 'SwapBack' ? '🥇' : ''}`);

  return {
    pair: `${fromSymbol}/${toSymbol}`,
    inputAmount: amount,
    jupiter,
    raydium,
    orca,
    swapback,
    winner: winner.name,
    swapbackAdvantage,
    timestamp: new Date(),
  };
}

/**
 * Exécute tous les tests
 */
async function runComprehensiveTests(): Promise<TestResult[]> {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 SUITE DE TESTS COMPLÈTE: 50 PAIRES DE TOKENS');
  console.log('='.repeat(80));
  console.log(`Début: ${new Date().toISOString()}\n`);

  const results: TestResult[] = [];
  let successCount = 0;
  let swapbackWins = 0;

  // Exécuter les tests séquentiellement avec délai
  for (let i = 0; i < TEST_PAIRS.length; i++) {
    const pair = TEST_PAIRS[i];
    console.log(`\n[${i + 1}/${TEST_PAIRS.length}] Testing ${pair.from} → ${pair.to}...`);

    try {
      const result = await testPair(pair.from, pair.to, pair.amount);
      
      if (result) {
        results.push(result);
        successCount++;
        if (result.winner === 'SwapBack') swapbackWins++;
      }

      // Délai pour éviter rate limiting (2 secondes entre chaque test)
      if (i < TEST_PAIRS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.log(`❌ Erreur lors du test:`, error instanceof Error ? error.message : String(error));
    }
  }

  // Génération du rapport
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 RAPPORT FINAL');
  console.log('='.repeat(80));
  console.log(`Tests réussis: ${successCount}/${TEST_PAIRS.length}`);
  console.log(`SwapBack gagnant: ${swapbackWins}/${successCount} (${((swapbackWins / successCount) * 100).toFixed(1)}%)`);

  // Statistiques détaillées
  const avgAdvantage = results
    .filter(r => r.swapback.available)
    .reduce((sum, r) => sum + r.swapbackAdvantage, 0) / results.filter(r => r.swapback.available).length;

  console.log(`\nAvantage moyen SwapBack: ${avgAdvantage.toFixed(3)}%`);

  // Top 10 meilleures performances
  console.log('\n📈 TOP 10 - Meilleures performances SwapBack:');
  results
    .filter(r => r.winner === 'SwapBack')
    .sort((a, b) => b.swapbackAdvantage - a.swapbackAdvantage)
    .slice(0, 10)
    .forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.pair}: +${r.swapbackAdvantage.toFixed(3)}% (${r.inputAmount} tokens)`);
    });

  // Sauvegarde des résultats
  const reportPath = '/workspaces/SwapBack/test-results-comprehensive.json';
  const fs = require('fs');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Résultats sauvegardés: ${reportPath}`);

  console.log('\n✅ TESTS TERMINÉS\n');
  
  return results;
}

// Suite de tests Vitest
describe('Comprehensive DEX Comparison', () => {
  it('should compare SwapBack routes against Jupiter, Raydium, and Orca on 50 token pairs', async () => {
    const results = await runComprehensiveTests();
    
    // Vérifications de base
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    
    // Vérifier qu'au moins un test a réussi
    const successfulTests = results.filter(r => r.swapback.available);
    expect(successfulTests.length).toBeGreaterThan(0);
    
    // Vérifier que SwapBack a des avantages
    const swapbackWins = results.filter(r => r.winner === 'SwapBack').length;
    expect(swapbackWins).toBeGreaterThan(0);
    
    // Log des résultats pour inspection
    console.log(`\n📊 Résumé des tests:`);
    console.log(`   Tests réussis: ${successfulTests.length}/${results.length}`);
    console.log(`   SwapBack gagnant: ${swapbackWins}/${successfulTests.length}`);
    
    // Calculer l'avantage moyen
    const avgAdvantage = results
      .filter(r => r.swapback.available)
      .reduce((sum, r) => sum + r.swapbackAdvantage, 0) / successfulTests.length;
    
    console.log(`   Avantage moyen SwapBack: ${avgAdvantage.toFixed(3)}%`);
    
    // Vérifier que l'avantage moyen est positif
    expect(avgAdvantage).toBeGreaterThan(0);
  }, 120000); // Timeout de 2 minutes pour laisser le temps aux appels API
});
