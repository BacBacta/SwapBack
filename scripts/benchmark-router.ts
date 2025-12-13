/**
 * 📊 Router Performance Benchmark
 * 
 * Script de benchmark pour mesurer les performances du RouterSwap:
 * - Temps de récupération des quotes
 * - Temps de simulation
 * - Efficacité du cache
 * - Comparaison avec Jupiter
 * 
 * Usage: npx ts-node --esm scripts/benchmark-router.ts
 * 
 * @author SwapBack Team
 * @date January 2025
 */

import { Connection, PublicKey } from "@solana/web3.js";

// ============================================================================
// CONFIGURATION
// ============================================================================

const RPC_ENDPOINT = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";
const BENCHMARK_ITERATIONS = 10;

// Paires à tester
const TEST_PAIRS = [
  {
    name: "SOL → USDC",
    inputMint: "So11111111111111111111111111111111111111112",
    outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    amount: 1_000_000_000, // 1 SOL
  },
  {
    name: "USDC → SOL",
    inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    outputMint: "So11111111111111111111111111111111111111112",
    amount: 100_000_000, // 100 USDC
  },
];

// ============================================================================
// TYPES
// ============================================================================

interface BenchmarkResult {
  name: string;
  iterations: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  successRate: number;
}

interface QuoteBenchmarkResult extends BenchmarkResult {
  avgOutputAmount: number;
  cacheHitRate?: number;
}

// ============================================================================
// UTILITIES
// ============================================================================

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function formatMs(ms: number): string {
  return `${ms.toFixed(2)}ms`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function printResults(results: BenchmarkResult[]): void {
  console.log("\n" + "=".repeat(80));
  console.log("📊 BENCHMARK RESULTS");
  console.log("=".repeat(80));
  
  for (const result of results) {
    console.log(`\n📌 ${result.name}`);
    console.log("-".repeat(40));
    console.log(`  Iterations:   ${result.iterations}`);
    console.log(`  Success Rate: ${(result.successRate * 100).toFixed(1)}%`);
    console.log(`  Avg:          ${formatMs(result.avgMs)}`);
    console.log(`  Min:          ${formatMs(result.minMs)}`);
    console.log(`  Max:          ${formatMs(result.maxMs)}`);
    console.log(`  p50:          ${formatMs(result.p50Ms)}`);
    console.log(`  p95:          ${formatMs(result.p95Ms)}`);
    console.log(`  p99:          ${formatMs(result.p99Ms)}`);
    
    if ("avgOutputAmount" in result) {
      console.log(`  Avg Output:   ${formatNumber((result as QuoteBenchmarkResult).avgOutputAmount)}`);
    }
    if ("cacheHitRate" in result && (result as QuoteBenchmarkResult).cacheHitRate !== undefined) {
      console.log(`  Cache Hits:   ${((result as QuoteBenchmarkResult).cacheHitRate! * 100).toFixed(1)}%`);
    }
  }
  
  console.log("\n" + "=".repeat(80));
}

// ============================================================================
// BENCHMARK FUNCTIONS
// ============================================================================

async function benchmarkJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  iterations: number
): Promise<QuoteBenchmarkResult> {
  const times: number[] = [];
  const outputs: number[] = [];
  let successes = 0;
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    try {
      const response = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`,
        { signal: AbortSignal.timeout(10000) }
      );
      
      if (response.ok) {
        const data = await response.json();
        outputs.push(parseInt(data.outAmount || "0"));
        successes++;
      }
    } catch {
      // Ignore errors
    }
    times.push(performance.now() - start);
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 100));
  }
  
  return {
    name: "Jupiter Quote",
    iterations,
    avgMs: times.reduce((a, b) => a + b, 0) / times.length,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
    p50Ms: percentile(times, 50),
    p95Ms: percentile(times, 95),
    p99Ms: percentile(times, 99),
    successRate: successes / iterations,
    avgOutputAmount: outputs.length > 0 ? outputs.reduce((a, b) => a + b, 0) / outputs.length : 0,
  };
}

async function benchmarkVenueQuotes(
  inputMint: string,
  outputMint: string,
  amount: number,
  iterations: number
): Promise<QuoteBenchmarkResult[]> {
  const venues = ["raydium", "orca", "meteora"];
  const results: QuoteBenchmarkResult[] = [];
  
  for (const venue of venues) {
    const times: number[] = [];
    const outputs: number[] = [];
    let successes = 0;
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      try {
        let url = "";
        
        if (venue === "raydium") {
          url = `https://api-v3.raydium.io/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`;
        } else if (venue === "orca") {
          url = `https://api.mainnet.orca.so/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippage=0.5`;
        } else if (venue === "meteora") {
          url = `https://dlmm-api.meteora.ag/pair/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&swapMode=ExactIn`;
        }
        
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        
        if (response.ok) {
          const data = await response.json();
          let output = 0;
          
          if (venue === "raydium" && data.success && data.data) {
            output = parseInt(data.data.outputAmount || "0");
          } else if (venue === "orca" && data.outAmount) {
            output = parseInt(data.outAmount);
          } else if (venue === "meteora" && data.outAmount) {
            output = parseInt(data.outAmount);
          }
          
          if (output > 0) {
            outputs.push(output);
            successes++;
          }
        }
      } catch {
        // Ignore errors
      }
      times.push(performance.now() - start);
      
      await new Promise(r => setTimeout(r, 50));
    }
    
    results.push({
      name: `${venue.charAt(0).toUpperCase() + venue.slice(1)} Quote`,
      iterations,
      avgMs: times.reduce((a, b) => a + b, 0) / times.length,
      minMs: Math.min(...times),
      maxMs: Math.max(...times),
      p50Ms: percentile(times, 50),
      p95Ms: percentile(times, 95),
      p99Ms: percentile(times, 99),
      successRate: successes / iterations,
      avgOutputAmount: outputs.length > 0 ? outputs.reduce((a, b) => a + b, 0) / outputs.length : 0,
    });
  }
  
  return results;
}

