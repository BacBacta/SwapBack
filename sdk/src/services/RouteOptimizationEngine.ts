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
import { OraclePriceService } from './OraclePriceService';

// ============================================================================
// OPTIMIZATION ENGINE
// ============================================================================

export class RouteOptimizationEngine {
  private readonly liquidityCollector: LiquidityDataCollector;
  private readonly oracleService: OraclePriceService;
  private readonly defaultConfig: OptimizationConfig;

  constructor(
    liquidityCollector: LiquidityDataCollector,
    oracleService: OraclePriceService
  ) {
    this.liquidityCollector = liquidityCollector;
    this.oracleService = oracleService;
    
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
      const splitCandidates = await this.createSplitRoutes(sources, inputAmount, inputMint, outputMint, config);
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
      mevRisk: 'low',
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

      const splits = this.optimizeSplitAllocationWithWeights(topSources, inputAmount, weights);
      
      if (splits.length === 0) continue;

      // Validate weights sum to 100
      const totalWeight = splits.reduce((sum, s) => sum + s.weight, 0);
      if (Math.abs(totalWeight - 100) > 0.01) {
        console.warn(`Warning: Split weights sum to ${totalWeight}, adjusting...`);
        // Normalize weights to sum to 100
        for (const split of splits) {
          split.weight = (split.weight / totalWeight) * 100;
        }
      }

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
   * Calculate dynamic weights for venues based on oracle prices and liquidity
   * Weights are normalized to sum to 100
   */
  async calculateDynamicWeights(
    sources: LiquiditySource[],
    inputMint: string,
    outputMint: string,
    totalInput: number
  ): Promise<{ weights: number[], venueOrder: VenueName[] }> {
    if (sources.length === 0) {
      return { weights: [], venueOrder: [] };
    }

    try {
      // Get oracle price for comparison
      const oraclePrice = await this.oracleService.getTokenPrice(outputMint);
      const oracleRate = oraclePrice.price; // USD per output token

      // Calculate scores for each venue
      const venueScores: Array<{ venue: VenueName, score: number }> = [];

      for (const source of sources) {
        let score = 0;

        // 1. Price efficiency vs oracle (40% weight)
        const priceEfficiency = Math.min(source.effectivePrice / oracleRate, 1);
        score += priceEfficiency * 40;

        // 2. Liquidity depth (30% weight)
        const depthScore = Math.min(source.depth / 1000000, 1); // Cap at $1M depth
        score += depthScore * 30;

        // 3. Fee efficiency (20% weight)
        const feeEfficiency = Math.max(0, 1 - source.feeAmount / totalInput);
        score += feeEfficiency * 20;

        // 4. Venue reliability (10% weight) - CLOB > AMM > RFQ
        let reliabilityScore: number;
        if (source.venueType === VenueType.CLOB) {
          reliabilityScore = 1;
        } else if (source.venueType === VenueType.AMM) {
          reliabilityScore = 0.7;
        } else {
          reliabilityScore = 0.5;
        }
        score += reliabilityScore * 10;

        venueScores.push({ venue: source.venue, score });
      }

      // Sort by score (descending)
      venueScores.sort((a, b) => b.score - a.score);

      // Allocate weights using exponential decay
      // Top venue gets most weight, others get progressively less
      const totalScore = venueScores.reduce((sum, v) => sum + v.score, 0);
      let weights: number[] = [];
      let remainingWeight = 100;

      for (let i = 0; i < venueScores.length; i++) {
        if (i === venueScores.length - 1) {
          // Last venue gets remaining weight
          weights.push(remainingWeight);
        } else {
          // Exponential decay allocation
          const scoreRatio = venueScores[i].score / totalScore;
          const allocatedWeight = Math.max(5, Math.floor(scoreRatio * 100 * Math.pow(0.7, i)));
          weights.push(Math.min(allocatedWeight, remainingWeight));
          remainingWeight -= allocatedWeight;
        }
      }

      // Ensure weights sum to exactly 100
      const currentSum = weights.reduce((sum, w) => sum + w, 0);
      if (currentSum !== 100) {
        const adjustment = 100 - currentSum;
        weights[weights.length - 1] += adjustment;
      }

      return {
        weights,
        venueOrder: venueScores.map(v => v.venue)
      };

    } catch (error) {
      console.warn('Oracle-based weight calculation failed, using equal weights:', error);

      // Fallback to equal weights
      const equalWeight = Math.floor(100 / sources.length);
      let weights = new Array(sources.length).fill(equalWeight);
      const remainder = 100 - (equalWeight * sources.length);
      if (remainder > 0 && weights.length > 0) {
        weights[weights.length - 1] += remainder;
      }

      return {
        weights,
        venueOrder: sources.map(s => s.venue)
      };
    }
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
