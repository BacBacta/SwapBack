import {
  LiquidityDataCollector,
  calculatePriceImpact,
  estimateAMMOutput,
} from "./LiquidityDataCollector";
import { RouteOptimizationEngine } from "./RouteOptimizationEngine";
import {
  AtomicSwapLeg,
  AtomicSwapPlan,
  LiquiditySource,
  OptimizationConfig,
  RouteCandidate,
  VenueName,
  VenueQuoteSample,
  VenueSimulationResult,
  VenueType,
} from "../types/smart-router";

export interface PlanDiff {
  venue: VenueName;
  priceDriftBps: number;
  liquidityRatio: number;
  stalenessMs: number;
}

export interface PlanAdjustmentResult {
  updated: boolean;
  plan: AtomicSwapPlan;
  reason?: string;
  diffs: PlanDiff[];
}

export type PlanUpdateHandler = (result: PlanAdjustmentResult) => void;

export interface PlanMonitor {
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

interface AdaptiveRebalanceConfig {
  driftBps: number;
  minLiquidityRatio: number;
  maxStalenessMs: number;
  pollIntervalMs: number;
}

interface IntelligentRouterOptions {
  samplePoints: number;
  sampleStrategy: "linear" | "progressive";
  epsilonAmount: number;
  quoteValidityMs: number;
  maxSlippageBps: number;
  optimizationDefaults: Partial<OptimizationConfig>;
  rebalance: AdaptiveRebalanceConfig;
}

export interface BuildPlanParams {
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  maxSlippageBps?: number;
  quoteValidityMs?: number;
  samplePoints?: number;
  sampleStrategy?: "linear" | "progressive";
  optimization?: Partial<OptimizationConfig>;
  rebalance?: Partial<AdaptiveRebalanceConfig>;
}

interface PlanEvaluation {
  shouldRebalance: boolean;
  reason?: string;
  diffs: PlanDiff[];
  snapshot: AtomicSwapPlan["liquiditySnapshot"];
}

const DEFAULT_OPTIONS: IntelligentRouterOptions = {
  samplePoints: 5,
  sampleStrategy: "progressive",
  epsilonAmount: 0.000001,
  quoteValidityMs: 30_000,
  maxSlippageBps: 100, // 1%
  optimizationDefaults: {
    slippageTolerance: 0.01,
    maxRoutes: 3,
    prioritizeCLOB: true,
    maxHops: 3,
    enableSplitRoutes: true,
    maxSplits: 3,
    useBundling: true,
    maxPriorityFee: 50_000,
    enableFallback: true,
    maxRetries: 2,
  },
  rebalance: {
    driftBps: 40,
    minLiquidityRatio: 0.6,
    maxStalenessMs: 15_000,
    pollIntervalMs: 2_500,
  },
};

export class IntelligentOrderRouter {
  private readonly liquidityCollector: LiquidityDataCollector;
  private readonly optimizer: RouteOptimizationEngine;
  private readonly options: IntelligentRouterOptions;

  constructor(
    liquidityCollector: LiquidityDataCollector,
    optimizer: RouteOptimizationEngine,
    options?: Partial<IntelligentRouterOptions>
  ) {
    this.liquidityCollector = liquidityCollector;
    this.optimizer = optimizer;
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      optimizationDefaults: {
        ...DEFAULT_OPTIONS.optimizationDefaults,
        ...(options?.optimizationDefaults ?? {}),
      },
      rebalance: {
        ...DEFAULT_OPTIONS.rebalance,
        ...(options?.rebalance ?? {}),
      },
    };
  }

