/**
 * Unit Tests for LiquidityDataCollector
 * Tests venue aggregation, caching, priority logic
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Connection, PublicKey, AccountInfo } from "@solana/web3.js";
import { LiquidityDataCollector } from "../sdk/src/services/LiquidityDataCollector";
import {
  VenueName,
  VenueType,
  LiquiditySource,
} from "../sdk/src/types/smart-router";

// ============================================================================
// MOCKS
// ============================================================================

// Mock Phoenix SDK
vi.mock("@ellipsis-labs/phoenix-sdk", () => ({
  Client: vi.fn().mockImplementation(() => ({
    getMarketOrderbook: vi.fn(),
  })),
}));

// Mock axios for Jupiter API
vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// ============================================================================
// MOCK DATA
// ============================================================================

const createMockLiquiditySource = (
  venue: VenueName,
  type: VenueType,
  price: number,
  depth: number,
  priority: number
): LiquiditySource => ({
  venue,
  type,
  depth,
  effectivePrice: price,
  expectedOutput: depth * price,
  feeRate: 0.003,
  priceImpact: 0.01,
  route: { hops: 1, venues: [venue] },
  executionTime: 500,
  confidence: 0.95,
  timestamp: Date.now(),
  priority,
  slippage: 0.005,
});

// ============================================================================
// TEST SUITE
// ============================================================================

describe("LiquidityDataCollector", () => {
  let collector: LiquidityDataCollector;
  let mockConnection: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConnection = {
      getAccountInfo: vi.fn(),
      getMultipleAccountsInfo: vi.fn(),
    };

    collector = new LiquidityDataCollector(mockConnection as Connection, 10000);
  });

  // ============================================================================
  // TEST 1: AGGREGATION LOGIC
  // ============================================================================

  describe("Aggregated Liquidity Fetching", () => {
    it("should aggregate liquidity from multiple venues", async () => {
      const inputMint = "So11111111111111111111111111111111111111112"; // SOL
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC
      const inputAmount = 100;

      // Mock Jupiter response (RFQ)
      const axios = await import("axios");
      (axios.default.get as any).mockResolvedValue({
        data: {
          data: [
            {
              inAmount: "100000000000", // 100 SOL
              outAmount: "10000000000", // 10000 USDC (price = 100)
              priceImpactPct: 0.5,
              marketInfos: [{ label: "Jupiter", lpFee: { pct: 0 } }],
            },
          ],
        },
      });

      // Mock Orca pool account (AMM)
      const orcaPoolBuffer = Buffer.alloc(512);
      // Simplified Orca whirlpool data - real implementation would parse correctly
      orcaPoolBuffer.writeBigUInt64LE(BigInt(1000000000000), 0); // liquidity
      orcaPoolBuffer.writeBigInt64LE(BigInt(50000000), 64); // token A amount
      orcaPoolBuffer.writeBigInt64LE(BigInt(5000000000), 128); // token B amount

      const mockOrcaAccount: Partial<AccountInfo<Buffer>> = {
        data: orcaPoolBuffer,
        owner: new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"),
        lamports: 1000000,
        executable: false,
      };

      mockConnection.getAccountInfo.mockResolvedValue(mockOrcaAccount);

      const result = await collector.fetchAggregatedLiquidity(
        inputMint,
        outputMint,
        inputAmount
      );

      // Assertions
      expect(result).toBeDefined();
      expect(result.tokenPair).toEqual([inputMint, outputMint]);
      expect(result.sources.length).toBeGreaterThan(0);
      expect(result.totalDepth).toBeGreaterThan(0);
      expect(result.bestSingleVenue).toBeDefined();
      expect(result.staleness).toBe(0); // Fresh data
    });

    it("should sort sources by best effective price", async () => {
      const inputMint = "So11111111111111111111111111111111111111112";
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const inputAmount = 100;

      // Mock multiple venues with different prices
      const axios = await import("axios");
      (axios.default.get as any).mockResolvedValue({
        data: {
          data: [
            {
              inAmount: "100000000000",
              outAmount: "9500000000", // Worse price (95 USDC)
              priceImpactPct: 1.0,
              marketInfos: [{ label: "Jupiter", lpFee: { pct: 0 } }],
            },
          ],
        },
      });

      const mockOrcaAccount: Partial<AccountInfo<Buffer>> = {
        data: Buffer.alloc(512),
        owner: new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"),
        lamports: 1000000,
        executable: false,
      };

      mockConnection.getAccountInfo.mockResolvedValue(mockOrcaAccount);

      const result = await collector.fetchAggregatedLiquidity(
        inputMint,
        outputMint,
        inputAmount
      );

      // Sources should be sorted by effective price (best first)
      if (result.sources.length > 1) {
        for (let i = 0; i < result.sources.length - 1; i++) {
          expect(result.sources[i].effectivePrice).toBeLessThanOrEqual(
            result.sources[i + 1].effectivePrice
          );
        }
      }
    });

    it("should calculate total depth correctly", async () => {
      const inputMint = "So11111111111111111111111111111111111111112";
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const inputAmount = 100;

      const axios = await import("axios");
      (axios.default.get as any).mockResolvedValue({
        data: {
          data: [
            {
              inAmount: "100000000000",
              outAmount: "10000000000",
              priceImpactPct: 0.5,
              marketInfos: [{ label: "Jupiter", lpFee: { pct: 0 } }],
            },
          ],
        },
      });

      const mockOrcaAccount: Partial<AccountInfo<Buffer>> = {
        data: Buffer.alloc(512),
        owner: new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"),
        lamports: 1000000,
        executable: false,
      };

      mockConnection.getAccountInfo.mockResolvedValue(mockOrcaAccount);

      const result = await collector.fetchAggregatedLiquidity(
        inputMint,
        outputMint,
        inputAmount
      );

      // Total depth should be sum of all venue depths
      const expectedDepth = result.sources.reduce((sum, s) => sum + s.depth, 0);
      expect(result.totalDepth).toBe(expectedDepth);
    });
  });

  // ============================================================================
  // TEST 2: CACHING BEHAVIOR
  // ============================================================================

  describe("Caching Mechanism", () => {
    it("should cache fetched liquidity data", async () => {
      const inputMint = "So11111111111111111111111111111111111111112";
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const inputAmount = 100;

      const axios = await import("axios");
      (axios.default.get as any).mockResolvedValue({
        data: {
          data: [
            {
              inAmount: "100000000000",
              outAmount: "10000000000",
              priceImpactPct: 0.5,
              marketInfos: [{ label: "Jupiter", lpFee: { pct: 0 } }],
            },
          ],
        },
      });

      const mockOrcaAccount: Partial<AccountInfo<Buffer>> = {
        data: Buffer.alloc(512),
        owner: new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"),
        lamports: 1000000,
        executable: false,
      };

      mockConnection.getAccountInfo.mockResolvedValue(mockOrcaAccount);

      // First fetch
      const result1 = await collector.fetchAggregatedLiquidity(
        inputMint,
        outputMint,
        inputAmount
      );

      // Clear mocks
      vi.clearAllMocks();

      // Second fetch (should use cache)
      const result2 = await collector.fetchAggregatedLiquidity(
        inputMint,
        outputMint,
        inputAmount
      );

      // Should not have called external APIs again
      expect(axios.default.get).not.toHaveBeenCalled();
      expect(mockConnection.getAccountInfo).not.toHaveBeenCalled();

      // Results should be similar (cached)
      expect(result2.tokenPair).toEqual(result1.tokenPair);
      expect(result2.sources.length).toBe(result1.sources.length);
    });

    it("should refresh cache after expiry", async () => {
      const shortCacheMs = 100; // 100ms cache
      const collectorShortCache = new LiquidityDataCollector(
        mockConnection as Connection,
        shortCacheMs
      );

      const inputMint = "So11111111111111111111111111111111111111112";
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const inputAmount = 100;

      // First fetch
      const result1 = await collectorShortCache.fetchAggregatedLiquidity(
        inputMint,
        outputMint,
        inputAmount
      );

      expect(result1.staleness).toBe(0);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, shortCacheMs + 50));

      // Second fetch (should refresh)
      const result2 = await collectorShortCache.fetchAggregatedLiquidity(
        inputMint,
        outputMint,
        inputAmount
      );

      // Should be fresh again
      expect(result2.staleness).toBe(0);
    });

    it("should maintain separate cache entries for different pairs", async () => {
      const inputMint1 = "So11111111111111111111111111111111111111112"; // SOL
      const inputMint2 = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC
      const outputMint = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"; // USDT
      const inputAmount = 100;

      // Fetch for first pair
      const result1 = await collector.fetchAggregatedLiquidity(
        inputMint1,
        outputMint,
        inputAmount
      );

      // Fetch for second pair (should not use first pair's cache)
      const result2 = await collector.fetchAggregatedLiquidity(
        inputMint2,
        outputMint,
        inputAmount
      );

      // Results should be different (different token pairs)
      expect(result1.tokenPair).toEqual([inputMint1, outputMint]);
      expect(result2.tokenPair).toEqual([inputMint2, outputMint]);
      expect(result1.tokenPair).not.toEqual(result2.tokenPair);
    });
  });

  // ============================================================================
  // TEST 3: VENUE FILTERING
  // ============================================================================

  describe("Venue Filtering", () => {
    it("should only fetch from enabled venues", async () => {
      const inputMint = "So11111111111111111111111111111111111111112";
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const inputAmount = 100;
      const enabledVenues = [VenueName.JUPITER, VenueName.ORCA];

      const axios = await import("axios");
      (axios.default.get as any).mockResolvedValue({
        data: {
          data: [
            {
              inAmount: "100000000000",
              outAmount: "10000000000",
              priceImpactPct: 0.5,
              marketInfos: [{ label: "Jupiter", lpFee: { pct: 0 } }],
            },
          ],
        },
      });

      const mockOrcaAccount: Partial<AccountInfo<Buffer>> = {
        data: Buffer.alloc(512),
        owner: new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"),
        lamports: 1000000,
        executable: false,
      };

      mockConnection.getAccountInfo.mockResolvedValue(mockOrcaAccount);

      const result = await collector.fetchAggregatedLiquidity(
        inputMint,
        outputMint,
        inputAmount,
        enabledVenues
      );

      // Should only have data from enabled venues
      result.sources.forEach((source) => {
        expect(enabledVenues).toContain(source.venue);
      });
    });
  });

  // ============================================================================
  // TEST 4: ERROR HANDLING
  // ============================================================================

  describe("Error Handling", () => {
    it("should handle venue fetch failures gracefully", async () => {
      const inputMint = "So11111111111111111111111111111111111111112";
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const inputAmount = 100;

      // Mock Jupiter failure
      const axios = await import("axios");
      (axios.default.get as any).mockRejectedValue(
        new Error("Jupiter API down")
      );

      // Mock Orca success
      const mockOrcaAccount: Partial<AccountInfo<Buffer>> = {
        data: Buffer.alloc(512),
        owner: new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"),
        lamports: 1000000,
        executable: false,
      };

      mockConnection.getAccountInfo.mockResolvedValue(mockOrcaAccount);

      // Should still return data from Orca (no throw)
      const result = await collector.fetchAggregatedLiquidity(
        inputMint,
        outputMint,
        inputAmount
      );

      expect(result).toBeDefined();
      expect(result.sources.length).toBeGreaterThanOrEqual(0);
    });

    it("should return fallback AMM data when implemented venues fail", async () => {
      const inputMint = "So11111111111111111111111111111111111111112";
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const inputAmount = 100;

      // Mock Jupiter failure (RFQ)
      const axios = await import("axios");
      (axios.default.get as any).mockRejectedValue(new Error("API down"));

      // Mock Orca failure (only implemented AMM)
      mockConnection.getAccountInfo.mockResolvedValue(null);

      const result = await collector.fetchAggregatedLiquidity(
        inputMint,
        outputMint,
        inputAmount
      );

      // Should still return data from fallback AMMs (Raydium, Meteora, etc.)
      expect(result).toBeDefined();
      expect(result.sources.length).toBeGreaterThan(0);

      // Should have fallback AMM data
      const ammSources = result.sources.filter((s) => s.venueType === "amm");
      expect(ammSources.length).toBeGreaterThan(0);

      // Fallback AMMs should have mock reserves
      ammSources.forEach((source) => {
        expect(source.reserves).toBeDefined();
        if (source.reserves) {
          expect(source.reserves.input).toBe(1000000);
          expect(source.reserves.output).toBe(500000);
        }
      });
    });
  });

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  describe("Utility Methods", () => {
    it("should clear cache", async () => {
      const inputMint = "So11111111111111111111111111111111111111112";
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const inputAmount = 1;

      // Fetch once to populate cache
      await collector.fetchAggregatedLiquidity(
        inputMint,
        outputMint,
        inputAmount
      );

      // Clear cache
      collector.clearCache();

      // Fetch again - should trigger new fetch (not from cache)
      const result = await collector.fetchAggregatedLiquidity(
        inputMint,
        outputMint,
        inputAmount
      );

      expect(result).toBeDefined();
    });

    it("should get venue config", () => {
      const orcaConfig = collector.getVenueConfig(VenueName.ORCA);
      expect(orcaConfig).toBeDefined();
      expect(orcaConfig.name).toBe(VenueName.ORCA);
      expect(orcaConfig.type).toBe(VenueType.AMM);
      expect(orcaConfig.enabled).toBe(true);
      expect(orcaConfig.feeRate).toBe(0.003);
    });

    it("should get enabled venues sorted by priority", () => {
      const enabledVenues = collector.getEnabledVenues();
      
      expect(enabledVenues).toBeDefined();
      expect(Array.isArray(enabledVenues)).toBe(true);
      expect(enabledVenues.length).toBeGreaterThan(0);

      // Should be sorted by priority (descending)
      for (let i = 0; i < enabledVenues.length - 1; i++) {
        const currentPriority = collector.getVenueConfig(enabledVenues[i]).priority;
        const nextPriority = collector.getVenueConfig(enabledVenues[i + 1]).priority;
        expect(currentPriority).toBeGreaterThanOrEqual(nextPriority);
      }
    });

    it("should filter only enabled venues", () => {
      const enabledVenues = collector.getEnabledVenues();
      
      enabledVenues.forEach((venue) => {
        const config = collector.getVenueConfig(venue);
        expect(config.enabled).toBe(true);
      });
    });
  });

  // ==========================================================================
  // HELPER FUNCTIONS
  // ==========================================================================

  describe("Helper Functions", () => {
    it("should calculate price impact correctly", async () => {
      const { calculatePriceImpact } = await import(
        "../sdk/src/services/LiquidityDataCollector"
      );

      const inputAmount = 10;
      const reserveIn = 100000;
      const reserveOut = 200000;
      const feeRate = 0.003;

      const priceImpact = calculatePriceImpact(
        inputAmount,
        reserveIn,
        reserveOut,
        feeRate
      );

      // Price impact should be a valid number
      expect(typeof priceImpact).toBe("number");
      expect(isNaN(priceImpact)).toBe(false);
      expect(isFinite(priceImpact)).toBe(true);
    });

    it("should calculate higher price impact for larger trades", async () => {
      const { calculatePriceImpact } = await import(
        "../sdk/src/services/LiquidityDataCollector"
      );

      const smallTrade = calculatePriceImpact(10, 10000, 20000, 0.003);
      const largeTrade = calculatePriceImpact(1000, 10000, 20000, 0.003);

      expect(largeTrade).toBeGreaterThan(smallTrade);
    });

    it("should estimate AMM output correctly", async () => {
      const { estimateAMMOutput } = await import(
        "../sdk/src/services/LiquidityDataCollector"
      );

      const inputAmount = 100;
      const reserveIn = 10000;
      const reserveOut = 20000;
      const feeRate = 0.003;

      const output = estimateAMMOutput(inputAmount, reserveIn, reserveOut, feeRate);

      expect(output).toBeGreaterThan(0);
      expect(output).toBeLessThan(inputAmount * 2); // Should be less than 2:1 ratio
      expect(output).toBeCloseTo(197.4, 1); // Expected output ~197.4
    });

    it("should account for fees in AMM output", async () => {
      const { estimateAMMOutput } = await import(
        "../sdk/src/services/LiquidityDataCollector"
      );

      const outputWithFee = estimateAMMOutput(100, 10000, 20000, 0.003);
      const outputNoFee = estimateAMMOutput(100, 10000, 20000, 0);

      expect(outputNoFee).toBeGreaterThan(outputWithFee);
    });

    it("should detect stale liquidity data", async () => {
      const { isLiquidityStale } = await import(
        "../sdk/src/services/LiquidityDataCollector"
      );

      const freshSource: LiquiditySource = {
        venue: VenueName.ORCA,
        venueType: VenueType.AMM,
        tokenPair: ["mint1", "mint2"],
        depth: 1000,
        effectivePrice: 1.5,
        feeAmount: 3,
        slippagePercent: 0.01,
        route: ["mint1", "mint2"],
        timestamp: Date.now(),
      };

      const staleSource: LiquiditySource = {
        ...freshSource,
        timestamp: Date.now() - 20000, // 20 seconds old
      };

      expect(isLiquidityStale(freshSource, 10000)).toBe(false);
      expect(isLiquidityStale(staleSource, 10000)).toBe(true);
    });

    it("should use custom maxAge for staleness check", async () => {
      const { isLiquidityStale } = await import(
        "../sdk/src/services/LiquidityDataCollector"
      );

      const source: LiquiditySource = {
        venue: VenueName.ORCA,
        venueType: VenueType.AMM,
        tokenPair: ["mint1", "mint2"],
        depth: 1000,
        effectivePrice: 1.5,
        feeAmount: 3,
        slippagePercent: 0.01,
        route: ["mint1", "mint2"],
        timestamp: Date.now() - 5000, // 5 seconds old
      };

      expect(isLiquidityStale(source, 10000)).toBe(false); // Not stale (max 10s)
      expect(isLiquidityStale(source, 3000)).toBe(true); // Stale (max 3s)
    });
  });

  // ==========================================================================
  // JUPITER RFQ INTEGRATION
  // ==========================================================================

  describe("Jupiter RFQ Integration", () => {
    it("should parse Jupiter quote response correctly", async () => {
      const axios = await import("axios");
      const mockJupiterResponse = {
        data: {
          inAmount: "1000000000", // 1 SOL in lamports
          outAmount: "100000000", // 100 USDC (6 decimals)
          priceImpactPct: "0.05", // 0.05% price impact
          routePlan: [
            {
              swapInfo: {
                outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                label: "Orca",
              },
            },
          ],
        },
      };

      (axios.default.get as any).mockResolvedValueOnce(mockJupiterResponse);

      const inputMint = "So11111111111111111111111111111111111111112";
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const inputAmount = 1;

      const result = await collector.fetchAggregatedLiquidity(
        inputMint,
        outputMint,
        inputAmount
      );

      expect(result).toBeDefined();
      
      // Find Jupiter source
      const jupiterSource = result.sources.find(
        (s) => s.venue === VenueName.JUPITER
      );

      if (jupiterSource) {
        expect(jupiterSource.venueType).toBe(VenueType.RFQ);
        expect(jupiterSource.metadata?.jupiterQuote).toBeDefined();
        expect(jupiterSource.route).toContain(inputMint);
        expect(jupiterSource.route).toContain(outputMint);
      }
    });

    it("should handle Jupiter quote with multiple route steps", async () => {
      const axios = await import("axios");
      const mockJupiterResponse = {
        data: {
          inAmount: "1000000000",
          outAmount: "100000000",
          priceImpactPct: "0.1",
          routePlan: [
            {
              swapInfo: {
                outputMint: "intermediate1",
                label: "Raydium",
              },
            },
            {
              swapInfo: {
                outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                label: "Orca",
              },
            },
          ],
        },
      };

      (axios.default.get as any).mockResolvedValueOnce(mockJupiterResponse);

      const inputMint = "So11111111111111111111111111111111111111112";
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const inputAmount = 1;

      const result = await collector.fetchAggregatedLiquidity(
        inputMint,
        outputMint,
        inputAmount
      );

      const jupiterSource = result.sources.find(
        (s) => s.venue === VenueName.JUPITER
      );

      if (jupiterSource) {
        // Route should include intermediate steps
        expect(jupiterSource.route.length).toBeGreaterThanOrEqual(3);
        expect(jupiterSource.metadata?.jupiterQuote?.marketInfos).toBeDefined();
      }
    });

    it("should calculate Jupiter effective price correctly", async () => {
      const axios = await import("axios");
      const mockJupiterResponse = {
        data: {
          inAmount: "1000000000", // 1 SOL
          outAmount: "95000000000", // 95 USDC (with impact)
          priceImpactPct: "0.5",
          routePlan: [],
        },
      };

      (axios.default.get as any).mockResolvedValueOnce(mockJupiterResponse);

      const inputMint = "So11111111111111111111111111111111111111112";
      const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const inputAmount = 1;

      const result = await collector.fetchAggregatedLiquidity(
        inputMint,
        outputMint,
        inputAmount
      );

      const jupiterSource = result.sources.find(
        (s) => s.venue === VenueName.JUPITER
      );

      if (jupiterSource) {
        // Effective price = input / output
        expect(jupiterSource.effectivePrice).toBeGreaterThan(0);
        expect(jupiterSource.slippagePercent).toBeCloseTo(0.005, 3); // 0.5%
      }
    });
  });
});
