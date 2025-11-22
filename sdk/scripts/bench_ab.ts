/**
 * Benchmark Script: A/B Testing SwapBack vs Competitors
 *
 * This script compares SwapBack's routing performance against Jupiter and other DEXes
 * by running parallel quotes and measuring price improvement, fees, and execution time.
 *
 * Usage:
 *   npm run bench:ab
 *
 * Environment variables:
 *   RPC_URL - Solana RPC endpoint (default: devnet)
 *   ITERATIONS - Number of test iterations per pair (default: 5)
 *   SAVE_RESULTS - Save results to CSV/JSON (default: true)
 */

import { execSync } from "node:child_process";
import { Connection, PublicKey } from "@solana/web3.js";
import { IntelligentOrderRouter } from "../src/services/IntelligentOrderRouter";
import { JupiterService } from "../src/services/JupiterService";
import { LiquidityDataCollector } from "../src/services/LiquidityDataCollector";
import { RouteOptimizationEngine } from "../src/services/RouteOptimizationEngine";
import { OraclePriceService } from "../src/services/OraclePriceService";
import {
  PriceVerification,
  RouteCandidate,
} from "../src/types/smart-router";
import * as fs from "node:fs";
import * as path from "node:path";

// Common token addresses on Solana
const TOKENS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  mSOL: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
};

interface TestCase {
  label: string;
  from: string;
  to: string;
  amounts: number[];
}

const DEFAULT_TEST_CASES: TestCase[] = [
  {
    label: "SOL/USDC",
    from: TOKENS.SOL,
    to: TOKENS.USDC,
    amounts: [1e6, 1e7, 1e8, 1e9],
  },
  {
    label: "USDC/USDT",
    from: TOKENS.USDC,
    to: TOKENS.USDT,
    amounts: [1e4, 1e5, 1e6, 1e7],
  },
  {
    label: "SOL/BONK",
    from: TOKENS.SOL,
    to: TOKENS.BONK,
    amounts: [1e7, 1e8, 1e9],
  },
  {
    label: "mSOL/SOL",
    from: TOKENS.mSOL,
    to: TOKENS.SOL,
    amounts: [1e6, 1e7, 1e8],
  },
];

interface BenchmarkResult {
  pair: string;
  amount: number;
  iteration: number;
  timestamp: number;
  swapback: {
    priceIn: number;
    priceOut: number;
    slippage: number;
    fees: number;
    duration: number;
    success: boolean;
    error?: string;
    oracleAcceptable?: boolean;
    oracleDeviationBps?: number;
    oracleWarning?: string;
    oracleMetadata?: PriceVerification["metadata"];
  };
  jupiter: {
    priceIn: number;
    priceOut: number;
    slippage: number;
    fees: number;
    duration: number;
    success: boolean;
    error?: string;
  };
  priceImprovement: number; // bps vs Jupiter
  savings: number; // USD value
}

interface BenchmarkStats {
  totalTests: number;
  successfulTests: number;
  avgImprovement: number;
  medianImprovement: number;
  p95Improvement: number;
  totalSavings: number;
  avgDuration: number;
  successRate: number;
  pairSummaries: Record<string, PairSummary>;
}

interface PairSummary {
  tests: number;
  avgImprovement: number;
  medianImprovement: number;
  p95Improvement: number;
  avgSavings: number;
  successRate: number;
}

interface BenchmarkRunOptions {
  iterations: number;
  outputDir: string;
  saveResults: boolean;
  improvementFloorBps?: number;
  pairFilter?: string[];
}

interface BenchmarkRunMetadata {
  startedAt: string;
  rpcEndpoint: string;
  iterations: number;
  pairs: string[];
  gitCommit?: string;
}

class SwapBackBenchmark {
  private readonly connection: Connection;
  private readonly router: IntelligentOrderRouter;
  private readonly jupiter: JupiterService;
  private readonly oracle: OraclePriceService;
  private readonly results: BenchmarkResult[] = [];

  constructor(rpcUrl?: string) {
    this.connection = new Connection(rpcUrl || "https://api.devnet.solana.com");
    const liquidityCollector = new LiquidityDataCollector(this.connection);
    const oracleService = new OraclePriceService(this.connection);
    const optimizer = new RouteOptimizationEngine(
      liquidityCollector,
      oracleService
    );
    this.router = new IntelligentOrderRouter(liquidityCollector, optimizer);
    this.jupiter = new JupiterService(this.connection);
    this.oracle = oracleService;
  }

