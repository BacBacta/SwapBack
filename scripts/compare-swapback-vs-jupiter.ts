/**
 * SwapBack vs Jupiter - Real-time Comparison Script
 * Compares swap quotes and simulates transactions to analyze gains
 * 
 * Usage: npx ts-node scripts/compare-swapback-vs-jupiter.ts
 */

import fetch from 'node-fetch';

// Configuration
const SWAPBACK_API = 'https://swapback-api.fly.dev';
const JUPITER_API = 'https://quote-api.jup.ag/v6';

// Token addresses (Mainnet)
const TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  PYTH: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
};

// Test pairs for comparison
const TEST_PAIRS = [
  { from: 'SOL', to: 'USDC', amount: 1, decimals: 9 },      // 1 SOL → USDC
  { from: 'USDC', to: 'SOL', amount: 100, decimals: 6 },    // 100 USDC → SOL
  { from: 'SOL', to: 'BONK', amount: 0.5, decimals: 9 },    // 0.5 SOL → BONK
  { from: 'USDC', to: 'JUP', amount: 50, decimals: 6 },     // 50 USDC → JUP
  { from: 'SOL', to: 'WIF', amount: 0.25, decimals: 9 },    // 0.25 SOL → WIF
];

// SwapBack rebate tiers (in basis points)
const SWAPBACK_REBATES = {
  base: 10,        // 0.10% base rebate
  bronze: 15,      // 0.15% with Bronze NFT
  silver: 25,      // 0.25% with Silver NFT
  gold: 40,        // 0.40% with Gold NFT
  platinum: 60,    // 0.60% with Platinum NFT
};

interface QuoteResult {
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  routeInfo: string;
  fees: number;
  latencyMs: number;
  error?: string;
}

interface ComparisonResult {
  pair: string;
  inputAmount: string;
  jupiter: QuoteResult;
  swapback: QuoteResult & { rebateAmount: number; netGain: number };
  winner: 'SwapBack' | 'Jupiter' | 'Tie';
  advantagePercent: number;
}

