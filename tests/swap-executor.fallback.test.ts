import { describe, it, expect, vi } from "vitest";
import { Keypair, PublicKey } from "@solana/web3.js";
import { SwapExecutor, SwapParams } from "../sdk/src/services/SwapExecutor";
import { AtomicSwapLeg, AtomicSwapPlan, RouteCandidate, VenueName, VenueType } from "../sdk/src/types/smart-router";
import type { LiquidityDataCollector } from "../sdk/src/services/LiquidityDataCollector";
import type { RouteOptimizationEngine } from "../sdk/src/services/RouteOptimizationEngine";
import type { IntelligentOrderRouter } from "../sdk/src/services/IntelligentOrderRouter";
import type { OraclePriceService } from "../sdk/src/services/OraclePriceService";
import type { JitoBundleService } from "../sdk/src/services/JitoBundleService";
import type { CircuitBreaker } from "../sdk/src/utils/circuit-breaker";
import type { Connection, Signer } from "@solana/web3.js";

const DUMMY_PUBLIC_KEY = new PublicKey("11111111111111111111111111111111");

function buildLiquiditySnapshot(venue: VenueName) {
  return Object.values(VenueName).reduce(
    (acc, name) => {
      acc[name] = {
        effectivePrice: name === venue ? 95 : 100,
        depth: name === venue ? 1_000_000 : 500_000,
        timestamp: Date.now(),
      };
      return acc;
    },
    {} as Record<VenueName, { effectivePrice: number; depth: number; timestamp: number }>
  );
}