  /**
   * Build an atomic swap plan using best marginal cost allocation.
   */
  async buildAtomicPlan(params: BuildPlanParams): Promise<AtomicSwapPlan> {
    if (params.inputAmount <= 0) {
      throw new Error("Input amount must be greater than zero");
    }

    const quoteValidityMs =
      params.quoteValidityMs ?? this.options.quoteValidityMs;
    const maxSlippageBps = params.maxSlippageBps ?? this.options.maxSlippageBps;
    const samplePoints = params.samplePoints ?? this.options.samplePoints;
    const sampleStrategy = params.sampleStrategy ?? this.options.sampleStrategy;
    const rebalanceCfg: AdaptiveRebalanceConfig = {
      ...this.options.rebalance,
      ...(params.rebalance ?? {}),
    };

    const optimizationConfig: Partial<OptimizationConfig> = {
      ...this.options.optimizationDefaults,
      ...(params.optimization ?? {}),
      slippageTolerance:
        (params.maxSlippageBps ?? this.options.maxSlippageBps) / 10_000,
    };

    const aggregated = await this.liquidityCollector.fetchAggregatedLiquidity(
      params.inputMint,
      params.outputMint,
      params.inputAmount
    );

    if (!aggregated.sources.length) {
      throw new Error("No liquidity sources available for the requested pair");
    }

    const sampleSizes = this.buildSampleSizes(
      params.inputAmount,
      samplePoints,
      sampleStrategy
    );

    const simulations = await Promise.all(
      aggregated.sources.map((source) =>
        this.simulateVenue(source, sampleSizes)
      )
    );

    const routes = await this.optimizer.findOptimalRoutes(
      params.inputMint,
      params.outputMint,
      params.inputAmount,
      optimizationConfig
    );

    if (!routes.length) {
      throw new Error("No viable route candidates found");
    }

    const now = Date.now();

    const liquiditySnapshot = aggregated.sources.reduce<
      AtomicSwapPlan["liquiditySnapshot"]
    >(
      (acc, source) => {
        acc[source.venue] = {
          effectivePrice: source.effectivePrice,
          depth: source.depth,
          timestamp: source.timestamp,
        };
        return acc;
      },
      {} as AtomicSwapPlan["liquiditySnapshot"]
    );
    const fallbackDepth = Math.min(routes.length, 3);
    const candidateRoutes = routes.slice(0, Math.max(fallbackDepth, 1));

    const planContext = {
      createdAt: now,
      quoteValidityMs,
      maxSlippageBps,
      rebalanceCfg,
      simulations,
      liquiditySnapshot,
    } as const;

    const planCandidates = candidateRoutes.map((route) =>
      this.buildPlanFromRoute(route, params, planContext)
    );

    const [primaryPlan, ...fallbackPlans] = planCandidates;

    if (!primaryPlan) {
      throw new Error("Failed to build primary swap plan");
    }

    primaryPlan.fallbackPlans = fallbackPlans.map((plan) => ({
      ...plan,
      fallbackPlans: [],
    }));

    return primaryPlan;
  }

  private buildPlanFromRoute(
    route: RouteCandidate,
    params: BuildPlanParams,
    context: {
      createdAt: number;
      quoteValidityMs: number;
      maxSlippageBps: number;
      rebalanceCfg: AdaptiveRebalanceConfig;
      simulations: VenueSimulationResult[];
      liquiditySnapshot: AtomicSwapPlan["liquiditySnapshot"];
    }
  ): AtomicSwapPlan {
    const {
      createdAt,
      quoteValidityMs,
      maxSlippageBps,
      rebalanceCfg,
      simulations,
      liquiditySnapshot,
    } = context;

    const legs = this.buildLegsFromRoute(route, simulations, maxSlippageBps);
    const expectedOutput = legs.reduce(
      (sum, leg) => sum + leg.expectedOutput,
      0
    );
    const minOutput = legs.reduce((sum, leg) => sum + leg.minOutput, 0);

    return {
      id: this.generatePlanId(),
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      totalInput: params.inputAmount,
      expectedOutput,
      minOutput,
      createdAt,
      expiresAt: createdAt + quoteValidityMs,
      quoteValidityMs,
      legs,
      simulations,
      baseRoute: route,
      fallbackPlans: [],
      maxSlippageBps,
      driftRebalanceBps: rebalanceCfg.driftBps,
      minLiquidityRatio: rebalanceCfg.minLiquidityRatio,
      maxStalenessMs: rebalanceCfg.maxStalenessMs,
      liquiditySnapshot,
    };
  }