// Fetch Jupiter quote
async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  decimals: number
): Promise<QuoteResult> {
  const start = Date.now();
  const amountLamports = Math.floor(amount * Math.pow(10, decimals));
  
  try {
    const url = `${JUPITER_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=50`;
    const response = await fetch(url);
    const latencyMs = Date.now() - start;
    
    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.status}`);
    }
    
    const data = await response.json() as any;
    
    const outputDecimals = getTokenDecimals(outputMint);
    const outputAmount = parseInt(data.outAmount) / Math.pow(10, outputDecimals);
    const priceImpact = parseFloat(data.priceImpactPct || '0');
    
    // Calculate approximate fees from route
    const routePlan = data.routePlan || [];
    const routeInfo = routePlan
      .map((r: any) => r.swapInfo?.label || 'Unknown')
      .join(' → ');
    
    return {
      inputAmount: amount,
      outputAmount,
      priceImpact,
      routeInfo: routeInfo || 'Direct',
      fees: 0, // Jupiter fees are included in output
      latencyMs,
    };
  } catch (error) {
    return {
      inputAmount: amount,
      outputAmount: 0,
      priceImpact: 0,
      routeInfo: 'Error',
      fees: 0,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Fetch SwapBack quote (via our API)
async function getSwapBackQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  decimals: number
): Promise<QuoteResult> {
  const start = Date.now();
  const amountLamports = Math.floor(amount * Math.pow(10, decimals));
  
  try {
    const url = `${SWAPBACK_API}/api/swap/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=50`;
    const response = await fetch(url);
    const latencyMs = Date.now() - start;
    
    if (!response.ok) {
      throw new Error(`SwapBack API error: ${response.status}`);
    }
    
    const data = await response.json() as any;
    
    // SwapBack returns Jupiter quote + rebate info
    const quote = data.quote || data;
    const outputDecimals = getTokenDecimals(outputMint);
    const outputAmount = parseInt(quote.outAmount) / Math.pow(10, outputDecimals);
    const priceImpact = parseFloat(quote.priceImpactPct || '0');
    
    const routePlan = quote.routePlan || [];
    const routeInfo = routePlan
      .map((r: any) => r.swapInfo?.label || 'Unknown')
      .join(' → ');
    
    return {
      inputAmount: amount,
      outputAmount,
      priceImpact,
      routeInfo: routeInfo || 'Direct',
      fees: 0,
      latencyMs,
    };
  } catch (error) {
    return {
      inputAmount: amount,
      outputAmount: 0,
      priceImpact: 0,
      routeInfo: 'Error',
      fees: 0,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Get token decimals
function getTokenDecimals(mint: string): number {
  const decimalsMap: Record<string, number> = {
    [TOKENS.SOL]: 9,
    [TOKENS.USDC]: 6,
    [TOKENS.USDT]: 6,
    [TOKENS.BONK]: 5,
    [TOKENS.JUP]: 6,
    [TOKENS.WIF]: 6,
    [TOKENS.PYTH]: 6,
  };
  return decimalsMap[mint] || 9;
}

// Calculate SwapBack rebate
function calculateRebate(
  outputAmount: number,
  tier: keyof typeof SWAPBACK_REBATES = 'base'
): number {
  const rebateBps = SWAPBACK_REBATES[tier];
  return outputAmount * (rebateBps / 10000);
}

// Compare a single pair
async function comparePair(
  fromSymbol: string,
  toSymbol: string,
  amount: number,
  decimals: number,
  tier: keyof typeof SWAPBACK_REBATES = 'base'
): Promise<ComparisonResult> {
  const inputMint = TOKENS[fromSymbol as keyof typeof TOKENS];
  const outputMint = TOKENS[toSymbol as keyof typeof TOKENS];
  
  // Fetch quotes in parallel
  const [jupiterQuote, swapbackQuote] = await Promise.all([
    getJupiterQuote(inputMint, outputMint, amount, decimals),
    getSwapBackQuote(inputMint, outputMint, amount, decimals),
  ]);
  
  // Calculate SwapBack rebate (on the output amount)
  const rebateAmount = calculateRebate(swapbackQuote.outputAmount, tier);
  const swapbackNetOutput = swapbackQuote.outputAmount + rebateAmount;
  
  // Calculate advantage
  const diff = swapbackNetOutput - jupiterQuote.outputAmount;
  const advantagePercent = jupiterQuote.outputAmount > 0 
    ? (diff / jupiterQuote.outputAmount) * 100 
    : 0;
  
  let winner: 'SwapBack' | 'Jupiter' | 'Tie';
  if (Math.abs(advantagePercent) < 0.01) {
    winner = 'Tie';
  } else if (advantagePercent > 0) {
    winner = 'SwapBack';
  } else {
    winner = 'Jupiter';
  }
  
  return {
    pair: `${fromSymbol} → ${toSymbol}`,
    inputAmount: `${amount} ${fromSymbol}`,
    jupiter: jupiterQuote,
    swapback: {
      ...swapbackQuote,
      rebateAmount,
      netGain: diff,
    },
    winner,
    advantagePercent,
  };
}

// Format number with precision
function formatNumber(n: number, precision: number = 6): string {
  if (n === 0) return '0';
  if (Math.abs(n) < 0.000001) return n.toExponential(2);
  return n.toFixed(precision).replace(/\.?0+$/, '');
}

// Print comparison table
function printComparison(results: ComparisonResult[], tier: string) {
  console.log('\n' + '═'.repeat(100));
  console.log(`🔄 SWAPBACK vs JUPITER - COMPARAISON EN TEMPS RÉEL`);
  console.log(`📊 Tier: ${tier.toUpperCase()} (${SWAPBACK_REBATES[tier as keyof typeof SWAPBACK_REBATES] / 100}% rebate)`);
  console.log(`📅 ${new Date().toLocaleString('fr-FR')}`);
  console.log('═'.repeat(100));
  
  let swapbackWins = 0;
  let jupiterWins = 0;
  let totalAdvantage = 0;
  
  for (const result of results) {
    console.log('\n┌' + '─'.repeat(98) + '┐');
    console.log(`│ 💱 ${result.pair.padEnd(20)} | Input: ${result.inputAmount.padEnd(20)} │`);
    console.log('├' + '─'.repeat(98) + '┤');
    
    if (result.jupiter.error) {
      console.log(`│ ⚡ JUPITER:  ❌ Error: ${result.jupiter.error.substring(0, 70).padEnd(70)} │`);
    } else {
      const jupOutput = formatNumber(result.jupiter.outputAmount);
      console.log(`│ ⚡ JUPITER:  Output: ${jupOutput.padEnd(20)} | Route: ${result.jupiter.routeInfo.substring(0, 35).padEnd(35)} | ${result.jupiter.latencyMs}ms │`);
    }
    
    if (result.swapback.error) {
      console.log(`│ 🔷 SWAPBACK: ❌ Error: ${result.swapback.error.substring(0, 70).padEnd(70)} │`);
    } else {
      const sbOutput = formatNumber(result.swapback.outputAmount);
      const rebate = formatNumber(result.swapback.rebateAmount);
      const netOutput = formatNumber(result.swapback.outputAmount + result.swapback.rebateAmount);
      console.log(`│ 🔷 SWAPBACK: Output: ${sbOutput.padEnd(20)} | Rebate: +${rebate.padEnd(15)} | Net: ${netOutput.padEnd(15)} │`);
    }
    
    console.log('├' + '─'.repeat(98) + '┤');
    
    const winnerEmoji = result.winner === 'SwapBack' ? '🏆' : result.winner === 'Jupiter' ? '⚡' : '🤝';
    const advantageStr = result.advantagePercent >= 0 
      ? `+${result.advantagePercent.toFixed(4)}%` 
      : `${result.advantagePercent.toFixed(4)}%`;
    const gainStr = result.swapback.netGain >= 0
      ? `+${formatNumber(result.swapback.netGain)}`
      : formatNumber(result.swapback.netGain);
    
    console.log(`│ ${winnerEmoji} WINNER: ${result.winner.padEnd(10)} | Avantage: ${advantageStr.padEnd(12)} | Gain net: ${gainStr.padEnd(20)} │`);
    console.log('└' + '─'.repeat(98) + '┘');
    
    if (result.winner === 'SwapBack') swapbackWins++;
    else if (result.winner === 'Jupiter') jupiterWins++;
    totalAdvantage += result.advantagePercent;
  }
  
  // Summary
  console.log('\n' + '═'.repeat(100));
  console.log('📈 RÉSUMÉ GLOBAL');
  console.log('═'.repeat(100));
  console.log(`│ SwapBack gagne: ${swapbackWins}/${results.length} swaps`);
  console.log(`│ Jupiter gagne:  ${jupiterWins}/${results.length} swaps`);
  console.log(`│ Avantage moyen SwapBack: ${(totalAdvantage / results.length).toFixed(4)}%`);
  console.log('═'.repeat(100));
}

// Simulate multiple transactions over time
async function runRealTimeSimulation(durationMinutes: number = 5, intervalSeconds: number = 30) {
  console.log('🚀 Démarrage de la simulation en temps réel...');
  console.log(`⏱️  Durée: ${durationMinutes} minutes, Intervalle: ${intervalSeconds}s`);
  console.log('─'.repeat(100));
  
  const endTime = Date.now() + durationMinutes * 60 * 1000;
  let iteration = 1;
  const allResults: ComparisonResult[] = [];
  
  while (Date.now() < endTime) {
    console.log(`\n\n🔄 ITÉRATION #${iteration} - ${new Date().toLocaleTimeString('fr-FR')}`);
    
    // Test all pairs
    const results: ComparisonResult[] = [];
    for (const pair of TEST_PAIRS) {
      try {
        const result = await comparePair(pair.from, pair.to, pair.amount, pair.decimals, 'silver');
        results.push(result);
        allResults.push(result);
        
        // Small delay between requests
        await new Promise(r => setTimeout(r, 500));
      } catch (error) {
        console.error(`❌ Erreur pour ${pair.from}→${pair.to}:`, error);
      }
    }
    
    printComparison(results, 'silver');
    
    iteration++;
    
    if (Date.now() < endTime) {
      console.log(`\n⏳ Prochaine itération dans ${intervalSeconds}s...`);
      await new Promise(r => setTimeout(r, intervalSeconds * 1000));
    }
  }
  
  // Final statistics
  printFinalStats(allResults);
}

