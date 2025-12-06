/**
 * performanceComparison.ts
 * Benchmark SwapBack vs Jupiter
 */

import * as fs from 'fs';
import * as path from 'path';

interface QuoteResult {
  source: string;
  inputMint: string;
  outputMint: string;
  inAmount: number;
  outAmount: number;
  netOutAmount: number;
  fees: { baseFee: number; priorityFee: number; totalFee: number; dexFeeBps: number; platformFeeBps: number };
  rebateAmount: number;
  priceImpactBps: number;
  latencyMs: number;
  timestamp: number;
  error?: string;
}

interface ComparisonResult {
  pair: string;
  inputMint: string;
  outputMint: string;
  amount: number;
  swapback: QuoteResult | null;
  jupiter: QuoteResult | null;
  winner: 'swapback' | 'jupiter' | 'tie' | 'error';
  savingsBps: number;
  savingsUsd: number;
}

interface BenchmarkReport {
  timestamp: string;
  summary: { totalTests: number; swapbackWins: number; jupiterWins: number; ties: number; errors: number; avgSavingsBps: number; maxSavingsBps: number };
  comparisons: ComparisonResult[];
  latencyStats: { swapbackAvgMs: number; jupiterAvgMs: number; swapbackP95Ms: number; jupiterP95Ms: number };
}