  async runBenchmark(partialOptions: Partial<BenchmarkRunOptions> = {}): Promise<BenchmarkStats> {
    const config: BenchmarkRunOptions = {
      iterations: partialOptions.iterations ?? 5,
      outputDir: partialOptions.outputDir ?? path.join(process.cwd(), "benchmarks"),
      saveResults: partialOptions.saveResults ?? true,
      improvementFloorBps: partialOptions.improvementFloorBps,
      pairFilter: partialOptions.pairFilter,
    };

    const testCases = this.resolveTestCases(config.pairFilter);
    this.results.length = 0;
    const metadata = this.buildMetadata(config, testCases);

    console.log("🚀 Starting SwapBack vs Competitors Benchmark");
    console.log(`📊 Iterations per case: ${config.iterations}`);
    console.log(`🔗 RPC: ${this.connection.rpcEndpoint}`);
    console.log(`🎯 Pairs: ${testCases.map((tc) => tc.label).join(", ")}`);
    console.log("");

    for (const testCase of testCases) {
      for (const amount of testCase.amounts) {
        console.log(
          `\n📈 Testing ${testCase.label} (${this.formatAmount(amount, testCase.from)})`
        );

        for (let i = 0; i < config.iterations; i++) {
          console.log(`  Iteration ${i + 1}/${config.iterations}...`);
          const result = await this.runComparison(
            testCase.from,
            testCase.to,
            amount,
            i
          );
          this.results.push(result);

          if (result.swapback.success && result.jupiter.success) {
            console.log(
              `    ✅ Price Improvement: ${result.priceImprovement.toFixed(2)} bps`
            );
            console.log(`    💰 Savings: $${result.savings.toFixed(4)}`);
          } else {
            console.log(
              `    ❌ Failed: SwapBack: ${result.swapback.success}, Jupiter: ${result.jupiter.success}`
            );
          }
        }
      }
    }

    const successfulResults = this.results.filter(
      (r) => r.swapback.success && r.jupiter.success
    );
    const stats = this.calculateStats(successfulResults);
    this.generateReport(stats, metadata);

    if (config.saveResults && successfulResults.length) {
      this.saveResultsToFile(successfulResults, stats, metadata, config);
    }

    return stats;
  }

  private async runComparison(
    inputMint: string,
    outputMint: string,
    amount: number,
    iteration: number
  ): Promise<BenchmarkResult> {
    const result: BenchmarkResult = {
      pair: `${this.getTokenSymbol(inputMint)}/${this.getTokenSymbol(outputMint)}`,
      amount,
      iteration,
      timestamp: Date.now(),
      swapback: {
        priceIn: 0,
        priceOut: 0,
        slippage: 0,
        fees: 0,
        duration: 0,
        success: false,
        oracleAcceptable: undefined,
        oracleDeviationBps: undefined,
        oracleWarning: undefined,
        oracleMetadata: undefined,
      },
      jupiter: {
        priceIn: 0,
        priceOut: 0,
        slippage: 0,
        fees: 0,
        duration: 0,
        success: false,
      },
      priceImprovement: 0,
      savings: 0,
    };

    // Test SwapBack
    try {
      const swapbackStart = Date.now();
      const plan = await this.router.buildAtomicPlan({
        inputMint,
        outputMint,
        inputAmount: amount,
      });
      const swapbackDuration = Date.now() - swapbackStart;

      let oracleVerification: PriceVerification | undefined;
      if (plan.baseRoute) {
        oracleVerification = await this.safeOracleVerification(
          plan.baseRoute,
          inputMint,
          outputMint,
          amount
        );
      }

      result.swapback = {
        priceIn: amount,
        priceOut: plan.expectedOutput,
        slippage: plan.maxSlippageBps / 100, // Convert to percentage
        fees: 0, // Fees calculation to be implemented
        duration: swapbackDuration,
        success: true,
        oracleAcceptable: oracleVerification?.isAcceptable,
        oracleDeviationBps: oracleVerification
          ? oracleVerification.deviation * 10_000
          : undefined,
        oracleWarning: oracleVerification?.warning,
        oracleMetadata: oracleVerification?.metadata,
      };

      if (oracleVerification?.metadata) {
        const inputProvider =
          oracleVerification.metadata.input?.providerUsed ?? "n/a";
        const outputProvider =
          oracleVerification.metadata.output?.providerUsed ?? "n/a";
        const divergence =
          oracleVerification.metadata.output?.divergencePercent;
        console.log(
          `    📡 Oracle: input=${inputProvider}, output=${outputProvider}, divergence=${
            divergence ? (divergence * 100).toFixed(3) : "n/a"
          }%`
        );
        if (oracleVerification.warning) {
          console.log(
            `    ⚠️  Oracle warning: ${oracleVerification.warning}`
          );
        }
      }
    } catch (error) {
      result.swapback.error =
        error instanceof Error ? error.message : String(error);
      result.swapback.duration = Date.now() - result.timestamp;
    }

    // Test Jupiter
    try {
      const jupiterStart = Date.now();
      const quote = await this.jupiter.getQuote(inputMint, outputMint, amount);
      const jupiterDuration = Date.now() - jupiterStart;

      result.jupiter = {
        priceIn: Number.parseInt(quote.inAmount, 10),
        priceOut: Number.parseInt(quote.outAmount, 10),
        slippage: Number.parseFloat(quote.priceImpactPct) * 100, // Convert to percentage
        fees: 0, // Jupiter fees are included in the quote
        duration: jupiterDuration,
        success: true,
      };
    } catch (error) {
      result.jupiter.error =
        error instanceof Error ? error.message : String(error);
      result.jupiter.duration = Date.now() - result.timestamp;
    }

    // Calculate improvement
    if (result.swapback.success && result.jupiter.success) {
      const swapbackPrice = result.swapback.priceOut / result.swapback.priceIn;
      const jupiterPrice = result.jupiter.priceOut / result.jupiter.priceIn;
      result.priceImprovement =
        ((swapbackPrice - jupiterPrice) / jupiterPrice) * 10000; // bps

      // Estimate USD savings (rough approximation)
      result.savings =
        (result.swapback.priceOut - result.jupiter.priceOut) *
        this.getUsdValue(outputMint);
    }

    return result;
  }

