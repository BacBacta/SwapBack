import {
  LiquidityDataCollector,
  calculatePriceImpact,
  estimateAMMOutput,
} from "./LiquidityDataCollector";
import { simulateClobFill, ClobTradeDirection } from "./ClobMath";
import { RouteOptimizationEngine } from "./RouteOptimizationEngine";
import {
  AtomicSwapLeg,
  AtomicSwapPlan,
  LiquiditySource,
  OptimizationConfig,
  OrderbookSnapshot,
  RouteCandidate,
  VenueName,
  VenueQuoteSample,
  VenueSimulationResult,
  VenueType,
  RoutingStrategyMetadata,
  TwapRecommendation,
} from "../types/smart-router";
import { StructuredLogger } from "../utils/StructuredLogger";

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

const DEFAULT_TWAP_TRIGGER_RATIO = (() => {

  const raw = Number(
    process.env.NEXT_PUBLIC_ROUTER_TWAP_TRIGGER_RATIO ?? 0.3
  );
  if (!Number.isFinite(raw)) {
    return 0.3;
  }
  return Math.min(Math.max(raw, 0.05), 0.9);
})();

export class IntelligentOrderRouter {
  private readonly liquidityCollector: LiquidityDataCollector;
  private readonly optimizer: RouteOptimizationEngine;
  private readonly options: IntelligentRouterOptions;
  private readonly logger: StructuredLogger;

