/**
 * Bundle Metrics Collector
 * Tracks and analyzes Jito bundle performance
 */

import { PublicKey } from "@solana/web3.js";
import { BundleMetrics } from "../types/smart-router";
import * as fs from "fs";
import * as path from "path";

// ============================================================================
// TYPES
// ============================================================================

export interface BundleSubmission {
  bundleId: string;
  timestamp: number;
  tradeValueUSD: number;
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount: number;
  strategy: "jito" | "quicknode" | "direct";
  tipLamports: number;
  riskLevel: "low" | "medium" | "high";
  eligible: boolean;
  eligibilityReason: string;
  landingTimeMs?: number; // Time from submission to confirmation
  landed: boolean;
  error?: string;
}

export interface MEVSavingsData {
  tradeId: string;
  timestamp: number;
  bundledOutput: number;
  unbundledOutput: number; // Estimated or actual
  savingsAmount: number;
  savingsPercent: number;
  tipCost: number;
  netSavings: number; // savings - tip
}

export interface StrategyStats {
  strategy: string;
  totalSubmissions: number;
  successCount: number;
  successRate: number;
  avgLandingTimeMs: number;
  avgTipLamports: number;
  totalValueUSD: number;
}

export interface MetricsSnapshot {
  timestamp: number;
  timeRangeMs: number; // Duration of data collection
  totalSwaps: number;
  bundledSwaps: number;
  bundleRate: number; // percentage
  strategyStats: StrategyStats[];
  avgBundleLandingTimeMs: number;
  totalMEVSavingsUSD: number;
  jitoSuccessRate: number;
  quicknodeSuccessRate: number;
  totalTipsPaidLamports: number;
  eligibilityStats: {
    totalAnalyzed: number;
    eligible: number;
    ineligible: number;
    eligibilityRate: number;
    eligibilityReasons: Record<string, number>; // reason -> count
  };
}

// ============================================================================
// BUNDLE METRICS COLLECTOR
// ============================================================================

export class BundleMetricsCollector {
  private submissions: BundleSubmission[] = [];
  private mevSavings: MEVSavingsData[] = [];
  private startTime: number;
  private metricsFilePath: string;

  constructor(metricsFilePath?: string) {
    this.startTime = Date.now();
    this.metricsFilePath =
      metricsFilePath || path.join(process.cwd(), "bundle-metrics.json");

    // Try to load existing metrics
    this.loadMetrics();
  }

  // ==========================================================================
  // DATA COLLECTION
  // ==========================================================================

  /**
   * Record a bundle submission
   */
  recordSubmission(submission: BundleSubmission): void {
    this.submissions.push(submission);
    this.saveMetrics();
  }

  /**
   * Record MEV savings data
   */
  recordMEVSavings(savings: MEVSavingsData): void {
    this.mevSavings.push(savings);
    this.saveMetrics();
  }

  /**
   * Update bundle landing status
   */
  updateBundleLanding(
    bundleId: string,
    landed: boolean,
    landingTimeMs?: number,
    error?: string
  ): void {
    const submission = this.submissions.find((s) => s.bundleId === bundleId);
    if (submission) {
      submission.landed = landed;
      submission.landingTimeMs = landingTimeMs;
      submission.error = error;
      this.saveMetrics();
    }
  }

  // ==========================================================================
  // METRICS CALCULATION
  // ==========================================================================

