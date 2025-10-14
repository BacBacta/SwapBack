/**
 * Route Optimization Engine
 * Implements greedy allocation algorithm to find best execution path
 */

import {
  RouteCandidate,
  RouteSplit,
  OptimizationConfig,
  AggregatedLiquidity,
  LiquiditySource,
  VenueName,
  VenueType,
} from '../types/smart-router';
import { LiquidityDataCollector } from './LiquidityDataCollector';

// ============================================================================
// OPTIMIZATION ENGINE
// ============================================================================

export class RouteOptimizationEngine {
  private liquidityCollector: LiquidityDataCollector;
  private defaultConfig: OptimizationConfig;

  constructor(liquidityCollector: LiquidityDataCollector) {
    this.liquidityCollector = liquidityCollector;
    
    this.defaultConfig = {
      slippageTolerance: 0.01,      // 1%
      maxRoutes: 3,
      prioritizeCLOB: true,
      maxHops: 3,
      enableSplitRoutes: true,
      maxSplits: 3,
      useBundling: true,
      maxPriorityFee: 100000,       // 0.0001 SOL
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
      sources = sources.filter(s => !config.excludedVenues!.includes(s.venue));
    }

    // Filter by slippage tolerance
    sources = sources.filter(s => s.slippagePercent <= config.slippageTolerance);

    if (sources.length === 0) {
      throw new Error('No viable liquidity sources found within slippage tolerance');
    }

    // Step 3: Generate route candidates
    const candidates: RouteCandidate[] = [];

    // 3a. Single venue routes (simplest, lowest gas)
    for (const source of sources) {
      const candidate = this.createSingleVenueRoute(source, inputAmount, config);
      if (candidate) candidates.push(candidate);
    }

    // 3b. Split routes (if enabled)
    if (config.enableSplitRoutes && sources.length > 1) {
      const splitCandidates = this.createSplitRoutes(sources, inputAmount, config);
      candidates.push(...splitCandidates);
    }

    // 3c. Multi-hop routes (TODO: implement for complex pairs)
    // For now, skip if no direct liquidity

    // Step 4: Calculate costs and rank
    for (const candidate of candidates) {
      this.calculateTotalCost(candidate, config);
      this.assessRisk(candidate);
    }

    // Step 5: Sort by expected output (descending)
    candidates.sort((a, b) => b.expectedOutput - a.expectedOutput);

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
      percentage: 100,
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
      mevRisk: 'low',
      instructions: [], // Will be built later
      estimatedComputeUnits: this.estimateComputeUnits(source.venueType, 1),
    };
  }

  /**
   * Create split routes across multiple venues
   * Uses greedy algorithm: allocate to cheapest sources first
   */
  private createSplitRoutes(
    sources: LiquiditySource[],
    inputAmount: number,
    config: OptimizationConfig
  ): RouteCandidate[] {
    const candidates: RouteCandidate[] = [];
    const maxSplits = Math.min(config.maxSplits, sources.length);

    // Try different split configurations (2-way, 3-way, etc.)
    for (let numSplits = 2; numSplits <= maxSplits; numSplits++) {
      const topSources = sources.slice(0, numSplits);
      const splits = this.optimizeSplitAllocation(topSources, inputAmount);
      
      if (splits.length === 0) continue;

      const totalOutput = splits.reduce((sum, s) => sum + s.expectedOutput, 0);
      const venues = splits.map(s => s.venue);

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
        mevRisk: 'medium', // Splits have higher MEV risk
        instructions: [],
        estimatedComputeUnits: this.estimateComputeUnits(VenueType.AMM, numSplits),
      });
    }

    return candidates;
  }

  /**
   * Optimize allocation across multiple sources using greedy algorithm
   * Allocate to cheapest liquidity first until filled
   */
  private optimizeSplitAllocation(
    sources: LiquiditySource[],
    totalInput: number
  ): RouteSplit[] {
    const splits: RouteSplit[] = [];
    let remaining = totalInput;

    // Sort by effective price (ascending = best first)
    const sorted = [...sources].sort((a, b) => a.effectivePrice - b.effectivePrice);

    for (const source of sorted) {
      if (remaining <= 0) break;

      // Calculate how much we can allocate to this source
      // Limited by either remaining amount or source depth
      const maxAllocatable = Math.min(
        remaining,
        source.depth * 0.9 // Use max 90% of depth to avoid excessive slippage
      );

      if (maxAllocatable < 1) continue; // Skip if too small

      const allocated = maxAllocatable;
      const expectedOutput = this.calculateExpectedOutput(source, allocated);
      
      splits.push({
        venue: source.venue,
        percentage: (allocated / totalInput) * 100,
        inputAmount: allocated,
        expectedOutput,
        liquiditySource: source,
      });

      remaining -= allocated;
    }

    return splits;
  }

  /**
   * Calculate expected output from a liquidity source
   */
  private calculateExpectedOutput(source: LiquiditySource, inputAmount: number): number {
    if (source.venueType === VenueType.CLOB && source.topOfBook) {
      // For CLOB, use ask price directly
      const config = this.liquidityCollector.getVenueConfig(source.venue);
      return (inputAmount / source.topOfBook.askPrice) * (1 - config.feeRate);
    }

    if (source.venueType === VenueType.AMM && source.reserves) {
      // For AMM, use constant product formula
      const config = this.liquidityCollector.getVenueConfig(source.venue);
      const inputWithFee = inputAmount * (1 - config.feeRate);
      return (source.reserves.output * inputWithFee) / (source.reserves.input + inputWithFee);
    }

    // For RFQ, use effective price
    return inputAmount / source.effectivePrice;
  }

  /**
   * Calculate total cost including all fees
   */
  private calculateTotalCost(candidate: RouteCandidate, config: OptimizationConfig): void {
    let totalCost = 0;

    // DEX fees
    for (const split of candidate.splits) {
      totalCost += split.liquiditySource.feeAmount;
    }

    // Network fees (estimate)
    const baseFee = 5000; // lamports
    const computeUnitPrice = config.maxPriorityFee / candidate.estimatedComputeUnits;
    const priorityFee = candidate.estimatedComputeUnits * computeUnitPrice;
    totalCost += (baseFee + priorityFee) / 1e9; // Convert to SOL

    // MEV protection cost (Jito tip)
    if (config.useBundling) {
      totalCost += 0.0001; // Estimated Jito tip in SOL
    }

    // Slippage cost
    for (const split of candidate.splits) {
      const slippageCost = split.inputAmount * split.liquiditySource.slippagePercent;
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
    const hasAMM = candidate.splits.some(s => s.liquiditySource.venueType === VenueType.AMM);
    if (hasAMM) riskScore += 15;

    // Multi-hop = higher risk
    if (candidate.hops > 2) riskScore += 20;

    candidate.riskScore = Math.min(riskScore, 100);

    // Assess MEV risk
    if (candidate.riskScore > 50) {
      candidate.mevRisk = 'high';
    } else if (candidate.riskScore > 25) {
      candidate.mevRisk = 'medium';
    } else {
      candidate.mevRisk = 'low';
    }
  }

  /**
   * Estimate compute units needed
   */
  private estimateComputeUnits(venueType: VenueType, numOperations: number): number {
    const baseUnits = {
      [VenueType.CLOB]: 50000,   // CLOBs are efficient
      [VenueType.AMM]: 100000,   // AMMs need more CU
      [VenueType.RFQ]: 150000,   // Aggregators may be complex
    };

    return baseUnits[venueType] * numOperations;
  }

  /**
   * Generate fallback routes
   * Returns alternative routes if primary fails
   */
  async generateFallbackRoutes(
    primaryRoute: RouteCandidate,
    inputMint: string,
    outputMint: string,
    inputAmount: number,
    config: OptimizationConfig
  ): Promise<RouteCandidate[]> {
    // Get all routes
    const allRoutes = await this.findOptimalRoutes(inputMint, outputMint, inputAmount, config);

    // Filter out primary route and return alternatives
    return allRoutes.filter(r => r.id !== primaryRoute.id);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate route candidate before execution
 */
export function validateRoute(
  candidate: RouteCandidate,
  config: OptimizationConfig
): { valid: boolean; reason?: string } {
  // Check min output
  if (config.minOutputAmount && candidate.expectedOutput < config.minOutputAmount) {
    return { valid: false, reason: 'Output below minimum threshold' };
  }

  // Check slippage tolerance
  for (const split of candidate.splits) {
    if (split.liquiditySource.slippagePercent > config.slippageTolerance) {
      return { valid: false, reason: `Slippage exceeds tolerance on ${split.venue}` };
    }
  }

  // Check route freshness
  for (const split of candidate.splits) {
    const staleness = Date.now() - split.liquiditySource.timestamp;
    if (staleness > 30000) { // 30 seconds
      return { valid: false, reason: 'Liquidity data is stale' };
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
