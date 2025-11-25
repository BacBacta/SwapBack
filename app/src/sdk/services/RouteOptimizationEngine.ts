/**
 * Route Optimization Engine
 * Implements greedy allocation algorithm to find best execution path
 */

import {
  RouteCandidate,
  RouteSplit,
  OptimizationConfig,
  LiquiditySource,
  VenueName,
  VenueType,
  RoutingStrategyMetadata,
} from "../types/smart-router";
import { LiquidityDataCollector } from "./LiquidityDataCollector";
import { OraclePriceService } from "./OraclePriceService";
import { StructuredLogger } from "../utils/StructuredLogger";
import { simulateClobFill, ClobTradeDirection } from "./ClobMath";

const PRICE_SORT_EPSILON = 1e-9;
const ROUTE_SORT_EPSILON = 1e-9;

// ============================================================================
// OPTIMIZATION ENGINE
// ============================================================================

export class RouteOptimizationEngine {
  private readonly liquidityCollector: LiquidityDataCollector;
  private readonly oracleService: OraclePriceService;
  private readonly defaultConfig: OptimizationConfig;
  private readonly logger: StructuredLogger;

  constructor(
    liquidityCollector: LiquidityDataCollector,
    oracleService: OraclePriceService
  ) {
    this.liquidityCollector = liquidityCollector;
    this.oracleService = oracleService;
    this.logger = new StructuredLogger("route-engine");

    this.defaultConfig = {
      slippageTolerance: 0.01, // 1%
      maxRoutes: 3,
      prioritizeCLOB: true,
      maxHops: 3,
      enableSplitRoutes: true,
      maxSplits: 3,
      useBundling: true,
      maxPriorityFee: 100000, // 0.0001 SOL
      enableTWAP: false,
      enableFallback: true,
      maxRetries: 2,
    };
  }

  /**
   * Find optimal route(s) for a swap
   * Implements multi-step optimization:
   * 1. Fetch liquidity from all venues
   * 2. Generate route candidates (single venue, splits, multi-hop)
   * 3. Sort by cost (greedy allocation)
   * 4. Return top N routes
   */
  async findOptimalRoutes(
    inputMint: string,
    outputMint: string,
    inputAmount: number,
    userConfig?: Partial<OptimizationConfig>
  ): Promise<RouteCandidate[]> {
    const config: OptimizationConfig = { ...this.defaultConfig, ...userConfig };

    // Step 1: Fetch aggregated liquidity
    const liquidity = await this.liquidityCollector.fetchAggregatedLiquidity(
      inputMint,
      outputMint,
      inputAmount,
      config.allowedVenues
    );

    // Step 2: Filter sources
    let sources = liquidity.sources;

    // Exclude venues if specified
    if (config.excludedVenues) {
      sources = sources.filter(
        (s) => !config.excludedVenues!.includes(s.venue)
      );
    }

    // Filter by slippage tolerance
    sources = sources.filter(
      (s) => s.slippagePercent <= config.slippageTolerance
    );

    sources =
      config.prioritizeCLOB && sources.length > 1
        ? this.applyClobPreference(sources)
        : sources;

    if (sources.length === 0) {
      throw new Error(
        "No viable liquidity sources found within slippage tolerance"
      );
    }

    // Step 3: Generate route candidates
    const candidates: RouteCandidate[] = [];

    // 3a. Single venue routes (simplest, lowest gas)
    for (const source of sources) {
      const candidate = this.createSingleVenueRoute(
        source,
        inputAmount,
        config
      );
      if (candidate) candidates.push(candidate);
    }

    // 3b. Split routes (if enabled)
    if (config.enableSplitRoutes && sources.length > 1) {
      const splitCandidates = await this.createSplitRoutes(
        sources,
        inputAmount,
        inputMint,
        outputMint,
        config
      );
      candidates.push(...splitCandidates);
    }

    // 3c. Multi-hop routes (TODO: implement for complex pairs)
    // For now, skip if no direct liquidity

    // Step 4: Calculate costs and rank
    for (const candidate of candidates) {
      this.calculateTotalCost(candidate, config);
      this.assessRisk(candidate);
    }

    // Step 5: Sort by expected output, honoring CLOB bias if requested
    this.rankCandidates(candidates, config);

    // Step 5.1: Enrich candidates with routing strategy metadata
    for (const candidate of candidates) {
      candidate.strategy = this.buildStrategyMetadata(
        candidate,
        inputAmount,
        config
      );
    }

    // Step 5.2: Generate fallback plans if enabled
    if (config.enableFallback && candidates.length > 1) {
      this.enrichWithFallbackPlans(candidates);
    }

    const diagnostics = this.buildRoutingDiagnostics(
      inputMint,
      outputMint,
      inputAmount,
      candidates,
      config
    );
    this.logger.info("routes_ranked", diagnostics);

    // Step 6: Return top N
    return candidates.slice(0, config.maxRoutes || 3);
  }

