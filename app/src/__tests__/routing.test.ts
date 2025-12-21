/**
 * Tests pour la configuration de routing et le split-route calculator
 *
 * @see https://dev.jup.ag/docs/routing - Reference Jupiter routing
 * @see docs/ai/solana-native-router-a2z.md
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PublicKey } from "@solana/web3.js";
import {
  getRoutingConfig,
  getEnabledVenues,
  getQuotableVenues,
  getVenueConfig,
  isVenueEnabled,
  getVenueFeeBps,
  calculateDynamicSlippage,
  shouldUseSplitRoute,
  DEX_PROGRAM_IDS,
  VENUE_CONFIGS,
  type SupportedVenue,
} from "@/config/routing";

describe("Routing Configuration", () => {
  describe("getRoutingConfig", () => {
    it("should return a valid configuration object", () => {
      const config = getRoutingConfig();

      expect(config).toBeDefined();
      expect(config.venues).toBeInstanceOf(Array);
      expect(config.splitRoute).toBeDefined();
      expect(config.dynamicSlippage).toBeDefined();
      expect(config.jupiterBenchmark).toBeDefined();
      expect(config.multiHop).toBeDefined();
    });

    it("should have split-route enabled by default", () => {
      const config = getRoutingConfig();

      expect(config.splitRoute.enabled).toBe(true);
      expect(config.splitRoute.maxSplits).toBe(4); // Updated for Phase 2 optimization
      expect(config.splitRoute.minSplitPercent).toBe(5); // Finer granularity
    });

    it("should have dynamic slippage enabled by default", () => {
      const config = getRoutingConfig();

      expect(config.dynamicSlippage.enabled).toBe(true);
      expect(config.dynamicSlippage.baseSlippageBps).toBe(100); // Updated for volatile tokens
      expect(config.dynamicSlippage.maxSlippageBps).toBe(500); // 5% max
    });

    it("should have Jupiter benchmark enabled by default", () => {
      const config = getRoutingConfig();

      expect(config.jupiterBenchmark.enabled).toBe(true);
      expect(config.jupiterBenchmark.showComparison).toBe(true);
    });
  });

  describe("Venue Configuration", () => {
    it("should have at least 5 venues configured", () => {
      expect(VENUE_CONFIGS.length).toBeGreaterThanOrEqual(5);
    });

    it("should have ORCA_WHIRLPOOL enabled", () => {
      expect(isVenueEnabled("ORCA_WHIRLPOOL")).toBe(true);
    });

    it("should have METEORA_DLMM enabled", () => {
      expect(isVenueEnabled("METEORA_DLMM")).toBe(true);
    });

    it("should have RAYDIUM_AMM enabled (re-enabled in v2.0)", () => {
      expect(isVenueEnabled("RAYDIUM_AMM")).toBe(true);
    });

    it("should have PHOENIX enabled (re-enabled in v2.0)", () => {
      expect(isVenueEnabled("PHOENIX")).toBe(true);
    });

    it("should have correct program IDs for DEXes", () => {
      expect(DEX_PROGRAM_IDS.ORCA_WHIRLPOOL.toBase58()).toBe(
        "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"
      );
      expect(DEX_PROGRAM_IDS.METEORA_DLMM.toBase58()).toBe(
        "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo"
      );
      expect(DEX_PROGRAM_IDS.RAYDIUM_AMM.toBase58()).toBe(
        "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
      );
      expect(DEX_PROGRAM_IDS.PHOENIX.toBase58()).toBe(
        "PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY"
      );
    });
  });

  describe("getEnabledVenues", () => {
    it("should return only enabled venues", () => {
      const enabled = getEnabledVenues();

      expect(enabled.length).toBeGreaterThan(0);
      enabled.forEach((venue) => {
        expect(venue.enabled).toBe(true);
      });
    });

    it("should include ORCA and METEORA", () => {
      const enabled = getEnabledVenues();
      const venueIds = enabled.map((v) => v.id);

      expect(venueIds).toContain("ORCA_WHIRLPOOL");
      expect(venueIds).toContain("METEORA_DLMM");
    });
  });

  describe("getQuotableVenues", () => {
    it("should return venues with quote API", () => {
      const quotable = getQuotableVenues();

      expect(quotable.length).toBeGreaterThan(0);
      quotable.forEach((venue) => {
        expect(venue.hasQuoteAPI).toBe(true);
        expect(venue.enabled).toBe(true);
      });
    });
  });

  describe("getVenueConfig", () => {
    it("should return correct config for ORCA_WHIRLPOOL", () => {
      const config = getVenueConfig("ORCA_WHIRLPOOL");

      expect(config).toBeDefined();
      expect(config?.id).toBe("ORCA_WHIRLPOOL");
      expect(config?.displayName).toBe("Orca Whirlpool");
      expect(config?.feeBps).toBe(30);
    });

    it("should return undefined for unknown venue", () => {
      const config = getVenueConfig("UNKNOWN" as SupportedVenue);

      expect(config).toBeUndefined();
    });
  });

  describe("getVenueFeeBps", () => {
    it("should return correct fees for each venue", () => {
      expect(getVenueFeeBps("ORCA_WHIRLPOOL")).toBe(30); // 0.3%
      expect(getVenueFeeBps("METEORA_DLMM")).toBe(20); // 0.2%
      expect(getVenueFeeBps("RAYDIUM_AMM")).toBe(25); // 0.25%
      expect(getVenueFeeBps("PHOENIX")).toBe(10); // ~0.1%
      expect(getVenueFeeBps("SABER")).toBe(4); // 0.04%
    });

    it("should return default 30 bps for unknown venue", () => {
      expect(getVenueFeeBps("UNKNOWN" as SupportedVenue)).toBe(30);
    });
  });
});

describe("Dynamic Slippage", () => {
  describe("calculateDynamicSlippage", () => {
    it("should return base slippage for small trades", () => {
      const slippage = calculateDynamicSlippage(1000, 10_000_000, 0);

      // Small trade (0.01% of pool) should be close to base (100 bps)
      expect(slippage).toBe(100);
    });

    it("should increase slippage for large trades", () => {
      // Trade is 10% of pool (1000 bps), exceeds threshold (50 bps)
      const slippage = calculateDynamicSlippage(1_000_000, 10_000_000, 0);

      // Base (100) + (1000 - 50) = 100 + 950 = 1050, capped at 500
      expect(slippage).toBe(500);
    });

    it("should add volatility component", () => {
      const slippageNoVol = calculateDynamicSlippage(1000, 10_000_000, 0);
      const slippageWithVol = calculateDynamicSlippage(1000, 10_000_000, 100);

      // volatilityComponent = Math.floor((100 * 1.5) / 10) = 15
      expect(slippageWithVol).toBe(slippageNoVol + 15);
    });

    it("should cap at maxSlippageBps", () => {
      // Very large trade with high volatility
      const slippage = calculateDynamicSlippage(50_000_000, 10_000_000, 500);

      expect(slippage).toBe(500); // maxSlippageBps (updated to 5%)
    });

    it("should add safety margin when TVL is unknown", () => {
      const slippage = calculateDynamicSlippage(1000, 0, 0);

      // Base (100) + safety margin (50) = 150
      expect(slippage).toBe(150);
    });
  });
});

describe("Split Route Decision", () => {
  describe("shouldUseSplitRoute", () => {
    it("should return false for small trades", () => {
      expect(shouldUseSplitRoute(50)).toBe(false);
      expect(shouldUseSplitRoute(99)).toBe(false);
    });

    it("should return true for trades >= $100", () => {
      expect(shouldUseSplitRoute(100)).toBe(true);
      expect(shouldUseSplitRoute(500)).toBe(true);
      expect(shouldUseSplitRoute(1000)).toBe(true);
    });
  });
});

describe("DEX Program IDs", () => {
  it("should all be valid PublicKeys", () => {
    Object.values(DEX_PROGRAM_IDS).forEach((programId) => {
      expect(programId).toBeInstanceOf(PublicKey);
      expect(programId.toBase58()).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    });
  });
});
