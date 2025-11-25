/**
 * SwapExecutor - Main orchestrator for atomic multi-venue swaps
 *
 * Coordinates all services to execute swaps with:
 * - Real-time liquidity aggregation (CLOBs, AMMs, RFQs)
 * - Intelligent route optimization (greedy cost minimization)
 * - Dual oracle price verification (Pyth + Switchboard)
 * - MEV protection via Jito atomic bundling
 * - Circuit breaker safety
 * - Comprehensive analytics logging
 *
 * @module SwapExecutor
 */

import { promises as fs } from "fs";
import * as path from "path";
import bs58 from "bs58";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  Signer,
  SystemProgram,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import { LiquidityDataCollector } from "./LiquidityDataCollector";
import { RouteOptimizationEngine } from "./RouteOptimizationEngine";
import { OraclePriceService } from "./OraclePriceService";
import { CircuitBreaker } from "../utils/circuit-breaker";
import {
  BuildPlanParams,
  IntelligentOrderRouter,
  PlanAdjustmentResult,
  PlanDiff,
} from "./IntelligentOrderRouter";
import {
  AtomicSwapPlan,
  AtomicSwapLeg,
  RouteCandidate,
  OptimizationConfig,
  VenueName,
  VenueType,
  OraclePriceData,
  OracleVerificationDetail,
  BundleEligibilityResult,
} from "../types/smart-router";
import { JitoBundleService, MEVProtectionAnalyzer } from "./JitoBundleService";

const SWAPBACK_ROUTER_PROGRAM_ID = new PublicKey(
  "FPK46poe53iX6Bcv3q8cgmc1jm7dJKQ9Qs9oESFxGN55"
);

const JUPITER_AGGREGATOR_PROGRAM_ID = new PublicKey(
  "JUP4sxrRzkF3EFRQ3SExvxBH5yDcszb1VSEi8PvX8Br"
);

const SYSTEM_PROGRAM_ID = new PublicKey("11111111111111111111111111111111");

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface SwapParams {
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  maxSlippageBps: number;
  slippageTolerance?: number;
  userPublicKey: PublicKey;
  signer: Signer;
  minOutputAmount?: number;
  routePreferences?: RoutePreferences;
}

export interface RoutePreferences {
  preferredVenues?: VenueName[];
  excludedVenues?: VenueName[];
  maxHops?: number;
  enableMevProtection?: boolean;
  outputTokenAccount?: string;
  enableFallbackRouting?: boolean;
  enableTwapMode?: boolean;
  twapThresholdRatio?: number;
  twapMaxSlices?: number;
  twapIntervalMs?: number;
}

export interface SwapResult {
  signature: string;
  signatures?: string[];
  routes: RouteCandidate[];
  metrics: SwapMetrics;
  success: boolean;
  error?: string;
}

export interface SwapMetrics {
  executionTimeMs: number;
  outputAmount: number;
  actualSlippage: number;
  priceImpact: number;
  totalFees: number;
  feeBreakdown: {
    dexFees: number;
    networkFees: number;
    priorityFees: number;
    jitoTip: number;
  };
  mevSavings: number;
  venueBreakdown: Record<VenueName, number>;
  routeCount: number;
  oraclePrice: number;
  oracleVerified: boolean;
}
/**
 * Route preferences for advanced users
/**
 * Swap execution metrics for analytics
 */
export interface SwapMetrics {
  /** Total execution time (ms) */
  executionTimeMs: number;
  /** Actual output amount received */
  outputAmount: number;
  /** Actual slippage experienced (%) */
  actualSlippage: number;
  /** Price impact (%) */
  priceImpact: number;
  /** Total fees paid (input token units) */
  totalFees: number;
  /** Fee breakdown by type */
  feeBreakdown: {
    dexFees: number;
    networkFees: number;
    priorityFees: number;
    jitoTip: number;
  };
  /** MEV savings (estimated) */
  mevSavings: number;
  /** Venue breakdown (how much routed to each venue) */
  venueBreakdown: Record<VenueName, number>;
  /** Number of routes used */
  routeCount: number;
  /** Oracle price at execution */
  oraclePrice: number;
  /** Whether oracle verification passed */
  oracleVerified: boolean;
}

/**
 * Internal execution context
 */
interface ExecutionContext {
  startTime: number;
  routes: RouteCandidate[];
  oraclePrice: number;
  transaction?: Transaction;
  signature?: string;
  chunkSignatures?: string[];
  plan?: AtomicSwapPlan;
  legs?: AtomicSwapLeg[];
  planDiffs?: PlanDiff[];
  planRefreshReason?: string;
  planRefreshIterations?: number;
  lastPlanAdjustment?: PlanAdjustmentResult;
  globalMinOutput?: number;
  inputOracle?: OraclePriceData;
  outputOracle?: OraclePriceData;
  inputOracleDetail?: OracleVerificationDetail;
  outputOracleDetail?: OracleVerificationDetail;
  tradeValueUSD?: number;
  bundleId?: string;
  bundleEligibility?: BundleEligibilityResult;
  mevStrategy?: "jito" | "quicknode" | "direct";
  mevTipLamports?: number;
  priorityFeeMicroLamports?: number;
  computeUnitLimit?: number;
  outputAccount?: PublicKey;
  preSwapOutputBalanceRaw?: bigint;
  guardMinOutputRaw?: bigint;
  outputDecimals?: number;
  slippageTolerance?: number;
  twapSlices?: number;
}

interface PlanRefreshSummary {
  plan: AtomicSwapPlan;
  diffs: PlanDiff[];
  reason?: string;
  iterations: number;
  lastAdjustment?: PlanAdjustmentResult;
}

interface TwapConfig {
  enabled: boolean;
  slices: number;
  intervalMs: number;
  thresholdRatio: number;
  liquidityDepth?: number;
  footprintRatio?: number;
  liquidityStalenessMs?: number;
}

interface TwapSliceDescriptor {
  params: SwapParams;
  isFirst: boolean;
}

// ============================================================================
// SWAP EXECUTOR CLASS
// ============================================================================

export class SwapExecutor {
  private readonly connection: Connection;
  private readonly liquidityCollector: LiquidityDataCollector;
  private readonly optimizer: RouteOptimizationEngine;
  private readonly router: IntelligentOrderRouter;
  private readonly oracleService: OraclePriceService;
  private readonly jitoService: JitoBundleService;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly analyticsLogPath: string;
  private readonly mevAnalyzer: MEVProtectionAnalyzer;
  private readonly mintDecimalsCache = new Map<string, number>();

  constructor(
    connection: Connection,
    liquidityCollector: LiquidityDataCollector,
    optimizer: RouteOptimizationEngine,
    router: IntelligentOrderRouter,
    oracleService: OraclePriceService,
    jitoService: JitoBundleService,
    circuitBreaker: CircuitBreaker
  ) {
    this.connection = connection;
    this.liquidityCollector = liquidityCollector;
    this.optimizer = optimizer;
    this.router = router;
    this.oracleService = oracleService;
    this.jitoService = jitoService;
    this.circuitBreaker = circuitBreaker;
    this.analyticsLogPath = path.resolve(
      process.cwd(),
      "logs",
      "swap-metrics.log"
    );
    this.mevAnalyzer = new MEVProtectionAnalyzer();
  }