// Print final statistics
function printFinalStats(results: ComparisonResult[]) {
  console.log('\n\n' + '═'.repeat(100));
  console.log('📊 STATISTIQUES FINALES DE LA SIMULATION');
  console.log('═'.repeat(100));
  
  const swapbackWins = results.filter(r => r.winner === 'SwapBack').length;
  const jupiterWins = results.filter(r => r.winner === 'Jupiter').length;
  const ties = results.filter(r => r.winner === 'Tie').length;
  
  const avgAdvantage = results.reduce((sum, r) => sum + r.advantagePercent, 0) / results.length;
  const maxAdvantage = Math.max(...results.map(r => r.advantagePercent));
  const minAdvantage = Math.min(...results.map(r => r.advantagePercent));
  
  const avgLatencyJupiter = results.reduce((sum, r) => sum + r.jupiter.latencyMs, 0) / results.length;
  const avgLatencySwapBack = results.reduce((sum, r) => sum + r.swapback.latencyMs, 0) / results.length;
  
  console.log(`│ Total swaps analysés:    ${results.length}`);
  console.log(`│ SwapBack gagnant:        ${swapbackWins} (${(swapbackWins/results.length*100).toFixed(1)}%)`);
  console.log(`│ Jupiter gagnant:         ${jupiterWins} (${(jupiterWins/results.length*100).toFixed(1)}%)`);
  console.log(`│ Égalité:                 ${ties} (${(ties/results.length*100).toFixed(1)}%)`);
  console.log('├' + '─'.repeat(98) + '┤');
  console.log(`│ Avantage moyen SwapBack: ${avgAdvantage >= 0 ? '+' : ''}${avgAdvantage.toFixed(4)}%`);
  console.log(`│ Meilleur avantage:       +${maxAdvantage.toFixed(4)}%`);
  console.log(`│ Pire avantage:           ${minAdvantage.toFixed(4)}%`);
  console.log('├' + '─'.repeat(98) + '┤');
  console.log(`│ Latence moyenne Jupiter: ${avgLatencyJupiter.toFixed(0)}ms`);
  console.log(`│ Latence moyenne SwapBack: ${avgLatencySwapBack.toFixed(0)}ms`);
  console.log('═'.repeat(100));
  
  // Projection annuelle
  const dailySwaps = 100; // Supposons 100 swaps/jour
  const avgSwapValue = 100; // $100 en moyenne
  const annualVolume = dailySwaps * avgSwapValue * 365;
  const annualSavings = annualVolume * (avgAdvantage / 100);
  
  console.log('\n💰 PROJECTION ÉCONOMIQUE (hypothèse: 100 swaps/jour, $100/swap)');
  console.log('═'.repeat(100));
  console.log(`│ Volume annuel estimé:    $${annualVolume.toLocaleString()}`);
  console.log(`│ Économies avec SwapBack: $${annualSavings.toFixed(2)} /an`);
  console.log('═'.repeat(100));
}

