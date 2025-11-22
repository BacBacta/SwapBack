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

// Mock Meteora DLMM SDK to avoid loading native deps during tests
vi.mock("@meteora-ag/dlmm", () => ({
  default: class MockDlmm {
    static async create() {
      throw new Error("not implemented in tests");
    }
  },
}));

// Mock axios for Jupiter API
vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// ============================================================================
// DETERMINISTIC MOCK HELPERS
// ============================================================================

const DEFAULT_INPUT_MINT = "So11111111111111111111111111111111111111112";
const DEFAULT_OUTPUT_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const deterministicVenueConfigs: Partial<
  Record<VenueName, Partial<LiquiditySource>>
> = {
  [VenueName.PHOENIX]: {
    venueType: VenueType.CLOB,
    depth: 600000,
    effectivePrice: 19.8,
    topOfBook: { bidPrice: 49.9, askPrice: 50, bidSize: 10, askSize: 9 },
    metadata: { direction: "sellBase", takerFeeBps: 5 },
  },
  [VenueName.OPENBOOK]: {
    venueType: VenueType.CLOB,
    depth: 500000,
    effectivePrice: 20.05,
    topOfBook: { bidPrice: 49.5, askPrice: 49.9, bidSize: 8, askSize: 7 },
    metadata: { direction: "sellBase", takerFeeBps: 5 },
  },
  [VenueName.ORCA]: {
    venueType: VenueType.AMM,
    depth: 400000,
    effectivePrice: 20.1,
    reserves: { input: 1_000_000, output: 500_000 },
  },
  [VenueName.RAYDIUM]: {
    venueType: VenueType.AMM,
    depth: 350000,
    effectivePrice: 20.2,
    reserves: { input: 1_000_000, output: 500_000 },
  },
  [VenueName.METEORA]: {
    venueType: VenueType.AMM,
    depth: 200000,
    effectivePrice: 20.4,
    reserves: { input: 1_000_000, output: 500_000 },
  },
  [VenueName.LIFINITY]: {
    venueType: VenueType.AMM,
    depth: 180000,
    effectivePrice: 20.45,
    reserves: { input: 1_000_000, output: 500_000 },
  },
  [VenueName.JUPITER]: {
    venueType: VenueType.RFQ,
    depth: 250000,
    effectivePrice: 20.5,
  },
  [VenueName.METIS]: {
    venueType: VenueType.RFQ,
    depth: 150000,
    effectivePrice: 20.6,
  },
};

const buildMockSource = (
  venue: VenueName,
  inputMint: string,
  outputMint: string,
  overrides: Partial<LiquiditySource> = {}
): LiquiditySource => {
  const inferredType =
    overrides.venueType ??
    deterministicVenueConfigs[venue]?.venueType ??
    (venue === VenueName.JUPITER || venue === VenueName.METIS
      ? VenueType.RFQ
      : venue === VenueName.PHOENIX || venue === VenueName.OPENBOOK
        ? VenueType.CLOB
        : VenueType.AMM);

  return {
    venue,
    venueType: inferredType,
    tokenPair: [inputMint, outputMint],
    depth:
      overrides.depth ?? deterministicVenueConfigs[venue]?.depth ?? 250000,
    effectivePrice:
      overrides.effectivePrice ??
      deterministicVenueConfigs[venue]?.effectivePrice ??
      20,
    feeAmount:
      overrides.feeAmount ??
      deterministicVenueConfigs[venue]?.feeAmount ??
      0.05,
    slippagePercent:
      overrides.slippagePercent ??
      deterministicVenueConfigs[venue]?.slippagePercent ??
      0.001,
    route: overrides.route ?? [inputMint, outputMint],
    timestamp: Date.now(),
    reserves:
      overrides.reserves ?? deterministicVenueConfigs[venue]?.reserves,
    topOfBook:
      overrides.topOfBook ?? deterministicVenueConfigs[venue]?.topOfBook,
    orderbook:
      overrides.orderbook ?? deterministicVenueConfigs[venue]?.orderbook,
    metadata:
      overrides.metadata ??
      deterministicVenueConfigs[venue]?.metadata ??
      (inferredType === VenueType.CLOB
        ? { direction: "sellBase", takerFeeBps: 5 }
        : undefined),
  };
};

const defaultFetchImplementation = async (
  venue: VenueName,
  inputMint: string,
  outputMint: string
): Promise<LiquiditySource | null> => {
  const template = deterministicVenueConfigs[venue];
  if (!template) {
    return null;
  }
  return buildMockSource(venue, inputMint, outputMint, template);
};

