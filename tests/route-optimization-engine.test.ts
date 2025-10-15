/**
 * Unit Tests for RouteOptimizationEngine
 * Tests greedy algorithm, split routing, cost optimization
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Connection } from "@solana/web3.js";
import { RouteOptimizationEngine } from "../sdk/src/services/RouteOptimizationEngine";
import { LiquidityDataCollector } from "../sdk/src/services/LiquidityDataCollector";
import { OraclePriceService } from "../sdk/src/services/OraclePriceService";
import {
  VenueName,
  VenueType,
  LiquiditySource,
  AggregatedLiquidity,
  OptimizationConfig,
} from "../sdk/src/types/smart-router";

// ============================================================================
// MOCKS
// ============================================================================

vi.mock("../sdk/src/services/LiquidityDataCollector", () => ({
  LiquidityDataCollector: vi.fn().mockImplementation(() => ({
    fetchAggregatedLiquidity: vi.fn(),
    getVenueConfig: vi.fn().mockReturnValue({
      feeRate: 0.003,
      priority: 80,
      enabled: true,
      minTradeSize: 1,
      maxSlippage: 0.01,
    }),
  })),
}));

vi.mock("../sdk/src/services/OraclePriceService", () => ({
  OraclePriceService: vi.fn().mockImplementation(() => ({
    getTokenPrice: vi.fn().mockResolvedValue({
      provider: 'pyth',
      price: 150,
      confidence: 1,
      timestamp: Date.now(),
      exponent: 0,
      publishTime: Date.now(),
    }),
  })),
}));

// ============================================================================
// MOCK DATA
// ============================================================================

const createMockLiquiditySource = (
  venue: VenueName,
  type: VenueType,
  effectivePrice: number,
  depth: number,
  slippagePercent = 0.005
): LiquiditySource => ({
  venue,
  venueType: type,
  tokenPair: ["SOL", "USDC"],
  depth,
  effectivePrice,
  feeAmount: 0.003,
  slippagePercent,
  route: ["SOL", "USDC"],
  timestamp: Date.now(),
  // Add reserves for AMM calculation
  reserves:
    type === VenueType.AMM
      ? {
          input: depth / 2,
          output: (depth / 2) * effectivePrice,
        }
      : undefined,
  // Add topOfBook for CLOB
  topOfBook:
    type === VenueType.CLOB
      ? {
          bidPrice: effectivePrice * 0.99,
          askPrice: effectivePrice * 1.01,
          bidSize: depth / 2,
          askSize: depth / 2,
        }
      : undefined,
});

const createMockAggregatedLiquidity = (
  sources: LiquiditySource[]
): AggregatedLiquidity => ({
  tokenPair: ["SOL", "USDC"],
  totalDepth: sources.reduce((sum, s) => sum + s.depth, 0),
  sources: sources.sort((a, b) => a.effectivePrice - b.effectivePrice),
  bestSingleVenue: sources[0]?.venue || VenueName.ORCA,
  bestCombinedRoute: null as any,
  fetchedAt: Date.now(),
  staleness: 0,
});

// ============================================================================
// TEST SUITE
// ============================================================================

describe("RouteOptimizationEngine", () => {
  let engine: RouteOptimizationEngine;
  let mockCollector: any;
  let mockOracleService: any;
  let mockConnection: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConnection = {
      getAccountInfo: vi.fn(),
    };

    mockCollector = new LiquidityDataCollector(mockConnection as Connection);
    mockOracleService = new OraclePriceService(mockConnection as Connection);
    engine = new RouteOptimizationEngine(mockCollector, mockOracleService);
  });

  // ============================================================================
  // TEST 1: SINGLE VENUE ROUTING
  // ============================================================================

  describe("Single Venue Routing", () => {
    it("should find optimal single venue route", async () => {
      const inputMint = "So11111111111111111111111111111111111111112";
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const inputAmount = 100;

      // Mock liquidity with multiple venues
      const sources = [
        createMockLiquiditySource(
          VenueName.PHOENIX,
          VenueType.CLOB,
          0.99,
          50000,
          0.002
        ), // effectivePrice = cost per output
        createMockLiquiditySource(
          VenueName.ORCA,
          VenueType.AMM,
          1.01,
          100000,
          0.005
        ),
        createMockLiquiditySource(
          VenueName.RAYDIUM,
          VenueType.AMM,
          1.02,
          80000,
          0.007
        ),
      ];

      const mockLiquidity = createMockAggregatedLiquidity(sources);
      mockCollector.fetchAggregatedLiquidity.mockResolvedValue(mockLiquidity);

      const routes = await engine.findOptimalRoutes(
        inputMint,
        outputMint,
        inputAmount
      );

      // Assertions
      expect(routes).toBeDefined();
      expect(routes.length).toBeGreaterThan(0);

      // Best route should be a single venue with highest expected output
      const bestRoute = routes[0];
      expect(bestRoute.hops).toBe(1);
      expect(bestRoute.splits.length).toBe(1);
      expect(bestRoute.splits[0].weight).toBe(100);
      expect(bestRoute.expectedOutput).toBeGreaterThan(0);
    });

    it("should respect slippage tolerance", async () => {
      const inputMint = "So11111111111111111111111111111111111111112";
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const inputAmount = 100;

      const sources = [
        createMockLiquiditySource(
          VenueName.ORCA,
          VenueType.AMM,
          99.0,
          100000,
          0.005
        ), // Within tolerance
        createMockLiquiditySource(
          VenueName.RAYDIUM,
          VenueType.AMM,
          98.0,
          80000,
          0.015
        ), // Above tolerance (1.5%)
      ];

      const mockLiquidity = createMockAggregatedLiquidity(sources);
      mockCollector.fetchAggregatedLiquidity.mockResolvedValue(mockLiquidity);

      const routes = await engine.findOptimalRoutes(
        inputMint,
        outputMint,
        inputAmount,
        { slippageTolerance: 0.01 } // 1% max slippage
      );

      // Should only include Orca (Raydium exceeds tolerance)
      expect(routes.length).toBeGreaterThan(0);
      routes.forEach((route) => {
        route.splits.forEach((split) => {
          expect(split.liquiditySource.slippagePercent).toBeLessThanOrEqual(
            0.01
          );
        });
      });
    });

    it("should calculate expected output correctly", async () => {
      const inputMint = "So11111111111111111111111111111111111111112";
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const inputAmount = 100;

      const sources = [
        createMockLiquiditySource(
          VenueName.ORCA,
          VenueType.AMM,
          1.01,
          100000,
          0.005
        ), // 1 input = 0.99 output (inverted price)
      ];

      const mockLiquidity = createMockAggregatedLiquidity(sources);
      mockCollector.fetchAggregatedLiquidity.mockResolvedValue(mockLiquidity);

      const routes = await engine.findOptimalRoutes(
        inputMint,
        outputMint,
        inputAmount
      );

      expect(routes.length).toBeGreaterThan(0);
      const route = routes[0];
      expect(route.expectedOutput).toBeGreaterThan(0);
      expect(route.effectiveRate).toBeCloseTo(
        route.expectedOutput / inputAmount,
        2
      );
    });
  });

  // ============================================================================
  // TEST 2: SPLIT ROUTING
  // ============================================================================

  describe("Split Routing", () => {
    it("should create split routes when enabled", async () => {
      const inputMint = "So11111111111111111111111111111111111111112";
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const inputAmount = 100;

      const sources = [
        createMockLiquiditySource(
          VenueName.PHOENIX,
          VenueType.CLOB,
          0.99,
          50000,
          0.002
        ),
        createMockLiquiditySource(
          VenueName.ORCA,
          VenueType.AMM,
          1.01,
          100000,
          0.005
        ),
        createMockLiquiditySource(
          VenueName.RAYDIUM,
          VenueType.AMM,
          1.02,
          80000,
          0.006
        ),
      ];

      const mockLiquidity = createMockAggregatedLiquidity(sources);
      mockCollector.fetchAggregatedLiquidity.mockResolvedValue(mockLiquidity);

      const routes = await engine.findOptimalRoutes(
        inputMint,
        outputMint,
        inputAmount,
        { enableSplitRoutes: true, maxSplits: 3 }
      );

      // Should have multiple route candidates (single + splits)
      expect(routes.length).toBeGreaterThan(1);

      // If split routes are created, validate them
      const splitRoutes = routes.filter((r) => r.splits.length > 1);
      if (splitRoutes.length > 0) {
        // Validate split weights sum to 100
        splitRoutes.forEach((route) => {
          const totalWeight = route.splits.reduce(
            (sum, s) => sum + s.weight,
            0
          );
          expect(totalWeight).toBeCloseTo(100, 1);
        });
      }
    });

    it("should not create split routes when disabled", async () => {
      const inputMint = "So11111111111111111111111111111111111111112";
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const inputAmount = 100;

      const sources = [
        createMockLiquiditySource(
          VenueName.PHOENIX,
          VenueType.CLOB,
          99.5,
          50000,
          0.002
        ),
        createMockLiquiditySource(
          VenueName.ORCA,
          VenueType.AMM,
          99.3,
          100000,
          0.005
        ),
      ];

      const mockLiquidity = createMockAggregatedLiquidity(sources);
      mockCollector.fetchAggregatedLiquidity.mockResolvedValue(mockLiquidity);

      const routes = await engine.findOptimalRoutes(
        inputMint,
        outputMint,
        inputAmount,
        { enableSplitRoutes: false }
      );

      // All routes should be single venue
      routes.forEach((route) => {
        expect(route.splits.length).toBe(1);
        expect(route.splits[0].weight).toBe(100);
      });
    });

    it("should respect maxSplits configuration", async () => {
      const inputMint = "So11111111111111111111111111111111111111112";
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const inputAmount = 100;

      const sources = [
        createMockLiquiditySource(
          VenueName.PHOENIX,
          VenueType.CLOB,
          99.5,
          50000,
          0.002
        ),
        createMockLiquiditySource(
          VenueName.ORCA,
          VenueType.AMM,
          99.3,
          100000,
          0.005
        ),
        createMockLiquiditySource(
          VenueName.RAYDIUM,
          VenueType.AMM,
          99.1,
          80000,
          0.006
        ),
        createMockLiquiditySource(
          VenueName.METEORA,
          VenueType.AMM,
          98.9,
          70000,
          0.007
        ),
      ];

      const mockLiquidity = createMockAggregatedLiquidity(sources);
      mockCollector.fetchAggregatedLiquidity.mockResolvedValue(mockLiquidity);

      const maxSplits = 2;
      const routes = await engine.findOptimalRoutes(
        inputMint,
        outputMint,
        inputAmount,
        { enableSplitRoutes: true, maxSplits }
      );

      // No route should exceed maxSplits
      routes.forEach((route) => {
        expect(route.splits.length).toBeLessThanOrEqual(maxSplits);
      });
    });
  });

  // ============================================================================
  // TEST 3: COST CALCULATION
  // ============================================================================

  describe("Cost Calculation", () => {
    it("should calculate total cost including fees", async () => {
      const inputMint = "So11111111111111111111111111111111111111112";
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const inputAmount = 100;

      const sources = [
        createMockLiquiditySource(
          VenueName.ORCA,
          VenueType.AMM,
          99.0,
          100000,
          0.005
        ),
      ];

      const mockLiquidity = createMockAggregatedLiquidity(sources);
      mockCollector.fetchAggregatedLiquidity.mockResolvedValue(mockLiquidity);

      const routes = await engine.findOptimalRoutes(
        inputMint,
        outputMint,
        inputAmount
      );

      expect(routes.length).toBeGreaterThan(0);
      const route = routes[0];

      // Total cost should be calculated
      expect(route.totalCost).toBeDefined();
      expect(route.totalCost).toBeGreaterThanOrEqual(0);
    });

    it("should prioritize routes with lower total cost", async () => {
      const inputMint = "So11111111111111111111111111111111111111112";
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const inputAmount = 100;

      const sources = [
        createMockLiquiditySource(
          VenueName.PHOENIX,
          VenueType.CLOB,
          99.5,
          50000,
          0.001
        ), // Low slippage
        createMockLiquiditySource(
          VenueName.RAYDIUM,
          VenueType.AMM,
          99.4,
          80000,
          0.008
        ), // High slippage
      ];

      const mockLiquidity = createMockAggregatedLiquidity(sources);
      mockCollector.fetchAggregatedLiquidity.mockResolvedValue(mockLiquidity);

      const routes = await engine.findOptimalRoutes(
        inputMint,
        outputMint,
        inputAmount
      );

      // Best route should have better expected output despite cost
      expect(routes.length).toBeGreaterThan(0);
      expect(routes[0].expectedOutput).toBeGreaterThan(0);

      // Routes should be sorted by expected output (descending)
      for (let i = 0; i < routes.length - 1; i++) {
        expect(routes[i].expectedOutput).toBeGreaterThanOrEqual(
          routes[i + 1].expectedOutput
        );
      }
    });
  });

  // ============================================================================
  // TEST 4: VENUE FILTERING
  // ============================================================================

  describe("Venue Filtering", () => {
    it("should exclude specified venues", async () => {
      const inputMint = "So11111111111111111111111111111111111111112";
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const inputAmount = 100;

      const sources = [
        createMockLiquiditySource(
          VenueName.PHOENIX,
          VenueType.CLOB,
          99.5,
          50000,
          0.002
        ),
        createMockLiquiditySource(
          VenueName.ORCA,
          VenueType.AMM,
          99.3,
          100000,
          0.005
        ),
        createMockLiquiditySource(
          VenueName.RAYDIUM,
          VenueType.AMM,
          99.1,
          80000,
          0.006
        ),
      ];

      const mockLiquidity = createMockAggregatedLiquidity(sources);
      mockCollector.fetchAggregatedLiquidity.mockResolvedValue(mockLiquidity);

      const excludedVenues = [VenueName.RAYDIUM];
      const routes = await engine.findOptimalRoutes(
        inputMint,
        outputMint,
        inputAmount,
        { excludedVenues }
      );

      // Should not include Raydium
      routes.forEach((route) => {
        route.splits.forEach((split) => {
          expect(split.venue).not.toBe(VenueName.RAYDIUM);
        });
      });
    });

    it("should only use allowed venues when specified", async () => {
      const inputMint = "So11111111111111111111111111111111111111112";
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const inputAmount = 100;

      const sources = [
        createMockLiquiditySource(
          VenueName.PHOENIX,
          VenueType.CLOB,
          99.5,
          50000,
          0.002
        ),
        createMockLiquiditySource(
          VenueName.ORCA,
          VenueType.AMM,
          99.3,
          100000,
          0.005
        ),
      ];

      const mockLiquidity = createMockAggregatedLiquidity(sources);
      mockCollector.fetchAggregatedLiquidity.mockResolvedValue(mockLiquidity);

      const allowedVenues = [VenueName.PHOENIX, VenueName.ORCA];
      const routes = await engine.findOptimalRoutes(
        inputMint,
        outputMint,
        inputAmount,
        { allowedVenues }
      );

      // Should only use Phoenix and Orca
      routes.forEach((route) => {
        route.splits.forEach((split) => {
          expect(allowedVenues).toContain(split.venue);
        });
      });
    });
  });

  // ============================================================================
  // TEST 5: ERROR HANDLING
  // ============================================================================

  describe("Error Handling", () => {
    it("should throw when no viable sources within slippage tolerance", async () => {
      const inputMint = "So11111111111111111111111111111111111111112";
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const inputAmount = 100;

      const sources = [
        createMockLiquiditySource(
          VenueName.ORCA,
          VenueType.AMM,
          99.0,
          100000,
          0.05
        ), // 5% slippage (too high)
      ];

      const mockLiquidity = createMockAggregatedLiquidity(sources);
      mockCollector.fetchAggregatedLiquidity.mockResolvedValue(mockLiquidity);

      await expect(
        engine.findOptimalRoutes(
          inputMint,
          outputMint,
          inputAmount,
          { slippageTolerance: 0.01 } // 1% max
        )
      ).rejects.toThrow(/No viable liquidity sources/);
    });

    it("should handle empty liquidity sources", async () => {
      const inputMint = "So11111111111111111111111111111111111111112";
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const inputAmount = 100;

      const mockLiquidity = createMockAggregatedLiquidity([]);
      mockCollector.fetchAggregatedLiquidity.mockResolvedValue(mockLiquidity);

      await expect(
        engine.findOptimalRoutes(inputMint, outputMint, inputAmount)
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // TEST 6: ROUTE RANKING
  // ============================================================================

  describe("Route Ranking", () => {
    it("should return routes sorted by expected output", async () => {
      const inputMint = "So11111111111111111111111111111111111111112";
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const inputAmount = 100;

      const sources = [
        createMockLiquiditySource(
          VenueName.PHOENIX,
          VenueType.CLOB,
          99.5,
          50000,
          0.002
        ), // Best
        createMockLiquiditySource(
          VenueName.ORCA,
          VenueType.AMM,
          99.3,
          100000,
          0.005
        ), // Second
        createMockLiquiditySource(
          VenueName.RAYDIUM,
          VenueType.AMM,
          99.0,
          80000,
          0.006
        ), // Third
      ];

      const mockLiquidity = createMockAggregatedLiquidity(sources);
      mockCollector.fetchAggregatedLiquidity.mockResolvedValue(mockLiquidity);

      const routes = await engine.findOptimalRoutes(
        inputMint,
        outputMint,
        inputAmount
      );

      // Should be sorted descending by expected output
      for (let i = 0; i < routes.length - 1; i++) {
        expect(routes[i].expectedOutput).toBeGreaterThanOrEqual(
          routes[i + 1].expectedOutput
        );
      }
    });

    it("should respect maxRoutes configuration", async () => {
      const inputMint = "So11111111111111111111111111111111111111112";
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const inputAmount = 100;

      const sources = [
        createMockLiquiditySource(
          VenueName.PHOENIX,
          VenueType.CLOB,
          99.5,
          50000,
          0.002
        ),
        createMockLiquiditySource(
          VenueName.ORCA,
          VenueType.AMM,
          99.3,
          100000,
          0.005
        ),
        createMockLiquiditySource(
          VenueName.RAYDIUM,
          VenueType.AMM,
          99.1,
          80000,
          0.006
        ),
        createMockLiquiditySource(
          VenueName.METEORA,
          VenueType.AMM,
          98.9,
          70000,
          0.007
        ),
      ];

      const mockLiquidity = createMockAggregatedLiquidity(sources);
      mockCollector.fetchAggregatedLiquidity.mockResolvedValue(mockLiquidity);

      const maxRoutes = 2;
      const routes = await engine.findOptimalRoutes(
        inputMint,
        outputMint,
        inputAmount,
        { maxRoutes }
      );

      expect(routes.length).toBeLessThanOrEqual(maxRoutes);
    });
  });
});