  /**
   * Create route using single venue
   */
  private createSingleVenueRoute(
    source: LiquiditySource,
    inputAmount: number,
    config: OptimizationConfig
  ): RouteCandidate | null {
    // Calculate expected output
    const expectedOutput = this.calculateExpectedOutput(source, inputAmount);

    // Check min output if specified
    if (config.minOutputAmount && expectedOutput < config.minOutputAmount) {
      return null;
    }

    const split: RouteSplit = {
      venue: source.venue,
      weight: 100,
      inputAmount,
      expectedOutput,
      liquiditySource: source,
    };

    return {
      id: `single-${source.venue}-${Date.now()}`,
      venues: [source.venue],
      path: source.route,
      hops: 1,
      splits: [split],
      expectedOutput,
      totalCost: 0, // Will be calculated
      effectiveRate: expectedOutput / inputAmount,
      riskScore: 0, // Will be assessed
      mevRisk: "low",
      instructions: [], // Will be built later
      estimatedComputeUnits: this.estimateComputeUnits(source.venueType, 1),
    };
  }

  /**
   * Create split routes across multiple venues
   * Uses dynamic weight calculation based on oracle data
   */
  private async createSplitRoutes(
    sources: LiquiditySource[],
    inputAmount: number,
    inputMint: string,
    outputMint: string,
    config: OptimizationConfig
  ): Promise<RouteCandidate[]> {
    const candidates: RouteCandidate[] = [];
    const maxSplits = Math.min(config.maxSplits, sources.length);

    // Try different split configurations (2-way, 3-way, etc.)
    for (let numSplits = 2; numSplits <= maxSplits; numSplits++) {
      const topSources = sources.slice(0, numSplits);

      // Calculate dynamic weights for these sources
      const { weights } = await this.calculateDynamicWeights(
        topSources,
        inputMint,
        outputMint,
        inputAmount
      );

      const splits = this.optimizeSplitAllocationWithWeights(
        topSources,
        inputAmount,
        weights
      );

      if (splits.length === 0) continue;

      // Validate weights sum to 100
      const totalWeight = splits.reduce((sum, s) => sum + s.weight, 0);
      if (Math.abs(totalWeight - 100) > 0.01) {
        console.warn(
          `Warning: Split weights sum to ${totalWeight}, adjusting...`
        );
        // Normalize weights to sum to 100
        for (const split of splits) {
          split.weight = (split.weight / totalWeight) * 100;
        }
      }

      const totalOutput = splits.reduce((sum, s) => sum + s.expectedOutput, 0);
      const venues = splits.map((s) => s.venue);

      candidates.push({
        id: `split-${numSplits}-${Date.now()}`,
        venues,
        path: [sources[0].tokenPair[0], sources[0].tokenPair[1]],
        hops: numSplits,
        splits,
        expectedOutput: totalOutput,
        totalCost: 0,
        effectiveRate: totalOutput / inputAmount,
        riskScore: 0,
        mevRisk: "medium", // Splits have higher MEV risk
        instructions: [],
        estimatedComputeUnits: this.estimateComputeUnits(
          VenueType.AMM,
          numSplits
        ),
      });
    }

    return candidates;
  }

