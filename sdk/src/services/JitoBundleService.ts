/**
 * Anti-MEV Protection with Jito Bundling
 * Protects swaps from sandwich attacks and front-running
 */

import {
  Connection,
  Transaction,
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import bs58 from "bs58";
import {
  JitoBundleConfig,
  JitoBundleResult,
  RouteCandidate,
} from "../types/smart-router";

// ============================================================================
// JITO BUNDLE SERVICE
// ============================================================================

type PriorityLevel = "low" | "medium" | "high";

export interface BundleProtectionOptions {
  tipLamports?: number;
  priorityLevel?: PriorityLevel;
  tradeValueUSD?: number;
  fallbackQuickNode?: boolean;
  quickNodeEndpoint?: string;
  priorityFeeMicroLamports?: number;
  maxRetries?: number;
}

export class JitoBundleService {
  private readonly connection: Connection;
  private readonly jitoBlockEngineUrl: string;
  private readonly defaultTipLamports: number;
  private readonly tipAccounts: PublicKey[];

  constructor(
    connection: Connection,
    jitoBlockEngineUrl = "https://mainnet.block-engine.jito.wtf/api/v1/bundles",
    defaultTipLamports = 10000 // 0.00001 SOL
  ) {
    this.connection = connection;
    this.jitoBlockEngineUrl = jitoBlockEngineUrl;
    this.defaultTipLamports = defaultTipLamports;
    this.tipAccounts = [
      "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
      "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
      "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
      "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
      "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
      "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
      "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
      "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
    ].map((address) => new PublicKey(address));
  }

  pickTipAccount(): PublicKey {
    const index = Math.floor(Math.random() * this.tipAccounts.length);
    return this.tipAccounts[index];
  }

  async submitProtectedBundle(
    transactions: Transaction[],
    options: BundleProtectionOptions = {}
  ): Promise<JitoBundleResult> {
    const priorityLevel = options.priorityLevel ?? "medium";
    const computedTip =
      options.tipLamports ??
      (await this.calculateOptimalTip(priorityLevel, options.tradeValueUSD));

    const submissionConfig: JitoBundleConfig = {
      enabled: true,
      tipLamports: computedTip,
      maxRetries: options.maxRetries ?? 3,
    };

    try {
      const result = await this.submitBundle(transactions, submissionConfig);
      return {
        ...result,
        strategy: "jito",
        tipLamports: computedTip,
        priorityFeeMicroLamports: options.priorityFeeMicroLamports,
      };
    } catch (error) {
      if (!options.fallbackQuickNode) {
        throw error;
      }

      const fallback = await this.submitViaQuickNode(
        transactions,
        options.quickNodeEndpoint,
        options.priorityFeeMicroLamports ?? 0,
        computedTip
      );
      return fallback;
    }
  }

  /**
   * Submit transactions as atomic bundle via Jito
   * Prevents sandwich attacks by ensuring atomic execution
   */
  async submitBundle(
    transactions: Transaction[],
    config?: JitoBundleConfig
  ): Promise<JitoBundleResult> {
    const bundleConfig: JitoBundleConfig = {
      enabled: true,
      tipLamports: this.defaultTipLamports,
      maxRetries: 3,
      ...config,
    };

    if (!bundleConfig.enabled) {
      throw new Error("Jito bundling is disabled");
    }

    try {
      // Add tip instruction to first transaction if tipLamports > 0
      if (bundleConfig.tipLamports > 0 && transactions.length > 0) {
        const tipAccount = this.pickTipAccount();
        const tipInstruction = SystemProgram.transfer({
          fromPubkey:
            transactions[0].feePayer ||
            new PublicKey("11111111111111111111111111111112"), // fallback
          toPubkey: tipAccount,
          lamports: bundleConfig.tipLamports,
        });
        transactions[0].add(tipInstruction);
      }

      // Serialize transactions
      const serializedTxs = transactions.map((tx) => {
        return tx.serialize({ requireAllSignatures: false }).toString("base64");
      });

      // Submit to Jito block engine
      const response = await fetch(this.jitoBlockEngineUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "sendBundle",
          params: [serializedTxs],
        }),
      });

      const result = await response.json();

      if (result.error) {
        throw new Error(
          `Jito bundle submission failed: ${result.error.message}`
        );
      }

      return {
        bundleId: result.result,
        status: "pending",
        signatures: transactions.map((tx) =>
          tx.signature ? bs58.encode(tx.signature) : ""
        ),
        strategy: "jito",
        tipLamports: bundleConfig.tipLamports,
      };
    } catch (error) {
      console.error("Jito bundle submission error:", error);
      throw error;
    }
  }

  private async submitViaQuickNode(
    transactions: Transaction[],
    endpoint?: string,
    priorityFeeMicroLamports = 0,
    tipLamports?: number
  ): Promise<JitoBundleResult> {
    const quickNodeEndpoint = endpoint ?? process.env.QUICKNODE_LILJIT_URL;

    if (!quickNodeEndpoint) {
      throw new Error("QuickNode Lil JIT endpoint not configured");
    }

    const serializedTxs = transactions.map((tx) =>
      tx.serialize({ requireAllSignatures: false }).toString("base64")
    );

    const body = {
      transactions: serializedTxs,
      options: {
        priorityFeeMicroLamports,
        tipLamports,
      },
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (process.env.QUICKNODE_API_KEY) {
      headers.Authorization = `Bearer ${process.env.QUICKNODE_API_KEY}`;
    }

    const response = await fetch(quickNodeEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `QuickNode Lil JIT submission failed: ${response.status} ${response.statusText}`
      );
    }

    let parsed: any = {};
    try {
      parsed = await response.json();
    } catch (error) {
      console.warn("QuickNode response parse failed", error);
    }

    const bundleId =
      parsed?.bundleId ??
      parsed?.result ??
      parsed?.id ??
      `quicknode-${Date.now()}`;

    return {
      bundleId,
      status: "pending",
      signatures: transactions.map((tx) =>
        tx.signature ? bs58.encode(tx.signature) : ""
      ),
      strategy: "quicknode",
      tipLamports,
      priorityFeeMicroLamports,
    };
  }

  /**
   * Check bundle status
   */
  async getBundleStatus(bundleId: string): Promise<JitoBundleResult["status"]> {
    try {
      const response = await fetch(this.jitoBlockEngineUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getBundleStatuses",
          params: [[bundleId]],
        }),
      });

      const result = await response.json();

      if (result.error) {
        return "failed";
      }

      const status = result.result?.value?.[0]?.confirmation_status;

      if (status === "confirmed" || status === "finalized") {
        return "landed";
      }

      return "pending";
    } catch (error) {
      console.error("Bundle status check failed:", error);
      return "failed";
    }
  }

  /**
   * Wait for bundle to land with timeout
   */
  async waitForBundle(
    bundleId: string,
    timeoutMs = 30000
  ): Promise<JitoBundleResult> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getBundleStatus(bundleId);

      if (status === "landed") {
        return {
          bundleId,
          status: "landed",
          signatures: [],
          strategy: "jito",
        };
      }

      if (status === "failed") {
        throw new Error("Bundle failed to land");
      }

      // Wait 500ms before checking again
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error("Bundle timeout");
  }

  /**
   * Calculate optimal tip based on network conditions
   */
  async calculateOptimalTip(
    priorityLevel: PriorityLevel = "medium",
    tradeValueUSD?: number
  ): Promise<number> {
    // Base tips by priority
    const baseTips = {
      low: 5000, // 0.000005 SOL
      medium: 10000, // 0.00001 SOL
      high: 50000, // 0.00005 SOL
    };

    const base = baseTips[priorityLevel];

    if (!tradeValueUSD || tradeValueUSD <= 0) {
      return base;
    }

    const scaled = Math.min(4, Math.max(1, tradeValueUSD / 10000));
    return Math.floor(base * scaled);
  }
}