  private generateReport(stats: BenchmarkStats, metadata: BenchmarkRunMetadata): void {
    console.log("\n" + "=".repeat(80));
    console.log("📊 BENCHMARK REPORT");
    console.log("=".repeat(80));
    console.log(`Started: ${metadata.startedAt}`);
    console.log(`RPC: ${metadata.rpcEndpoint}`);
    if (metadata.gitCommit) {
      console.log(`Git commit: ${metadata.gitCommit}`);
    }

    console.log(`Total test cases: ${this.results.length}`);
    console.log(`Successful comparisons: ${stats.successfulTests}`);
    console.log(`Success rate: ${stats.successRate.toFixed(2)}%`);

    if (stats.successfulTests === 0) {
      console.log("❌ No successful comparisons completed");
      return;
    }

    console.log(
      `Average price improvement: ${stats.avgImprovement.toFixed(2)} bps`
    );
    console.log(
      `Median price improvement: ${stats.medianImprovement.toFixed(2)} bps`
    );
    console.log(
      `95th percentile improvement: ${stats.p95Improvement.toFixed(2)} bps`
    );
    console.log(`Total estimated savings: $${stats.totalSavings.toFixed(2)}`);
    console.log(`Average response time: ${stats.avgDuration.toFixed(0)}ms`);

    if (Object.keys(stats.pairSummaries).length) {
      console.log("\nPer-pair breakdown:");
      for (const [pair, summary] of Object.entries(stats.pairSummaries)) {
        console.log(
          ` - ${pair}: avg ${summary.avgImprovement.toFixed(2)} bps ` +
            `(median ${summary.medianImprovement.toFixed(2)} bps, success ${summary.successRate.toFixed(1)}%, tests ${summary.tests})`
        );
      }
    }
  }