  /**
   * Execute atomic multi-venue swap
   *
   * @param params - Swap parameters
   * @returns Swap result with signature and metrics
   *
   * @example
   * ```typescript
   * const result = await executor.executeSwap({
   *   inputMint: 'So11111111111111111111111111111111111111112', // SOL
   *   outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
   *   inputAmount: 1.5, // 1.5 SOL
   *   maxSlippageBps: 50, // 0.5%
   *   userPublicKey: wallet.publicKey,
   *   signer: wallet.payer,
   * });
   *
   * console.log('Swap signature:', result.signature);
   * console.log('Output amount:', result.metrics.outputAmount, 'USDC');
   * console.log('MEV savings:', result.metrics.mevSavings);
   * ```
   */
  async executeSwap(params: SwapParams): Promise<SwapResult> {
    const ctx: ExecutionContext = {
      startTime: Date.now(),
      routes: [],
      oraclePrice: 0,
    };

    try {
      const { tolerance: slippageTolerance, maxSlippageBps } =
        this.resolveSlippage(params);
      ctx.slippageTolerance = slippageTolerance;

      await this.checkCircuitBreaker();

      console.log("📊 Building intelligent routing plan...");

      const { plan: finalPlan, summary: refreshSummary } =
        await this.buildStablePlan(params, slippageTolerance, maxSlippageBps);

      ctx.planDiffs = refreshSummary.diffs;
      ctx.planRefreshReason = refreshSummary.reason;
      ctx.planRefreshIterations = refreshSummary.iterations;
      ctx.lastPlanAdjustment = refreshSummary.lastAdjustment;
      ctx.plan = finalPlan;
      ctx.legs = finalPlan.legs;

      const fallbackEnabled =
        params.routePreferences?.enableFallbackRouting ?? true;
      const candidatePlans = fallbackEnabled
        ? this.prepareCandidatePlans(finalPlan)
        : [finalPlan];

      await this.runPlanWithFallback(
        params,
        candidatePlans,
        ctx,
        slippageTolerance
      );

      // Step 7: Calculate metrics
      const metrics = await this.calculateMetrics(params, ctx);

      // Step 8: Log analytics
      await this.logSwapMetrics(params, ctx, metrics);

      // Record success in circuit breaker
      this.circuitBreaker.recordSuccess();

      return {
        signature: ctx.signature!,
        signatures: ctx.chunkSignatures,
        routes: ctx.routes,
        metrics,
        success: true,
      };
    } catch (error) {
      // Handle errors and log failure
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Record failure in circuit breaker (unless it's already tripped)
      if (!this.circuitBreaker.isTripped()) {
        this.circuitBreaker.recordFailure();
      }

      await this.logSwapFailure(params, ctx, errorMessage);

      return {
        signature: ctx.signature || "",
        signatures: ctx.chunkSignatures,
        routes: ctx.routes,
        metrics: this.getEmptyMetrics(),
        success: false,
        error: errorMessage,
      };
    }
  }

  private resolveSlippage(params: SwapParams): {
    tolerance: number;
    maxSlippageBps: number;
  } {
    const requestedTolerance =
      params.slippageTolerance ?? params.maxSlippageBps / 10_000;
    const tolerance = Math.min(Math.max(requestedTolerance, 0.0001), 0.99);

    return {
      tolerance,
      maxSlippageBps: this.toEffectiveSlippageBps(tolerance),
    };
  }

  private async buildStablePlan(
    params: SwapParams,
    slippageTolerance: number,
    effectiveMaxSlippageBps: number
  ): Promise<{ plan: AtomicSwapPlan; summary: PlanRefreshSummary }> {
    const optimizationOverrides = this.buildOptimizationOverrides(
      params,
      slippageTolerance
    );

    const initialPlan = await this.router.buildAtomicPlan({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      inputAmount: params.inputAmount,
      maxSlippageBps: effectiveMaxSlippageBps,
      optimization:
        optimizationOverrides && Object.keys(optimizationOverrides).length
          ? optimizationOverrides
          : undefined,
    });

    const planOverrides = this.buildPlanOverrides(
      params,
      optimizationOverrides,
      effectiveMaxSlippageBps
    );

    const summary = await this.refreshPlanUntilStable(
      initialPlan,
      planOverrides
    );

    if (!summary.plan.legs.length) {
      throw new Error("No executable legs were generated for the swap plan");
    }

    if (Date.now() > summary.plan.expiresAt) {
      throw new Error("Swap quote expired before execution could start");
    }

    return { plan: summary.plan, summary };
  }

  private async runPlanWithFallback(
    params: SwapParams,
    candidatePlans: AtomicSwapPlan[],
    ctx: ExecutionContext,
    slippageTolerance: number
  ): Promise<void> {
    let lastError: unknown;

    for (const candidatePlan of candidatePlans) {
      try {
        await this.executePlanCandidate(
          params,
          candidatePlan,
          ctx,
          slippageTolerance
        );

        if (!ctx.signature) {
          throw new Error(
            "Candidate plan execution did not produce a signature"
          );
        }

        return;
      } catch (attemptError) {
        lastError = attemptError;
        const reason =
          attemptError instanceof Error
            ? attemptError.message
            : String(attemptError);
        console.warn(`Fallback plan ${candidatePlan.id} failed: ${reason}`);
      }
    }

    const errorMessage =
      lastError instanceof Error
        ? lastError.message
        : "All swap routes failed to execute";
    throw new Error(errorMessage);
  }

  private prepareCandidatePlans(plan: AtomicSwapPlan): AtomicSwapPlan[] {
    const candidates: AtomicSwapPlan[] = [];
    const queue: AtomicSwapPlan[] = [plan];
    const seen = new Set<string>();

    while (queue.length && candidates.length < 5) {
      const next = queue.shift();
      if (!next || seen.has(next.id)) {
        continue;
      }

      seen.add(next.id);
      if (next.baseRoute && next.strategy) {
        next.baseRoute.strategy = next.strategy;
      }
      candidates.push(next);

      if (next.fallbackPlans?.length) {
        queue.push(...next.fallbackPlans);
      }
    }

    return candidates.sort((a, b) => this.rankPlan(b) - this.rankPlan(a));
  }

  private rankPlan(plan: AtomicSwapPlan): number {
    const route = plan.baseRoute;
    if (!route) {
      return 0;
    }

    let score = 0;

    for (const split of route.splits) {
      const venueType = split.liquiditySource?.venueType ?? VenueType.AMM;
      switch (venueType) {
        case VenueType.CLOB:
          score += 80;
          break;
        case VenueType.RFQ:
          score += 60;
          break;
        case VenueType.AMM:
        default:
          score += 30;
          break;
      }

      const fee = split.liquiditySource?.feeAmount ?? 0;
      if (fee <= 0.0005) {
        score += 10;
      }
    }

    score -= route.hops * 5;

    return score;
  }

  private async executePlanCandidate(
    params: SwapParams,
    plan: AtomicSwapPlan,
    ctx: ExecutionContext,
    slippageTolerance: number
  ): Promise<void> {
    const twapConfig = this.evaluateTwapConfig(params, plan);

    if (twapConfig.enabled) {
      await this.executeTwapSlices(
        params,
        plan,
        ctx,
        slippageTolerance,
        twapConfig
      );
      return;
    }

    const attemptCtx = await this.executeSinglePlanAttempt(
      params,
      plan,
      ctx,
      slippageTolerance
    );

    this.applyExecutionResult(ctx, attemptCtx, { appendRoutes: false });
  }

  private async executeSinglePlanAttempt(
    params: SwapParams,
    plan: AtomicSwapPlan,
    baseCtx: ExecutionContext,
    slippageTolerance: number
  ): Promise<ExecutionContext> {
    if (Date.now() > plan.expiresAt) {
      throw new Error("Swap quote expired before execution could start");
    }

    const attemptCtx = this.cloneExecutionContext(baseCtx);
    attemptCtx.plan = plan;
    attemptCtx.legs = plan.legs;
    attemptCtx.routes = plan.baseRoute ? [plan.baseRoute] : [];

    const minOutputCandidate = Math.max(
      params.minOutputAmount ?? 0,
      plan.minOutput,
      plan.expectedOutput * (1 - slippageTolerance)
    );
    const globalMinOutput = Math.min(plan.expectedOutput, minOutputCandidate);
    attemptCtx.globalMinOutput = globalMinOutput;

    const oracleCheck = await this.verifyOraclePrice(params, plan);
    attemptCtx.oraclePrice = oracleCheck.rate;
    attemptCtx.inputOracle = oracleCheck.inputPrice;
    attemptCtx.outputOracle = oracleCheck.outputPrice;
    attemptCtx.inputOracleDetail = oracleCheck.inputDetail;
    attemptCtx.outputOracleDetail = oracleCheck.outputDetail;

    await this.prepareOutputAccountContext(
      params,
      plan,
      globalMinOutput,
      slippageTolerance,
      attemptCtx
    );

    attemptCtx.transaction = await this.buildTransaction(
      params,
      plan,
      globalMinOutput,
      attemptCtx
    );
    attemptCtx.tradeValueUSD = this.estimateTradeValueUSD(plan, attemptCtx);

    // Determine bundle eligibility with detailed analysis
    const bundleEligibility = this.mevAnalyzer.isEligibleForBundling(
      plan.baseRoute, // Use base route instead of routes[0]
      attemptCtx.tradeValueUSD,
      params.inputMint,
      params.inputAmount
    );

    // Allow user override but default to eligibility analysis
    const userEnabledMevProtection = params.routePreferences?.enableMevProtection;
    const enableMevProtection =
      userEnabledMevProtection !== undefined
        ? userEnabledMevProtection
        : bundleEligibility.eligible;

    // Log bundle decision
    if (enableMevProtection) {
      console.log(
        `🛡️  MEV Protection ENABLED - ${bundleEligibility.reason}`
      );
      console.log(`   Risk Level: ${bundleEligibility.riskLevel}`);
      console.log(
        `   Recommended Tip: ${bundleEligibility.recommendedTipLamports} lamports`
      );
      console.log(`   Factors:`, {
        valueThreshold: bundleEligibility.eligibilityFactors.meetsValueThreshold,
        highRisk: bundleEligibility.eligibilityFactors.hasHighMEVRisk,
        ammOnly: bundleEligibility.eligibilityFactors.isAMMOnly,
        highSlippage: bundleEligibility.eligibilityFactors.hasHighSlippage,
      });
    } else {
      console.log(`📤 Direct Submission - ${bundleEligibility.reason}`);
    }

    // Store eligibility info in context
    attemptCtx.bundleEligibility = bundleEligibility;

    const bundleResult = await this.submitProtectedBundle(
      params,
      plan,
      attemptCtx,
      attemptCtx.transaction,
      params.signer,
      enableMevProtection
    );

    attemptCtx.signature = bundleResult.signature;
    attemptCtx.bundleId = bundleResult.bundleId;
    attemptCtx.mevTipLamports = bundleResult.tip;
    attemptCtx.mevStrategy = bundleResult.strategy;

    if (!attemptCtx.signature) {
      throw new Error(
        "Bundle submission did not return a transaction signature"
      );
    }

    await this.confirmTransaction(attemptCtx.signature);

    return attemptCtx;
  }

  private cloneExecutionContext(baseCtx: ExecutionContext): ExecutionContext {
    return {
      startTime: baseCtx.startTime,
      routes: [],
      oraclePrice: baseCtx.oraclePrice,
      transaction: undefined,
      signature: undefined,
      chunkSignatures: baseCtx.chunkSignatures
        ? [...baseCtx.chunkSignatures]
        : undefined,
      plan: undefined,
      legs: undefined,
      planDiffs: baseCtx.planDiffs,
      planRefreshReason: baseCtx.planRefreshReason,
      planRefreshIterations: baseCtx.planRefreshIterations,
      lastPlanAdjustment: baseCtx.lastPlanAdjustment,
      globalMinOutput: undefined,
      inputOracle: baseCtx.inputOracle,
      outputOracle: baseCtx.outputOracle,
      inputOracleDetail: baseCtx.inputOracleDetail,
      outputOracleDetail: baseCtx.outputOracleDetail,
      tradeValueUSD: undefined,
      bundleId: undefined,
      mevStrategy: undefined,
      mevTipLamports: undefined,
      priorityFeeMicroLamports: baseCtx.priorityFeeMicroLamports,
      computeUnitLimit: baseCtx.computeUnitLimit,
      outputAccount: baseCtx.outputAccount,
      preSwapOutputBalanceRaw: undefined,
      guardMinOutputRaw: undefined,
      outputDecimals: baseCtx.outputDecimals,
      slippageTolerance: baseCtx.slippageTolerance,
      twapSlices: baseCtx.twapSlices,
    };
  }

  private applyExecutionResult(
    target: ExecutionContext,
    result: ExecutionContext,
    options: { appendRoutes: boolean }
  ): void {
    if (options.appendRoutes) {
      target.routes.push(...result.routes);
    } else {
      target.routes = result.routes;
    }

    target.plan = result.plan;
    target.legs = result.legs;
    target.transaction = result.transaction;
    target.signature = result.signature;
    target.bundleId = result.bundleId;
    target.mevStrategy = result.mevStrategy;
    target.mevTipLamports = result.mevTipLamports;
    target.priorityFeeMicroLamports = result.priorityFeeMicroLamports;
    target.computeUnitLimit = result.computeUnitLimit;
    target.tradeValueUSD = result.tradeValueUSD;
    target.globalMinOutput = result.globalMinOutput;
    target.outputAccount = result.outputAccount;
    target.preSwapOutputBalanceRaw = result.preSwapOutputBalanceRaw;
    target.guardMinOutputRaw = result.guardMinOutputRaw;
    target.outputDecimals = result.outputDecimals;
    target.oraclePrice = result.oraclePrice;
    target.inputOracle = result.inputOracle;
    target.outputOracle = result.outputOracle;
    target.inputOracleDetail = result.inputOracleDetail;
    target.outputOracleDetail = result.outputOracleDetail;

    if (result.chunkSignatures?.length) {
      target.chunkSignatures = result.chunkSignatures;
    }
  }

  private evaluateTwapConfig(
    params: SwapParams,
    plan: AtomicSwapPlan
  ): TwapConfig {
    const preferences = params.routePreferences;
    const strategy = plan.strategy;
    const twapHint = strategy?.twap;
    const explicitDisable = preferences?.enableTwapMode === false;
    const userOptIn = preferences?.enableTwapMode === true;
    const autoEligible = Boolean(twapHint?.recommended) && !explicitDisable;
    const enabled = userOptIn || autoEligible;
    const threshold = Math.min(
      0.9,
      Math.max(
        preferences?.twapThresholdRatio ?? twapHint?.triggerRatio ?? 0.2,
        0.05
      )
    );
    const hintedSlices = twapHint?.slices;
    const maxSlices = Math.min(
      Math.max(preferences?.twapMaxSlices ?? hintedSlices ?? 3, 2),
      10
    );
    const intervalMs = Math.max(
      0,
      preferences?.twapIntervalMs ?? twapHint?.intervalMs ?? 2_000
    );
    const liquidityFootprint = this.computePlanLiquidityFootprint(plan);
    const footprintRatio =
      twapHint?.footprintRatio ??
      (liquidityFootprint > 0
        ? plan.totalInput / liquidityFootprint
        : undefined);
    const stalenessReason =
      twapHint?.reason === "liquidity_snapshot_stale"
        ? plan.maxStalenessMs
        : undefined;

    const disabledConfig: TwapConfig = {
      enabled: false,
      slices: 1,
      intervalMs: 0,
      thresholdRatio: threshold,
      liquidityDepth: liquidityFootprint > 0 ? liquidityFootprint : undefined,
      footprintRatio,
      liquidityStalenessMs: stalenessReason,
    };

    if (!enabled) {
      return disabledConfig;
    }

    let slices: number;
    if (hintedSlices && autoEligible && !userOptIn) {
      slices = hintedSlices;
    } else if (footprintRatio && footprintRatio > 0) {
      slices = Math.ceil(footprintRatio / threshold);
    } else {
      slices = 2;
    }

    slices = Math.min(maxSlices, Math.max(2, slices));

    return {
      enabled: true,
      slices,
      intervalMs,
      thresholdRatio: threshold,
      liquidityDepth: liquidityFootprint > 0 ? liquidityFootprint : undefined,
      footprintRatio,
      liquidityStalenessMs: stalenessReason,
    };
  }

  private async executeTwapSlices(
    params: SwapParams,
    initialPlan: AtomicSwapPlan,
    ctx: ExecutionContext,
    slippageTolerance: number,
    config: TwapConfig
  ): Promise<void> {
    const sliceSignatures: string[] = [];
    const aggregatedRoutes: RouteCandidate[] = [];
    let aggregateTradeValue = 0;

    const totalAmount = params.inputAmount;
    const totalMinOutput = params.minOutputAmount ?? 0;
    const baseSliceAmount = totalAmount / config.slices;

    for (let index = 0; index < config.slices; index += 1) {
      const sliceDescriptor = this.buildTwapSliceDescriptor(
        index,
        config,
        totalAmount,
        baseSliceAmount,
        totalMinOutput,
        params
      );

      const sliceCtx = await this.processTwapSlice(
        index,
        sliceDescriptor,
        initialPlan,
        ctx,
        slippageTolerance
      );

      sliceSignatures.push(sliceCtx.signature!);
      aggregatedRoutes.push(...sliceCtx.routes);
      aggregateTradeValue += sliceCtx.tradeValueUSD ?? 0;

      ctx.chunkSignatures = ctx.chunkSignatures
        ? [...ctx.chunkSignatures, sliceCtx.signature!]
        : [sliceCtx.signature!];

      this.applyExecutionResult(ctx, sliceCtx, { appendRoutes: true });

      await this.awaitTwapInterval(index, config);
    }

    ctx.routes = aggregatedRoutes;
    ctx.signature = sliceSignatures[sliceSignatures.length - 1];
    ctx.tradeValueUSD = aggregateTradeValue;
    ctx.twapSlices = config.slices;
  }

  private buildSliceParams(
    params: SwapParams,
    sliceAmount: number,
    sliceMinOutput?: number
  ): SwapParams {
    return {
      ...params,
      inputAmount: sliceAmount,
      minOutputAmount: sliceMinOutput,
    };
  }

  private buildTwapSliceDescriptor(
    index: number,
    config: TwapConfig,
    totalAmount: number,
    baseSliceAmount: number,
    totalMinOutput: number,
    params: SwapParams
  ): TwapSliceDescriptor {
    const isLast = index === config.slices - 1;
    const sliceAmount = isLast
      ? totalAmount - baseSliceAmount * index
      : baseSliceAmount;
    const ratio = totalAmount > 0 ? sliceAmount / totalAmount : 0;
    const sliceMinOutput =
      totalMinOutput > 0 ? totalMinOutput * ratio : undefined;

    return {
      params: this.buildSliceParams(params, sliceAmount, sliceMinOutput),
      isFirst: index === 0,
    };
  }

  private async processTwapSlice(
    index: number,
    descriptor: TwapSliceDescriptor,
    initialPlan: AtomicSwapPlan,
    ctx: ExecutionContext,
    slippageTolerance: number
  ): Promise<ExecutionContext> {
    const slicePlan = descriptor.isFirst
      ? initialPlan
      : await this.rebuildPlanForAmount(descriptor.params, slippageTolerance);

    const sliceCtx = await this.executeTwapPlanWithFallback(
      descriptor.params,
      slicePlan,
      ctx,
      slippageTolerance
    );

    if (!sliceCtx?.signature) {
      throw new Error(`TWAP slice ${index + 1} failed to produce a signature`);
    }

    return sliceCtx;
  }

  private async awaitTwapInterval(
    index: number,
    config: TwapConfig
  ): Promise<void> {
    if (index >= config.slices - 1) {
      return;
    }

    if (config.intervalMs <= 0) {
      return;
    }

    await this.delay(config.intervalMs);
  }

  private async executeTwapPlanWithFallback(
    sliceParams: SwapParams,
    slicePlan: AtomicSwapPlan,
    ctx: ExecutionContext,
    slippageTolerance: number
  ): Promise<ExecutionContext> {
    const candidatePlans = this.prepareCandidatePlans(slicePlan);
    let lastError: unknown;

    for (const candidate of candidatePlans) {
      try {
        return await this.executeSinglePlanAttempt(
          sliceParams,
          candidate,
          ctx,
          slippageTolerance
        );
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("TWAP slice execution failed");
  }

  private async rebuildPlanForAmount(
    params: SwapParams,
    slippageTolerance: number
  ): Promise<AtomicSwapPlan> {
    const optimizationOverrides = this.buildOptimizationOverrides(
      params,
      slippageTolerance
    );
    const maxSlippageBps = this.toEffectiveSlippageBps(slippageTolerance);

    const basePlan = await this.router.buildAtomicPlan({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      inputAmount: params.inputAmount,
      maxSlippageBps,
      optimization:
        optimizationOverrides && Object.keys(optimizationOverrides).length
          ? optimizationOverrides
          : undefined,
    });

    const planOverrides = this.buildPlanOverrides(
      params,
      optimizationOverrides,
      maxSlippageBps
    );

    const summary = await this.refreshPlanUntilStable(basePlan, planOverrides);
    return summary.plan;
  }

  private computePlanLiquidityFootprint(plan: AtomicSwapPlan): number {
    if (!plan.legs?.length) {
      return 0;
    }

    return plan.legs.reduce((acc, leg) => {
      const depth = leg.liquiditySource?.depth ?? 0;
      return acc + Math.max(depth, 0);
    }, 0);
  }

  private toEffectiveSlippageBps(slippageTolerance: number): number {
    return Math.max(1, Math.round(slippageTolerance * 10_000));
  }

  private async delay(ms: number): Promise<void> {
    if (ms <= 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if circuit breaker is tripped
   */
  private async checkCircuitBreaker(): Promise<void> {
    if (this.circuitBreaker.isTripped()) {
      const nextRetry = this.circuitBreaker.getNextRetryTime();
      const waitTime = Math.ceil((nextRetry - Date.now()) / 1000);

      throw new Error(
        `Circuit breaker is active. System paused due to repeated failures. ` +
          `Retry in ${waitTime} seconds.`
      );
    }
  }

  private buildOptimizationOverrides(
    params: SwapParams,
    slippageTolerance: number
  ): Partial<OptimizationConfig> {
    const overrides: Partial<OptimizationConfig> = {
      slippageTolerance,
    };

    if (typeof params.minOutputAmount === "number") {
      overrides.minOutputAmount = params.minOutputAmount;
    }

    const preferences = params.routePreferences;
    if (preferences?.preferredVenues?.length) {
      overrides.allowedVenues = preferences.preferredVenues;
    }

    if (preferences?.excludedVenues?.length) {
      overrides.excludedVenues = preferences.excludedVenues;
    }

    if (typeof preferences?.maxHops === "number") {
      overrides.maxHops = preferences.maxHops;
    }

    if (typeof preferences?.enableMevProtection === "boolean") {
      overrides.useBundling = preferences.enableMevProtection;
    }

    return overrides;
  }

  private buildPlanOverrides(
    params: SwapParams,
    optimizationOverrides: Partial<OptimizationConfig>,
    effectiveMaxSlippageBps: number
  ): Partial<BuildPlanParams> {
    const overrides: Partial<BuildPlanParams> = {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      inputAmount: params.inputAmount,
      maxSlippageBps: effectiveMaxSlippageBps,
    };

    if (Object.keys(optimizationOverrides).length > 0) {
      overrides.optimization = optimizationOverrides;
    }

    return overrides;
  }

  private async refreshPlanUntilStable(
    initialPlan: AtomicSwapPlan,
    overrides: Partial<BuildPlanParams>,
    maxIterations = 3
  ): Promise<PlanRefreshSummary> {
    let plan = initialPlan;
    let iterations = 0;
    let lastAdjustment: PlanAdjustmentResult | undefined;
    const collectedDiffs: PlanDiff[] = [];

    while (iterations < maxIterations) {
      iterations += 1;
      const adjustment = await this.router.adjustPlanIfNeeded(plan, overrides);
      lastAdjustment = adjustment;
      collectedDiffs.push(...adjustment.diffs);

      if (!adjustment.updated) {
        return {
          plan,
          diffs: this.consolidateDiffs(collectedDiffs),
          reason: adjustment.reason ?? "plan_stable",
          iterations,
          lastAdjustment: adjustment,
        };
      }

      plan = adjustment.plan;

      if (!adjustment.reason) {
        break;
      }
    }

    return {
      plan,
      diffs: this.consolidateDiffs(collectedDiffs),
      reason: lastAdjustment?.reason ?? "plan_rebalanced",
      iterations,
      lastAdjustment,
    };
  }

  private consolidateDiffs(diffs: PlanDiff[]): PlanDiff[] {
    if (!diffs.length) {
      return [];
    }

    const byVenue = new Map<VenueName, PlanDiff>();
    for (const diff of diffs) {
      byVenue.set(diff.venue, diff);
    }

    return Array.from(byVenue.values());
  }

  private formatAgeMs(ageMs: number): string {
    if (!Number.isFinite(ageMs) || ageMs < 0) {
      return "unknown";
    }

    if (ageMs < 1000) {
      return `${Math.round(ageMs)}ms`;
    }

    if (ageMs < 60_000) {
      return `${(ageMs / 1000).toFixed(2)}s`;
    }

    return `${(ageMs / 60_000).toFixed(2)}m`;
  }

  private estimateTradeValueUSD(
    plan: AtomicSwapPlan,
    ctx: ExecutionContext
  ): number {
    if (ctx.inputOracle) {
      return plan.totalInput * ctx.inputOracle.price;
    }

    if (ctx.outputOracle) {
      return plan.expectedOutput * ctx.outputOracle.price;
    }

    return plan.totalInput;
  }

  private determineTipLamports(tradeValueUSD?: number): number {
    if (!tradeValueUSD || tradeValueUSD <= 0) {
      return 10_000;
    }

    const recommended = Math.floor(
      this.mevAnalyzer.calculateRecommendedTip(tradeValueUSD)
    );

    return Math.max(5_000, Math.min(200_000, recommended));
  }

  private determinePriorityLevel(
    tradeValueUSD?: number
  ): "low" | "medium" | "high" {
    if (!tradeValueUSD || tradeValueUSD < 5_000) {
      return "low";
    }

    if (tradeValueUSD > 50_000) {
      return "high";
    }

    if (tradeValueUSD > 10_000) {
      return "medium";
    }

    return "medium";
  }

  private determinePriorityFeeMicroLamports(
    plan: AtomicSwapPlan,
    tradeValueUSD?: number
  ): number {
    const base = this.estimatePriorityFeeMicroLamports(plan);

    if (!tradeValueUSD || tradeValueUSD <= 0) {
      return base;
    }

    if (tradeValueUSD > 50_000) {
      return Math.min(base * 3, 1_000_000);
    }

    if (tradeValueUSD > 10_000) {
      return Math.min(base * 2, 1_000_000);
    }

    if (tradeValueUSD < 2_000) {
      return Math.max(1, Math.floor(base * 0.8));
    }

    return base;
  }

  private async prepareOutputAccountContext(
    params: SwapParams,
    plan: AtomicSwapPlan,
    globalMinOutput: number,
    slippageTolerance: number,
    ctx: ExecutionContext
  ): Promise<void> {
    const outputMintKey = this.safePublicKey(plan.outputMint);
    const outputDecimals = await this.getMintDecimals(plan.outputMint);
    ctx.outputDecimals = outputDecimals;

    const overrideAccount = params.routePreferences?.outputTokenAccount;
    const outputAccount = overrideAccount
      ? this.safePublicKey(overrideAccount)
      : getAssociatedTokenAddressSync(outputMintKey, params.userPublicKey);

    ctx.outputAccount = outputAccount;

    try {
      const balance =
        await this.connection.getTokenAccountBalance(outputAccount);
      ctx.preSwapOutputBalanceRaw = BigInt(balance.value.amount);
    } catch (error) {
      console.warn("Unable to fetch output account balance", error);
      ctx.preSwapOutputBalanceRaw = 0n;
    }

    const scale = BigInt(10) ** BigInt(outputDecimals);
    const scaleAsNumber = Number(scale);
    const guardRaw = Number.isFinite(globalMinOutput)
      ? BigInt(Math.max(0, Math.floor(globalMinOutput * scaleAsNumber)))
      : 0n;

    ctx.guardMinOutputRaw = guardRaw;
    ctx.slippageTolerance = slippageTolerance;
  }

  private appendMevTipInstruction(
    transaction: Transaction,
    payer: PublicKey,
    tipLamports: number
  ): void {
    if (tipLamports <= 0) {
      return;
    }

    const tipAccount = this.jitoService.pickTipAccount();
    const alreadyAdded = transaction.instructions.some((ix) =>
      ix.keys.some((key) => key.pubkey.equals(tipAccount))
    );

    if (alreadyAdded) {
      return;
    }

    transaction.add(
      SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: tipAccount,
        lamports: tipLamports,
      })
    );
  }

  /**
   * Verify route price against oracle
   */
  private async verifyOraclePrice(
    params: SwapParams,
    plan: AtomicSwapPlan
  ): Promise<{
    rate: number;
    inputPrice: OraclePriceData;
    outputPrice: OraclePriceData;
    inputDetail: OracleVerificationDetail;
    outputDetail: OracleVerificationDetail;
  }> {
    const slippageTolerance = Math.max(params.maxSlippageBps / 10_000, 0.0001);

    const [inputPriceData, outputPriceData] = await Promise.all([
      this.oracleService.getTokenPrice(params.inputMint),
      this.oracleService.getTokenPrice(params.outputMint),
    ]);

    const inputDetail = this.ensureOracleDetail(
      params.inputMint,
      inputPriceData
    );
    const outputDetail = this.ensureOracleDetail(
      params.outputMint,
      outputPriceData
    );

    const maxOracleAgeMs = Math.min(plan.quoteValidityMs, 15_000);

    if (!this.oracleService.isPriceFresh(inputPriceData, maxOracleAgeMs)) {
      throw new Error(
        `Input oracle price is stale (published ${this.formatAgeMs(
          Date.now() - inputPriceData.publishTime
        )} ago)`
      );
    }

    if (!this.oracleService.isPriceFresh(outputPriceData, maxOracleAgeMs)) {
      throw new Error(
        `Output oracle price is stale (published ${this.formatAgeMs(
          Date.now() - outputPriceData.publishTime
        )} ago)`
      );
    }

    const inputConfidenceRatio = Math.abs(
      inputPriceData.confidence / inputPriceData.price
    );
    const outputConfidenceRatio = Math.abs(
      outputPriceData.confidence / outputPriceData.price
    );

    if (inputConfidenceRatio > slippageTolerance) {
      throw new Error(
        `Input oracle confidence ${(inputConfidenceRatio * 100).toFixed(
          3
        )}% exceeds user slippage tolerance ${(slippageTolerance * 100).toFixed(2)}%`
      );
    }

    if (outputConfidenceRatio > slippageTolerance) {
      throw new Error(
        `Output oracle confidence ${(outputConfidenceRatio * 100).toFixed(
          3
        )}% exceeds user slippage tolerance ${(slippageTolerance * 100).toFixed(2)}%`
      );
    }

    // Oracle rate: how much output per input
    // Example: SOL=$100, USDC=$1 => oracleRate = 100 / 1 = 100 USDC per SOL
    const oracleRate = inputPriceData.price / outputPriceData.price;

    if (!Number.isFinite(oracleRate) || oracleRate <= 0) {
      throw new Error("Oracle rate is invalid or non-positive");
    }

    // Calculate weighted average route rate
    const totalOutput = plan.legs.reduce(
      (sum, leg) => sum + leg.expectedOutput,
      0
    );
    const totalInput = plan.legs.reduce((sum, leg) => sum + leg.inputAmount, 0);

    if (totalInput <= 0) {
      throw new Error("Swap plan has no input allocation");
    }

    const routeRate = totalOutput / totalInput;

    const deviation = Math.abs(routeRate - oracleRate) / oracleRate;

    if (deviation > slippageTolerance) {
      throw new Error(
        `Route price deviates ${(deviation * 100).toFixed(
          2
        )}% from oracle, exceeding slippage tolerance ${(
          slippageTolerance * 100
        ).toFixed(
          2
        )}%. Oracle: ${oracleRate.toFixed(6)}, Route: ${routeRate.toFixed(6)}`
      );
    }

    return {
      rate: oracleRate,
      inputPrice: inputPriceData,
      outputPrice: outputPriceData,
      inputDetail,
      outputDetail,
    };
  }

  private ensureOracleDetail(
    mint: string,
    price: OraclePriceData
  ): OracleVerificationDetail {
    const cached = this.oracleService.getVerificationDetail(mint);
    if (cached) {
      return cached;
    }

    const sources: OracleVerificationDetail["sources"] = {};
    if (price.provider === "pyth") {
      sources.pyth = price;
    } else {
      sources.switchboard = price;
    }

    return {
      providerUsed: price.provider,
      price: price.price,
      confidence: price.confidence,
      fallbackUsed: false,
      sources,
    };
  }

  /**
   * Build Solana transaction for multi-venue swap
   */
  private async buildTransaction(
    params: SwapParams,
    plan: AtomicSwapPlan,
    globalMinOutput: number,
    ctx: ExecutionContext
  ): Promise<Transaction> {
    const transaction = new Transaction();

    const computeBudgetInstructions = this.createComputeBudgetInstructions(
      plan,
      ctx
    );
    if (computeBudgetInstructions.length) {
      transaction.add(...computeBudgetInstructions);
    }

    for (const leg of plan.legs) {
      const legInstructions = await this.createSwapInstructions(
        params,
        plan,
        leg,
        globalMinOutput
      );

      if (legInstructions.length) {
        transaction.add(...legInstructions);
      }
    }

    const guardInstruction = this.createGlobalMinOutputGuardInstruction(
      params,
      plan,
      globalMinOutput,
      ctx
    );
    if (guardInstruction) {
      transaction.add(guardInstruction);
    }

    // Set recent blockhash
    const { blockhash } = await this.connection.getRecentBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = params.userPublicKey;

    return transaction;
  }

  /**
   * Create compute budget instruction for priority fees
   */
  private createComputeBudgetInstructions(
    plan: AtomicSwapPlan,
    ctx?: ExecutionContext
  ): TransactionInstruction[] {
    if (!plan.legs.length) {
      return [];
    }

    const boundedUnits = this.estimateComputeUnitLimit(plan);
    if (ctx) {
      ctx.computeUnitLimit = boundedUnits;
    }

    const priorityPriceMicroLamports =
      this.estimatePriorityFeeMicroLamports(plan);
    if (ctx && typeof ctx.priorityFeeMicroLamports !== "number") {
      ctx.priorityFeeMicroLamports = priorityPriceMicroLamports;
    }

    // Note: ComputeBudgetProgram not available in web3.js v1.x
    // Return empty array until web3.js v2 is used
    // const unitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
    //   units: boundedUnits,
    // });
    // const unitPriceIx = ComputeBudgetProgram.setComputeUnitPrice({
    //   microLamports: priorityPriceMicroLamports,
    // });
    // return [unitLimitIx, unitPriceIx];
    
    return []; // Temporarily disabled for web3.js v1
  }

  /**
   * Create swap instruction for a specific route
   */
  private async createSwapInstructions(
    params: SwapParams,
    plan: AtomicSwapPlan,
    leg: AtomicSwapLeg,
    globalMinOutput: number
  ): Promise<TransactionInstruction[]> {
    const programId = this.resolveVenueProgramId(leg.venue);
    const accounts = this.buildLegAccounts(params, plan, leg);
    const payload = this.serializeLegPayload(plan, leg, globalMinOutput);

    return [
      new TransactionInstruction({
        keys: accounts,
        programId,
        data: payload,
      }),
    ];
  }

  private estimateLegComputeUnits(leg: AtomicSwapLeg): number {
    switch (leg.venueType) {
      case VenueType.CLOB:
        return 70_000;
      case VenueType.RFQ:
        return 110_000;
      case VenueType.AMM:
      default:
        return 130_000;
    }
  }

  private estimateComputeUnits(plan: AtomicSwapPlan): number {
    return plan.legs
      .map((leg) => this.estimateLegComputeUnits(leg))
      .reduce((sum, units) => sum + units, 0);
  }

  private estimateComputeUnitLimit(plan: AtomicSwapPlan): number {
    const estimatedUnits = this.estimateComputeUnits(plan);
    return Math.min(1_400_000, Math.max(200_000, estimatedUnits));
  }

  private estimatePriorityFeeMicroLamports(plan: AtomicSwapPlan): number {
    const boundedUnits = this.estimateComputeUnitLimit(plan);
    return Math.max(
      1,
      Math.floor((plan.baseRoute?.estimatedComputeUnits ?? boundedUnits) / 10)
    );
  }

  private resolveVenueProgramId(venue: VenueName): PublicKey {
    if (venue === VenueName.JUPITER) {
      return JUPITER_AGGREGATOR_PROGRAM_ID;
    }

    return SWAPBACK_ROUTER_PROGRAM_ID;
  }

  private buildLegAccounts(
    params: SwapParams,
    plan: AtomicSwapPlan,
    leg: AtomicSwapLeg
  ): { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] {
    const accounts: {
      pubkey: PublicKey;
      isSigner: boolean;
      isWritable: boolean;
    }[] = [{ pubkey: params.userPublicKey, isSigner: true, isWritable: true }];

    const accountSet = new Set<string>();
    accountSet.add(plan.inputMint);
    accountSet.add(plan.outputMint);
    for (const mint of leg.route) {
      accountSet.add(mint);
    }

    for (const mint of accountSet) {
      accounts.push({
        pubkey: this.safePublicKey(mint),
        isSigner: false,
        isWritable: true,
      });
    }

    return accounts;
  }

  private serializeLegPayload(
    plan: AtomicSwapPlan,
    leg: AtomicSwapLeg,
    globalMinOutput: number
  ): Buffer {
    const payload = {
      planId: plan.id,
      legVenue: leg.venue,
      venueType: leg.venueType,
      inputAmount: leg.inputAmount,
      expectedOutput: leg.expectedOutput,
      minOutput: leg.minOutput,
      globalMinOutput,
      quoteExpiresAt: plan.expiresAt,
    };

    return Buffer.from(JSON.stringify(payload), "utf8");
  }

  private createGlobalMinOutputGuardInstruction(
    params: SwapParams,
    plan: AtomicSwapPlan,
    globalMinOutput: number,
    ctx: ExecutionContext
  ): TransactionInstruction | null {
    if (!Number.isFinite(globalMinOutput) || globalMinOutput <= 0) {
      return null;
    }

    const outputAccount =
      ctx.outputAccount ?? this.safePublicKey(plan.outputMint);
    const outputDecimals = ctx.outputDecimals ?? 0;
    const minOutputRaw =
      ctx.guardMinOutputRaw ??
      this.convertToRawAmount(globalMinOutput, outputDecimals);

    const payload = {
      planId: plan.id,
      minOutput: globalMinOutput,
      minOutputRaw: minOutputRaw.toString(),
      expectedOutput: plan.expectedOutput,
      preSwapBalance: ctx.preSwapOutputBalanceRaw?.toString(),
      slippageTolerance: ctx.slippageTolerance,
      legCount: plan.legs.length,
    };

    const data = Buffer.from(JSON.stringify(payload, null, 0), "utf8");

    const metas: {
      pubkey: PublicKey;
      isSigner: boolean;
      isWritable: boolean;
    }[] = [];
    const pushMeta = (meta?: {
      pubkey: PublicKey;
      isSigner: boolean;
      isWritable: boolean;
    }) => {
      if (!meta) {
        return;
      }
      if (metas.some((existing) => existing.pubkey.equals(meta.pubkey))) {
        return;
      }
      metas.push(meta);
    };

    pushMeta({
      pubkey: params.userPublicKey,
      isSigner: true,
      isWritable: true,
    });
    pushMeta({ pubkey: outputAccount, isSigner: false, isWritable: true });
    pushMeta({
      pubkey: this.safePublicKey(plan.outputMint),
      isSigner: false,
      isWritable: false,
    });
    pushMeta({ pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false });
    pushMeta({
      pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    });
    pushMeta({
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    });

    return new TransactionInstruction({
      keys: metas,
      programId: SWAPBACK_ROUTER_PROGRAM_ID,
      data,
    });
  }

  private async getMintDecimals(mintAddress: string): Promise<number> {
    const cached = this.mintDecimalsCache.get(mintAddress);
    if (typeof cached === "number") {
      return cached;
    }

    const mintKey = this.safePublicKey(mintAddress);
    const mintInfo = await getMint(this.connection, mintKey);
    this.mintDecimalsCache.set(mintAddress, mintInfo.decimals);
    return mintInfo.decimals;
  }

  private convertToRawAmount(amount: number, decimals: number): bigint {
    if (!Number.isFinite(amount) || amount <= 0) {
      return 0n;
    }

    const scale = BigInt(10) ** BigInt(Math.max(decimals, 0));
    const scaleAsNumber = Number(scale);
    return BigInt(Math.max(0, Math.floor(amount * scaleAsNumber)));
  }

  private safePublicKey(address: string): PublicKey {
    if (!address) {
      return SYSTEM_PROGRAM_ID;
    }

    try {
      return new PublicKey(address);
    } catch (error) {
      console.warn(
        `Encountered invalid public key ${address}. Using system program placeholder.`,
        error
      );
      return SYSTEM_PROGRAM_ID;
    }
  }

  /**
   * Submit transaction via Jito bundle
   */
  private async submitProtectedBundle(
    params: SwapParams,
    plan: AtomicSwapPlan,
    ctx: ExecutionContext,
    transaction: Transaction,
    signer: Signer,
    enableProtection: boolean
  ): Promise<{
    signature: string;
    tip: number;
    strategy: "jito" | "quicknode" | "direct";
    bundleId?: string;
  }> {
    if (!enableProtection) {
      transaction.sign(signer);
      ctx.priorityFeeMicroLamports =
        this.estimatePriorityFeeMicroLamports(plan);
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        { skipPreflight: false }
      );
      ctx.mevStrategy = "direct";
      ctx.mevTipLamports = 0;
      return {
        signature,
        tip: 0,
        strategy: "direct",
      };
    }

    const tradeValueUSD =
      ctx.tradeValueUSD ?? this.estimateTradeValueUSD(plan, ctx);
    ctx.tradeValueUSD = tradeValueUSD;

    const tipLamports = this.determineTipLamports(tradeValueUSD);
    ctx.mevTipLamports = tipLamports;
    this.appendMevTipInstruction(
      transaction,
      params.userPublicKey,
      tipLamports
    );

    const priorityLevel = this.determinePriorityLevel(tradeValueUSD);
    const priorityFeeMicroLamports = this.determinePriorityFeeMicroLamports(
      plan,
      tradeValueUSD
    );
    ctx.priorityFeeMicroLamports = priorityFeeMicroLamports;

    transaction.sign(signer);

    const bundleResult = await this.jitoService.submitProtectedBundle(
      [transaction],
      {
        tipLamports,
        priorityLevel,
        tradeValueUSD,
        fallbackQuickNode: true,
        priorityFeeMicroLamports,
      }
    );

    const primarySignature = bundleResult.signatures.find(Boolean);
    const derivedSignature =
      primarySignature ||
      (transaction.signature ? bs58.encode(transaction.signature) : undefined);

    const signature = derivedSignature ?? bundleResult.bundleId;

    return {
      signature,
      tip: tipLamports,
      strategy: bundleResult.strategy,
      bundleId: bundleResult.bundleId,
    };
  }

  /**
   * Confirm transaction with retry logic
   */
  private async confirmTransaction(signature: string): Promise<void> {
    const TIMEOUT_MS = 30_000; // 30 seconds
    const POLL_INTERVAL_MS = 1_000; // 1 second
    const startTime = Date.now();

    while (Date.now() - startTime < TIMEOUT_MS) {
      const status = await this.connection.getSignatureStatus(signature);

      if (
        status?.value?.confirmationStatus === "confirmed" ||
        status?.value?.confirmationStatus === "finalized"
      ) {
        return; // Success
      }

      if (status?.value?.err) {
        throw new Error(
          `Transaction failed: ${JSON.stringify(status.value.err)}`
        );
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    throw new Error("Transaction confirmation timeout after 30 seconds");
  }

  /**
   * Calculate execution metrics
   */
  private async calculateMetrics(
    params: SwapParams,
    ctx: ExecutionContext
  ): Promise<SwapMetrics> {
    const executionTimeMs = Date.now() - ctx.startTime;

    // Calculate total output amount from routes
    const outputAmount = ctx.routes.reduce(
      (sum, r) => sum + r.expectedOutput,
      0
    );

    // Calculate total input amount from routes
    const totalInput = ctx.routes.reduce((sum, r) => {
      return sum + r.splits.reduce((s, split) => s + split.inputAmount, 0);
    }, 0);

    // Calculate actual slippage
    const expectedOutput = totalInput / ctx.oraclePrice;
    const actualSlippage =
      ((expectedOutput - outputAmount) / expectedOutput) * 100;

    // Calculate price impact
    const weightedRate = totalInput / outputAmount;
    const priceImpact =
      ((weightedRate - ctx.oraclePrice) / ctx.oraclePrice) * 100;

    // Calculate fees from total cost
    const dexFees = ctx.routes.reduce((sum, r) => sum + r.totalCost, 0);
    const networkFees = 0.000005 * ctx.routes.length; // 5000 lamports per instruction

    const computeUnitLimit =
      ctx.computeUnitLimit ??
      (ctx.plan ? this.estimateComputeUnitLimit(ctx.plan) : 0);

    const priorityFees =
      ctx.priorityFeeMicroLamports && computeUnitLimit
        ? (ctx.priorityFeeMicroLamports * computeUnitLimit) / 1_000_000 / 1e9
        : 0.0001;

    const jitoTip = (ctx.mevTipLamports ?? 0) / 1e9;

    const totalFees = dexFees + networkFees + priorityFees + jitoTip;

    // Estimate MEV savings as multiple of tip (placeholder heuristic)
    const mevSavings = jitoTip > 0 ? jitoTip * 8 : 0;

    // Venue breakdown
    const venueBreakdown: Record<string, number> = {};
    if (ctx.legs) {
      for (const leg of ctx.legs) {
        const venue = leg.venue;
        venueBreakdown[venue] = (venueBreakdown[venue] || 0) + leg.inputAmount;
      }
    }

    return {
      executionTimeMs,
      outputAmount,
      actualSlippage,
      priceImpact,
      totalFees,
      feeBreakdown: {
        dexFees,
        networkFees,
        priorityFees,
        jitoTip,
      },
      mevSavings,
      venueBreakdown: venueBreakdown as Record<VenueName, number>,
      routeCount: ctx.routes.length,
      oraclePrice: ctx.oraclePrice,
      oracleVerified: true,
    };
  }

  private async writeAnalyticsEvent(
    event: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.analyticsLogPath), { recursive: true });
      const entry = JSON.stringify(
        {
          event,
          timestamp: new Date().toISOString(),
          payload,
        },
        null,
        0
      );
      await fs.appendFile(this.analyticsLogPath, `${entry}\n`, {
        encoding: "utf8",
      });
    } catch (error) {
      console.warn("Failed to persist analytics event", error);
    }
  }

  /**
   * Log successful swap metrics
   */
  private async logSwapMetrics(
    params: SwapParams,
    ctx: ExecutionContext,
    metrics: SwapMetrics
  ): Promise<void> {
    console.log("✅ Swap executed successfully");
    console.log("📝 Signature:", ctx.signature);
    console.log("⏱️  Execution time:", metrics.executionTimeMs, "ms");
    console.log("💰 Output amount:", metrics.outputAmount.toFixed(6));
    console.log("📉 Actual slippage:", metrics.actualSlippage.toFixed(4), "%");
    console.log("💸 Total fees:", metrics.totalFees.toFixed(6));
    console.log("🛡️  MEV savings:", metrics.mevSavings.toFixed(6));
    console.log("🔀 Routes used:", metrics.routeCount);
    console.log("🏦 Venue breakdown:", metrics.venueBreakdown);
    console.log("🚦 MEV strategy:", ctx.mevStrategy ?? "direct");
    this.logOracleDetail("Input", ctx.inputOracleDetail);
    this.logOracleDetail("Output", ctx.outputOracleDetail);
    if (ctx.mevTipLamports) {
      console.log(
        "🎁 Tip (lamports):",
        ctx.mevTipLamports,
        "(SOL",
        (ctx.mevTipLamports / 1e9).toFixed(6),
        ")"
      );
    }
    if (ctx.priorityFeeMicroLamports) {
      console.log(
        "⚙️ Priority fee (μ-lamports):",
        ctx.priorityFeeMicroLamports
      );
    }
    if (ctx.bundleId) {
      console.log("📦 Bundle ID:", ctx.bundleId);
    }

    await this.writeAnalyticsEvent("swap_success", {
      planId: ctx.plan?.id,
      signature: ctx.signature,
      executionTimeMs: metrics.executionTimeMs,
      outputAmount: metrics.outputAmount,
      totalFees: metrics.totalFees,
      venues: metrics.venueBreakdown,
      oraclePrice: metrics.oraclePrice,
      oracleMetadata: this.buildOracleMetadataPayload(
        ctx.inputOracleDetail,
        ctx.outputOracleDetail
      ),
      diffs: ctx.planDiffs,
      refreshReason: ctx.planRefreshReason,
      refreshIterations: ctx.planRefreshIterations,
      bundleStrategy: ctx.mevStrategy,
      bundleId: ctx.bundleId,
      mevTipLamports: ctx.mevTipLamports,
      priorityFeeMicroLamports: ctx.priorityFeeMicroLamports,
      tradeValueUSD: ctx.tradeValueUSD,
    });
  }

  /**
   * Log swap failure
   */
  private async logSwapFailure(
    params: SwapParams,
    ctx: ExecutionContext,
    error: string
  ): Promise<void> {
    console.error("❌ Swap execution failed");
    console.error("🔴 Error:", error);
    console.error("⏱️  Time to failure:", Date.now() - ctx.startTime, "ms");
    console.error("🔀 Routes attempted:", ctx.routes.length);
    console.error("🚦 MEV strategy:", ctx.mevStrategy ?? "direct");
    if (ctx.priorityFeeMicroLamports) {
      console.error(
        "⚙️ Priority fee (μ-lamports):",
        ctx.priorityFeeMicroLamports
      );
    }

    await this.writeAnalyticsEvent("swap_failure", {
      planId: ctx.plan?.id,
      error,
      routesAttempted: ctx.routes.length,
      elapsedMs: Date.now() - ctx.startTime,
      oracleMetadata: this.buildOracleMetadataPayload(
        ctx.inputOracleDetail,
        ctx.outputOracleDetail
      ),
      diffs: ctx.planDiffs,
      refreshReason: ctx.planRefreshReason,
      bundleStrategy: ctx.mevStrategy,
      bundleId: ctx.bundleId,
      mevTipLamports: ctx.mevTipLamports,
      priorityFeeMicroLamports: ctx.priorityFeeMicroLamports,
      tradeValueUSD: ctx.tradeValueUSD,
    });
  }

  private logOracleDetail(
    label: string,
    detail?: OracleVerificationDetail
  ): void {
    if (!detail) {
      return;
    }

    const confidencePct = detail.price
      ? ((Math.abs(detail.confidence) / Math.max(Math.abs(detail.price), 1e-9)) * 100).toFixed(4)
      : "n/a";
    const divergencePct =
      typeof detail.divergencePercent === "number"
        ? `${(detail.divergencePercent * 100).toFixed(4)}%`
        : "n/a";

    console.log(
      `📡 ${label} Oracle → provider=${detail.providerUsed}, confidence=${confidencePct}%, divergence=${divergencePct}, fallback=${detail.fallbackUsed ? "yes" : "no"}`
    );
  }

  private buildOracleMetadataPayload(
    input?: OracleVerificationDetail,
    output?: OracleVerificationDetail
  ): Record<string, unknown> | undefined {
    if (!input && !output) {
      return undefined;
    }
    return { input, output };
  }

  /**
   * Get empty metrics for failed swaps
   */
  private getEmptyMetrics(): SwapMetrics {
    return {
      executionTimeMs: 0,
      outputAmount: 0,
      actualSlippage: 0,
      priceImpact: 0,
      totalFees: 0,
      feeBreakdown: {
        dexFees: 0,
        networkFees: 0,
        priorityFees: 0,
        jitoTip: 0,
      },
      mevSavings: 0,
      venueBreakdown: {} as Record<VenueName, number>,
      routeCount: 0,
      oraclePrice: 0,
      oracleVerified: false,
    };
  }
}