// ============================================================================
// MEV PROTECTION ANALYZER
// ============================================================================

/**
 * Analyzes routes for MEV risk and recommends protection strategies
 */
export class MEVProtectionAnalyzer {
  /**
   * Assess MEV risk for a route
   */
  assessMEVRisk(route: RouteCandidate): {
    riskLevel: "low" | "medium" | "high";
    vulnerabilities: string[];
    recommendations: string[];
  } {
    const vulnerabilities: string[] = [];
    const recommendations: string[] = [];
    let riskScore = 0;

    // Large trades are more vulnerable
    const isLargeTrade = route.splits.some((s) => s.inputAmount > 10000);
    if (isLargeTrade) {
      riskScore += 30;
      vulnerabilities.push("Large trade size makes it attractive to MEV bots");
      recommendations.push("Consider splitting into smaller trades (TWAP)");
    }

    // AMM-only routes are more vulnerable than CLOB
    const isAMMOnly = route.splits.every(
      (s) => s.liquiditySource.venueType === "amm"
    );
    if (isAMMOnly) {
      riskScore += 25;
      vulnerabilities.push("AMM swaps are predictable and sandwich-able");
      recommendations.push("Use Jito bundling for atomic execution");
    }

    // High slippage indicates vulnerability
    const hasHighSlippage = route.splits.some(
      (s) => s.liquiditySource.slippagePercent > 0.01
    );
    if (hasHighSlippage) {
      riskScore += 20;
      vulnerabilities.push(
        "High slippage tolerance leaves room for sandwich attacks"
      );
      recommendations.push(
        "Tighten slippage tolerance or use smaller trade size"
      );
    }

    // Multi-venue splits are complex
    if (route.venues.length > 1) {
      riskScore += 15;
      vulnerabilities.push("Multi-venue execution increases attack surface");
      recommendations.push("Ensure all instructions are in same bundle");
    }

    // Determine risk level
    let riskLevel: "low" | "medium" | "high";
    if (riskScore < 30) {
      riskLevel = "low";
      recommendations.push("Standard transaction submission is acceptable");
    } else if (riskScore < 60) {
      riskLevel = "medium";
      recommendations.push("Consider Jito bundling for MEV protection");
    } else {
      riskLevel = "high";
      recommendations.push("Strongly recommend Jito bundling + TWAP strategy");
    }

    return {
      riskLevel,
      vulnerabilities,
      recommendations,
    };
  }

