import { describe, expect, it, vi } from "vitest";
import {
  RouteOptimizationEngine,
  RoutingDiagnostics,
} from "../RouteOptimizationEngine";
import {
  LiquiditySource,
  VenueName,
  VenueType,
  VenueConfig,
  OptimizationConfig,
  AggregatedLiquidity,
} from "../../types/smart-router";
import { LiquidityDataCollector } from "../LiquidityDataCollector";
import { OraclePriceService } from "../OraclePriceService";

function buildCollector(
  configOverride?: Partial<VenueConfig>,
  aggregatedOverride?: AggregatedLiquidity
): LiquidityDataCollector {
  const defaultConfig: VenueConfig = {
    name: VenueName.PHOENIX,
    type: VenueType.CLOB,
    enabled: true,
    priority: 100,
    feeRate: 0.001,
    minTradeSize: 1,
    maxSlippage: 0.01,
  };

  const aggregated: AggregatedLiquidity =
    aggregatedOverride ??
    ({
      tokenPair: ["SOL", "USDC"],
      totalDepth: 0,
      sources: [],
      bestSingleVenue: VenueName.ORCA,
      bestCombinedRoute: null,
      fetchedAt: Date.now(),
      staleness: 0,
    } as AggregatedLiquidity);

  return {
    getVenueConfig: vi.fn(() => ({ ...defaultConfig, ...configOverride })),
    fetchAggregatedLiquidity: vi.fn(async () => aggregated),
  } as unknown as LiquidityDataCollector;
}

function createEngine(
  collector: LiquidityDataCollector = buildCollector()
): RouteOptimizationEngine {
  const oracle = {} as OraclePriceService;
  return new RouteOptimizationEngine(collector, oracle);
}

describe("RouteOptimizationEngine.calculateExpectedOutput", () => {
  it("prefers liquidity source effective price when available", () => {
    const engine = createEngine();
    const source: LiquiditySource = {
      venue: VenueName.PHOENIX,
      venueType: VenueType.CLOB,
      tokenPair: ["SOL", "USDC"],
      depth: 100000,
      effectivePrice: 0.1,
      feeAmount: 0.05,
      slippagePercent: 0.0005,
      route: ["SOL", "USDC"],
      timestamp: Date.now(),
    };

    const output = (engine as any).calculateExpectedOutput(source, 5);
    expect(output).toBeCloseTo(50, 5);
  });

  it("falls back to top-of-book when effective price missing", () => {
    const engine = createEngine();
    const source: LiquiditySource = {
      venue: VenueName.PHOENIX,
      venueType: VenueType.CLOB,
      tokenPair: ["SOL", "USDC"],
      depth: 100000,
      effectivePrice: 0,
      feeAmount: 0.05,
      slippagePercent: 0.0005,
      route: ["SOL", "USDC"],
      timestamp: Date.now(),
      topOfBook: {
        bidPrice: 99,
        askPrice: 101,
        bidSize: 10,
        askSize: 10,
      },
    };

    const output = (engine as any).calculateExpectedOutput(source, 5);
    const expected = (5 / 101) * (1 - 0.001);
    expect(output).toBeCloseTo(expected, 5);
  });

  it("simulates multi-level CLOB depth when orderbook is available", () => {
    const engine = createEngine();
    const source: LiquiditySource = {
      venue: VenueName.PHOENIX,
      venueType: VenueType.CLOB,
      tokenPair: ["SOL", "USDC"],
      depth: 100000,
      effectivePrice: 0,
      feeAmount: 0,
      slippagePercent: 0.0005,
      route: ["SOL", "USDC"],
      timestamp: Date.now(),
      orderbook: {
        bids: [
          { price: 100, size: 1 },
          { price: 95, size: 5 },
        ],
        asks: [
          { price: 101, size: 10 },
        ],
        bestBid: 100,
        bestAsk: 101,
        spreadBps: 100,
        depthUsd: 10000,
        lastUpdated: Date.now(),
        latencyMs: 5,
      },
      metadata: {
        direction: "sellBase",
        takerFeeBps: 10,
      },
    } as LiquiditySource;

    const output = (engine as any).calculateExpectedOutput(source, 3);
    const gross = 100 * 1 + 95 * 2;
    const expected = gross * (1 - 0.001);
    expect(output).toBeCloseTo(expected, 5);
  });
});

