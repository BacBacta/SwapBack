/**
 * Real-time Liquidity Data Collector
 * Fetches current state from DEXs, CLOBs, and aggregators
 */

import { Connection, PublicKey } from "@solana/web3.js";
import {
  VenueName,
  VenueType,
  LiquiditySource,
  AggregatedLiquidity,
  VenueConfig,
  OrderbookSnapshot,
} from "../types/smart-router";
import { PhoenixService } from "./PhoenixService";
import { OpenBookService } from "./OpenBookService";
import { MeteoraService } from "./MeteoraService";
import { LifinityService } from "./LifinityService";
import { ClobTradeDirection } from "./ClobMath";
import { OrcaService } from "./OrcaService";
import { RaydiumService } from "./RaydiumService";
import { StructuredLogger } from "../utils/StructuredLogger";

// ============================================================================
// CONFIGURATION
// ============================================================================

const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1);

const parseCoverageEnv = (
  raw: string | undefined,
  fallback: number
): number => {
  const parsed = raw !== undefined ? Number(raw) : NaN;
  if (Number.isFinite(parsed)) {
    return clamp01(parsed);
  }
  return clamp01(fallback);
};

const DEFAULT_CLOB_TOP_OF_BOOK_COVERAGE = parseCoverageEnv(
  process.env.NEXT_PUBLIC_CLOB_MIN_TOP_OF_BOOK_COVERAGE,
  0.65
);

const PHOENIX_TOP_OF_BOOK_COVERAGE = parseCoverageEnv(
  process.env.NEXT_PUBLIC_PHOENIX_MIN_TOP_OF_BOOK_COVERAGE,
  DEFAULT_CLOB_TOP_OF_BOOK_COVERAGE
);

const OPENBOOK_TOP_OF_BOOK_COVERAGE = parseCoverageEnv(
  process.env.NEXT_PUBLIC_OPENBOOK_MIN_TOP_OF_BOOK_COVERAGE,
  DEFAULT_CLOB_TOP_OF_BOOK_COVERAGE
);

const VENUE_CONFIGS: Record<VenueName, VenueConfig> = {
  // CLOBs - Highest priority (best execution)
  [VenueName.PHOENIX]: {
    name: VenueName.PHOENIX,
    type: VenueType.CLOB,
    enabled: true,
    priority: 100,
    feeRate: 0.0005, // 0.05% taker fee
    minTradeSize: 10,
    maxSlippage: 0.001,
    minTopOfBookCoverage: PHOENIX_TOP_OF_BOOK_COVERAGE,
  },
  [VenueName.OPENBOOK]: {
    name: VenueName.OPENBOOK,
    type: VenueType.CLOB,
    enabled: true,
    priority: 95,
    feeRate: 0.0004,
    minTradeSize: 10,
    maxSlippage: 0.001,
    minTopOfBookCoverage: OPENBOOK_TOP_OF_BOOK_COVERAGE,
  },

  // AMMs - Medium priority
  [VenueName.ORCA]: {
    name: VenueName.ORCA,
    type: VenueType.AMM,
    enabled: true,
    priority: 80,
    feeRate: 0.003, // 0.3%
    minTradeSize: 1,
    maxSlippage: 0.01,
  },
  [VenueName.RAYDIUM]: {
    name: VenueName.RAYDIUM,
    type: VenueType.AMM,
    enabled: true,
    priority: 75,
    feeRate: 0.0025,
    minTradeSize: 1,
    maxSlippage: 0.01,
  },
  [VenueName.METEORA]: {
    name: VenueName.METEORA,
    type: VenueType.AMM,
    enabled:
      (process.env.NEXT_PUBLIC_ENABLE_METEORA ?? "true").toLowerCase() !==
      "false",
    priority: 70,
    feeRate: 0.002,
    minTradeSize: 1,
    maxSlippage: 0.01,
  },
  [VenueName.LIFINITY]: {
    name: VenueName.LIFINITY,
    type: VenueType.AMM,
    enabled:
      (process.env.NEXT_PUBLIC_ENABLE_LIFINITY ?? "true").toLowerCase() !==
      "false",
    priority: 65,
    feeRate: 0.001, // Variable fee
    minTradeSize: 1,
    maxSlippage: 0.02,
  },

  // Aggregators - Lower priority (use as fallback)
  [VenueName.JUPITER]: {
    name: VenueName.JUPITER,
    type: VenueType.RFQ,
    enabled: true,
    priority: 50,
    feeRate: 0.0,
    minTradeSize: 1,
    maxSlippage: 0.02,
  },
  [VenueName.METIS]: {
    name: VenueName.METIS,
    type: VenueType.RFQ,
    enabled: true,
    priority: 45,
    feeRate: 0.0,
    minTradeSize: 1,
    maxSlippage: 0.02,
  },
};

