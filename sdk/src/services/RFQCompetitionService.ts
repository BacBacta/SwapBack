/**
 * RFQ Competition Service
 * Compares quotes from multiple RFQ sources (Jupiter, Metis, private MMs)
 * and selects the best one based on output amount, fees, slippage, and reliability
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { JupiterService } from "./JupiterService";
import { MetisService } from "./MetisService";
import { VenueName } from "../types/smart-router";

export interface CompetitiveQuote {
  source: VenueName | string; // Jupiter, Metis, ou nom du MM privé
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount: number;
  effectivePrice: number; // inputAmount / outputAmount
  priceImpact: number; // Percentage (0-100)
  fees: number; // Total fees in input token
  slippage: number; // Percentage (0-100)
  route?: string[]; // Route if multi-hop
  expiresAt: number; // Unix timestamp in ms
  reliability: number; // Reliability score (0-100)
  metadata?: {
    marketMaker?: string;
    responseTime?: number; // ms
    quotedAt: number;
  };
}

export interface QuoteComparisonResult {
  bestQuote: CompetitiveQuote;
  allQuotes: CompetitiveQuote[];
  comparison: {
    source: string;
    outputAmount: number;
    score: number;
    rank: number;
  }[];
  metadata: {
    totalSources: number;
    successfulSources: number;
    failedSources: string[];
    totalTime: number; // ms
  };
}

interface SourceConfig {
  name: VenueName;
  enabled: boolean;
  timeout: number; // ms
  reliability: number; // Base reliability score (0-100)
  weight: number; // Weight in final scoring (0-1)
}

/**
 * RFQ Competition Service
 * Manages competitive quoting across multiple RFQ sources
 */
export class RFQCompetitionService {
  private connection: Connection;
  private jupiterService: JupiterService;
  private metisService: MetisService;
  private sourceConfigs: Map<VenueName, SourceConfig>;

  // Scoring weights
  private readonly WEIGHT_OUTPUT = 0.70; // 70% weight on output amount
  private readonly WEIGHT_PRICE_IMPACT = 0.15; // 15% weight on price impact
  private readonly WEIGHT_RELIABILITY = 0.10; // 10% weight on reliability
  private readonly WEIGHT_SLIPPAGE = 0.05; // 5% weight on slippage

  constructor(connection: Connection) {
    this.connection = connection;
    this.jupiterService = new JupiterService(connection);
    this.metisService = new MetisService(connection);

    // Initialize source configurations
    this.sourceConfigs = new Map([
      [
        VenueName.JUPITER,
        {
          name: VenueName.JUPITER,
          enabled: true,
          timeout: 2000, // 2s
          reliability: 95, // Very reliable
          weight: 1.0,
        },
      ],
      [
        VenueName.METIS,
        {
          name: VenueName.METIS,
          enabled: true,
          timeout: 3000, // 3s
          reliability: 85, // Good reliability
          weight: 1.0,
        },
      ],
    ]);
  }