describe("RouteOptimizationEngine.buildRoutingDiagnostics", () => {
  it("summarizes top routes for observability", () => {
    const engine = createEngine();

    const liquiditySource: LiquiditySource = {
      venue: VenueName.PHOENIX,
      venueType: VenueType.CLOB,
      tokenPair: ["SOL", "USDC"],
      depth: 100000,
      effectivePrice: 0.5,
      feeAmount: 0.02,
      slippagePercent: 0.0005,
      route: ["SOL", "USDC"],
      timestamp: Date.now(),
    };

    const candidate = {
      id: "single-phoenix",
      venues: [VenueName.PHOENIX],
      path: ["SOL", "USDC"],
      hops: 1,
      splits: [
        {
          venue: VenueName.PHOENIX,
          weight: 100,
          inputAmount: 5,
          expectedOutput: 10,
          liquiditySource,
        },
      ],
      expectedOutput: 10,
      totalCost: 0.02,
      effectiveRate: 0.5,
      riskScore: 5,
      mevRisk: "low" as const,
      instructions: [],
      estimatedComputeUnits: 50000,
      strategy: {
        profile: "single-venue",
        splitsEnabled: false,
        splitVenues: [VenueName.PHOENIX],
        fallbackEnabled: false,
        fallbackCount: 0,
        twap: {
          recommended: false,
          triggerRatio: 0.3,
          footprintRatio: 0.1,
        },
      },
    };

    const config = {
      slippageTolerance: 0.01,
      prioritizeCLOB: true,
      maxRoutes: 3,
      maxHops: 3,
      enableSplitRoutes: true,
      maxSplits: 3,
      useBundling: true,
      maxPriorityFee: 100000,
      enableTWAP: false,
      enableFallback: true,
      maxRetries: 2,
    } satisfies OptimizationConfig;

    const diagnostics: RoutingDiagnostics = (engine as any).buildRoutingDiagnostics(
      "SOL",
      "USDC",
      5,
      [candidate],
      config
    );

    expect(diagnostics.inputMint).toBe("SOL");
    expect(diagnostics.topRoutes).toHaveLength(1);
    expect(diagnostics.topRoutes[0].venues).toEqual([VenueName.PHOENIX]);
    expect(diagnostics.topRoutes[0].expectedOutput).toBeCloseTo(10, 5);
    expect(diagnostics.clobPreferenceApplied).toBe(true);
    expect(diagnostics.clobRouteCount).toBe(1);
    expect(diagnostics.topRoutes[0].usesClob).toBe(true);
    expect(diagnostics.topRoutes[0].strategyProfile).toBe("single-venue");
    expect(diagnostics.topRoutes[0].twapRecommended).toBe(false);
  });
});

describe("RouteOptimizationEngine.findOptimalRoutes", () => {
  it("keeps CLOB route ahead when prioritizeCLOB is enabled", async () => {
    const now = Date.now();
    const clobSource: LiquiditySource = {
      venue: VenueName.PHOENIX,
      venueType: VenueType.CLOB,
      tokenPair: ["SOL", "USDC"],
      depth: 200000,
      effectivePrice: 25,
      feeAmount: 0.01,
      slippagePercent: 0.0005,
      route: ["SOL", "USDC"],
      timestamp: now,
      metadata: {
        direction: "sellBase",
        takerFeeBps: 5,
      },
    };

    const ammSource: LiquiditySource = {
      venue: VenueName.ORCA,
      venueType: VenueType.AMM,
      tokenPair: ["SOL", "USDC"],
      depth: 150000,
      effectivePrice: 25,
      feeAmount: 0.03,
      slippagePercent: 0.0005,
      route: ["SOL", "USDC"],
      timestamp: now,
    };

    const aggregated: AggregatedLiquidity = {
      tokenPair: ["SOL", "USDC"],
      totalDepth: 350000,
      sources: [ammSource, clobSource],
      bestSingleVenue: VenueName.PHOENIX,
      bestCombinedRoute: null,
      fetchedAt: now,
      staleness: 0,
    };

    const collector = buildCollector(undefined, aggregated);
    const engine = createEngine(collector);

    const routes = await engine.findOptimalRoutes("SOL", "USDC", 10, {
      prioritizeCLOB: true,
      enableSplitRoutes: false,
    });

    expect(routes[0].venues[0]).toBe(VenueName.PHOENIX);
  });
});