const CLOB_FAILURE_THRESHOLD = Number(
  process.env.NEXT_PUBLIC_CLOB_FAILURE_THRESHOLD ?? 3
);
const CLOB_FAILURE_COOLDOWN_MS = Number(
  process.env.NEXT_PUBLIC_CLOB_FAILURE_COOLDOWN_MS ?? 30000
);
const PRICE_SORT_EPSILON = 1e-9;

type ClobHealthState = {
  consecutiveFailures: number;
  lastFailure: number;
};

// ============================================================================
// LIQUIDITY DATA COLLECTOR
// ============================================================================

export class LiquidityDataCollector {
  private connection: Connection;
  private cache: Map<string, AggregatedLiquidity>;
  private cacheExpiryMs: number;
  private phoenixService: PhoenixService;
  private openBookService: OpenBookService;
  private meteoraService: MeteoraService;
  private lifinityService: LifinityService;
  private orcaService: OrcaService;
  private raydiumService: RaydiumService;
  private clobHealth: Partial<Record<VenueName, ClobHealthState>>;
  private logger: StructuredLogger;

  constructor(connection: Connection, cacheExpiryMs = 10000) {
    this.connection = connection;
    this.cache = new Map();
    this.cacheExpiryMs = cacheExpiryMs;
    this.phoenixService = new PhoenixService(connection);
    this.openBookService = new OpenBookService(connection);
    this.meteoraService = new MeteoraService(connection);
    this.lifinityService = new LifinityService(connection);
    this.orcaService = new OrcaService(connection);
    this.raydiumService = new RaydiumService(connection);
    this.clobHealth = {};
    this.logger = new StructuredLogger("liquidity");
  }

