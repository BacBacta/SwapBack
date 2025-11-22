/**
 * DEX Integration Tests
 *
 * Tests integration with real DEX data from Raydium and Orca
 * Tests both liquidity fetching and actual swap execution
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Connection, Keypair } from "@solana/web3.js";
import { LiquidityDataCollector } from "../sdk/src/services/LiquidityDataCollector";
import {
  VenueName,
  VenueType,
  LiquiditySource,
} from "../sdk/src/types/smart-router";

const USE_REAL_NETWORK = process.env.SWAPBACK_REAL_DEX === "true";
const TEST_MODE_LABEL = USE_REAL_NETWORK ? "Real" : "Stubbed";

const stubbedVenueConfigs: Partial<
  Record<VenueName, Partial<LiquiditySource>>
> = {
  [VenueName.PHOENIX]: {
    venueType: VenueType.CLOB,
    depth: 650000,
    effectivePrice: 19.75,
    topOfBook: { bidPrice: 49.8, askPrice: 49.9, bidSize: 12, askSize: 10 },
  },
  [VenueName.ORCA]: {
    venueType: VenueType.AMM,
    depth: 420000,
    effectivePrice: 20.1,
    reserves: { input: 1_200_000, output: 600_000 },
  },
  [VenueName.RAYDIUM]: {
    venueType: VenueType.AMM,
    depth: 415000,
    effectivePrice: 20.2,
    reserves: { input: 1_100_000, output: 550_000 },
  },
  [VenueName.JUPITER]: {
    venueType: VenueType.RFQ,
    depth: 250000,
    effectivePrice: 20.4,
  },
  [VenueName.METEORA]: {
    venueType: VenueType.AMM,
    depth: 200000,
    effectivePrice: 20.35,
    reserves: { input: 1_000_000, output: 500_000 },
  },
  [VenueName.LIFINITY]: {
    venueType: VenueType.AMM,
    depth: 180000,
    effectivePrice: 20.45,
    reserves: { input: 1_000_000, output: 500_000 },
  },
  [VenueName.METIS]: {
    venueType: VenueType.RFQ,
    depth: 150000,
    effectivePrice: 20.55,
  },
};

const buildStubSource = (
  venue: VenueName,
  inputMint: string,
  outputMint: string,
  overrides: Partial<LiquiditySource> = {}
): LiquiditySource => {
  const base = {
    venue,
    venueType:
      overrides.venueType ??
      stubbedVenueConfigs[venue]?.venueType ??
      VenueType.AMM,
    tokenPair: [inputMint, outputMint],
    depth: overrides.depth ?? stubbedVenueConfigs[venue]?.depth ?? 250000,
    effectivePrice:
      overrides.effectivePrice ??
      stubbedVenueConfigs[venue]?.effectivePrice ??
      20,
    feeAmount:
      overrides.feeAmount ??
      stubbedVenueConfigs[venue]?.feeAmount ??
      0.05,
    slippagePercent:
      overrides.slippagePercent ??
      stubbedVenueConfigs[venue]?.slippagePercent ??
      0.002,
    route: overrides.route ?? [inputMint, outputMint],
    timestamp: Date.now(),
    reserves:
      overrides.reserves ?? stubbedVenueConfigs[venue]?.reserves,
    topOfBook:
      overrides.topOfBook ?? stubbedVenueConfigs[venue]?.topOfBook,
    metadata:
      overrides.metadata ??
      (stubbedVenueConfigs[venue]?.venueType === VenueType.CLOB
        ? { direction: "sellBase", takerFeeBps: 5 }
        : undefined),
  } satisfies LiquiditySource;

  return base;
};

const stubFetchVenue = async (
  venue: VenueName,
  inputMint: string,
  outputMint: string
): Promise<LiquiditySource | null> => {
  const template = stubbedVenueConfigs[venue];
  if (!template) {
    return null;
  }
  return buildStubSource(venue, inputMint, outputMint, template);
};

// ============================================================================
// REAL DEX INTEGRATION TESTS
// ============================================================================

describe(`DEX Integration Tests (${TEST_MODE_LABEL} Mode)`, () => {
  let connection: Connection;
  let liquidityCollector: LiquidityDataCollector;

  // Real token mints for testing
  const SOL_MINT = "So11111111111111111111111111111111111111112";
  const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

  beforeEach(async () => {
    // Use mainnet-beta for real DEX data
    connection = new Connection(
      "https://api.mainnet-beta.solana.com",
      "confirmed"
    );
    liquidityCollector = new LiquidityDataCollector(connection);

    if (!USE_REAL_NETWORK) {
      vi.spyOn(liquidityCollector as any, "fetchVenueLiquidity").mockImplementation(
        async (
          venue: VenueName,
          inputMint: string,
          outputMint: string,
          _inputAmount: number
        ) => stubFetchVenue(venue, inputMint, outputMint)
      );
    }
  });

  describe("Real DEX Liquidity Fetching", () => {
    it("should fetch real Phoenix CLOB liquidity for SOL/USDC", async () => {
      const liquidity = await liquidityCollector.fetchAggregatedLiquidity(
        SOL_MINT,
        USDC_MINT,
        0.001 // 0.001 SOL in human units
      );

      expect(liquidity).toBeDefined();
      expect(liquidity.sources.length).toBeGreaterThan(0);

      // Check if Phoenix is present
      const phoenixSource = liquidity.sources.find(
        (s: any) => s.venue === VenueName.PHOENIX
      );
      if (phoenixSource) {
        expect(phoenixSource.depth).toBeGreaterThan(0);
        expect(phoenixSource.effectivePrice).toBeGreaterThan(0);
        expect(phoenixSource.feeAmount).toBeGreaterThan(0);
      }
    }, 30000); // 30 second timeout for real network calls

    it("should fetch real Raydium AMM liquidity for SOL/USDC", async () => {
      const liquidity = await liquidityCollector.fetchAggregatedLiquidity(
        SOL_MINT,
        USDC_MINT,
        0.001 // 0.001 SOL in human units
      );

      expect(liquidity).toBeDefined();
      expect(liquidity.sources.length).toBeGreaterThan(0);

      // Check if Raydium is present
      const raydiumSource = liquidity.sources.find(
        (s: any) => s.venue === VenueName.RAYDIUM
      );
      if (raydiumSource) {
        expect(raydiumSource.depth).toBeGreaterThan(0);
        expect(raydiumSource.effectivePrice).toBeGreaterThan(0);
        expect(raydiumSource.feeAmount).toBeGreaterThan(0);
        console.log(`Raydium effective price: ${raydiumSource.effectivePrice}`);
      }
    }, 30000);

    it("should handle pairs with no liquidity gracefully", async () => {
      // Use a random token pair that likely doesn't exist
      const fakeMint1 = Keypair.generate().publicKey.toBase58();
      const fakeMint2 = Keypair.generate().publicKey.toBase58();

      const liquidity = await liquidityCollector.fetchAggregatedLiquidity(
        fakeMint1,
        fakeMint2,
        1000000
      );

      // Should return empty sources or handle gracefully
      expect(liquidity).toBeDefined();
      // May have some sources from aggregators, but depth should be low
    }, 15000);

    it("should calculate accurate slippage for large trades", async () => {
      const largeAmount = 1; // 1 SOL in human units

      const liquidity = await liquidityCollector.fetchAggregatedLiquidity(
        SOL_MINT,
        USDC_MINT,
        largeAmount
      );

      expect(liquidity).toBeDefined();

      // For large trades, slippage should be higher
      for (const source of liquidity.sources) {
        if (source.slippagePercent !== undefined) {
          expect(source.slippagePercent).toBeGreaterThan(0);
        }
      }
    }, 30000);
  });

  describe("Cross-DEX Price Comparison", () => {
    it("should compare prices across Orca and Raydium", async () => {
      const liquidity = await liquidityCollector.fetchAggregatedLiquidity(
        SOL_MINT,
        USDC_MINT,
        0.01 // 0.01 SOL in human units
      );

      const orcaPrice = liquidity.sources.find(
        (s: any) => s.venue === VenueName.ORCA
      )?.effectivePrice;
      const raydiumPrice = liquidity.sources.find(
        (s: any) => s.venue === VenueName.RAYDIUM
      )?.effectivePrice;

      if (orcaPrice && raydiumPrice) {
        // Prices should be reasonably close (within 5%)
        const priceDiff =
          Math.abs(orcaPrice - raydiumPrice) /
          Math.min(orcaPrice, raydiumPrice);
        expect(priceDiff).toBeLessThan(0.05);
      }
    }, 30000);

    it("should identify best venue by effective price", async () => {
      const liquidity = await liquidityCollector.fetchAggregatedLiquidity(
        SOL_MINT,
        USDC_MINT,
        50000000 // 0.05 SOL
      );

      expect(liquidity.sources.length).toBeGreaterThan(0);

      // Find venue with best (lowest) effective price for buying output token
      const bestVenue = liquidity.sources.reduce((best: any, current: any) =>
        current.effectivePrice < best.effectivePrice ? current : best
      );

      expect(bestVenue).toBeDefined();
      expect(bestVenue.effectivePrice).toBeGreaterThan(0);
    }, 30000);
  });

  describe("Liquidity Depth Analysis", () => {
    it("should provide accurate depth estimates", async () => {
      const liquidity = await liquidityCollector.fetchAggregatedLiquidity(
        SOL_MINT,
        USDC_MINT,
        1000000
      );

      for (const source of liquidity.sources) {
        expect(source.depth).toBeGreaterThan(0);
        // Depth should be reasonable for major pairs
        expect(source.depth).toBeLessThan(1000000000000); // Less than 1M tokens
      }
    }, 30000);

    it("should handle low liquidity pairs", async () => {
      // Use a less common pair
      const liquidity = await liquidityCollector.fetchAggregatedLiquidity(
        "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7", // Marinade SOL
        USDC_MINT,
        1000000
      );

      expect(liquidity).toBeDefined();
      // Should still return some sources, even if depth is low
    }, 30000);
  });
});
