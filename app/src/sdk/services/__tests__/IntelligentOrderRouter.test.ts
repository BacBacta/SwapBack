import { describe, expect, it, vi } from "vitest";
import { IntelligentOrderRouter as AppRouter } from "../IntelligentOrderRouter";
import { IntelligentOrderRouter as SdkRouter } from "../../../../../sdk/src/services/IntelligentOrderRouter";
import type { LiquidityDataCollector } from "../LiquidityDataCollector";
import type { RouteOptimizationEngine } from "../RouteOptimizationEngine";
import { VenueName, VenueType } from "../../types/smart-router";
import type { LiquiditySource } from "../../types/smart-router";

vi.mock("@meteora-ag/dlmm", () => ({}));

const routerMatrix = [
  ["app", AppRouter],
  ["sdk", SdkRouter],
] as const;

function buildRouter(
  RouterImpl: new (
    collector: LiquidityDataCollector,
    optimizer: RouteOptimizationEngine
  ) => unknown
) {
  const collector = {
    getVenueConfig: vi.fn(() => ({
      name: VenueName.PHOENIX,
      type: VenueType.CLOB,
      enabled: true,
      priority: 100,
      feeRate: 0.001,
      minTradeSize: 1,
      maxSlippage: 0.01,
      takerFeeBps: 10,
    })),
  } as unknown as LiquidityDataCollector;

  const optimizer = {} as RouteOptimizationEngine;
  return new RouterImpl(collector, optimizer);
}

describe.each(routerMatrix)(
  "IntelligentOrderRouter.simulateSourceOutput (%s)",
  (_, RouterImpl) => {
    it("simulates depth-aware fills for CLOB venues", () => {
      const router = buildRouter(RouterImpl as any);
      const orderbook = {
        bids: [
          { price: 50, size: 1 },
          { price: 48, size: 4 },
        ],
        asks: [
          { price: 51, size: 5 },
        ],
        bestBid: 50,
        bestAsk: 51,
        spreadBps: 200,
        depthUsd: 5000,
        lastUpdated: Date.now(),
        latencyMs: 3,
      };

      const source: LiquiditySource = {
        venue: VenueName.PHOENIX,
        venueType: VenueType.CLOB,
        tokenPair: ["SOL", "USDC"],
        depth: 100000,
        effectivePrice: 0,
        feeAmount: 0,
        slippagePercent: 0.0001,
        route: ["SOL", "USDC"],
        timestamp: Date.now(),
        orderbook,
        metadata: {
          direction: "sellBase",
          takerFeeBps: 5,
        },
      };

      const quote = (router as any).simulateSourceOutput(source, 2);
      const gross = 50 * 1 + 48 * 1;
      const expected = gross * (1 - 0.0005);
      expect(quote.outputAmount).toBeCloseTo(expected, 5);
    });

    it("honors sellQuote direction when only top-of-book is present", () => {
      const router = buildRouter(RouterImpl as any);
      const source: LiquiditySource = {
        venue: VenueName.PHOENIX,
        venueType: VenueType.CLOB,
        tokenPair: ["USDC", "SOL"],
        depth: 90000,
        effectivePrice: 0,
        feeAmount: 0,
        slippagePercent: 0.0001,
        route: ["USDC", "SOL"],
        timestamp: Date.now(),
        topOfBook: {
          bidPrice: 49,
          askPrice: 50,
          bidSize: 5,
          askSize: 5,
        },
        metadata: {
          direction: "sellQuote",
          takerFeeBps: 10,
        },
      };

      const quote = (router as any).simulateSourceOutput(source, 100);
      const expected = (100 * (1 - 0.001)) / 50;
      expect(quote.outputAmount).toBeCloseTo(expected, 5);
      expect(quote.feeAmount).toBeCloseTo(0.1, 5);
    });

    it("falls back to bid-side top-of-book when depth snapshot is empty", () => {
      const router = buildRouter(RouterImpl as any);
      const source: LiquiditySource = {
        venue: VenueName.PHOENIX,
        venueType: VenueType.CLOB,
        tokenPair: ["SOL", "USDC"],
        depth: 80000,
        effectivePrice: 0,
        feeAmount: 0,
        slippagePercent: 0.0001,
        route: ["SOL", "USDC"],
        timestamp: Date.now(),
        orderbook: {
          bids: [],
          asks: [],
          bestBid: 0,
          bestAsk: 0,
          spreadBps: 0,
          depthUsd: 0,
          lastUpdated: Date.now(),
          latencyMs: 2,
        },
        topOfBook: {
          bidPrice: 47,
          askPrice: 48,
          bidSize: 10,
          askSize: 10,
        },
        metadata: {
          direction: "sellBase",
          takerFeeBps: 10,
        },
      };

      const quote = (router as any).simulateSourceOutput(source, 1);
      const expected = 47 * (1 - 0.001);
      expect(quote.outputAmount).toBeCloseTo(expected, 5);
    });
  }
);