  /**
   * Fetch aggregated liquidity for a token pair from all venues
   */
  async fetchAggregatedLiquidity(
    inputMint: string,
    outputMint: string,
    inputAmount: number,
    enabledVenues?: VenueName[]
  ): Promise<AggregatedLiquidity> {
    const cacheKey = `${inputMint}-${outputMint}-${inputAmount}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < this.cacheExpiryMs) {
      return {
        ...cached,
        staleness: Date.now() - cached.fetchedAt,
      };
    }

    // Fetch from all enabled venues in parallel
    const venuePromises = Object.values(VenueName)
      .filter((venue) => {
        const config = VENUE_CONFIGS[venue];
        if (!config.enabled) return false;
        if (enabledVenues && !enabledVenues.includes(venue)) return false;
        return true;
      })
      .map((venue) =>
        this.fetchVenueLiquidity(venue, inputMint, outputMint, inputAmount)
      );

    const normalizedSources = (await Promise.allSettled(venuePromises))
      .filter(
        (result): result is PromiseFulfilledResult<LiquiditySource> =>
          result.status === "fulfilled" && result.value !== null
      )
      .map((result) =>
        this.normalizeClobSource(result.value, inputMint, outputMint)
      );

    const sources = normalizedSources.sort((a, b) =>
      this.compareLiquiditySources(a, b)
    );

    // Calculate total depth
    const totalDepth = sources.reduce((sum, s) => sum + s.depth, 0);

    // Find best single venue
    const bestSingleVenue = sources[0]?.venue || VenueName.ORCA;

    const aggregated: AggregatedLiquidity = {
      tokenPair: [inputMint, outputMint],
      totalDepth,
      sources,
      bestSingleVenue,
      bestCombinedRoute: null, // Will be calculated by optimizer
      fetchedAt: Date.now(),
      staleness: 0,
    };

    // Cache result
    this.cache.set(cacheKey, aggregated);

    return aggregated;
  }

  /**
   * Fetch liquidity data from a specific venue
   */
  private async fetchVenueLiquidity(
    venue: VenueName,
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): Promise<LiquiditySource | null> {
    const config = VENUE_CONFIGS[venue];

    try {
      switch (config.type) {
        case VenueType.CLOB:
          return await this.fetchCLOBLiquidity(
            venue,
            inputMint,
            outputMint,
            inputAmount
          );

        case VenueType.AMM:
          return await this.fetchAMMLiquidity(
            venue,
            inputMint,
            outputMint,
            inputAmount
          );

        case VenueType.RFQ:
          return await this.fetchRFQLiquidity(
            venue,
            inputMint,
            outputMint,
            inputAmount
          );

        default:
          return null;
      }
    } catch (error) {
      console.warn(`Failed to fetch liquidity from ${venue}:`, error);
      return null;
    }
  }

  /**
   * Fetch CLOB (Phoenix, OpenBook) liquidity
   * Check top-of-book for immediate execution
   */
  private async fetchCLOBLiquidity(
    venue: VenueName,
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): Promise<LiquiditySource | null> {
    if (!this.isClobHealthy(venue)) {
      console.warn("[liquidity][clob] skip_unhealthy", { venue });
      return null;
    }

    if (venue === VenueName.PHOENIX) {
      const result = await this.withClobHealth(venue, () =>
        this.phoenixService.fetchLiquidity(inputMint, outputMint, inputAmount)
      );
      return this.postProcessClobSource(venue, result, inputAmount);
    }

    if (venue === VenueName.OPENBOOK) {
      const result = await this.withClobHealth(venue, () =>
        this.openBookService.fetchLiquidity(inputMint, outputMint, inputAmount)
      );
      return this.postProcessClobSource(venue, result, inputAmount);
    }

    console.warn(`CLOB venue ${venue} not yet implemented`);
    return null;
  }

  private postProcessClobSource(
    venue: VenueName,
    source: LiquiditySource | null,
    inputAmount: number
  ): LiquiditySource | null {
    if (!source) {
      return null;
    }

    this.emitClobMetrics(venue, source);

    const coverage = this.evaluateTopOfBookCoverage(
      venue,
      source,
      inputAmount
    );

    if (!coverage.passes) {
      this.logger.warn("clob_skip_insufficient_top_of_book", {
        venue,
        inputAmount,
        direction: coverage.direction,
        coverageShare: coverage.coverageShare,
        requiredCoverage: coverage.minCoverage,
        topOfBook: coverage.top ?? null,
      });
      return null;
    }

    return source;
  }

  private emitClobMetrics(venue: VenueName, source: LiquiditySource): void {
    if (source.venueType !== VenueType.CLOB) {
      return;
    }

    const top = this.resolveTopOfBook(source);
    const snapshot = source.orderbook;
    const metadata = { ...(source.metadata ?? {}) } as Record<string, unknown>;
    const minCoverage = this.getVenueConfig(venue).minTopOfBookCoverage ?? 0;
    const latencyMs =
      typeof snapshot?.latencyMs === "number"
        ? snapshot.latencyMs
        : typeof metadata.latencyMs === "number"
          ? (metadata.latencyMs as number)
          : undefined;

    this.logger.info("clob_metrics", {
      venue,
      direction: this.extractClobDirection(source),
      depthUsd: snapshot?.depthUsd ?? source.depth,
      spreadBps: snapshot?.spreadBps ?? null,
      latencyMs: latencyMs ?? null,
      bestBid: top?.bidPrice ?? null,
      bidSize: top?.bidSize ?? null,
      bestAsk: top?.askPrice ?? null,
      askSize: top?.askSize ?? null,
      dataFreshnessMs: source.dataFreshnessMs ?? null,
      exhausted: Boolean(metadata.exhausted),
      minCoverage,
    });
  }

  private evaluateTopOfBookCoverage(
    venue: VenueName,
    source: LiquiditySource,
    inputAmount: number
  ): {
    passes: boolean;
    coverageShare: number;
    minCoverage: number;
    direction: ClobTradeDirection;
    top?: LiquiditySource["topOfBook"];
  } {
    const minCoverage = this.getVenueConfig(venue).minTopOfBookCoverage ?? 0;
    const direction = this.extractClobDirection(source);
    const top = this.resolveTopOfBook(source);

    if (inputAmount <= 0 || minCoverage <= 0) {
      return { passes: true, coverageShare: 1, minCoverage, direction, top };
    }

    if (!top) {
      return { passes: false, coverageShare: 0, minCoverage, direction };
    }

    const coverageShare = this.getTopOfBookCoverageShare(
      top,
      direction,
      inputAmount
    );

    return {
      passes: coverageShare >= minCoverage,
      coverageShare,
      minCoverage,
      direction,
      top,
    };
  }

  private getTopOfBookCoverageShare(
    top: NonNullable<LiquiditySource["topOfBook"]>,
    direction: ClobTradeDirection,
    inputAmount: number
  ): number {
    if (inputAmount <= 0) {
      return 1;
    }

    if (direction === "sellBase") {
      return top.bidSize / inputAmount;
    }

    if (top.askPrice <= 0) {
      return 0;
    }

    const quoteCapacity = top.askSize * top.askPrice;
    return quoteCapacity / inputAmount;
  }

  private resolveTopOfBook(
    source: LiquiditySource
  ): LiquiditySource["topOfBook"] | undefined {
    if (source.topOfBook) {
      return source.topOfBook;
    }

    const snapshot: OrderbookSnapshot | undefined = source.orderbook;
    if (!snapshot) {
      return undefined;
    }

    const bestBid = snapshot.bids[0];
    const bestAsk = snapshot.asks[0];

    if (!bestBid && !bestAsk) {
      return undefined;
    }

    return {
      bidPrice: bestBid?.price ?? 0,
      bidSize: bestBid?.size ?? 0,
      askPrice: bestAsk?.price ?? 0,
      askSize: bestAsk?.size ?? 0,
    };
  }

  private extractClobDirection(source: LiquiditySource): ClobTradeDirection {
    const metadata = { ...(source.metadata ?? {}) } as Record<string, unknown>;
    return (
      (metadata.direction as ClobTradeDirection | undefined) ??
      this.deriveClobDirection(metadata)
    );
  }

  /**
   * Fetch AMM (Orca, Raydium) liquidity
   * Calculate based on xy=k formula with fees
   */
  private async fetchAMMLiquidity(
    venue: VenueName,
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): Promise<LiquiditySource | null> {
    const config = VENUE_CONFIGS[venue];

    // Orca Whirlpools integration
    if (venue === VenueName.ORCA) {
      return this.orcaService.fetchLiquidity(inputMint, outputMint, inputAmount);
    }

    if (venue === VenueName.RAYDIUM) {
      return this.raydiumService.fetchLiquidity(
        inputMint,
        outputMint,
        inputAmount
      );
    }

    if (venue === VenueName.METEORA) {
      return this.meteoraService.fetchLiquidity(
        inputMint,
        outputMint,
        inputAmount
      );
    }

    if (venue === VenueName.LIFINITY) {
      return this.lifinityService.fetchLiquidity(
        inputMint,
        outputMint,
        inputAmount
      );
    }

    // Fallback mock data for other AMMs
    const reserves = {
      input: 1000000,
      output: 500000,
    };

    const inputWithFee = inputAmount * (1 - config.feeRate);
    const outputAmount =
      (reserves.output * inputWithFee) / (reserves.input + inputWithFee);

    const effectivePrice = outputAmount / inputAmount;
    const slippagePercent = 0.01; // Placeholder until venue-specific logic exists

    return {
      venue,
      venueType: VenueType.AMM,
      tokenPair: [inputMint, outputMint],
      depth: Math.min(reserves.input, reserves.output) * 2,
      reserves,
      effectivePrice,
      feeAmount: inputAmount - inputWithFee,
      slippagePercent,
      route: [inputMint, outputMint],
      timestamp: Date.now(),
      metadata: {
        placeholder: true,
      },
    };
  }

  /**
   * Fetch RFQ (Jupiter, Metis) quote
   * These are aggregators that already do routing
   */
  private async fetchRFQLiquidity(
    venue: VenueName,
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): Promise<LiquiditySource | null> {
    // Jupiter v6 API integration
    if (venue === VenueName.JUPITER) {
      try {
        return await this.fetchJupiterQuote(inputMint, outputMint, inputAmount);
      } catch (error) {
        console.error("Jupiter API error:", error);
        return null;
      }
    }

    // For other RFQ venues (Metis, etc), return null for now
    // TODO: Implement Metis and other aggregator APIs
    console.warn(`RFQ venue ${venue} not yet implemented`);
    return null;
  }

  /**
   * Fetch quote from Jupiter v6 API
   * @see https://station.jup.ag/docs/apis/swap-api
   */
  private async fetchJupiterQuote(
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): Promise<LiquiditySource | null> {
    try {
      // Convert amount to lamports/smallest unit (assuming 9 decimals for SOL)
      // In production, look up actual token decimals
      const amountInSmallestUnit = Math.floor(inputAmount * 1e9);

      // Jupiter v6 Quote API
      const url = new URL("https://quote-api.jup.ag/v6/quote");
      url.searchParams.append("inputMint", inputMint);
      url.searchParams.append("outputMint", outputMint);
      url.searchParams.append("amount", amountInSmallestUnit.toString());
      url.searchParams.append("slippageBps", "50"); // 0.5% slippage
      url.searchParams.append("onlyDirectRoutes", "false"); // Allow multi-hop

      const response = await fetch(url.toString());

      if (!response.ok) {
        console.warn(
          `Jupiter API returned ${response.status}: ${response.statusText}`
        );
        return null;
      }

      type JupiterRouteStep = {
        swapInfo?: {
          label?: string;
          outputMint?: string;
        };
      };

      type JupiterQuoteResponse = {
        inAmount?: string;
        outAmount?: string;
        priceImpactPct?: number | string;
        routePlan?: JupiterRouteStep[];
      };

      const data = (await response.json()) as JupiterQuoteResponse;

      if (!data || !data.outAmount) {
        console.warn("Invalid Jupiter quote response:", data);
        return null;
      }

      // Parse Jupiter response
      const outputAmount = Number(data.outAmount) / 1e9; // Convert back to UI units
      const priceImpactPct = Number(data.priceImpactPct ?? 0);
      const routePlan = data.routePlan ?? [];

      // Extract route from Jupiter's route plan
      const route: string[] = [inputMint];
      for (const step of routePlan) {
        if (step.swapInfo?.outputMint) {
          route.push(step.swapInfo.outputMint);
        }
      }
      if (route[route.length - 1] !== outputMint) {
        route.push(outputMint);
      }

      // Calculate effective price
      const effectivePrice = inputAmount / outputAmount;

      // Jupiter fees are included in the quote
      const feeAmount = inputAmount - inputAmount / effectivePrice;

      return {
        venue: VenueName.JUPITER,
        venueType: VenueType.RFQ,
        tokenPair: [inputMint, outputMint],
        depth: outputAmount * 10, // Jupiter has deep aggregated liquidity
        effectivePrice,
        feeAmount,
        slippagePercent: priceImpactPct / 100,
        route,
        timestamp: Date.now(),
        // Store raw Jupiter data for reference
        metadata: {
          jupiterQuote: {
            inAmount: data.inAmount,
            outAmount: data.outAmount,
            priceImpactPct: data.priceImpactPct,
            marketInfos: routePlan
              .map((r) => r.swapInfo?.label)
              .filter(Boolean),
          },
        },
      };
    } catch (error) {
      console.error("Jupiter quote fetch error:", error);
      return null;
    }
  }

  /**
   * Clear cache (useful for forcing refresh)
   */
  clearCache(): void {
    this.cache.clear();
  }

  private async withClobHealth(
    venue: VenueName,
    fn: () => Promise<LiquiditySource | null>
  ): Promise<LiquiditySource | null> {
    try {
      const result = await fn();
      this.markClobOutcome(venue, !!result);
      return result;
    } catch (error) {
      this.markClobOutcome(venue, false, error);
      throw error;
    }
  }

  private isClobHealthy(venue: VenueName): boolean {
    if (VENUE_CONFIGS[venue].type !== VenueType.CLOB) {
      return true;
    }

    const state = this.clobHealth[venue];
    if (!state || state.consecutiveFailures < CLOB_FAILURE_THRESHOLD) {
      return true;
    }

    return Date.now() - state.lastFailure >= CLOB_FAILURE_COOLDOWN_MS;
  }

  private markClobOutcome(
    venue: VenueName,
    success: boolean,
    error?: unknown
  ): void {
    if (VENUE_CONFIGS[venue].type !== VenueType.CLOB) {
      return;
    }

    if (success) {
      this.clobHealth[venue] = { consecutiveFailures: 0, lastFailure: 0 };
      return;
    }

    const prev = this.clobHealth[venue] || {
      consecutiveFailures: 0,
      lastFailure: 0,
    };

    const consecutiveFailures = prev.consecutiveFailures + 1;
    this.clobHealth[venue] = {
      consecutiveFailures,
      lastFailure: Date.now(),
    };

    console.warn("[liquidity][clob] venue_failure", {
      venue,
      consecutiveFailures,
      error: error instanceof Error ? error.message : error,
    });
  }

  /**
   * Get venue configuration
   */
  getVenueConfig(venue: VenueName): VenueConfig {
    return VENUE_CONFIGS[venue];
  }

  /**
   * Get all enabled venues sorted by priority
   */
  getEnabledVenues(): VenueName[] {
    return Object.values(VenueName)
      .filter((venue) => VENUE_CONFIGS[venue].enabled)
      .sort((a, b) => VENUE_CONFIGS[b].priority - VENUE_CONFIGS[a].priority);
  }

  private normalizeClobSource(
    source: LiquiditySource,
    inputMint: string,
    outputMint: string
  ): LiquiditySource {
    if (!source || source.venueType !== VenueType.CLOB) {
      return source;
    }

    const config = this.getVenueConfig(source.venue);
    const metadata = { ...(source.metadata ?? {}) } as Record<string, unknown>;
    const takerFeeBps =
      typeof metadata.takerFeeBps === "number"
        ? (metadata.takerFeeBps as number)
        : config.takerFeeBps ?? Math.round(config.feeRate * 10_000);

    const direction =
      (metadata.direction as ClobTradeDirection | undefined) ??
      this.deriveClobDirection(metadata);

    if (source.orderbook?.latencyMs !== undefined) {
      metadata.latencyMs = source.orderbook.latencyMs;
    } else if (metadata.latencyMs === undefined) {
      metadata.latencyMs = source.dataFreshnessMs ?? 0;
    }

    metadata.takerFeeBps = takerFeeBps;
    metadata.direction = direction;
    metadata.inputMint = metadata.inputMint ?? inputMint;
    metadata.outputMint = metadata.outputMint ?? outputMint;

    return {
      ...source,
      metadata,
    };
  }

  private deriveClobDirection(
    metadata: Record<string, unknown>
  ): ClobTradeDirection {
    if (metadata && typeof metadata.inverted === "boolean") {
      return metadata.inverted ? "sellQuote" : "sellBase";
    }
    return "sellBase";
  }

  private compareLiquiditySources(
    a: LiquiditySource,
    b: LiquiditySource
  ): number {
    const priceDiff = a.effectivePrice - b.effectivePrice;
    if (Math.abs(priceDiff) > PRICE_SORT_EPSILON) {
      return priceDiff;
    }

    const priorityDiff =
      this.getVenueConfig(b.venue).priority -
      this.getVenueConfig(a.venue).priority;
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return a.timestamp - b.timestamp;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate price impact for AMM swap
 */
export function calculatePriceImpact(
  inputAmount: number,
  reserveIn: number,
  reserveOut: number,
  feeRate: number
): number {
  const spotPrice = reserveOut / reserveIn;
  const inputWithFee = inputAmount * (1 - feeRate);
  const outputAmount = (reserveOut * inputWithFee) / (reserveIn + inputWithFee);
  const effectivePrice = inputAmount / outputAmount;

  return (effectivePrice - spotPrice) / spotPrice;
}

/**
 * Estimate output amount for AMM swap
 */
export function estimateAMMOutput(
  inputAmount: number,
  reserveIn: number,
  reserveOut: number,
  feeRate: number
): number {
  const inputWithFee = inputAmount * (1 - feeRate);
  return (reserveOut * inputWithFee) / (reserveIn + inputWithFee);
}

/**
 * Check if liquidity source is stale
 */
export function isLiquidityStale(
  source: LiquiditySource,
  maxAgeMs = 10000
): boolean {
  return Date.now() - source.timestamp > maxAgeMs;
}