  /**
   * Get current metrics snapshot
   */
  getMetricsSnapshot(): MetricsSnapshot {
    const now = Date.now();
    const timeRangeMs = now - this.startTime;

    const totalSwaps = this.submissions.length;
    const bundledSwaps = this.submissions.filter(
      (s) => s.strategy === "jito" || s.strategy === "quicknode"
    ).length;
    const bundleRate = totalSwaps > 0 ? (bundledSwaps / totalSwaps) * 100 : 0;

    // Strategy stats
    const strategyStats = this.calculateStrategyStats();

    // Landing time
    const landedBundles = this.submissions.filter(
      (s) => s.landed && s.landingTimeMs !== undefined
    );
    const avgBundleLandingTimeMs =
      landedBundles.length > 0
        ? landedBundles.reduce((sum, s) => sum + (s.landingTimeMs || 0), 0) /
          landedBundles.length
        : 0;

    // MEV savings
    const totalMEVSavingsUSD = this.mevSavings.reduce(
      (sum, s) => sum + s.netSavings,
      0
    );

    // Success rates
    const jitoSubmissions = this.submissions.filter(
      (s) => s.strategy === "jito"
    );
    const jitoSuccessCount = jitoSubmissions.filter((s) => s.landed).length;
    const jitoSuccessRate =
      jitoSubmissions.length > 0
        ? (jitoSuccessCount / jitoSubmissions.length) * 100
        : 0;

    const quicknodeSubmissions = this.submissions.filter(
      (s) => s.strategy === "quicknode"
    );
    const quicknodeSuccessCount = quicknodeSubmissions.filter(
      (s) => s.landed
    ).length;
    const quicknodeSuccessRate =
      quicknodeSubmissions.length > 0
        ? (quicknodeSuccessCount / quicknodeSubmissions.length) * 100
        : 0;

    // Tips
    const totalTipsPaidLamports = this.submissions.reduce(
      (sum, s) => sum + s.tipLamports,
      0
    );

    // Eligibility stats
    const eligibilityStats = this.calculateEligibilityStats();

    return {
      timestamp: now,
      timeRangeMs,
      totalSwaps,
      bundledSwaps,
      bundleRate,
      strategyStats,
      avgBundleLandingTimeMs,
      totalMEVSavingsUSD,
      jitoSuccessRate,
      quicknodeSuccessRate,
      totalTipsPaidLamports,
      eligibilityStats,
    };
  }

  /**
   * Calculate per-strategy statistics
   */
  private calculateStrategyStats(): StrategyStats[] {
    const strategies = ["jito", "quicknode", "direct"];
    const stats: StrategyStats[] = [];

    for (const strategy of strategies) {
      const submissions = this.submissions.filter(
        (s) => s.strategy === strategy
      );
      const successCount = submissions.filter((s) => s.landed).length;
      const successRate =
        submissions.length > 0 ? (successCount / submissions.length) * 100 : 0;

      const landedSubmissions = submissions.filter(
        (s) => s.landed && s.landingTimeMs !== undefined
      );
      const avgLandingTimeMs =
        landedSubmissions.length > 0
          ? landedSubmissions.reduce(
              (sum, s) => sum + (s.landingTimeMs || 0),
              0
            ) / landedSubmissions.length
          : 0;

      const avgTipLamports =
        submissions.length > 0
          ? submissions.reduce((sum, s) => sum + s.tipLamports, 0) /
            submissions.length
          : 0;

      const totalValueUSD = submissions.reduce(
        (sum, s) => sum + s.tradeValueUSD,
        0
      );

      stats.push({
        strategy,
        totalSubmissions: submissions.length,
        successCount,
        successRate,
        avgLandingTimeMs,
        avgTipLamports,
        totalValueUSD,
      });
    }

    return stats;
  }

  /**
   * Calculate eligibility statistics
   */
  private calculateEligibilityStats(): MetricsSnapshot["eligibilityStats"] {
    const totalAnalyzed = this.submissions.length;
    const eligible = this.submissions.filter((s) => s.eligible).length;
    const ineligible = totalAnalyzed - eligible;
    const eligibilityRate =
      totalAnalyzed > 0 ? (eligible / totalAnalyzed) * 100 : 0;

    // Count reasons
    const eligibilityReasons: Record<string, number> = {};
    for (const submission of this.submissions) {
      const reason = submission.eligibilityReason;
      eligibilityReasons[reason] = (eligibilityReasons[reason] || 0) + 1;
    }

    return {
      totalAnalyzed,
      eligible,
      ineligible,
      eligibilityRate,
      eligibilityReasons,
    };
  }

