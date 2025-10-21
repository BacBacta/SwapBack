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

import { Connection, PublicKey } from "@solana/web3.js";
import { IntelligentOrderRouter } from "../src/services/IntelligentOrderRouter";
import { JupiterService } from "../src/services/JupiterService";
import { LiquidityDataCollector } from "../src/services/LiquidityDataCollector";
import { RouteOptimizationEngine } from "../src/services/RouteOptimizationEngine";
import { OraclePriceService } from "../src/services/OraclePriceService";
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
}

class SwapBackBenchmark {
  private readonly connection: Connection;
  private readonly router: IntelligentOrderRouter;
  private readonly jupiter: JupiterService;
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
  }

  async runBenchmark(iterations: number = 5): Promise<void> {
    console.log("🚀 Starting SwapBack vs Competitors Benchmark");
    console.log(`📊 Running ${iterations} iterations per test case`);
    console.log(`🔗 RPC: ${this.connection.rpcEndpoint}`);
    console.log("");

    // Test pairs and amounts
    const testCases = [
      { from: TOKENS.SOL, to: TOKENS.USDC, amounts: [1e6, 1e7, 1e8, 1e9] }, // 0.001 to 1 SOL
      { from: TOKENS.USDC, to: TOKENS.USDT, amounts: [1e4, 1e5, 1e6, 1e7] }, // 0.01 to 10 USDC
      { from: TOKENS.SOL, to: TOKENS.BONK, amounts: [1e7, 1e8, 1e9] }, // 0.01 to 1 SOL
      { from: TOKENS.mSOL, to: TOKENS.SOL, amounts: [1e6, 1e7, 1e8] }, // 0.001 to 0.1 mSOL
    ];

    for (const testCase of testCases) {
      for (const amount of testCase.amounts) {
        console.log(
          `\n📈 Testing ${this.getTokenSymbol(testCase.from)} → ${this.getTokenSymbol(testCase.to)} (${this.formatAmount(amount, testCase.from)})`
        );

        for (let i = 0; i < iterations; i++) {
          console.log(`  Iteration ${i + 1}/${iterations}...`);
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

    this.generateReport();
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

      result.swapback = {
        priceIn: amount,
        priceOut: plan.expectedOutput,
        slippage: plan.maxSlippageBps / 100, // Convert to percentage
        fees: 0, // Fees calculation to be implemented
        duration: swapbackDuration,
        success: true,
      };
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

  private generateReport(): void {
    console.log("\n" + "=".repeat(80));
    console.log("📊 BENCHMARK REPORT");
    console.log("=".repeat(80));

    const successfulResults = this.results.filter(
      (r) => r.swapback.success && r.jupiter.success
    );

    if (successfulResults.length === 0) {
      console.log("❌ No successful comparisons completed");
      return;
    }

    const stats = this.calculateStats(successfulResults);

    console.log(`Total test cases: ${this.results.length}`);
    console.log(`Successful comparisons: ${successfulResults.length}`);
    console.log(`Success rate: ${stats.successRate.toFixed(2)}%`);
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

    // Save results if requested
    if (process.env.SAVE_RESULTS !== "false") {
      this.saveResultsToFile(successfulResults, stats);
    }
  }

  private calculateStats(results: BenchmarkResult[]): BenchmarkStats {
    const improvements = results
      .map((r) => r.priceImprovement)
      .sort((a, b) => a - b);
    const durations = results.map((r) =>
      Math.max(r.swapback.duration, r.jupiter.duration)
    );

    return {
      totalTests: this.results.length,
      successfulTests: results.length,
      avgImprovement:
        improvements.reduce((sum, val) => sum + val, 0) / improvements.length,
      medianImprovement: improvements[Math.floor(improvements.length / 2)],
      p95Improvement: improvements[Math.floor(improvements.length * 0.95)],
      totalSavings: results.reduce((sum, r) => sum + r.savings, 0),
      avgDuration:
        durations.reduce((sum, val) => sum + val, 0) / durations.length,
      successRate: (results.length / this.results.length) * 100,
    };
  }

  private saveResultsToFile(
    results: BenchmarkResult[],
    stats: BenchmarkStats
  ): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    // Save detailed results as JSON
    const resultsPath = path.join(
      process.cwd(),
      `benchmark-results-${timestamp}.json`
    );
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`📄 Detailed results saved to: ${resultsPath}`);

    // Save summary stats as JSON
    const statsPath = path.join(
      process.cwd(),
      `benchmark-stats-${timestamp}.json`
    );
    fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    console.log(`📈 Summary stats saved to: ${statsPath}`);

    // Save CSV for easy analysis
    const csvPath = path.join(
      process.cwd(),
      `benchmark-results-${timestamp}.csv`
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
}

// Main execution
async function main() {
  const iterations = Number.parseInt(process.env.ITERATIONS || "5", 10);
  const rpcUrl = process.env.RPC_URL;

  const benchmark = new SwapBackBenchmark(rpcUrl);
  await benchmark.runBenchmark(iterations);
}

if (require.main === module) {
  main().catch(console.error);
}

export { SwapBackBenchmark };
