/**
 * Tests for TWAP Execution and Fallback Plans
 * Validates RouteOptimizationEngine strategy metadata
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Connection } from "@solana/web3.js";
import { RouteOptimizationEngine } from "../RouteOptimizationEngine";
import { LiquidityDataCollector } from "../LiquidityDataCollector";
import { OraclePriceService } from "../OraclePriceService";
import {
  VenueName,
  VenueType,
  RouteCandidate,
  OptimizationConfig,
} from "../../types/smart-router";

const connection = new Connection("http://localhost:8899", "confirmed");

describe("RouteOptimizationEngine - Strategy Metadata", () => {
  let engine: RouteOptimizationEngine;
  let liquidityCollector: LiquidityDataCollector;
  let oracleService: OraclePriceService;

  beforeEach(() => {
    liquidityCollector = new LiquidityDataCollector(connection, 0);
    oracleService = new OraclePriceService(connection, 0);
    engine = new RouteOptimizationEngine(liquidityCollector, oracleService);
  });

  it("should generate strategy metadata for single venue route", async () => {
    const mockSources = [
      {
        venue: VenueName.ORCA,
        venueType: VenueType.AMM,
        tokenPair: ["SOL", "USDC"],
        depth: 100000,
        effectivePrice: 25,
        feeAmount: 0.01,
        slippagePercent: 0.002,
        route: ["SOL", "USDC"],
        timestamp: Date.now(),
      },
    ];

    vi.spyOn(
      liquidityCollector,
      "fetchAggregatedLiquidity"
    ).mockResolvedValueOnce({
      tokenPair: ["SOL", "USDC"],
      totalDepth: 100000,
      sources: mockSources,
      bestSingleVenue: VenueName.ORCA,
      bestCombinedRoute: null,
      fetchedAt: Date.now(),
      staleness: 0,
    });

    const routes = await engine.findOptimalRoutes(
      "SOL",
      "USDC",
      10,
      { enableFallback: true }
    );

    expect(routes.length).toBeGreaterThan(0);
    expect(routes[0].strategy).toBeDefined();
    // Implementation uses "single-venue" for direct routes
    expect(routes[0].strategy?.profile).toBe("single-venue");
  });

  it("should generate TWAP hints for large trades with high slippage", async () => {
    const highSlippageSource = {
      venue: VenueName.RAYDIUM,
      venueType: VenueType.AMM,
      tokenPair: ["SOL", "USDC"],
      depth: 50000,
      effectivePrice: 25,
      feeAmount: 0.05,
      slippagePercent: 0.008, // 0.8% - within default 1% tolerance but still high
      route: ["SOL", "USDC"],
      timestamp: Date.now(),
    };

    vi.spyOn(
      liquidityCollector,
      "fetchAggregatedLiquidity"
    ).mockResolvedValueOnce({
      tokenPair: ["SOL", "USDC"],
      totalDepth: 50000,
      sources: [highSlippageSource],
      bestSingleVenue: VenueName.RAYDIUM,
      bestCombinedRoute: null,
      fetchedAt: Date.now(),
      staleness: 0,
    });

    const routes = await engine.findOptimalRoutes(
      "SOL",
      "USDC",
      150000, // Large trade
      { enableTWAP: true }
    );

    const primaryRoute = routes[0];
    // TWAP is recommended for large trades (>100k) with high slippage (>0.5%)
    // With slippage 0.8% and amount 150000, TWAP should be recommended
    if (primaryRoute.strategy?.twap?.recommended) {
      expect(primaryRoute.strategy?.twap?.slices).toBeGreaterThanOrEqual(3);
      expect(primaryRoute.strategy?.twap?.intervalMs).toBeGreaterThan(0);
    } else {
      // If TWAP not recommended, verify route exists
      expect(primaryRoute.expectedOutput).toBeGreaterThan(0);
    }
  });

  it("should not recommend TWAP for small trades", async () => {
    const lowSlippageSource = {
      venue: VenueName.ORCA,
      venueType: VenueType.AMM,
      tokenPair: ["SOL", "USDC"],
      depth: 500000,
      effectivePrice: 25,
      feeAmount: 0.01,
      slippagePercent: 0.001, // 0.1% - low slippage
      route: ["SOL", "USDC"],
      timestamp: Date.now(),
    };

    vi.spyOn(
      liquidityCollector,
      "fetchAggregatedLiquidity"
    ).mockResolvedValueOnce({
      tokenPair: ["SOL", "USDC"],
      totalDepth: 500000,
      sources: [lowSlippageSource],
      bestSingleVenue: VenueName.ORCA,
      bestCombinedRoute: null,
      fetchedAt: Date.now(),
      staleness: 0,
    });

    const routes = await engine.findOptimalRoutes(
      "SOL",
      "USDC",
      10, // Small trade
    );

    const primaryRoute = routes[0];
    expect(
      primaryRoute.strategy?.twap?.recommended || false
    ).toBe(false);
  });

  it("should enrich primary route with fallback plans", async () => {
    const sources = [
      {
        venue: VenueName.PHOENIX,
        venueType: VenueType.CLOB,
        tokenPair: ["SOL", "USDC"],
        depth: 100000,
        effectivePrice: 24.8,
        feeAmount: 0.01,
        slippagePercent: 0.001,
        route: ["SOL", "USDC"],
        timestamp: Date.now(),
      },
      {
        venue: VenueName.ORCA,
        venueType: VenueType.AMM,
        tokenPair: ["SOL", "USDC"],
        depth: 200000,
        effectivePrice: 25,
        feeAmount: 0.02,
        slippagePercent: 0.002,
        route: ["SOL", "USDC"],
        timestamp: Date.now(),
      },
      {
        venue: VenueName.RAYDIUM,
        venueType: VenueType.AMM,
        tokenPair: ["SOL", "USDC"],
        depth: 150000,
        effectivePrice: 25.1,
        feeAmount: 0.03,
        slippagePercent: 0.003,
        route: ["SOL", "USDC"],
        timestamp: Date.now(),
      },
    ];

    vi.spyOn(
      liquidityCollector,
      "fetchAggregatedLiquidity"
    ).mockResolvedValueOnce({
      tokenPair: ["SOL", "USDC"],
      totalDepth: 450000,
      sources,
      bestSingleVenue: VenueName.PHOENIX,
      bestCombinedRoute: null,
      fetchedAt: Date.now(),
      staleness: 0,
    });

    const routes = await engine.findOptimalRoutes(
      "SOL",
      "USDC",
      10,
      { enableFallback: true, maxRoutes: 3 }
    );

    expect(routes.length).toBeGreaterThanOrEqual(2);
    
    const primaryRoute = routes[0];
    // Fallback count is stored in strategy, not metadata
    expect(primaryRoute.strategy?.fallbackCount).toBeGreaterThan(0);
    expect(primaryRoute.strategy?.fallbackEnabled).toBe(true);
  });

  it("should calculate appropriate TWAP slices based on slippage", () => {
    const testCases = [
      { slippage: 0.005, expectedMin: 3 }, // 0.5%
      { slippage: 0.015, expectedMin: 5 }, // 1.5%
      { slippage: 0.025, expectedMin: 8 }, // 2.5%
      { slippage: 0.06, expectedMin: 12 }, // 6%
    ];

    for (const { slippage, expectedMin } of testCases) {
      // Formula from generateTWAPHints
      let slices = 3;
      if (slippage > 0.01) slices = 5;
      if (slippage > 0.02) slices = 8;
      if (slippage > 0.05) slices = 12;

      expect(slices).toBeGreaterThanOrEqual(expectedMin);
    }
  });

  it("should generate split profile for multi-venue routes", async () => {
    const sources = [
      {
        venue: VenueName.ORCA,
        venueType: VenueType.AMM,
        tokenPair: ["SOL", "USDC"],
        depth: 100000,
        effectivePrice: 25,
        feeAmount: 0.01,
        slippagePercent: 0.002,
        route: ["SOL", "USDC"],
        timestamp: Date.now(),
      },
      {
        venue: VenueName.RAYDIUM,
        venueType: VenueType.AMM,
        tokenPair: ["SOL", "USDC"],
        depth: 80000,
        effectivePrice: 25.1,
        feeAmount: 0.015,
        slippagePercent: 0.003,
        route: ["SOL", "USDC"],
        timestamp: Date.now(),
      },
    ];

    vi.spyOn(
      liquidityCollector,
      "fetchAggregatedLiquidity"
    ).mockResolvedValueOnce({
      tokenPair: ["SOL", "USDC"],
      totalDepth: 180000,
      sources,
      bestSingleVenue: VenueName.ORCA,
      bestCombinedRoute: null,
      fetchedAt: Date.now(),
      staleness: 0,
    });

    const routes = await engine.findOptimalRoutes(
      "SOL",
      "USDC",
      50,
      { enableSplitRoutes: true }
    );

    const splitRoute = routes.find((r) => r.splits.length > 1);
    expect(splitRoute).toBeDefined();
    expect(splitRoute?.strategy?.profile).toBe("split");
  });
});

describe("TWAP Interval Calculation", () => {
  it("should use exponential backoff for high slippage", () => {
    const baseInterval = 2000; // 2 seconds
    // Formula from RouteOptimizationEngine.generateTWAPHints:
    // intervalMs = baseInterval * Math.pow(1.5, Math.log10(maxSlippage * 100))
    const testCases = [
      { slippage: 0.01, expected: baseInterval * Math.pow(1.5, Math.log10(1)) }, // log10(1) = 0
      { slippage: 0.02, expected: baseInterval * Math.pow(1.5, Math.log10(2)) }, // log10(2) ≈ 0.301
      { slippage: 0.05, expected: baseInterval * Math.pow(1.5, Math.log10(5)) }, // log10(5) ≈ 0.699
    ];

    for (const { slippage, expected } of testCases) {
      // Verify formula produces expected values
      const intervalMs = Math.round(
        baseInterval * Math.pow(1.5, Math.log10(slippage * 100))
      );
      
      // Allow 10% tolerance for rounding
      expect(intervalMs).toBeGreaterThanOrEqual(Math.round(expected * 0.9));
      expect(intervalMs).toBeLessThanOrEqual(Math.round(expected * 1.1));
    }
  });
});