  /**
   * Fetch quotes from all enabled sources in parallel
   */
  async fetchAllQuotes(
    inputMint: string,
    outputMint: string,
    amount: number,
    sources?: VenueName[]
  ): Promise<CompetitiveQuote[]> {
    const startTime = Date.now();
    const quotesToFetch = sources || Array.from(this.sourceConfigs.keys());
    const enabledSources = quotesToFetch.filter(
      (source) => this.sourceConfigs.get(source)?.enabled
    );

    console.log(
      `🔍 Fetching quotes from ${enabledSources.length} sources:`,
      enabledSources
    );

    // Fetch all quotes in parallel
    const quotePromises = enabledSources.map((source) =>
      this.fetchQuoteWithTimeout(source, inputMint, outputMint, amount)
    );

    const results = await Promise.allSettled(quotePromises);

    // Extract successful quotes
    const quotes: CompetitiveQuote[] = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value) {
        quotes.push(result.value);
      } else if (result.status === "rejected") {
        console.warn(
          `Quote from ${enabledSources[index]} failed:`,
          result.reason
        );
      }
    });

    const totalTime = Date.now() - startTime;
    console.log(
      `✅ Received ${quotes.length}/${enabledSources.length} quotes in ${totalTime}ms`
    );

    return quotes;
  }

  /**
   * Fetch quote from a specific source with timeout
   */
  private async fetchQuoteWithTimeout(
    source: VenueName,
    inputMint: string,
    outputMint: string,
    amount: number
  ): Promise<CompetitiveQuote | null> {
    const config = this.sourceConfigs.get(source);
    if (!config) {
      console.warn(`No configuration found for source: ${source}`);
      return null;
    }

    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Timeout after ${config.timeout}ms`)),
          config.timeout
        )
      );

      const quotePromise = this.fetchQuoteFromSource(
        source,
        inputMint,
        outputMint,
        amount
      );

      const quote = await Promise.race([quotePromise, timeoutPromise]);

      if (quote) {
        const responseTime = Date.now() - startTime;
        quote.metadata = {
          ...quote.metadata,
          responseTime,
          quotedAt: quote.metadata?.quotedAt || Date.now(),
        };
        console.log(`   ✓ ${source}: ${quote.outputAmount} (${responseTime}ms)`);
      }

      return quote;
    } catch (error) {
      const errorTime = Date.now() - startTime;
      if (error instanceof Error) {
        console.warn(`   ✗ ${source} failed after ${errorTime}ms:`, error.message);
      }
      return null;
    }
  }

  /**
   * Fetch quote from specific source (Jupiter or Metis)
   */
  private async fetchQuoteFromSource(
    source: VenueName,
    inputMint: string,
    outputMint: string,
    amount: number
  ): Promise<CompetitiveQuote | null> {
    const config = this.sourceConfigs.get(source);
    if (!config) return null;

    try {
      if (source === VenueName.JUPITER) {
        const quote = await this.jupiterService.getQuote(
          inputMint,
          outputMint,
          amount,
          50 // 0.5% slippage
        );

        if (!quote) return null;

        return {
          source: VenueName.JUPITER,
          inputMint,
          outputMint,
          inputAmount: Number(quote.inAmount),
          outputAmount: Number(quote.outAmount),
          effectivePrice: Number(quote.inAmount) / Number(quote.outAmount),
          priceImpact: parseFloat(quote.priceImpactPct),
          fees: 0, // Jupiter fees included in output
          slippage: quote.slippageBps / 100,
          route: quote.routePlan.map((step) => step.swapInfo.outputMint.toString()),
          expiresAt: Date.now() + 30000, // 30s validity
          reliability: config.reliability,
          metadata: {
            quotedAt: Date.now(),
          },
        };
      } else if (source === VenueName.METIS) {
        const quote = await this.metisService.getQuote({
          inputMint,
          outputMint,
          amount,
          slippageBps: 50,
        });

        if (!quote) return null;

        return {
          source: VenueName.METIS,
          inputMint,
          outputMint,
          inputAmount: Number(quote.inputAmount),
          outputAmount: Number(quote.outputAmount),
          effectivePrice: Number(quote.inputAmount) / Number(quote.outputAmount),
          priceImpact: quote.priceImpact,
          fees: quote.fees.total,
          slippage: quote.metadata?.slippageBps
            ? quote.metadata.slippageBps / 100
            : 0.5,
          route: quote.route,
          expiresAt: quote.expiresAt,
          reliability: config.reliability,
          metadata: {
            marketMaker: quote.marketMaker,
            quotedAt: Date.now(),
          },
        };
      }

      return null;
    } catch (error) {
      console.error(`Error fetching quote from ${source}:`, error);
      return null;
    }
  }

  /**
   * Get the best quote from multiple competitive quotes
   */
  async getBestQuote(
    quotes: CompetitiveQuote[]
  ): Promise<QuoteComparisonResult | null> {
    if (quotes.length === 0) {
      console.warn("No quotes available for comparison");
      return null;
    }

    console.log(`\n📊 Comparing ${quotes.length} quotes...`);

    // Calculate scores for all quotes
    const scoredQuotes = quotes.map((quote) => ({
      quote,
      score: this.calculateScore(quote, quotes),
    }));

    // Sort by score (highest first)
    scoredQuotes.sort((a, b) => b.score - a.score);

    // Build comparison data
    const comparison = scoredQuotes.map((sq, index) => ({
      source: sq.quote.source,
      outputAmount: sq.quote.outputAmount,
      score: sq.score,
      rank: index + 1,
    }));

    const bestQuote = scoredQuotes[0].quote;

    console.log("🏆 Quote Rankings:");
    comparison.forEach((c) => {
      const emoji = c.rank === 1 ? "🥇" : c.rank === 2 ? "🥈" : "🥉";
      console.log(
        `   ${emoji} ${c.source}: ${c.outputAmount} (score: ${c.score.toFixed(2)})`
      );
    });

    return {
      bestQuote,
      allQuotes: quotes,
      comparison,
      metadata: {
        totalSources: quotes.length,
        successfulSources: quotes.length,
        failedSources: [],
        totalTime: 0,
      },
    };
  }

  /**
   * Calculate score for a quote
   * Score = weighted sum of normalized metrics
   */
  private calculateScore(
    quote: CompetitiveQuote,
    allQuotes: CompetitiveQuote[]
  ): number {
    // Find max output amount for normalization
    const maxOutput = Math.max(...allQuotes.map((q) => q.outputAmount));

    // Normalize output amount (0-100)
    const outputScore = (quote.outputAmount / maxOutput) * 100;

    // Price impact score (lower is better, invert scale)
    const priceImpactScore = Math.max(0, 100 - quote.priceImpact * 10);

    // Reliability score (from config)
    const reliabilityScore = quote.reliability;

    // Slippage score (lower is better, invert scale)
    const slippageScore = Math.max(0, 100 - quote.slippage * 10);

    // Calculate weighted final score
    const finalScore =
      outputScore * this.WEIGHT_OUTPUT +
      priceImpactScore * this.WEIGHT_PRICE_IMPACT +
      reliabilityScore * this.WEIGHT_RELIABILITY +
      slippageScore * this.WEIGHT_SLIPPAGE;

    return finalScore;
  }

  /**
   * Enable or disable a source
   */
  setSourceEnabled(source: VenueName, enabled: boolean): void {
    const config = this.sourceConfigs.get(source);
    if (config) {
      config.enabled = enabled;
      console.log(`${source} ${enabled ? "enabled" : "disabled"}`);
    }
  }

  /**
   * Update source timeout
   */
  setSourceTimeout(source: VenueName, timeoutMs: number): void {
    const config = this.sourceConfigs.get(source);
    if (config) {
      config.timeout = timeoutMs;
      console.log(`${source} timeout updated to ${timeoutMs}ms`);
    }
  }

  /**
   * Update source reliability score
   */
  setSourceReliability(source: VenueName, reliability: number): void {
    const config = this.sourceConfigs.get(source);
    if (config) {
      config.reliability = Math.max(0, Math.min(100, reliability));
      console.log(`${source} reliability updated to ${config.reliability}`);
    }
  }

  /**
   * Get source configuration
   */
  getSourceConfig(source: VenueName): SourceConfig | undefined {
    return this.sourceConfigs.get(source);
  }

  /**
   * Get all source configurations
   */
  getAllSourceConfigs(): Map<VenueName, SourceConfig> {
    return new Map(this.sourceConfigs);
  }
}