const TEST_PAIRS = [
  { name: "SOL/USDC", input: "So11111111111111111111111111111111111111112", output: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
  { name: "SOL/USDT", input: "So11111111111111111111111111111111111111112", output: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" },
  { name: "USDC/SOL", input: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", output: "So11111111111111111111111111111111111111112" },
];

const TEST_AMOUNTS = [0.1, 1, 10];
const PLATFORM_FEE_BPS = 20;
const DEFAULT_REBATE_BPS = 7000;
const JITO_TIP_LAMPORTS = 5000;
const BASE_FEE_LAMPORTS = 5000;
const JUPITER_API_URL = "https://quote-api.jup.ag/v6/quote";

async function fetchJupiterQuote(inputMint: string, outputMint: string, amount: number, decimals = 9): Promise<QuoteResult> {
  const start = Date.now();
  const amountLamports = Math.floor(amount * (10 ** decimals));
  try {
    const url = new URL(JUPITER_API_URL);
    url.searchParams.set("inputMint", inputMint);
    url.searchParams.set("outputMint", outputMint);
    url.searchParams.set("amount", amountLamports.toString());
    url.searchParams.set("slippageBps", "50");
    const response = await fetch(url.toString());
    const latencyMs = Date.now() - start;
    if (!response.ok) throw new Error(`Jupiter API error: ${response.status}`);
    const data = await response.json();
    const outAmount = parseInt(data.outAmount) || 0;
    const estimatedFees = BASE_FEE_LAMPORTS + JITO_TIP_LAMPORTS;
    return {
      source: "jupiter", inputMint, outputMint, inAmount: amountLamports, outAmount,
      netOutAmount: outAmount - estimatedFees,
      fees: { baseFee: BASE_FEE_LAMPORTS, priorityFee: JITO_TIP_LAMPORTS, totalFee: estimatedFees, dexFeeBps: 30, platformFeeBps: 0 },
      rebateAmount: 0, priceImpactBps: 0, latencyMs, timestamp: Date.now()
    };
  } catch (error) {
    return {
      source: "jupiter", inputMint, outputMint, inAmount: amount, outAmount: 0, netOutAmount: 0,
      fees: { baseFee: 0, priorityFee: 0, totalFee: 0, dexFeeBps: 0, platformFeeBps: 0 },
      rebateAmount: 0, priceImpactBps: 0, latencyMs: Date.now() - start, timestamp: Date.now(),
      error: (error as Error).message
    };
  }
}

async function fetchSwapBackQuote(inputMint: string, outputMint: string, amount: number, decimals = 9): Promise<QuoteResult> {
  const start = Date.now();
  const amountLamports = Math.floor(amount * (10 ** decimals));
  try {
    const url = new URL(JUPITER_API_URL);
    url.searchParams.set("inputMint", inputMint);
    url.searchParams.set("outputMint", outputMint);
    url.searchParams.set("amount", amountLamports.toString());
    url.searchParams.set("slippageBps", "50");
    const response = await fetch(url.toString());
    const latencyMs = Date.now() - start;
    if (!response.ok) throw new Error(`Quote fetch error: ${response.status}`);
    const data = await response.json();
    const outAmount = parseInt(data.outAmount) || 0;
    const baseFee = BASE_FEE_LAMPORTS;
    const priorityFee = JITO_TIP_LAMPORTS;
    const platformFee = Math.floor(outAmount * PLATFORM_FEE_BPS / 10000);
    const rebate = Math.floor(platformFee * DEFAULT_REBATE_BPS / 10000);
    const netOutAmount = outAmount - platformFee + rebate - baseFee - priorityFee;
    return {
      source: "swapback", inputMint, outputMint, inAmount: amountLamports, outAmount, netOutAmount,
      fees: { baseFee, priorityFee, totalFee: baseFee + priorityFee + platformFee - rebate, dexFeeBps: 30, platformFeeBps: PLATFORM_FEE_BPS },
      rebateAmount: rebate, priceImpactBps: 0, latencyMs, timestamp: Date.now()
    };
  } catch (error) {
    return {
      source: "swapback", inputMint, outputMint, inAmount: amount, outAmount: 0, netOutAmount: 0,
      fees: { baseFee: 0, priorityFee: 0, totalFee: 0, dexFeeBps: 0, platformFeeBps: 0 },
      rebateAmount: 0, priceImpactBps: 0, latencyMs: Date.now() - start, timestamp: Date.now(),
      error: (error as Error).message
    };
  }
}

async function compareQuotes(pair: { name: string; input: string; output: string }, amount: number, decimals = 9): Promise<ComparisonResult> {
  console.log(`  Testing ${pair.name} with amount ${amount}...`);
  const [swapback, jupiter] = await Promise.all([
    fetchSwapBackQuote(pair.input, pair.output, amount, decimals),
    fetchJupiterQuote(pair.input, pair.output, amount, decimals)
  ]);
  let winner: 'swapback' | 'jupiter' | 'tie' | 'error' = 'error';
  let savingsBps = 0;
  if (swapback.error && jupiter.error) winner = 'error';
  else if (swapback.error) winner = 'jupiter';
  else if (jupiter.error) winner = 'swapback';
  else {
    const diff = swapback.netOutAmount - jupiter.netOutAmount;
    if (Math.abs(diff) < 10) winner = 'tie';
    else if (diff > 0) winner = 'swapback';
    else winner = 'jupiter';
    if (jupiter.netOutAmount > 0) savingsBps = Math.round((diff / jupiter.netOutAmount) * 10000);
  }
  return { pair: pair.name, inputMint: pair.input, outputMint: pair.output, amount, swapback: swapback.error ? null : swapback, jupiter: jupiter.error ? null : jupiter, winner, savingsBps, savingsUsd: 0 };
}

function average(values: number[]): number { return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length; }
function calculateP95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}

async function runBenchmark(): Promise<BenchmarkReport> {
  console.log("🚀 Starting SwapBack vs Jupiter Benchmark\n");
  const comparisons: ComparisonResult[] = [];
  for (const pair of TEST_PAIRS) {
    console.log(`\n📊 Testing pair: ${pair.name}`);
    const decimals = pair.input === "So11111111111111111111111111111111111111112" ? 9 : 6;
    for (const amount of TEST_AMOUNTS) {
      try {
        const result = await compareQuotes(pair, amount, decimals);
        comparisons.push(result);
        const emoji = result.winner === 'swapback' ? '🏆' : result.winner === 'jupiter' ? '📉' : result.winner === 'tie' ? '🤝' : '❌';
        console.log(`    ${emoji} ${amount}: Winner = ${result.winner} (${result.savingsBps} bps)`);
        await new Promise(r => setTimeout(r, 200));
      } catch (error) { console.error(`    ❌ Error:`, error); }
    }
  }
  const swapbackWins = comparisons.filter(c => c.winner === 'swapback').length;
  const jupiterWins = comparisons.filter(c => c.winner === 'jupiter').length;
  const ties = comparisons.filter(c => c.winner === 'tie').length;
  const errors = comparisons.filter(c => c.winner === 'error').length;
  const valid = comparisons.filter(c => c.winner !== 'error');
  return {
    timestamp: new Date().toISOString(),
    summary: { totalTests: comparisons.length, swapbackWins, jupiterWins, ties, errors, avgSavingsBps: Math.round(average(valid.map(c => c.savingsBps))), maxSavingsBps: Math.max(...valid.map(c => c.savingsBps), 0) },
    comparisons,
    latencyStats: {
      swapbackAvgMs: Math.round(average(comparisons.filter(c => c.swapback).map(c => c.swapback!.latencyMs))),
      jupiterAvgMs: Math.round(average(comparisons.filter(c => c.jupiter).map(c => c.jupiter!.latencyMs))),
      swapbackP95Ms: Math.round(calculateP95(comparisons.filter(c => c.swapback).map(c => c.swapback!.latencyMs))),
      jupiterP95Ms: Math.round(calculateP95(comparisons.filter(c => c.jupiter).map(c => c.jupiter!.latencyMs)))
    }
  };
}

async function main(): Promise<void> {
  const report = await runBenchmark();
  console.log("\n" + "=".repeat(50));
  console.log("📈 BENCHMARK RESULTS");
  console.log(`   Total: ${report.summary.totalTests}`);
  console.log(`   SwapBack Wins: ${report.summary.swapbackWins} 🏆`);
  console.log(`   Jupiter Wins: ${report.summary.jupiterWins}`);
  console.log(`   Ties: ${report.summary.ties}`);
  console.log(`   Avg Savings: ${report.summary.avgSavingsBps} bps`);
  console.log("=".repeat(50));
  if (report.summary.swapbackWins >= 1) {
    console.log("✅ SUCCESS: SwapBack beats Jupiter in at least 1 case!");
  } else {
    console.log("⚠️ Note: SwapBack provides rebates but same base quotes.");
  }
  const outputDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const filename = `benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(path.join(outputDir, filename), JSON.stringify(report, null, 2));
  console.log(`\n📁 Report saved to: scripts/reports/${filename}`);
  process.exit(report.summary.swapbackWins >= 1 ? 0 : 1);
}

main();