  private calculateStats(results: BenchmarkResult[]): BenchmarkStats {
    if (results.length === 0) {
      return {
        totalTests: this.results.length,
        successfulTests: 0,
        avgImprovement: 0,
        medianImprovement: 0,
        p95Improvement: 0,
        totalSavings: 0,
        avgDuration: 0,
        successRate: 0,
        pairSummaries: {},
      };
    }

    const improvements = [...results]
      .map((r) => r.priceImprovement)
      .sort((a, b) => a - b);
    const durations = results.map((r) =>
      Math.max(r.swapback.duration, r.jupiter.duration)
    );

    const totalPerPair = this.results.reduce<Record<string, number>>(
      (acc, result) => {
        acc[result.pair] = (acc[result.pair] ?? 0) + 1;
        return acc;
      },
      {}
    );

    const groupedByPair = results.reduce<Record<string, BenchmarkResult[]>>(
      (acc, result) => {
        acc[result.pair] = acc[result.pair] || [];
        acc[result.pair].push(result);
        return acc;
      },
      {}
    );

    const pairSummaries: Record<string, PairSummary> = {};
    for (const [pair, pairResults] of Object.entries(groupedByPair)) {
      const pairImprovements = [...pairResults]
        .map((r) => r.priceImprovement)
        .sort((a, b) => a - b);
      const totalTestsForPair = totalPerPair[pair] ?? pairResults.length;
      const avgImprovement =
        pairImprovements.reduce((sum, val) => sum + val, 0) /
        pairImprovements.length;
      const medianImprovement =
        pairImprovements[Math.floor(pairImprovements.length / 2)];
      const p95Improvement = pairImprovements[
        Math.min(
          pairImprovements.length - 1,
          Math.floor(pairImprovements.length * 0.95)
        )
      ];
      const avgSavings =
        pairResults.reduce((sum, r) => sum + r.savings, 0) /
        pairResults.length;
      const successRate = (pairResults.length / totalTestsForPair) * 100;

      pairSummaries[pair] = {
        tests: pairResults.length,
        avgImprovement,
        medianImprovement,
        p95Improvement,
        avgSavings,
        successRate,
      };
    }

    return {
      totalTests: this.results.length,
      successfulTests: results.length,
      avgImprovement:
        improvements.reduce((sum, val) => sum + val, 0) / improvements.length,
      medianImprovement:
        improvements[Math.floor(improvements.length / 2)] ?? 0,
      p95Improvement: improvements[
        Math.min(
          improvements.length - 1,
          Math.floor(improvements.length * 0.95)
        )
      ],
      totalSavings: results.reduce((sum, r) => sum + r.savings, 0),
      avgDuration:
        durations.reduce((sum, val) => sum + val, 0) / durations.length,
      successRate: (results.length / this.results.length) * 100,
      pairSummaries,
    };
  }

  private async safeOracleVerification(
    route: RouteCandidate,
    inputMint: string,
    outputMint: string,
    amount: number
  ): Promise<PriceVerification | undefined> {
    try {
      return await this.oracle.verifyRoutePrice(
        route,
        inputMint,
        outputMint,
        amount
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? "unknown");
      console.warn("    ⚠️  Oracle verification skipped:", message);
      return undefined;
    }
  }

  private saveResultsToFile(
    results: BenchmarkResult[],
    stats: BenchmarkStats,
    metadata: BenchmarkRunMetadata,
    config: BenchmarkRunOptions
  ): void {
    fs.mkdirSync(config.outputDir, { recursive: true });
    const timestamp = metadata.startedAt.replace(/[:.]/g, "-");
    const baseName = `benchmark-${timestamp}`;

    const payload = {
      metadata,
      stats,
      results,
    };

    const resultsPath = path.join(
      config.outputDir,
      `${baseName}-results.json`
    );
    fs.writeFileSync(resultsPath, JSON.stringify(payload, null, 2));

    const summaryPayload = { metadata, stats };
    const statsPath = path.join(
      config.outputDir,
      `${baseName}-summary.json`
    );
    fs.writeFileSync(statsPath, JSON.stringify(summaryPayload, null, 2));
    fs.writeFileSync(
      path.join(config.outputDir, `latest-summary.json`),
      JSON.stringify(summaryPayload, null, 2)
    );

    const csvPath = path.join(
      config.outputDir,
      `${baseName}-results.csv`
    );
    const csvHeader =
      "pair,amount,iteration,swapback_price_out,jupiter_price_out,improvement_bps,savings_usd,swapback_duration,jupiter_duration\n";
    const csvData = results
      .map(
        (r) =>
          `${r.pair},${r.amount},${r.iteration},${r.swapback.priceOut},${r.jupiter.priceOut},${r.priceImprovement},${r.savings},${r.swapback.duration},${r.jupiter.duration}`
      )
      .join("\n");
    fs.writeFileSync(csvPath, csvHeader + csvData);

    console.log(`📄 Detailed results saved to: ${resultsPath}`);
    console.log(`📈 Summary stats saved to: ${statsPath}`);
    console.log(`📊 CSV data saved to: ${csvPath}`);
  }

  private getTokenSymbol(mint: string): string {
    return (
      Object.entries(TOKENS).find(([_, address]) => address === mint)?.[0] ||
      mint.slice(0, 8)
    );
  }

  private formatAmount(amount: number, mint: string): string {
    const decimals = this.getTokenDecimals(mint);
    return (amount / Math.pow(10, decimals)).toFixed(Math.min(4, decimals));
  }

  private getTokenDecimals(mint: string): number {
    // Simplified decimals mapping
    switch (mint) {
      case TOKENS.SOL:
      case TOKENS.mSOL:
        return 9;
      case TOKENS.USDC:
      case TOKENS.USDT:
        return 6;
      case TOKENS.BONK:
        return 5;
      default:
        return 9; // Default to 9 decimals
    }
  }