  constructor(
    liquidityCollector: LiquidityDataCollector,
    optimizer: RouteOptimizationEngine,
    options?: Partial<IntelligentRouterOptions>
  ) {
    this.liquidityCollector = liquidityCollector;
    this.optimizer = optimizer;
    this.logger = new StructuredLogger("intelligent-router");
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

    const optimizationConfig: OptimizationConfig = {
      ...this.options.optimizationDefaults,
      ...(params.optimization ?? {}),
      slippageTolerance:
        (params.maxSlippageBps ?? this.options.maxSlippageBps) / 10_000,
    } as OptimizationConfig;

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

    const twapHint = this.deriveTwapHint(
      params.inputAmount,
      aggregated.totalDepth,
      aggregated.staleness
    );

    const normalizedFallbacks = fallbackPlans.map((plan) =>
      this.normalizeFallbackPlan(plan, {
        totalDepth: aggregated.totalDepth,
        totalInput: params.inputAmount,
        optimization: optimizationConfig,
        twapHint,
      })
    );

    primaryPlan.strategy = this.buildRoutingStrategyMetadata(primaryPlan, {
      fallbackCount: this.countFallbackPlans(normalizedFallbacks),
      totalDepth: aggregated.totalDepth,
      totalInput: params.inputAmount,
      optimization: optimizationConfig,
      twapHint,
    });
    this.enrichPlanStrategy(primaryPlan);
    primaryPlan.fallbackPlans = normalizedFallbacks;

    this.logger.info("routing_strategy_selected", {
      planId: primaryPlan.id,
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      inputAmount: params.inputAmount,
      profile: primaryPlan.strategy.profile,
      splitVenues: primaryPlan.strategy.splitVenues,
      fallbackCount: primaryPlan.strategy.fallbackCount,
      twapRecommended: primaryPlan.strategy.twap?.recommended ?? false,
      twapSlices: primaryPlan.strategy.twap?.slices,
    });

    this.logger.info("plan_built", {
      planId: primaryPlan.id,
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      totalInput: params.inputAmount,
      expectedOutput: primaryPlan.expectedOutput,
      fallbackCount: primaryPlan.fallbackPlans.length,
      strategy: primaryPlan.strategy,
      legs: primaryPlan.legs.map((leg) => ({
        venue: leg.venue,
        inputAmount: leg.inputAmount,
        expectedOutput: leg.expectedOutput,
        minOutput: leg.minOutput,
      })),
    });

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

  private deriveTwapHint(
    totalInput: number,
    totalDepth: number,
    stalenessMs: number
  ): TwapRecommendation {
    const footprintRatio = totalDepth > 0 ? totalInput / totalDepth : 0;
    const recommended = footprintRatio >= DEFAULT_TWAP_TRIGGER_RATIO;
    const slices = recommended
      ? Math.min(
          10,
          Math.max(
            2,
            Math.ceil(footprintRatio / DEFAULT_TWAP_TRIGGER_RATIO)
          )
        )
      : undefined;

    return {
      recommended,
      triggerRatio: DEFAULT_TWAP_TRIGGER_RATIO,
      footprintRatio,
      slices,
      intervalMs: recommended ? this.options.rebalance.pollIntervalMs : undefined,
      reason: recommended
        ? "liquidity_footprint_exceeds_threshold"
        : stalenessMs > this.options.rebalance.maxStalenessMs
          ? "liquidity_snapshot_stale"
          : undefined,
    };
  }

  private buildRoutingStrategyMetadata(
    plan: AtomicSwapPlan,
    context: {
      fallbackCount: number;
      totalDepth: number;
      totalInput: number;
      optimization: OptimizationConfig;
      twapHint?: TwapRecommendation;
    }
  ): RoutingStrategyMetadata {
    const splitVenues = Array.from(new Set(plan.legs.map((leg) => leg.venue)));
    const splitsEnabled =
      Boolean(context.optimization.enableSplitRoutes ?? true) &&
      splitVenues.length > 1;
    const fallbackEnabled =
      Boolean(context.optimization.enableFallback ?? true) &&
      context.fallbackCount > 0;
    const twap = context.twapHint
      ? { ...context.twapHint }
      : {
          recommended: false,
          triggerRatio: DEFAULT_TWAP_TRIGGER_RATIO,
          footprintRatio:
            context.totalDepth > 0
              ? context.totalInput / context.totalDepth
              : 0,
        };

    const profile = twap.recommended
      ? "twap-assisted"
      : splitsEnabled
        ? "split"
        : "single-venue";

    const notes: string[] = [];
    if (context.optimization.enableSplitRoutes === false) {
      notes.push("splits_disabled_by_config");
    }
    if (context.optimization.enableFallback === false) {
      notes.push("fallback_disabled_by_config");
    }
    if (twap.recommended) {
      notes.push("twap_recommended");
    }

    return {
      profile,
      splitsEnabled,
      splitVenues,
      fallbackEnabled,
      fallbackCount: fallbackEnabled ? context.fallbackCount : 0,
      twap,
      notes: notes.length ? notes : undefined,
    };
  }

  private enrichPlanStrategy(plan: AtomicSwapPlan): void {
    if (!plan.strategy) {
      return;
    }

    plan.strategy.splitVenues = Array.from(
      new Set(plan.legs.map((leg) => leg.venue))
    );

    if (plan.baseRoute) {
      plan.baseRoute.strategy = plan.strategy;
    }

    if (plan.fallbackPlans?.length) {
      plan.fallbackPlans.forEach((fallback) => {
        if (fallback.baseRoute) {
          fallback.baseRoute.strategy = fallback.strategy ?? plan.strategy;
        }
      });
    }
  }

  private normalizeFallbackPlan(
    plan: AtomicSwapPlan,
    context: {
      totalDepth: number;
      totalInput: number;
      optimization: OptimizationConfig;
      twapHint?: TwapRecommendation;
    }
  ): AtomicSwapPlan {
    const normalizedFallbacks = (plan.fallbackPlans ?? []).map((child) =>
      this.normalizeFallbackPlan(child, context)
    );

    const clonedPlan: AtomicSwapPlan = {
      ...plan,
      fallbackPlans: normalizedFallbacks,
    };

    clonedPlan.strategy = this.buildRoutingStrategyMetadata(clonedPlan, {
      fallbackCount: this.countFallbackPlans(normalizedFallbacks),
      totalDepth: context.totalDepth,
      totalInput: context.totalInput,
      optimization: context.optimization,
      twapHint: context.twapHint,
    });

    this.enrichPlanStrategy(clonedPlan);
    return clonedPlan;
  }

  private countFallbackPlans(fallbacks?: AtomicSwapPlan[]): number {
    if (!fallbacks?.length) {
      return 0;
    }

    return fallbacks.reduce((sum, child) => {
      const nested = this.countFallbackPlans(child.fallbackPlans);
      return sum + 1 + nested;
    }, 0);
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
      this.logger.debug("plan_monitor_steady", {
        planId: plan.id,
        reason: evaluation.reason ?? "up_to_date",
        diffs: evaluation.diffs,
      });
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

    this.logger.warn("plan_rebuilt", {
      oldPlanId: plan.id,
      newPlanId: updatedPlan.id,
      reason: evaluation.reason ?? "unspecified",
      diffs: evaluation.diffs,
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

  /**
   * Simulate venue execution using the most accurate model available.
   * For CLOBs we replay against the in-memory orderbook so routing decisions
   * reflect real depth instead of a single top-of-book price. AMMs keep using
   * xy=k math while RFQ venues fall back to their quoted effective price.
   */
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
    let bumpOutputFn: ((amount: number) => number) | undefined;
    let clobFillApplied = false;

    const clobMeta = (source.metadata ?? {}) as {
      direction?: ClobTradeDirection;
      takerFeeBps?: number;
      inverted?: boolean;
    };
    const direction: ClobTradeDirection = clobMeta.direction
      ? clobMeta.direction
      : clobMeta.inverted
        ? "sellQuote"
        : "sellBase";
    const takerFeeBps =
      clobMeta.takerFeeBps ??
      config.takerFeeBps ??
      Math.round(config.feeRate * 10_000);
    const takerFeeRate = takerFeeBps / 10_000;

    if (source.venueType === VenueType.CLOB && source.orderbook) {
      const fillMeta = (source.metadata ?? {}) as {
        direction?: ClobTradeDirection;
        takerFeeBps?: number;
      };
      const directionOverride = fillMeta.direction ?? direction;
      const effectiveTakerFeeBps = fillMeta.takerFeeBps ?? takerFeeBps;
      const computeFill = (amount: number) =>
        simulateClobFill({
          direction: directionOverride,
          inputAmount: amount,
          takerFeeBps: effectiveTakerFeeBps,
          bids: source.orderbook!.bids,
          asks: source.orderbook!.asks,
        });
      const fill = computeFill(inputAmount);

      if (fill) {
        outputAmount = fill.outputAmount;
        effectivePrice = fill.effectivePrice;
        slippagePercent = fill.slippagePercent;
        feeAmount = fill.feeAmount;
        postTradeLiquidity = Math.max(
          source.depth - fill.notionalQuote,
          0
        );
        bumpOutputFn = (amount: number) =>
          computeFill(amount)?.outputAmount ?? fill.outputAmount;
        clobFillApplied = true;
      } else {
        this.logger.warn("clob_fill_simulation_failed", {
          venue: source.venue,
          direction: directionOverride,
          inputAmount,
          takerFeeBps: effectiveTakerFeeBps,
          bidLevels: source.orderbook?.bids.length ?? 0,
          askLevels: source.orderbook?.asks.length ?? 0,
        });
      }
    }

    const fallbackTopOfBook =
      source.topOfBook ?? this.deriveTopOfBook(source.orderbook);

    if (!clobFillApplied) {
      if (
        source.venueType === VenueType.CLOB &&
        fallbackTopOfBook
      ) {
        const top = fallbackTopOfBook;
        const applySellQuoteFallback = () => {
          if (top.askPrice <= 0) {
            return false;
          }
          const netQuote = inputAmount * (1 - takerFeeRate);
          outputAmount = netQuote / top.askPrice;
          feeAmount = inputAmount * takerFeeRate;
          effectivePrice =
            (inputAmount + feeAmount) /
            Math.max(outputAmount, this.options.epsilonAmount);
          slippagePercent = source.slippagePercent;
          postTradeLiquidity = Math.max(source.depth - inputAmount, 0);
          bumpOutputFn = (amount: number) =>
            (amount * (1 - takerFeeRate)) / top.askPrice;
          return true;
        };

        const applySellBaseFallback = () => {
          if (top.bidPrice <= 0) {
            return false;
          }
          const grossQuote = inputAmount * top.bidPrice;
          feeAmount = grossQuote * takerFeeRate;
          outputAmount = grossQuote - feeAmount;
          effectivePrice =
            inputAmount /
            Math.max(outputAmount, this.options.epsilonAmount);
          slippagePercent = source.slippagePercent;
          postTradeLiquidity = Math.max(source.depth - grossQuote, 0);
          bumpOutputFn = (amount: number) => {
            const gross = amount * top.bidPrice;
            const fee = gross * takerFeeRate;
            return gross - fee;
          };
          return true;
        };

        const appliedFallback =
          direction === "sellQuote"
            ? applySellQuoteFallback()
            : applySellBaseFallback();

        clobFillApplied = appliedFallback;
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
        postTradeLiquidity = Math.max(
          source.reserves.output - outputAmount,
          0
        );
        bumpOutputFn = (amount: number) =>
          estimateAMMOutput(
            amount,
            source.reserves!.input,
            source.reserves!.output,
            config.feeRate
          );
      } else {
        outputAmount = inputAmount / source.effectivePrice;
        effectivePrice = source.effectivePrice;
        slippagePercent = source.slippagePercent;
        postTradeLiquidity = source.depth - inputAmount;
        bumpOutputFn = (amount: number) =>
          amount /
          Math.max(source.effectivePrice, this.options.epsilonAmount);
      }
    }

    const delta = Math.max(inputAmount * 0.01, this.options.epsilonAmount);
    const bumpedOutput = bumpOutputFn
      ? bumpOutputFn(inputAmount + delta)
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

  private deriveTopOfBook(
    snapshot?: OrderbookSnapshot
  ): LiquiditySource["topOfBook"] | undefined {
    if (!snapshot) {
      return undefined;
    }

    const bestBid = snapshot.bids.find(
      (level) => level.price > this.options.epsilonAmount && level.size > 0
    );
    const bestAsk = snapshot.asks.find(
      (level) => level.price > this.options.epsilonAmount && level.size > 0
    );

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