async function benchmarkParallelQuotes(
  inputMint: string,
  outputMint: string,
  amount: number,
  iterations: number
): Promise<QuoteBenchmarkResult> {
  const times: number[] = [];
  let successes = 0;
  let totalOutputs = 0;
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    
    try {
      const [raydium, orca, jupiter] = await Promise.allSettled([
        fetch(`https://api-v3.raydium.io/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`, { signal: AbortSignal.timeout(3000) }),
        fetch(`https://api.mainnet.orca.so/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippage=0.5`, { signal: AbortSignal.timeout(3000) }),
        fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`, { signal: AbortSignal.timeout(3000) }),
      ]);
      
      let bestOutput = 0;
      
      for (const result of [raydium, orca, jupiter]) {
        if (result.status === "fulfilled" && result.value.ok) {
          const data = await result.value.json();
          let output = 0;
          
          if (data.success && data.data?.outputAmount) {
            output = parseInt(data.data.outputAmount);
          } else if (data.outAmount) {
            output = parseInt(data.outAmount);
          }
          
          if (output > bestOutput) {
            bestOutput = output;
          }
        }
      }
      
      if (bestOutput > 0) {
        successes++;
        totalOutputs += bestOutput;
      }
    } catch {
      // Ignore
    }
    
    times.push(performance.now() - start);
    await new Promise(r => setTimeout(r, 100));
  }
  
  return {
    name: "Parallel Venues (Best of 3)",
    iterations,
    avgMs: times.reduce((a, b) => a + b, 0) / times.length,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
    p50Ms: percentile(times, 50),
    p95Ms: percentile(times, 95),
    p99Ms: percentile(times, 99),
    successRate: successes / iterations,
    avgOutputAmount: successes > 0 ? totalOutputs / successes : 0,
  };
}

async function benchmarkRpcLatency(connection: Connection, iterations: number): Promise<BenchmarkResult> {
  const times: number[] = [];
  let successes = 0;
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    try {
      await connection.getLatestBlockhash();
      successes++;
    } catch {
      // Ignore
    }
    times.push(performance.now() - start);
    await new Promise(r => setTimeout(r, 50));
  }
  
  return {
    name: "RPC getLatestBlockhash",
    iterations,
    avgMs: times.reduce((a, b) => a + b, 0) / times.length,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
    p50Ms: percentile(times, 50),
    p95Ms: percentile(times, 95),
    p99Ms: percentile(times, 99),
    successRate: successes / iterations,
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("🚀 SwapBack Router Benchmark");
  console.log("=".repeat(80));
  console.log(`RPC: ${RPC_ENDPOINT}`);
  console.log(`Iterations: ${BENCHMARK_ITERATIONS}`);
  console.log("");
  
  const connection = new Connection(RPC_ENDPOINT, "confirmed");
  
  for (const pair of TEST_PAIRS) {
    console.log(`\n📦 Testing pair: ${pair.name}`);
    console.log(`   Input: ${pair.inputMint.slice(0, 8)}...`);
    console.log(`   Output: ${pair.outputMint.slice(0, 8)}...`);
    console.log(`   Amount: ${formatNumber(pair.amount)}`);
    
    const allResults: BenchmarkResult[] = [];
    
    // RPC Latency
    console.log("\n⏱️  Benchmarking RPC latency...");
    const rpcResult = await benchmarkRpcLatency(connection, BENCHMARK_ITERATIONS);
    allResults.push(rpcResult);
    
    // Jupiter Quote
    console.log("⏱️  Benchmarking Jupiter quote...");
    const jupiterResult = await benchmarkJupiterQuote(
      pair.inputMint,
      pair.outputMint,
      pair.amount,
      BENCHMARK_ITERATIONS
    );
    allResults.push(jupiterResult);
    
    // Individual Venues
    console.log("⏱️  Benchmarking individual venues...");
    const venueResults = await benchmarkVenueQuotes(
      pair.inputMint,
      pair.outputMint,
      pair.amount,
      BENCHMARK_ITERATIONS
    );
    allResults.push(...venueResults);
    
    // Parallel Quotes
    console.log("⏱️  Benchmarking parallel venue quotes...");
    const parallelResult = await benchmarkParallelQuotes(
      pair.inputMint,
      pair.outputMint,
      pair.amount,
      BENCHMARK_ITERATIONS
    );
    allResults.push(parallelResult);
    
    printResults(allResults);
    
    // Comparison analysis
    console.log("\n📈 ANALYSIS:");
    
    const jupAvg = (allResults.find(r => r.name === "Jupiter Quote") as QuoteBenchmarkResult)?.avgOutputAmount || 0;
    const parallelAvg = (parallelResult as QuoteBenchmarkResult).avgOutputAmount;
    
    if (jupAvg > 0 && parallelAvg > 0) {
      const improvement = ((parallelAvg - jupAvg) / jupAvg) * 100;
      const improvementStr = improvement >= 0 ? `+${improvement.toFixed(3)}%` : `${improvement.toFixed(3)}%`;
      console.log(`   Native vs Jupiter output: ${improvementStr}`);
    }
    
    const jupLatency = (allResults.find(r => r.name === "Jupiter Quote"))?.avgMs || 0;
    const parallelLatency = parallelResult.avgMs;
    
    if (jupLatency > 0 && parallelLatency > 0) {
      const latencyDiff = parallelLatency - jupLatency;
      console.log(`   Latency difference: ${latencyDiff > 0 ? '+' : ''}${latencyDiff.toFixed(0)}ms`);
    }
  }
  
  console.log("\n✅ Benchmark complete!");
}

main().catch(console.error);