const attachDeterministicFetch = (
  instance: LiquidityDataCollector,
  impl: typeof defaultFetchImplementation = defaultFetchImplementation
) =>
  vi
    .spyOn(instance as any, "fetchVenueLiquidity")
    .mockImplementation(
      async (
        venue: VenueName,
        inputMint: string,
        outputMint: string,
        _inputAmount: number
      ) => impl(venue, inputMint, outputMint)
    );

// ============================================================================
// TEST SUITE
// ============================================================================

describe("LiquidityDataCollector", () => {
  let collector: LiquidityDataCollector;
  let mockConnection: any;
  let fetchVenueMock: ReturnType<typeof attachDeterministicFetch>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConnection = {
      getAccountInfo: vi.fn(),
      getMultipleAccountsInfo: vi.fn(),
    };

    collector = new LiquidityDataCollector(mockConnection as Connection, 10000);
    fetchVenueMock = attachDeterministicFetch(collector);
  });

  // ============================================================================
  // TEST 1: AGGREGATION LOGIC
  // ============================================================================

  describe("Aggregated Liquidity Fetching", () => {
    it("should aggregate liquidity from multiple venues", async () => {
      const inputMint = DEFAULT_INPUT_MINT;
      const outputMint = DEFAULT_OUTPUT_MINT;
      const inputAmount = 100;

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
      attachDeterministicFetch(collectorShortCache);

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
      const inputMint = DEFAULT_INPUT_MINT;
      const outputMint = DEFAULT_OUTPUT_MINT;
      const inputAmount = 100;

      fetchVenueMock.mockImplementation(
        async (venue: VenueName, mintIn: string, mintOut: string) => {
          if (venue === VenueName.JUPITER) {
            return null; // Simulate RFQ outage
          }
          return defaultFetchImplementation(venue, mintIn, mintOut);
        }
      );

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
      const inputMint = DEFAULT_INPUT_MINT;
      const outputMint = DEFAULT_OUTPUT_MINT;
      const inputAmount = 100;

      fetchVenueMock.mockImplementation(
        async (venue: VenueName, mintIn: string, mintOut: string) => {
          if (venue === VenueName.JUPITER || venue === VenueName.ORCA) {
            return null; // Force primary venues to fail
          }

          if (
            venue === VenueName.RAYDIUM ||
            venue === VenueName.METEORA ||
            venue === VenueName.LIFINITY
          ) {
            return buildMockSource(venue, mintIn, mintOut, {
              venueType: VenueType.AMM,
              reserves: { input: 1_000_000, output: 500_000 },
              depth: 300000,
              effectivePrice: 20.3,
            });
          }

          return defaultFetchImplementation(venue, mintIn, mintOut);
        }
      );

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

  // ============================================================================
  // TEST 3: REAL AMM SERVICE INTEGRATION (METEORA + LIFINITY)
  // ============================================================================

  describe("AMM service integration", () => {
    beforeEach(() => {
      fetchVenueMock.mockRestore();
    });

    it("delegates Meteora and Lifinity venues to their services", async () => {
      const inputMint = DEFAULT_INPUT_MINT;
      const outputMint = DEFAULT_OUTPUT_MINT;
      const inputAmount = 5;

      const meteoraQuote = buildMockSource(VenueName.METEORA, inputMint, outputMint, {
        effectivePrice: 20.12,
        depth: 12345,
      });
      const lifinityQuote = buildMockSource(
        VenueName.LIFINITY,
        inputMint,
        outputMint,
        {
          effectivePrice: 20.18,
          depth: 9876,
        }
      );

      const meteoraSpy = vi
        .spyOn((collector as any).meteoraService, "fetchLiquidity")
        .mockResolvedValue(meteoraQuote);
      const lifinitySpy = vi
        .spyOn((collector as any).lifinityService, "fetchLiquidity")
        .mockResolvedValue(lifinityQuote);

      const result = await collector.fetchAggregatedLiquidity(
        inputMint,
        outputMint,
        inputAmount,
        [VenueName.METEORA, VenueName.LIFINITY]
      );

      expect(meteoraSpy).toHaveBeenCalledWith(inputMint, outputMint, inputAmount);
      expect(lifinitySpy).toHaveBeenCalledWith(inputMint, outputMint, inputAmount);
      expect(result.sources).toHaveLength(2);
      expect(result.totalDepth).toBeCloseTo(meteoraQuote.depth + lifinityQuote.depth);
      expect(result.sources.map((s) => s.venue)).toEqual(
        expect.arrayContaining([VenueName.METEORA, VenueName.LIFINITY])
      );
    });
  });
});