  private getUsdValue(mint: string): number {
    // Rough USD approximations for devnet/testnet
    switch (mint) {
      case TOKENS.USDC:
      case TOKENS.USDT:
        return 1;
      case TOKENS.SOL:
        return 150; // Rough SOL price
      case TOKENS.BONK:
        return 0.00001; // Rough BONK price
      case TOKENS.mSOL:
        return 145; // Rough mSOL price
      default:
        return 0;
    }
  }

  private resolveTestCases(pairFilter?: string[]): TestCase[] {
    if (!pairFilter?.length) {
      return DEFAULT_TEST_CASES;
    }

    const normalized = new Set(pairFilter.map((pair) => pair.toUpperCase()));
    const filtered = DEFAULT_TEST_CASES.filter((testCase) =>
      normalized.has(testCase.label.toUpperCase())
    );

    if (filtered.length === 0) {
      console.warn("⚠️ Pair filter did not match any test cases, using defaults");
      return DEFAULT_TEST_CASES;
    }

    return filtered;
  }

  private buildMetadata(
    config: BenchmarkRunOptions,
    testCases: TestCase[]
  ): BenchmarkRunMetadata {
    return {
      startedAt: new Date().toISOString(),
      rpcEndpoint: this.connection.rpcEndpoint,
      iterations: config.iterations,
      pairs: testCases.map((tc) => tc.label),
      gitCommit: this.getGitCommit(),
    };
  }

  private getGitCommit(): string | undefined {
    try {
      return execSync("git rev-parse --short HEAD", {
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim();
    } catch (error) {
      return undefined;
    }
  }
}

interface CliOptions extends BenchmarkRunOptions {
  rpcUrl?: string;
}

function parseCliOptions(): CliOptions {
  const options: CliOptions = {
    iterations: Number.parseInt(process.env.ITERATIONS || "5", 10),
    outputDir: process.env.BENCH_OUTPUT_DIR
      ? path.resolve(process.cwd(), process.env.BENCH_OUTPUT_DIR)
      : path.join(process.cwd(), "benchmarks"),
    saveResults: process.env.SAVE_RESULTS !== "false",
    improvementFloorBps: process.env.FAIL_BELOW_BPS
      ? Number.parseFloat(process.env.FAIL_BELOW_BPS)
      : undefined,
    pairFilter: process.env.BENCH_PAIRS
      ? process.env.BENCH_PAIRS.split(",")
          .map((pair) => pair.trim().toUpperCase())
          .filter(Boolean)
      : undefined,
    rpcUrl: process.env.RPC_URL,
  };

  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    printHelpAndExit();
  }

  for (const rawArg of args) {
    if (!rawArg.startsWith("--")) {
      continue;
    }
    const [flag, value] = rawArg.slice(2).split("=");
    switch (flag) {
      case "iterations":
        if (value) options.iterations = Number.parseInt(value, 10);
        break;
      case "rpc":
        options.rpcUrl = value;
        break;
      case "output":
        if (value) options.outputDir = path.resolve(process.cwd(), value);
        break;
      case "pairs":
        if (value) {
          options.pairFilter = value
            .split(",")
            .map((pairValue) => pairValue.trim().toUpperCase())
            .filter(Boolean);
        }
        break;
      case "floor":
        if (value) options.improvementFloorBps = Number.parseFloat(value);
        break;
      case "no-save":
        options.saveResults = false;
        break;
      case "save":
        options.saveResults = value !== "false";
        break;
      default:
        break;
    }
  }

  return options;
}

function printHelpAndExit(): never {
  console.log(`Usage: ts-node bench_ab.ts [options]

Options:
  --iterations=<n>      Number of iterations per test case (default: env ITERATIONS or 5)
  --rpc=<url>           Custom Solana RPC endpoint
  --pairs=a/b,c/d       Filter test pairs by symbol (e.g. SOL/USDC)
  --output=<dir>        Directory to store benchmark artifacts (default: ./benchmarks)
  --floor=<bps>         Minimum average improvement (bps) before exiting with code 1
  --save=<true|false>   Force saving results (default: true)
  --no-save             Disable saving artifacts
  --help                Show this help message
`);
  process.exit(0);
}

// Main execution
async function main() {
  const options = parseCliOptions();
  const benchmark = new SwapBackBenchmark(options.rpcUrl);
  const stats = await benchmark.runBenchmark(options);

  if (typeof options.improvementFloorBps === "number") {
    if (
      stats.successfulTests === 0 ||
      stats.avgImprovement < options.improvementFloorBps
    ) {
      console.error(
        `❌ Average improvement ${stats.avgImprovement.toFixed(
          2
        )} bps is below floor ${options.improvementFloorBps} bps`
      );
      process.exitCode = 1;
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { SwapBackBenchmark };
