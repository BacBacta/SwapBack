#!/usr/bin/env npx tsx
/**
 * Benchmark Script pour le Multi-Source Quote Aggregator
 * 
 * Usage:
 *   npx tsx scripts/benchmark.ts
 *   npx tsx scripts/benchmark.ts --pairs 5 --iterations 10
 */

import { MultiSourceQuoteAggregator, type QuoteParams } from "../src/lib/quotes/multiSourceAggregator";

// === Configuration ===
const BENCHMARK_CONFIG = {
  iterations: 5,
  warmupIterations: 2,
  pairs: [
    { input: "So11111111111111111111111111111111111111112", output: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", name: "SOL/USDC" },
    { input: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", output: "So11111111111111111111111111111111111111112", name: "USDC/SOL" },
    { input: "So11111111111111111111111111111111111111112", output: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", name: "SOL/USDT" },
    { input: "So11111111111111111111111111111111111111112", output: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", name: "SOL/JUP" },
    { input: "So11111111111111111111111111111111111111112", output: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", name: "SOL/mSOL" },
  ],
  amounts: [0.1, 1, 10, 100],
};

interface BenchmarkResult {
  pair: string;
  amount: number;
  iteration: number;
  source: string;
  latencyMs: number;
  outAmount: string;
  improvementBps?: number;
  fromCache: boolean;
  error?: string;
}

interface SourceStats {
  source: string;
  successCount: number;
  failureCount: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  avgImprovementBps: number;
  bestImprovementBps: number;
}

// === Helpers ===
function formatNumber(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

function formatBps(bps: number): string {
  const sign = bps >= 0 ? "+" : "";
  return `${sign}${bps} bps`;
}

function printHeader(title: string): void {
  console.log("\n" + "=".repeat(60));
  console.log(`  ${title}`);
  console.log("=".repeat(60));
}

function printTable(headers: string[], rows: string[][]): void {
  const colWidths = headers.map((h, i) => {
    const maxRowWidth = Math.max(...rows.map(r => (r[i] || "").length));
    return Math.max(h.length, maxRowWidth);
  });

  const headerRow = headers.map((h, i) => h.padEnd(colWidths[i])).join(" | ");
  const separator = colWidths.map(w => "-".repeat(w)).join("-+-");
  
  console.log(headerRow);
  console.log(separator);
  for (const row of rows) {
    console.log(row.map((c, i) => (c || "").padEnd(colWidths[i])).join(" | "));
  }
}

// === Benchmark Functions ===
async function runBenchmark(): Promise<BenchmarkResult[]> {
  const aggregator = new MultiSourceQuoteAggregator();
  const results: BenchmarkResult[] = [];

  printHeader("Multi-Source Quote Aggregator Benchmark");
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Pairs: ${BENCHMARK_CONFIG.pairs.length}`);
  console.log(`Amounts: ${BENCHMARK_CONFIG.amounts.join(", ")}`);
  console.log(`Iterations: ${BENCHMARK_CONFIG.iterations}`);
  console.log(`Warmup: ${BENCHMARK_CONFIG.warmupIterations}`);

  // Warmup
  console.log("\n🔥 Warmup phase...");
  for (let w = 0; w < BENCHMARK_CONFIG.warmupIterations; w++) {
    for (const pair of BENCHMARK_CONFIG.pairs.slice(0, 2)) {
      try {
        await aggregator.getBestQuote({
          inputMint: pair.input,
          outputMint: pair.output,
          amountTokens: 1,
          amountLamports: 1_000_000_000,
          inputDecimals: 9,
          outputDecimals: 6,
          slippageBps: 50,
        });
      } catch {
        // Ignore warmup errors
      }
    }
  }

  // Main benchmark
  console.log("\n📊 Running benchmark...\n");
  
  for (const pair of BENCHMARK_CONFIG.pairs) {
    for (const amount of BENCHMARK_CONFIG.amounts) {
      for (let iteration = 1; iteration <= BENCHMARK_CONFIG.iterations; iteration++) {
        const params: QuoteParams = {
          inputMint: pair.input,
          outputMint: pair.output,
          amountTokens: amount,
          amountLamports: amount * 1_000_000_000,
          inputDecimals: 9,
          outputDecimals: 6,
          slippageBps: 50,
        };

        const start = Date.now();
        try {
          const result = await aggregator.getBestQuote(params);
          const latency = Date.now() - start;

          // Trouver l'amélioration vs Jupiter dans les alternatives
          const jupiterAlt = result.alternativeQuotes.find(q => q.source === "jupiter");
          const bestAlt = result.alternativeQuotes.find(q => q.source === result.source);
          const improvementBps = bestAlt?.improvementBps;

          results.push({
            pair: pair.name,
            amount,
            iteration,
            source: result.source,
            latencyMs: result.totalLatencyMs,
            outAmount: result.bestQuote.outAmount,
            improvementBps,
            fromCache: result.fromCache,
          });

          process.stdout.write(`  ${pair.name} ${amount} #${iteration}: ${result.source} (${latency}ms)${result.fromCache ? " [cache]" : ""}\r`);
        } catch (error) {
          results.push({
            pair: pair.name,
            amount,
            iteration,
            source: "error",
            latencyMs: Date.now() - start,
            outAmount: "0",
            fromCache: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }

        // Petit délai entre les requêtes
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  console.log("\n");
  return results;
}

function analyzeResults(results: BenchmarkResult[]): void {
  printHeader("Results Analysis");

  // 1. Statistiques par source
  const sourceMap = new Map<string, BenchmarkResult[]>();
  for (const r of results) {
    const arr = sourceMap.get(r.source) || [];
    arr.push(r);
    sourceMap.set(r.source, arr);
  }

  const sourceStats: SourceStats[] = [];
  for (const [source, sourceResults] of sourceMap) {
    const successes = sourceResults.filter(r => !r.error);
    const failures = sourceResults.filter(r => r.error);
    const latencies = successes.map(r => r.latencyMs);
    const improvements = successes.filter(r => r.improvementBps !== undefined).map(r => r.improvementBps!);

    sourceStats.push({
      source,
      successCount: successes.length,
      failureCount: failures.length,
      avgLatencyMs: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      minLatencyMs: latencies.length > 0 ? Math.min(...latencies) : 0,
      maxLatencyMs: latencies.length > 0 ? Math.max(...latencies) : 0,
      avgImprovementBps: improvements.length > 0 ? improvements.reduce((a, b) => a + b, 0) / improvements.length : 0,
      bestImprovementBps: improvements.length > 0 ? Math.max(...improvements) : 0,
    });
  }

  console.log("\n📈 Source Performance:\n");
  printTable(
    ["Source", "Success", "Fail", "Avg (ms)", "Min", "Max", "Avg Impr.", "Best Impr."],
    sourceStats.map(s => [
      s.source,
      s.successCount.toString(),
      s.failureCount.toString(),
      formatNumber(s.avgLatencyMs, 0),
      formatNumber(s.minLatencyMs, 0),
      formatNumber(s.maxLatencyMs, 0),
      formatBps(Math.round(s.avgImprovementBps)),
      formatBps(s.bestImprovementBps),
    ])
  );

  // 2. Best source par paire
  console.log("\n🏆 Best Source by Pair:\n");
  const pairBest = new Map<string, { source: string; count: number }>();
  for (const r of results.filter(r => !r.error && !r.fromCache)) {
    const key = r.pair;
    const current = pairBest.get(key);
    if (!current || r.source === current.source) {
      pairBest.set(key, { source: r.source, count: (current?.count || 0) + 1 });
    }
  }

  printTable(
    ["Pair", "Best Source", "Win Count"],
    Array.from(pairBest.entries()).map(([pair, stats]) => [
      pair,
      stats.source,
      stats.count.toString(),
    ])
  );

  // 3. Cache hit rate
  const cacheHits = results.filter(r => r.fromCache).length;
  const cacheHitRate = (cacheHits / results.length) * 100;
  console.log(`\n💾 Cache Hit Rate: ${formatNumber(cacheHitRate)}% (${cacheHits}/${results.length})`);

  // 4. Latence globale
  const allLatencies = results.filter(r => !r.error).map(r => r.latencyMs);
  
  if (allLatencies.length === 0) {
    console.log(`\n⚠️  Aucun quote réussi - impossible de calculer les percentiles de latence`);
  } else {
    const sorted = allLatencies.sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;

    console.log(`\n⏱️  Latency Percentiles:`);
    console.log(`   P50: ${formatNumber(p50, 0)}ms`);
    console.log(`   P95: ${formatNumber(p95, 0)}ms`);
    console.log(`   P99: ${formatNumber(p99, 0)}ms`);
  }

  // 5. Amélioration moyenne vs Jupiter
  const improvements = results
    .filter(r => r.source !== "jupiter" && r.source !== "cache" && r.improvementBps !== undefined)
    .map(r => r.improvementBps!);
  
  if (improvements.length > 0) {
    const avgImprovement = improvements.reduce((a, b) => a + b, 0) / improvements.length;
    const bestImprovement = Math.max(...improvements);
    console.log(`\n🚀 Improvement vs Jupiter:`);
    console.log(`   Average: ${formatBps(Math.round(avgImprovement))}`);
    console.log(`   Best: ${formatBps(bestImprovement)}`);
  }

  // 6. Erreurs
  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    console.log(`\n⚠️  Errors: ${errors.length}`);
    const errorTypes = new Map<string, number>();
    for (const e of errors) {
      const msg = e.error || "Unknown";
      errorTypes.set(msg, (errorTypes.get(msg) || 0) + 1);
    }
    for (const [msg, count] of errorTypes) {
      console.log(`   - ${msg}: ${count}`);
    }
  }
}

// === Main ===
async function main(): Promise<void> {
  console.log("🔄 Starting Multi-Source Quote Aggregator Benchmark...\n");

  try {
    const results = await runBenchmark();
    analyzeResults(results);
    
    printHeader("Benchmark Complete");
    console.log(`Total requests: ${results.length}`);
    console.log(`Successful: ${results.filter(r => !r.error).length}`);
    console.log(`Failed: ${results.filter(r => r.error).length}`);
  } catch (error) {
    console.error("❌ Benchmark failed:", error);
    process.exit(1);
  }
}

main();