  /**
   * Get BundleMetrics interface for smart-router
   */
  getBundleMetrics(): BundleMetrics {
    const snapshot = this.getMetricsSnapshot();

    return {
      totalSwaps: snapshot.totalSwaps,
      bundledSwaps: snapshot.bundledSwaps,
      directSwaps: snapshot.totalSwaps - snapshot.bundledSwaps, // Calculate from existing data
      bundleRate: snapshot.bundleRate,
      avgBundleLandingTimeMs: snapshot.avgBundleLandingTimeMs,
      totalMEVSavingsUSD: snapshot.totalMEVSavingsUSD,
      avgMEVSavingsPercent: 0, // Not available in snapshot
      jitoSuccessRate: snapshot.jitoSuccessRate,
      quicknodeSuccessRate: snapshot.quicknodeSuccessRate,
      directSuccessRate: 100, // Default value
      jitoFailures: 0, // Not available in snapshot
      quicknodeFailures: 0, // Not available in snapshot
      timeouts: 0, // Not available in snapshot
      firstSwapAt: Date.now() - snapshot.timeRangeMs,
      lastSwapAt: snapshot.timestamp,
      periodMs: snapshot.timeRangeMs,
      eligibleSwaps: snapshot.eligibilityStats.eligible,
      ineligibleSwaps: snapshot.eligibilityStats.ineligible,
      eligibilityRate: snapshot.eligibilityStats.eligibilityRate,
      totalTipsPaidLamports: snapshot.totalTipsPaidLamports,
      avgTipPaidLamports:
        snapshot.bundledSwaps > 0
          ? snapshot.totalTipsPaidLamports / snapshot.bundledSwaps
          : 0,
    };
  }

  /**
   * Calculate fallback rate from one strategy to another
   */
  private calculateFallbackRate(
    fromStrategy: string,
    toStrategy: string
  ): number {
    const fromFailures = this.submissions.filter(
      (s) => s.strategy === fromStrategy && !s.landed
    ).length;

    const toAfterFrom = this.submissions.filter(
      (s) => s.strategy === toStrategy && s.timestamp > this.startTime
    ).length;

    // Rough estimate: toAfterFrom / fromFailures
    // In reality, we'd need to track explicit fallback events
    return fromFailures > 0 ? (toAfterFrom / fromFailures) * 100 : 0;
  }

  // ==========================================================================
  // REPORTING
  // ==========================================================================