// Quick single comparison
async function quickCompare() {
  console.log('🔄 Comparaison rapide SwapBack vs Jupiter...\n');
  
  const results: ComparisonResult[] = [];
  
  for (const pair of TEST_PAIRS) {
    console.log(`  Fetching ${pair.from} → ${pair.to}...`);
    try {
      const result = await comparePair(pair.from, pair.to, pair.amount, pair.decimals, 'silver');
      results.push(result);
    } catch (error) {
      console.error(`  ❌ Error: ${error}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }
  
  printComparison(results, 'silver');
  
  // Also show comparison by tier
  console.log('\n\n📊 COMPARAISON PAR TIER DE REBATE');
  console.log('═'.repeat(80));
  
  const tiers = Object.keys(SWAPBACK_REBATES) as Array<keyof typeof SWAPBACK_REBATES>;
  for (const tier of tiers) {
    const rebatePct = SWAPBACK_REBATES[tier] / 100;
    const avgOutput = results.reduce((sum, r) => sum + r.swapback.outputAmount, 0) / results.length;
    const avgRebate = avgOutput * (SWAPBACK_REBATES[tier] / 10000);
    
    console.log(`│ ${tier.toUpperCase().padEnd(10)} | Rebate: ${rebatePct.toFixed(2)}% | Avg rebate value: ~$${avgRebate.toFixed(4)}`);
  }
  console.log('═'.repeat(80));
}

// Main entry point
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--realtime') || args.includes('-r')) {
    const duration = parseInt(args[args.indexOf('--duration') + 1] || args[args.indexOf('-d') + 1] || '2');
    await runRealTimeSimulation(duration, 30);
  } else {
    await quickCompare();
  }
}

main().catch(console.error);