function createStubPlan(id: string, venue: VenueName): AtomicSwapPlan {
  const route: RouteCandidate = {
    id: `${id}-route`,
    venues: [venue],
    path: ["So11111111111111111111111111111111111111112", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"],
    hops: 1,
    splits: [
      {
        venue,
        percentage: 100,
        inputAmount: 10,
        expectedOutput: 950,
        liquiditySource: {
          venue,
          venueType: VenueType.AMM,
          tokenPair: ["So11111111111111111111111111111111111111112", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"],
          depth: 1_000_000,
          effectivePrice: 95,
          feeAmount: 0.1,
          slippagePercent: 0.2,
          route: ["So11111111111111111111111111111111111111112", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"],
          timestamp: Date.now(),
        },
      },
    ],
    expectedOutput: 950,
    totalCost: 2,
    effectiveRate: 95,
    riskScore: 12,
    mevRisk: "medium",
    instructions: [],
    estimatedComputeUnits: 300_000,
  };

  const leg: AtomicSwapLeg = {
    venue,
    venueType: VenueType.AMM,
    route: route.path,
    inputAmount: 10,
    expectedOutput: 950,
    minOutput: 900,
    feeAmount: 0.1,
    slippagePercent: 0.2,
    quote: {
      inputAmount: 10,
      outputAmount: 950,
      effectivePrice: 95,
      marginalPrice: 95,
      slippagePercent: 0.2,
      feeAmount: 0.1,
    },
    liquiditySource: route.splits[0].liquiditySource,
  };

  return {
    id,
    inputMint: "So11111111111111111111111111111111111111112",
    outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    totalInput: 10,
    expectedOutput: 950,
    minOutput: 900,
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000,
    quoteValidityMs: 60_000,
    legs: [leg],
    simulations: [],
    baseRoute: route,
    fallbackPlans: [],
    maxSlippageBps: 100,
    driftRebalanceBps: 50,
    minLiquidityRatio: 0.5,
    maxStalenessMs: 30_000,
    liquiditySnapshot: buildLiquiditySnapshot(venue),
  };
}

function createExecutor(): SwapExecutor {
  const connection = null as unknown as Connection;
  const liquidityCollector = {} as unknown as LiquidityDataCollector;
  const optimizer = {} as unknown as RouteOptimizationEngine;
  const router = {} as unknown as IntelligentOrderRouter;
  const oracle = {} as unknown as OraclePriceService;
  const jito = {
    pickTipAccount: () => DUMMY_PUBLIC_KEY,
    submitProtectedBundle: async () => ({
      bundleId: "stub",
      signatures: ["stub"],
      strategy: "jito" as const,
      status: "landed" as const,
      tipLamports: 0,
      priorityFeeMicroLamports: 0,
    }),
  } as unknown as JitoBundleService;
  const circuitBreaker = {
    isTripped: () => false,
    getNextRetryTime: () => Date.now(),
    recordFailure: () => undefined,
    recordSuccess: () => undefined,
  } as CircuitBreaker;

  return new SwapExecutor(
    connection,
    liquidityCollector,
    optimizer,
    router,
    oracle,
    jito,
    circuitBreaker
  );
}

function createParams(): SwapParams {
  const signer = Keypair.generate() as unknown as Signer;
  return {
    inputMint: "So11111111111111111111111111111111111111112",
    outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    inputAmount: 10,
    maxSlippageBps: 100,
    userPublicKey: DUMMY_PUBLIC_KEY,
    signer,
    routePreferences: {
      enableFallbackRouting: true,
    },
  };
}

describe("SwapExecutor fallback routing", () => {
  it("falls back to the next plan when the primary fails", async () => {
    const executor = createExecutor();
    const params = createParams();
    const context: any = {
      startTime: Date.now(),
      routes: [] as RouteCandidate[],
      oraclePrice: 0,
    };

    const primary = createStubPlan("primary", VenueName.PHOENIX);
    const fallback = createStubPlan("fallback", VenueName.ORCA);

    const executeSpy = vi
      .spyOn(executor as any, "executePlanCandidate")
      .mockImplementationOnce(() => {
        throw new Error("primary failed");
      })
      .mockImplementationOnce(async (_params, plan, ctx) => {
        const typedPlan = plan as AtomicSwapPlan;
        const typedCtx = ctx as any;
        typedCtx.signature = `sig-${typedPlan.id}`;
        typedCtx.routes = typedPlan.baseRoute ? [typedPlan.baseRoute] : [];
      });

    await (executor as any).runPlanWithFallback(
      params,
      [primary, fallback],
      context,
      0.01
    );

    expect(executeSpy).toHaveBeenCalledTimes(2);
  expect(context.signature).toBe("sig-fallback");
  expect(context.routes[0]?.id).toBe("fallback-route");
  });

  it("throws when all candidate plans fail", async () => {
    const executor = createExecutor();
    const params = createParams();
    const context: any = {
      startTime: Date.now(),
      routes: [] as RouteCandidate[],
      oraclePrice: 0,
    };

    const primary = createStubPlan("primary", VenueName.PHOENIX);
    const fallback = createStubPlan("fallback", VenueName.ORCA);

    vi.spyOn(executor as any, "executePlanCandidate").mockImplementation(() => {
      throw new Error("execution reverted");
    });

    await expect(
      (executor as any).runPlanWithFallback(params, [primary, fallback], context, 0.01)
    ).rejects.toThrow("execution reverted");

  expect(context.signature).toBeUndefined();
  });
});

describe("SwapExecutor TWAP execution", () => {
  it("splits execution across slices and aggregates results", async () => {
    const executor = createExecutor();
    const params = {
      ...createParams(),
      inputAmount: 60_000,
      routePreferences: {
        enableFallbackRouting: true,
        enableTwapMode: true,
        twapThresholdRatio: 0.2,
        twapMaxSlices: 3,
        twapIntervalMs: 0,
      },
    };

    const context: any = {
      startTime: Date.now(),
      routes: [] as RouteCandidate[],
      oraclePrice: 0,
    };

    const plan = createStubPlan("twap", VenueName.PHOENIX);
    plan.totalInput = 60_000;
    plan.expectedOutput = 57_000;
    plan.minOutput = 55_000;
    plan.legs[0].inputAmount = 60_000;
    plan.legs[0].expectedOutput = 57_000;
    plan.legs[0].minOutput = 55_000;
    plan.legs[0].liquiditySource.depth = 50_000;
    plan.baseRoute!.splits[0].inputAmount = 60_000;
    plan.baseRoute!.splits[0].expectedOutput = 57_000;
    plan.baseRoute!.splits[0].liquiditySource.depth = 50_000;

    vi.spyOn(executor as any, "delay").mockResolvedValue(undefined);
    vi
      .spyOn(executor as any, "rebuildPlanForAmount")
      .mockImplementation(async () => ({ ...plan } as AtomicSwapPlan));

    let attempt = 0;
    const attemptSpy = vi
      .spyOn(executor as any, "executeSinglePlanAttempt")
      .mockImplementation(async (_params, candidatePlan) => {
        const typedPlan = candidatePlan as AtomicSwapPlan;
        attempt += 1;
        return {
          startTime: Date.now(),
          routes: typedPlan.baseRoute ? [typedPlan.baseRoute] : [],
          oraclePrice: 100,
          signature: `sig-${attempt}`,
          tradeValueUSD: 100 * attempt,
          plan: typedPlan,
          legs: typedPlan.legs,
          bundleId: `bundle-${attempt}`,
          mevStrategy: "jito",
          mevTipLamports: 0,
        } as any;
      });

    await (executor as any).runPlanWithFallback(params, [plan], context, 0.01);

    expect(attemptSpy).toHaveBeenCalledTimes(3);
    expect(context.twapSlices).toBe(3);
    expect(context.chunkSignatures).toEqual(["sig-1", "sig-2", "sig-3"]);
    expect(context.signature).toBe("sig-3");
    expect(context.routes).toHaveLength(3);
    expect(context.tradeValueUSD).toBe(100 + 200 + 300);
  });
});