  /**
   * Evaluate the current plan against latest liquidity and rebuild if needed.
   */
  async adjustPlanIfNeeded(
    plan: AtomicSwapPlan,
    overrides?: Partial<BuildPlanParams>
  ): Promise<PlanAdjustmentResult> {
    const evaluation = await this.evaluatePlan(plan);

    if (!evaluation.shouldRebalance) {
      return {
        updated: false,
        plan,
        diffs: evaluation.diffs,
      };
    }

    const updatedPlan = await this.buildAtomicPlan({
      inputMint: overrides?.inputMint ?? plan.inputMint,
      outputMint: overrides?.outputMint ?? plan.outputMint,
      inputAmount: overrides?.inputAmount ?? plan.totalInput,
      maxSlippageBps: overrides?.maxSlippageBps ?? plan.maxSlippageBps,
      quoteValidityMs: overrides?.quoteValidityMs ?? plan.quoteValidityMs,
      samplePoints: overrides?.samplePoints,
      sampleStrategy: overrides?.sampleStrategy,
      optimization: overrides?.optimization,
      rebalance: overrides?.rebalance,
    });

    return {
      updated: true,
      plan: updatedPlan,
      reason: evaluation.reason,
      diffs: evaluation.diffs,
    };
  }

  createPlanMonitor(
    plan: AtomicSwapPlan,
    overrides: Partial<BuildPlanParams> = {},
    handler: PlanUpdateHandler = () => undefined
  ): PlanMonitor {
    const pollInterval =
      overrides.rebalance?.pollIntervalMs ??
      this.options.rebalance.pollIntervalMs;

    const mergedOverrides: Partial<BuildPlanParams> = {
      inputMint: overrides.inputMint ?? plan.inputMint,
      outputMint: overrides.outputMint ?? plan.outputMint,
      inputAmount: overrides.inputAmount ?? plan.totalInput,
      maxSlippageBps: overrides.maxSlippageBps ?? plan.maxSlippageBps,
      quoteValidityMs: overrides.quoteValidityMs ?? plan.quoteValidityMs,
      samplePoints: overrides.samplePoints,
      sampleStrategy: overrides.sampleStrategy,
      optimization: overrides.optimization,
      rebalance: overrides.rebalance,
    };

    return new PlanMonitorImpl(
      this,
      plan,
      mergedOverrides,
      handler,
      pollInterval
    );
  }

  /**
   * Evaluate whether a plan is still valid with current market data.
   */
  async evaluatePlan(plan: AtomicSwapPlan): Promise<PlanEvaluation> {
    const latest = await this.liquidityCollector.fetchAggregatedLiquidity(
      plan.inputMint,
      plan.outputMint,
      plan.totalInput
    );

    const now = Date.now();
    const diffs: PlanEvaluation["diffs"] = [];
    let reason: string | undefined;
    let shouldRebalance = false;

    if (now > plan.expiresAt) {
      shouldRebalance = true;
      reason = "quote_expired";
    }

    if (latest.staleness > plan.maxStalenessMs) {
      shouldRebalance = true;
      reason = reason ?? "market_data_stale";
    }

    for (const leg of plan.legs) {
      const latestSource = latest.sources.find((s) => s.venue === leg.venue);
      const baseline = plan.liquiditySnapshot[leg.venue];

      if (!latestSource || !baseline) {
        shouldRebalance = true;
        diffs.push({
          venue: leg.venue,
          priceDriftBps: Number.POSITIVE_INFINITY,
          liquidityRatio: 0,
          stalenessMs: Number.POSITIVE_INFINITY,
        });
        reason = reason ?? "venue_unavailable";
        continue;
      }

      const priceDriftBps = this.computeDriftBps(
        baseline.effectivePrice,
        latestSource.effectivePrice
      );
      const liquidityRatio =
        latestSource.depth === 0 ? 0 : latestSource.depth / baseline.depth;
      const stalenessMs = now - latestSource.timestamp;

      diffs.push({
        venue: leg.venue,
        priceDriftBps,
        liquidityRatio,
        stalenessMs,
      });

      if (Math.abs(priceDriftBps) > plan.driftRebalanceBps) {
        shouldRebalance = true;
        reason = reason ?? "price_drift";
      }

      if (liquidityRatio < plan.minLiquidityRatio) {
        shouldRebalance = true;
        reason = reason ?? "liquidity_drop";
      }

      if (stalenessMs > plan.maxStalenessMs) {
        shouldRebalance = true;
        reason = reason ?? "venue_stale";
      }
    }

    const snapshot = latest.sources.reduce<AtomicSwapPlan["liquiditySnapshot"]>(
      (acc, source) => {
        acc[source.venue] = {
          effectivePrice: source.effectivePrice,
          depth: source.depth,
          timestamp: source.timestamp,
        };
        return acc;
      },
      {} as AtomicSwapPlan["liquiditySnapshot"]
    );

    return {
      shouldRebalance,
      reason,
      diffs,
      snapshot,
    };
  }