  /**
   * Calculate recommended bundle tip based on trade value
   */
  calculateRecommendedTip(tradeValueUSD: number): number {
    // Tip scales with trade value (0.01% of trade)
    const tipUSD = tradeValueUSD * 0.0001;

    // Convert to lamports (assuming SOL = $100)
    const solPrice = 100;
    const tipSOL = tipUSD / solPrice;
    const tipLamports = tipSOL * 1e9;

    // Minimum 5000, maximum 100000 lamports
    return Math.max(5000, Math.min(100000, Math.floor(tipLamports)));
  }

  /**
   * Check if route should use bundling
   */
  shouldUseBundling(route: RouteCandidate, tradeValueUSD: number): boolean {
    const analysis = this.assessMEVRisk(route);

    // Always bundle for high-value trades
    if (tradeValueUSD > 10000) return true;

    // Bundle for medium/high risk
    if (analysis.riskLevel === "high" || analysis.riskLevel === "medium")
      return true;

    // Optional for low risk, small trades
    return false;
  }
}

// ============================================================================
// SANDWICH DETECTION
// ============================================================================

/**
 * Detects potential sandwich attacks in mempool
 */
export class SandwichDetector {
  private readonly connection: Connection;
  private readonly recentTransactions: Map<string, number>;

  constructor(connection: Connection) {
    this.connection = connection;
    this.recentTransactions = new Map();
  }

  /**
   * Check if suspicious activity detected for token pair
   * This is a simplified version - real implementation would monitor mempool
   */
  async detectSuspiciousActivity(
    inputMint: string,
    outputMint: string
  ): Promise<{
    suspicious: boolean;
    reason?: string;
    confidence: number;
  }> {
    // NOTE: A full mempool monitor is not yet integrated.
    // Look for:
    // - Repeated large swaps in same direction
    // - Front-running patterns
    // - Known MEV bot addresses

    // For now, return mock data
    return {
      suspicious: false,
      confidence: 0.95,
    };
  }

  /**
   * Monitor transaction after submission
   */
  async monitorTransaction(
    signature: string,
    timeoutMs = 30000
  ): Promise<{
    sandwiched: boolean;
    frontRunner?: string;
    backRunner?: string;
  }> {
    // NOTE: Post-trade sandwich detection can be plugged in with block data analytics.
    // Compare with transactions in same block

    return {
      sandwiched: false,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create atomic bundle for multi-step swap
 */
export async function createAtomicSwapBundle(
  setupIxs: TransactionInstruction[],
  swapIxs: TransactionInstruction[],
  cleanupIxs: TransactionInstruction[],
  feePayer: PublicKey
): Promise<Transaction[]> {
  const transactions: Transaction[] = [];

  // Combine all instructions into single transaction if possible
  const allIxs = [...setupIxs, ...swapIxs, ...cleanupIxs];

  // Split if too many instructions (max ~20 per tx)
  const maxIxPerTx = 20;
  for (let i = 0; i < allIxs.length; i += maxIxPerTx) {
    const tx = new Transaction();
    tx.feePayer = feePayer;
    tx.add(...allIxs.slice(i, i + maxIxPerTx));
    transactions.push(tx);
  }

  return transactions;
}

/**
 * Estimate MEV loss without protection
 */
export function estimateMEVLoss(
  tradeSize: number,
  slippagePercent: number
): number {
  // Typical sandwich attack captures 50-90% of slippage
  const sandwichCapture = 0.7;
  return tradeSize * slippagePercent * sandwichCapture;
}