  /**
   * Optimize allocation across multiple sources using dynamic weights
   * Weights are pre-calculated based on oracle data and venue characteristics
   */
  private optimizeSplitAllocationWithWeights(
    sources: LiquiditySource[],
    totalInput: number,
    weights: number[]
  ): RouteSplit[] {
    const splits: RouteSplit[] = [];

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      const weight = weights[i];

      // Calculate allocation based on weight
      const allocated = (totalInput * weight) / 100;

      if (allocated < 1) continue; // Skip if too small

      const expectedOutput = this.calculateExpectedOutput(source, allocated);

      splits.push({
        venue: source.venue,
        weight,
        inputAmount: allocated,
        expectedOutput,
        liquiditySource: source,
      });
    }

    return splits;
  }

  private rankCandidates(
    candidates: RouteCandidate[],
    config: OptimizationConfig
  ): void {
    candidates.sort((a, b) => {
      const diff = b.expectedOutput - a.expectedOutput;
      if (Math.abs(diff) > ROUTE_SORT_EPSILON) {
        return diff;
      }

      if (config.prioritizeCLOB) {
        const aUsesClob = this.routeUsesClob(a);
        const bUsesClob = this.routeUsesClob(b);
        if (aUsesClob !== bUsesClob) {
          return aUsesClob ? -1 : 1;
        }
      }

      return 0;
    });
  }

  private routeUsesClob(candidate: RouteCandidate): boolean {
    return candidate.splits.some(
      (split) => split.liquiditySource.venueType === VenueType.CLOB
    );
  }

  private applyClobPreference(
    sources: LiquiditySource[]
  ): LiquiditySource[] {
    return [...sources].sort((a, b) => {
      const priceDiff = a.effectivePrice - b.effectivePrice;
      if (Math.abs(priceDiff) > PRICE_SORT_EPSILON) {
        return priceDiff;
      }

      if (a.venueType !== b.venueType) {
        return a.venueType === VenueType.CLOB ? -1 : 1;
      }

      const priorityDiff =
        this.liquidityCollector.getVenueConfig(b.venue).priority -
        this.liquidityCollector.getVenueConfig(a.venue).priority;
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return a.timestamp - b.timestamp;
    });
  }

  private getTakerFeeBps(venue: VenueName): number {
    const config = this.liquidityCollector.getVenueConfig(venue);
    return config.takerFeeBps ?? Math.round(config.feeRate * 10_000);
  }

  private resolveClobDirection(
    metadata?: Record<string, unknown>
  ): ClobTradeDirection {
    if (metadata && typeof metadata.direction === "string") {
      return metadata.direction as ClobTradeDirection;
    }

    if (metadata && typeof metadata.inverted === "boolean") {
      return metadata.inverted ? "sellQuote" : "sellBase";
    }

    return "sellBase";
  }

  /**
   * Calculate expected output from a liquidity source
   */
  private calculateExpectedOutput(
    source: LiquiditySource,
    inputAmount: number
  ): number {
    if (source.venueType === VenueType.CLOB && source.orderbook) {
      const metadata = source.metadata as Record<string, unknown> | undefined;
      const direction = this.resolveClobDirection(metadata);
      const takerFeeBps =
        (metadata?.takerFeeBps as number | undefined) ??
        this.getTakerFeeBps(source.venue);

      const fill = simulateClobFill({
        direction,
        inputAmount,
        takerFeeBps,
        bids: source.orderbook.bids,
        asks: source.orderbook.asks,
      });

      if (fill) {
        return fill.outputAmount;
      }
    }

    if (source.effectivePrice > 0) {
      return inputAmount / source.effectivePrice;
    }

    if (source.venueType === VenueType.CLOB && source.topOfBook) {
      // For CLOB, use ask price directly
      const config = this.liquidityCollector.getVenueConfig(source.venue);
      return (inputAmount / source.topOfBook.askPrice) * (1 - config.feeRate);
    }

    if (source.venueType === VenueType.AMM && source.reserves) {
      // For AMM, use constant product formula
      const config = this.liquidityCollector.getVenueConfig(source.venue);
      const inputWithFee = inputAmount * (1 - config.feeRate);
      return (
        (source.reserves.output * inputWithFee) /
        (source.reserves.input + inputWithFee)
      );
    }

    return 0;
  }

  /**
   * Calculate total cost including all fees
   */
  private calculateTotalCost(
    candidate: RouteCandidate,
    config: OptimizationConfig
  ): void {
    let totalCost = 0;

    // DEX fees
    for (const split of candidate.splits) {
      totalCost += split.liquiditySource.feeAmount;
    }

    // Network fees (estimate)
    const baseFee = 5000; // lamports
    const computeUnitPrice =
      config.maxPriorityFee / candidate.estimatedComputeUnits;
    const priorityFee = candidate.estimatedComputeUnits * computeUnitPrice;
    totalCost += (baseFee + priorityFee) / 1e9; // Convert to SOL

    // MEV protection cost (Jito tip)
    if (config.useBundling) {
      totalCost += 0.0001; // Estimated Jito tip in SOL
    }

    // Slippage cost
    for (const split of candidate.splits) {
      const slippageCost =
        split.inputAmount * split.liquiditySource.slippagePercent;
      totalCost += slippageCost;
    }

    candidate.totalCost = totalCost;
  }

  /**
   * Assess risk score for a route
   */
  private assessRisk(candidate: RouteCandidate): void {
    let riskScore = 0;

    // Multi-venue = higher risk
    riskScore += (candidate.venues.length - 1) * 10;

    // High slippage = higher risk
    for (const split of candidate.splits) {
      riskScore += split.liquiditySource.slippagePercent * 100;
    }

    // AMM has higher MEV risk than CLOB
    const hasAMM = candidate.splits.some(
      (s) => s.liquiditySource.venueType === VenueType.AMM
    );
    if (hasAMM) riskScore += 15;

    // Multi-hop = higher risk
    if (candidate.hops > 2) riskScore += 20;

    candidate.riskScore = Math.min(riskScore, 100);

    // Assess MEV risk
    if (candidate.riskScore > 50) {
      candidate.mevRisk = "high";
    } else if (candidate.riskScore > 25) {
      candidate.mevRisk = "medium";
    } else {
      candidate.mevRisk = "low";
    }
  }

  /**
   * Estimate compute units needed
   */
  private estimateComputeUnits(
    venueType: VenueType,
    numOperations: number
  ): number {
    const baseUnits = {
      [VenueType.CLOB]: 50000, // CLOBs are efficient
      [VenueType.AMM]: 100000, // AMMs need more CU
      [VenueType.RFQ]: 150000, // Aggregators may be complex
    };

    return baseUnits[venueType] * numOperations;
  }

  /**
   * Calculate dynamic weights for venues based on oracle prices and liquidity
   * Weights are normalized to sum to 100
   */
  async calculateDynamicWeights(
    sources: LiquiditySource[],
    inputMint: string,
    outputMint: string,
    totalInput: number
  ): Promise<{ weights: number[]; venueOrder: VenueName[] }> {
    // Use tranche-based allocation algorithm as requested
    return this.computeWeightsTrancheBased(totalInput, sources);
  }

  /**
   * Calculate weights using tranche-based allocation algorithm
   * Implements the greedy allocation strategy requested:
   * 1. Simulate output for each DEX using AMM formula
   * 2. Calculate unit cost ci = qin/qouti
   * 3. Sort DEXes by ascending cost
   * 4. Allocate in tranches starting from lowest cost DEX
   */
  async computeWeightsTrancheBased(
    amountIn: number,
    dexList: LiquiditySource[]
  ): Promise<{ weights: number[]; venueOrder: VenueName[] }> {
    if (dexList.length === 0) {
      return { weights: [], venueOrder: [] };
    }

    if (dexList.length === 1) {
      return { weights: [100], venueOrder: [dexList[0].venue] };
    }

    try {
      // Step 1: Simulate output for each DEX and calculate unit costs
      const dexCosts: Array<{
        dex: LiquiditySource;
        unitCost: number; // qin/qouti (higher = worse)
        simulatedOutput: number;
      }> = [];

      for (const dex of dexList) {
        // Simulate AMM output using x*y = k formula with fees
        // For AMM: qout = y - (x*y)/(x + qin)
        // But we need to account for fees and use available reserves
        const reserveIn = dex.depth * 0.5; // Assume 50% of depth is input token
        const reserveOut = dex.depth * 0.5; // Assume 50% of depth is output token

        // Apply fee: effective input = amountIn * (1 - fee)
        const feeRate = dex.feeAmount || 0.003; // Default 0.3% fee
        const effectiveInput = amountIn * (1 - feeRate);

        // AMM formula: qout = reserveOut - (reserveIn * reserveOut) / (reserveIn + effectiveInput)
        const numerator = reserveIn * reserveOut;
        const denominator = reserveIn + effectiveInput;
        const simulatedOutput = reserveOut - numerator / denominator;

        // Unit cost: higher means worse price (qin/qouti)
        const unitCost = amountIn / Math.max(simulatedOutput, 0.000001);

        dexCosts.push({
          dex,
          unitCost,
          simulatedOutput: Math.max(simulatedOutput, 0),
        });
      }

      // Step 2: Sort DEXes by ascending unit cost (lowest cost first)
      dexCosts.sort((a, b) => a.unitCost - b.unitCost);

      // Step 3: Allocate in tranches using greedy algorithm
      const allocations: Array<{
        dex: LiquiditySource;
        allocatedInput: number;
      }> = [];
      let remainingAmount = amountIn;

      for (const dexCost of dexCosts) {
        if (remainingAmount <= 0) break;

        // Calculate how much to allocate to this DEX
        // Use a tranche size that considers price impact
        const trancheSize = Math.min(
          remainingAmount * 0.4, // Max 40% of remaining amount per tranche
          dexCost.dex.depth * 0.1 // Max 10% of available liquidity
        );

        const allocatedInput = Math.min(trancheSize, remainingAmount);

        if (allocatedInput > 0) {
          allocations.push({
            dex: dexCost.dex,
            allocatedInput,
          });
          remainingAmount -= allocatedInput;
        }
      }

      // Step 4: Convert allocations to weights (u8 values summing to 100)
      const weights: number[] = [];
      const venueOrder: VenueName[] = [];

      for (const allocation of allocations) {
        const weight = Math.round((allocation.allocatedInput / amountIn) * 100);
        weights.push(weight);
        venueOrder.push(allocation.dex.venue);
      }

      // Ensure weights sum to exactly 100
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);
      if (totalWeight !== 100) {
        const adjustment = 100 - totalWeight;
        if (weights.length > 0) {
          weights[weights.length - 1] += adjustment;
        }
      }

      // Ensure no weight is 0 and all are u8 (0-255)
      const validWeights = weights.filter((w) => w > 0);
      if (validWeights.length !== weights.length) {
        // Redistribute if some weights were 0
        return this.computeWeightsTrancheBased(
          amountIn,
          dexList.slice(0, validWeights.length)
        );
      }

      return { weights, venueOrder };
    } catch (error) {
      console.warn(
        "Tranche-based weight calculation failed, using equal weights:",
        error
      );

      // Fallback to equal weights
      const equalWeight = Math.floor(100 / dexList.length);
      const weights = new Array(dexList.length).fill(equalWeight);
      const remainder = 100 - equalWeight * dexList.length;
      if (remainder > 0 && weights.length > 0) {
        weights[weights.length - 1] += remainder;
      }

      return {
        weights,
        venueOrder: dexList.map((d) => d.venue),
      };
    }
  }

  /**
   * Build routing strategy metadata for a candidate
   */
  private buildStrategyMetadata(
    candidate: RouteCandidate,
    inputAmount: number,
    config: OptimizationConfig
  ): RoutingStrategyMetadata {
    const profile = candidate.splits.length > 1 ? "split" : "single-venue";
    const usesClob = this.routeUsesClob(candidate);

    // Determine if TWAP is recommended
    const twapRecommended = this.shouldRecommendTWAP(inputAmount, candidate);
    const twap = twapRecommended
      ? this.generateTWAPHints(inputAmount, candidate, config)
      : undefined;

    return {
      profile,
      splitsEnabled: candidate.splits.length > 1,
      splitVenues: candidate.venues,
      fallbackEnabled: false,
      fallbackCount: 0, // Will be updated by enrichWithFallbackPlans
      twap,
    };
  }

  /**
   * Determine if TWAP execution is recommended
   */
  private shouldRecommendTWAP(
    inputAmount: number,
    candidate: RouteCandidate
  ): boolean {
    // Recommend TWAP for large orders that would cause significant slippage
    const HIGH_SLIPPAGE_THRESHOLD = 0.005; // 0.5%
    const LARGE_TRADE_THRESHOLD = 100000; // $100k USD equivalent

    const hasHighSlippage = candidate.splits.some(
      (split) => split.liquiditySource.slippagePercent > HIGH_SLIPPAGE_THRESHOLD
    );

    const isLargeTrade = inputAmount > LARGE_TRADE_THRESHOLD;

    return hasHighSlippage && isLargeTrade;
  }

  /**
   * Generate TWAP execution hints
   */
  private generateTWAPHints(
    inputAmount: number,
    candidate: RouteCandidate,
    config: OptimizationConfig
  ): RoutingStrategyMetadata["twap"] {
    // Calculate optimal number of slices based on amount and slippage
    const maxSlippage = Math.max(
      ...candidate.splits.map((s) => s.liquiditySource.slippagePercent)
    );

    // More slippage = more slices needed
    let slices = 3; // Default
    if (maxSlippage > 0.01) slices = 5;
    if (maxSlippage > 0.02) slices = 8;
    if (maxSlippage > 0.05) slices = 12;

    // Calculate interval between slices (in milliseconds)
    // Use exponential backoff for better price discovery
    const baseInterval = 2000; // 2 seconds
    const intervalMs = baseInterval * Math.pow(1.5, Math.log10(maxSlippage * 100));

    return {
      recommended: true,
      slices,
      intervalMs: Math.round(intervalMs),
      reason: `High slippage detected (${(maxSlippage * 100).toFixed(2)}%). Splitting into ${slices} chunks reduces price impact.`,
    };
  }

  /**
   * Enrich top candidates with fallback plans
   */
  private enrichWithFallbackPlans(candidates: RouteCandidate[]): void {
    if (candidates.length < 2) return;

    // Primary route gets next 2 candidates as fallbacks
    const primary = candidates[0];
    const fallbacks = candidates.slice(1, 3);

    if (primary.strategy) {
      primary.strategy.fallbackCount = fallbacks.length;
      primary.strategy.fallbackEnabled = true;
    }

    // Note: metadata property not available in RouteCandidate type
    // Fallback route IDs stored in strategy.fallbackCount instead

    this.logger.info("fallback_plans_generated", {
      primaryRoute: primary.id,
      fallbackCount: fallbacks.length,
      fallbacks: fallbacks.map((f) => ({
        id: f.id,
        venues: f.venues,
        expectedOutput: f.expectedOutput,
      })),
    });
  }

  private buildRoutingDiagnostics(
    inputMint: string,
    outputMint: string,
    inputAmount: number,
    candidates: RouteCandidate[],
    config: OptimizationConfig
  ): RoutingDiagnostics {
    const topRoutes = candidates.slice(0, 3);
    const clobRouteCount = candidates.filter((candidate) =>
      this.routeUsesClob(candidate)
    ).length;
    const clobRoutesInTop3 = topRoutes.filter((candidate) =>
      this.routeUsesClob(candidate)
    ).length;

    return {
      inputMint,
      outputMint,
      inputAmount,
      slippageTolerance: config.slippageTolerance,
      candidateCount: candidates.length,
      clobPreferenceApplied: config.prioritizeCLOB,
      clobRouteCount,
      clobRoutesInTop3,
      topRoutes: topRoutes.map((candidate) => ({
        id: candidate.id,
        venues: candidate.venues,
        expectedOutput: candidate.expectedOutput,
        totalCost: candidate.totalCost,
        effectiveRate: candidate.effectiveRate,
        mevRisk: candidate.mevRisk,
        usesClob: this.routeUsesClob(candidate),
        strategyProfile: candidate.strategy?.profile,
        fallbackCount: candidate.strategy?.fallbackCount,
        twapRecommended: candidate.strategy?.twap?.recommended ?? false,
        twapSlices: candidate.strategy?.twap?.slices,
      })),
    };
  }
}