  /**
   * Generate a human-readable report
   */
  generateReport(): string {
    const snapshot = this.getMetricsSnapshot();
    const durationHours = snapshot.timeRangeMs / (1000 * 60 * 60);

    let report = "";
    report += "=".repeat(70) + "\n";
    report += "📊 BUNDLE METRICS REPORT\n";
    report += "=".repeat(70) + "\n\n";

    report += `Collection Period: ${durationHours.toFixed(2)} hours\n`;
    report += `Generated: ${new Date(snapshot.timestamp).toISOString()}\n\n`;

    // Overview
    report += "OVERVIEW\n";
    report += "-".repeat(70) + "\n";
    report += `Total Swaps:        ${snapshot.totalSwaps}\n`;
    report += `Bundled Swaps:      ${snapshot.bundledSwaps} (${snapshot.bundleRate.toFixed(1)}%)\n`;
    report += `Avg Landing Time:   ${snapshot.avgBundleLandingTimeMs.toFixed(0)}ms\n`;
    report += `Total MEV Savings:  $${snapshot.totalMEVSavingsUSD.toFixed(2)}\n`;
    report += `Total Tips Paid:    ${snapshot.totalTipsPaidLamports} lamports\n\n`;

    // Strategy stats
    report += "STRATEGY PERFORMANCE\n";
    report += "-".repeat(70) + "\n";
    for (const stats of snapshot.strategyStats) {
      if (stats.totalSubmissions === 0) continue;

      report += `\n${stats.strategy.toUpperCase()}\n`;
      report += `  Submissions:       ${stats.totalSubmissions}\n`;
      report += `  Success Rate:      ${stats.successRate.toFixed(1)}%\n`;
      report += `  Avg Landing Time:  ${stats.avgLandingTimeMs.toFixed(0)}ms\n`;
      report += `  Avg Tip:           ${stats.avgTipLamports.toFixed(0)} lamports\n`;
      report += `  Total Value:       $${stats.totalValueUSD.toFixed(2)}\n`;
    }

    // Eligibility stats
    report += "\nELIGIBILITY ANALYSIS\n";
    report += "-".repeat(70) + "\n";
    report += `Total Analyzed:     ${snapshot.eligibilityStats.totalAnalyzed}\n`;
    report += `Eligible:           ${snapshot.eligibilityStats.eligible} (${snapshot.eligibilityStats.eligibilityRate.toFixed(1)}%)\n`;
    report += `Ineligible:         ${snapshot.eligibilityStats.ineligible}\n\n`;

    report += "Top Eligibility Reasons:\n";
    const sortedReasons = Object.entries(
      snapshot.eligibilityStats.eligibilityReasons
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    for (const [reason, count] of sortedReasons) {
      const percent =
        (count / snapshot.eligibilityStats.totalAnalyzed) * 100;
      report += `  - ${reason}: ${count} (${percent.toFixed(1)}%)\n`;
    }

    report += "\n" + "=".repeat(70) + "\n";

    return report;
  }

  /**
   * Print report to console
   */
  printReport(): void {
    console.log(this.generateReport());
  }

  // ==========================================================================
  // PERSISTENCE
  // ==========================================================================

  /**
   * Save metrics to JSON file
   */
  saveMetrics(): void {
    try {
      const data = {
        startTime: this.startTime,
        submissions: this.submissions,
        mevSavings: this.mevSavings,
        snapshot: this.getMetricsSnapshot(),
      };

      fs.writeFileSync(this.metricsFilePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Failed to save metrics:", error);
    }
  }

  /**
   * Load metrics from JSON file
   */
  private loadMetrics(): void {
    try {
      if (fs.existsSync(this.metricsFilePath)) {
        const data = JSON.parse(fs.readFileSync(this.metricsFilePath, "utf-8"));
        this.startTime = data.startTime || Date.now();
        this.submissions = data.submissions || [];
        this.mevSavings = data.mevSavings || [];

        console.log(
          `📊 Loaded ${this.submissions.length} submissions from ${this.metricsFilePath}`
        );
      }
    } catch (error) {
      console.error("Failed to load metrics:", error);
      // Reset to empty state
      this.submissions = [];
      this.mevSavings = [];
    }
  }

  /**
   * Export metrics as JSON
   */
  exportJSON(outputPath: string): void {
    const data = {
      startTime: this.startTime,
      submissions: this.submissions,
      mevSavings: this.mevSavings,
      snapshot: this.getMetricsSnapshot(),
      report: this.generateReport(),
    };

    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`✅ Metrics exported to ${outputPath}`);
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.submissions = [];
    this.mevSavings = [];
    this.startTime = Date.now();
    this.saveMetrics();
  }

  // ==========================================================================
  // QUERY METHODS
  // ==========================================================================

  /**
   * Get recent submissions (last N)
   */
  getRecentSubmissions(count: number): BundleSubmission[] {
    return this.submissions.slice(-count);
  }

  /**
   * Get submissions in time range
   */
  getSubmissionsInRange(
    startTime: number,
    endTime: number
  ): BundleSubmission[] {
    return this.submissions.filter(
      (s) => s.timestamp >= startTime && s.timestamp <= endTime
    );
  }

  /**
   * Get submissions by strategy
   */
  getSubmissionsByStrategy(
    strategy: "jito" | "quicknode" | "direct"
  ): BundleSubmission[] {
    return this.submissions.filter((s) => s.strategy === strategy);
  }

  /**
   * Get failed submissions
   */
  getFailedSubmissions(): BundleSubmission[] {
    return this.submissions.filter((s) => !s.landed || s.error);
  }

  /**
   * Get high-value trades (>= threshold USD)
   */
  getHighValueTrades(thresholdUSD: number): BundleSubmission[] {
    return this.submissions.filter((s) => s.tradeValueUSD >= thresholdUSD);
  }
}