  /**
   * Simulate venue costs for various bucket sizes.
   */
  private async simulateVenue(
    source: LiquiditySource,
    sampleSizes: number[]
  ): Promise<VenueSimulationResult> {
    const samples: VenueQuoteSample[] = sampleSizes.map((size) =>
      this.simulateSourceOutput(source, size)
    );

    if (!samples.length) {
      throw new Error(`No quote samples generated for venue ${source.venue}`);
    }

    const bestSample = samples.reduce(
      (best, current) =>
        current.effectivePrice < best.effectivePrice ? current : best,
      samples[0]
    );

    return {
      venue: source.venue,
      venueType: source.venueType,
      route: source.route,
      samples,
      bestSample,
      fetchedAt: Date.now(),
    };
  }

  private simulateSourceOutput(
    source: LiquiditySource,
    inputAmount: number
  ): VenueQuoteSample {
    if (inputAmount <= 0) {
      return {
        inputAmount,
        outputAmount: 0,
        effectivePrice: Number.POSITIVE_INFINITY,
        marginalPrice: Number.POSITIVE_INFINITY,
        slippagePercent: 0,
        feeAmount: 0,
      };
    }

    const config = this.liquidityCollector.getVenueConfig(source.venue);
    let outputAmount = 0;
    let effectivePrice: number;
    let slippagePercent: number;
    let feeAmount = inputAmount * config.feeRate;
    let postTradeLiquidity: number | undefined;

    if (source.venueType === VenueType.CLOB && source.topOfBook) {
      const askPrice = source.topOfBook.askPrice;
      outputAmount = inputAmount / (askPrice * (1 + config.feeRate));
      effectivePrice = inputAmount / outputAmount;
      slippagePercent =
        inputAmount > source.topOfBook.askSize
          ? source.slippagePercent * (inputAmount / source.topOfBook.askSize)
          : source.slippagePercent;
      postTradeLiquidity = Math.max(source.depth - inputAmount, 0);
      feeAmount = outputAmount * config.feeRate;
    } else if (source.venueType === VenueType.AMM && source.reserves) {
      outputAmount = estimateAMMOutput(
        inputAmount,
        source.reserves.input,
        source.reserves.output,
        config.feeRate
      );
      effectivePrice =
        inputAmount / Math.max(outputAmount, this.options.epsilonAmount);
      slippagePercent = calculatePriceImpact(
        inputAmount,
        source.reserves.input,
        source.reserves.output,
        config.feeRate
      );
      postTradeLiquidity = Math.max(source.reserves.output - outputAmount, 0);
    } else {
      outputAmount = inputAmount / source.effectivePrice;
      effectivePrice = source.effectivePrice;
      slippagePercent = source.slippagePercent;
      postTradeLiquidity = source.depth - inputAmount;
    }

    const delta = Math.max(inputAmount * 0.01, this.options.epsilonAmount);
    const bumpedOutput =
      source.venueType === VenueType.AMM && source.reserves
        ? estimateAMMOutput(
            inputAmount + delta,
            source.reserves.input,
            source.reserves.output,
            config.feeRate
          )
        : (inputAmount + delta) /
          Math.max(source.effectivePrice, this.options.epsilonAmount);
    const marginalOutput = Math.max(
      bumpedOutput - outputAmount,
      this.options.epsilonAmount
    );
    const marginalPrice = delta / marginalOutput;

    return {
      inputAmount,
      outputAmount,
      effectivePrice,
      marginalPrice,
      slippagePercent,
      feeAmount,
      postTradeLiquidity,
    };
  }