export type RoutingDiagnostics = {
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  slippageTolerance: number;
  candidateCount: number;
  clobPreferenceApplied: boolean;
  clobRouteCount: number;
  clobRoutesInTop3: number;
  topRoutes: Array<{
    id: string;
    venues: VenueName[];
    expectedOutput: number;
    totalCost: number;
    effectiveRate: number;
    mevRisk: string;
    usesClob: boolean;
    strategyProfile?: RoutingStrategyMetadata["profile"];
    fallbackCount?: number;
    twapRecommended?: boolean;
    twapSlices?: number;
  }>;
};

/**
 * Validate route candidate before execution
 */
export async function validateRoute(
  candidate: RouteCandidate,
  config: OptimizationConfig,
  oracleService?: OraclePriceService,
  inputMint?: string,
  outputMint?: string,
  inputAmount?: number
): Promise<{ valid: boolean; reason?: string }> {
  // Check min output
  if (
    config.minOutputAmount &&
    candidate.expectedOutput < config.minOutputAmount
  ) {
    return { valid: false, reason: "Output below minimum threshold" };
  }

  // Check slippage tolerance
  for (const split of candidate.splits) {
    if (split.liquiditySource.slippagePercent > config.slippageTolerance) {
      return {
        valid: false,
        reason: `Slippage exceeds tolerance on ${split.venue}`,
      };
    }
  }

  // Check route freshness
  for (const split of candidate.splits) {
    const staleness = Date.now() - split.liquiditySource.timestamp;
    if (staleness > 30000) {
      // 30 seconds
      return { valid: false, reason: "Liquidity data is stale" };
    }
  }

  // Oracle price verification (if oracle service provided)
  if (oracleService && inputMint && outputMint && inputAmount !== undefined) {
    try {
      const verification = await oracleService.verifyRoutePrice(
        candidate,
        inputMint,
        outputMint,
        inputAmount,
        config.slippageTolerance // Use same tolerance as slippage
      );

      if (!verification.isAcceptable) {
        return {
          valid: false,
          reason: `Route price deviates from oracle by ${verification.deviation.toFixed(2)}% (max allowed: ${(config.slippageTolerance * 100).toFixed(2)}%)`,
        };
      }
    } catch (error) {
      console.warn("Oracle price verification failed:", error);
      // Don't fail validation if oracle check fails, just log warning
    }
  }

  return { valid: true };
}

/**
 * Compare two routes
 */
export function compareRoutes(a: RouteCandidate, b: RouteCandidate): number {
  // Primary: better output
  if (Math.abs(a.expectedOutput - b.expectedOutput) > 0.01) {
    return b.expectedOutput - a.expectedOutput;
  }

  // Secondary: lower risk
  if (Math.abs(a.riskScore - b.riskScore) > 5) {
    return a.riskScore - b.riskScore;
  }

  // Tertiary: lower cost
  return a.totalCost - b.totalCost;
}