  private buildLegsFromRoute(
    route: RouteCandidate,
    simulations: VenueSimulationResult[],
    maxSlippageBps: number
  ): AtomicSwapLeg[] {
    const legs: AtomicSwapLeg[] = [];
    const slippageMultiplier = 1 - maxSlippageBps / 10_000;

    for (const split of route.splits) {
      const simulation = simulations.find((sim) => sim.venue === split.venue);
      const sample = simulation
        ? this.selectSample(simulation.samples, split.inputAmount)
        : undefined;

      const expectedOutput = sample?.outputAmount ?? split.expectedOutput;
      const feeAmount = sample?.feeAmount ?? split.liquiditySource.feeAmount;
      const slippagePercent =
        sample?.slippagePercent ?? split.liquiditySource.slippagePercent;
      const minOutput = expectedOutput * slippageMultiplier;

      legs.push({
        venue: split.venue,
        venueType: split.liquiditySource.venueType,
        route: split.liquiditySource.route,
        inputAmount: split.inputAmount,
        expectedOutput,
        minOutput,
        feeAmount,
        slippagePercent,
        quote: sample ?? {
          inputAmount: split.inputAmount,
          outputAmount: expectedOutput,
          effectivePrice: split.liquiditySource.effectivePrice,
          marginalPrice: split.liquiditySource.effectivePrice,
          slippagePercent,
          feeAmount,
          postTradeLiquidity: split.liquiditySource.depth - split.inputAmount,
        },
        liquiditySource: split.liquiditySource,
      });
    }

    return legs;
  }

  private buildSampleSizes(
    totalAmount: number,
    samplePoints: number,
    strategy: "linear" | "progressive"
  ): number[] {
    if (samplePoints <= 1) {
      return [totalAmount];
    }

    const sizes: number[] = [];

    for (let i = 1; i <= samplePoints; i++) {
      const ratio = i / samplePoints;
      const scaled = strategy === "linear" ? ratio : Math.pow(ratio, 2);
      const amount = Math.max(totalAmount * scaled, this.options.epsilonAmount);
      sizes.push(amount);
    }

    const unique = Array.from(new Set(sizes.map((n) => Number(n.toFixed(9)))));
    return unique.sort((a, b) => a - b);
  }

  private selectSample(
    samples: VenueQuoteSample[],
    inputAmount: number
  ): VenueQuoteSample | undefined {
    if (!samples.length) {
      return undefined;
    }

    let best = samples[0];
    let smallestDiff = Math.abs(samples[0].inputAmount - inputAmount);

    for (const sample of samples) {
      const diff = Math.abs(sample.inputAmount - inputAmount);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        best = sample;
      }
    }

    return best;
  }

  private computeDriftBps(basePrice: number, newPrice: number): number {
    if (basePrice === 0 || !isFinite(basePrice) || !isFinite(newPrice)) {
      return Number.POSITIVE_INFINITY;
    }
    return ((newPrice - basePrice) / basePrice) * 10_000;
  }

  private generatePlanId(): string {
    return `plan-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  }
}

class PlanMonitorImpl implements PlanMonitor {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private pending = false;
  private currentPlan: AtomicSwapPlan;

  constructor(
    private readonly router: IntelligentOrderRouter,
    initialPlan: AtomicSwapPlan,
    private readonly overrides: Partial<BuildPlanParams>,
    private readonly handler: PlanUpdateHandler,
    private readonly intervalMs: number
  ) {
    this.currentPlan = initialPlan;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);

    void this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  private async tick(): Promise<void> {
    if (!this.running || this.pending) {
      return;
    }

    this.pending = true;

    try {
      const result = await this.router.adjustPlanIfNeeded(
        this.currentPlan,
        this.overrides
      );

      if (!this.running) {
        return;
      }

      if (result.updated) {
        this.currentPlan = result.plan;
      }

      this.handler(result);
    } finally {
      this.pending = false;
    }
  }
}
