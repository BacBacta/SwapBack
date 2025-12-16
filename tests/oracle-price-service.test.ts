/**
 * OraclePriceService Unit Tests
 *
 * Tests for oracle price verification covering:
 * - Pyth price fetching
 * - Switchboard fallback
 * - Price caching
 * - Staleness validation
 * - Confidence interval checks
 *
 * @module oracle-price-service.test
 */

import { describe, it, expect, beforeEach, vi, SpyInstance } from "vitest";
import { Connection, PublicKey, AccountInfo } from "@solana/web3.js";
import { OraclePriceService } from "../sdk/src/services/OraclePriceService";
import { OraclePriceData } from "../sdk/src/types/smart-router";
import { parsePriceData } from "@pythnetwork/client";

// Mock Pyth SDK
vi.mock("@pythnetwork/client", () => ({
  parsePriceData: vi.fn(),
}));

// Mock Switchboard SDK
vi.mock("@switchboard-xyz/solana.js", () => ({
  AggregatorAccount: vi.fn(),
}));

// ============================================================================
// MOCK DATA
// ============================================================================

const createMockPythAccountData = (
  price: number,
  confidence: number,
  exponent = -8
): Buffer => {
  // Simplified mock - real Pyth data is more complex
  const buffer = Buffer.alloc(256);
  buffer.writeBigInt64LE(BigInt(price * Math.pow(10, -exponent)), 0);
  return buffer;
};

const createMockPythPriceData = (
  price: number,
  confidence: number,
  exponent = -8
) => ({
  price: BigInt(price * Math.pow(10, -exponent)),
  confidence: BigInt(confidence * Math.pow(10, -exponent)),
  exponent,
  lastSlot: BigInt(Math.floor(Date.now() / 1000)),
  publishTime: BigInt(Math.floor(Date.now() / 1000)),
});

const buildOraclePrice = (
  provider: "pyth" | "switchboard",
  price: number,
  confidence = 0.5
): OraclePriceData => {
  const timestamp = Date.now();
  return {
    provider,
    price,
    confidence,
    timestamp,
    publishTime: timestamp,
    exponent: -8,
  };
};

// ============================================================================
// TEST SUITE
// ============================================================================

describe("OraclePriceService", () => {
  let service: OraclePriceService;
  let mockConnection: any;
  let switchboardSpy: SpyInstance;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Create mock connection
    mockConnection = {
      getAccountInfo: vi.fn(),
    };

    // Create service
    service = new OraclePriceService(mockConnection as Connection, 5000);

    // Default to disabling Switchboard fetches unless explicitly tested
    switchboardSpy = vi
      .spyOn(service as unknown as Record<string, any>, "fetchSwitchboardPrice")
      .mockResolvedValue(null);
  });

  // ============================================================================
  // TEST 1: PYTH PRICE FETCHING
  // ============================================================================

  describe("Pyth Price Fetching", () => {
    it("should fetch and parse Pyth price successfully", async () => {
      const mockMint = "So11111111111111111111111111111111111111112"; // SOL
      const mockPrice = 100.0;
      const mockConfidence = 0.5;

      // Mock account info
      const mockAccountInfo: Partial<AccountInfo<Buffer>> = {
        data: createMockPythAccountData(mockPrice, mockConfidence),
        owner: new PublicKey("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH"),
        lamports: 1000000,
        executable: false,
      };

      mockConnection.getAccountInfo.mockResolvedValue(mockAccountInfo);

      // Mock parsePriceData
      (parsePriceData as any).mockReturnValue(
        createMockPythPriceData(mockPrice, mockConfidence)
      );

      // Fetch price
      const result = await service.getTokenPrice(mockMint);

      // Assertions
      expect(result).toBeDefined();
      expect(result.provider).toBe("pyth");
      expect(result.price).toBeCloseTo(mockPrice, 2);
      expect(result.confidence).toBeCloseTo(mockConfidence, 2);
      expect(result.exponent).toBe(-8);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it("should validate price freshness and reject stale prices", async () => {
      const mockMint = "So11111111111111111111111111111111111111112";

      // Mock stale data (very old timestamp)
      const stalePriceData = createMockPythPriceData(100, 0.5);
      stalePriceData.publishTime = BigInt(0); // Ancient timestamp

      const mockAccountInfo: Partial<AccountInfo<Buffer>> = {
        data: createMockPythAccountData(100, 0.5),
        owner: new PublicKey("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH"),
        lamports: 1000000,
        executable: false,
      };

      mockConnection.getAccountInfo.mockResolvedValue(mockAccountInfo);
      (parsePriceData as any).mockReturnValue(stalePriceData);

      // Should throw error (no valid price available)
      await expect(service.getTokenPrice(mockMint)).rejects.toThrow(
        /No oracle price available/
      );
    });

    it("should validate confidence interval and reject high variance", async () => {
      const mockMint = "So11111111111111111111111111111111111111112";
      const mockPrice = 100.0;
      const highConfidence = 10.0; // 10% confidence interval (too high)

      const priceData = createMockPythPriceData(mockPrice, highConfidence);

      const mockAccountInfo: Partial<AccountInfo<Buffer>> = {
        data: createMockPythAccountData(mockPrice, highConfidence),
        owner: new PublicKey("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH"),
        lamports: 1000000,
        executable: false,
      };

      mockConnection.getAccountInfo.mockResolvedValue(mockAccountInfo);
      (parsePriceData as any).mockReturnValue(priceData);

      // Should fallback to Switchboard or throw
      await expect(service.getTokenPrice(mockMint)).rejects.toThrow(
        /No oracle price available/
      );
    });
  });

  // ============================================================================
  // TEST 2: SWITCHBOARD FALLBACK
  // ============================================================================

  describe("Switchboard Fallback", () => {
    it("should throw when Pyth fails (Switchboard disabled)", async () => {
      const mockMint = "So11111111111111111111111111111111111111112";

      switchboardSpy.mockRestore();

      // Mock Pyth failure (no account)
      mockConnection.getAccountInfo.mockResolvedValueOnce(null);

      // Mock Switchboard success with properly sized buffer
      const switchboardBuffer = Buffer.alloc(280);
      switchboardBuffer.writeDoubleLE(100.0, 240); // price at offset 240
      switchboardBuffer.writeDoubleLE(0.5, 256); // stdDeviation at offset 256
      switchboardBuffer.writeBigInt64LE(
        BigInt(Math.floor(Date.now() / 1000)),
        272
      ); // timestamp at offset 272

      const mockSwitchboardData: Partial<AccountInfo<Buffer>> = {
        data: switchboardBuffer,
        owner: new PublicKey("SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f"),
        lamports: 1000000,
        executable: false,
      };
      mockConnection.getAccountInfo.mockResolvedValueOnce(mockSwitchboardData);

      // Switchboard v2 is deprecated/disabled in config; expect no oracle price.
      await expect(service.getTokenPrice(mockMint)).rejects.toThrow(
        /No oracle price available/
      );
    });

    it("should throw error when both Pyth and Switchboard fail", async () => {
      const mockMint = "So11111111111111111111111111111111111111112";

      // Mock both failing
      mockConnection.getAccountInfo.mockResolvedValue(null);

      await expect(service.getTokenPrice(mockMint)).rejects.toThrow(
        /No oracle price available/
      );
    });
  });

  // ============================================================================
  // TEST 3: PRICE CACHING
  // ============================================================================

  describe("Price Caching", () => {
    it("should cache price and return from cache on subsequent calls", async () => {
      const mockMint = "So11111111111111111111111111111111111111112";
      const mockPrice = 100.0;

      const pythSpy = vi
        .spyOn(service as unknown as Record<string, any>, "fetchPythPrice")
        .mockResolvedValue(buildOraclePrice("pyth", mockPrice, 0.5));

      // First call fetches from oracle
      const result1 = await service.getTokenPrice(mockMint);
      expect(pythSpy).toHaveBeenCalledTimes(1);

      // Second call should hit cache and avoid oracle fetch
      const result2 = await service.getTokenPrice(mockMint);
      expect(pythSpy).toHaveBeenCalledTimes(1);

      expect(result1.price).toBe(result2.price);
      expect(result1.timestamp).toBe(result2.timestamp);
    });

    it("should refresh cache after expiry", async () => {
      const mockMint = "So11111111111111111111111111111111111111112";
      const mockPrice = 100.0;

      const shortCacheService = new OraclePriceService(mockConnection, 100);
      const shortSwitchboardSpy = vi
        .spyOn(shortCacheService as unknown as Record<string, any>, "fetchSwitchboardPrice")
        .mockResolvedValue(null);

      const pythSpy = vi
        .spyOn(shortCacheService as unknown as Record<string, any>, "fetchPythPrice")
        .mockResolvedValue(buildOraclePrice("pyth", mockPrice, 0.5));

      await shortCacheService.getTokenPrice(mockMint);
      expect(pythSpy).toHaveBeenCalledTimes(1);

      await new Promise((resolve) => setTimeout(resolve, 150));

      await shortCacheService.getTokenPrice(mockMint);
      expect(pythSpy).toHaveBeenCalledTimes(2);

      shortSwitchboardSpy.mockRestore();
    });

    it("should maintain separate cache entries for different tokens", async () => {
      const mockMint1 = "So11111111111111111111111111111111111111112"; // SOL
      const mockMint2 = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC

      const pythSpy = vi
        .spyOn(service as unknown as Record<string, any>, "fetchPythPrice")
        .mockImplementation(async (mint: string) => {
          if (mint === mockMint1) {
            return buildOraclePrice("pyth", 100, 0.5);
          }
          if (mint === mockMint2) {
            return buildOraclePrice("pyth", 1, 0.001);
          }
          return null;
        });

      await service.getTokenPrice(mockMint1);
      await service.getTokenPrice(mockMint2);
      expect(pythSpy).toHaveBeenCalledTimes(2);

      await service.getTokenPrice(mockMint1);
      await service.getTokenPrice(mockMint2);
      expect(pythSpy).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // TEST 4: ROUTE PRICE VERIFICATION
  // ============================================================================

  describe("Route Price Verification", () => {
    it("should accept route when price is within deviation threshold", async () => {
      const mockMint1 = "So11111111111111111111111111111111111111112"; // SOL
      const mockMint2 = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC

      vi.spyOn(service as unknown as Record<string, any>, "fetchPythPrice")
        .mockImplementation(async (mint: string) => {
          if (mint === mockMint1) {
            return buildOraclePrice("pyth", 100, 0.5);
          }
          if (mint === mockMint2) {
            return buildOraclePrice("pyth", 1, 0.001);
          }
          return null;
        });

      const mockRoute: any = {
        expectedOutput: 99.5, // $100 worth of SOL → 99.5 USDC (within 2% deviation)
      };

      const result = await service.verifyRoutePrice(
        mockRoute,
        mockMint1,
        mockMint2,
        1.0, // 1 SOL
        0.02 // 2% max deviation
      );

      expect(result.isAcceptable).toBe(true);
      expect(result.deviation).toBeLessThan(0.02);
    });

    it("should reject route when price deviates too much", async () => {
      const mockMint1 = "So11111111111111111111111111111111111111112";
      const mockMint2 = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

      vi.spyOn(service as unknown as Record<string, any>, "fetchPythPrice")
        .mockImplementation(async (mint: string) => {
          if (mint === mockMint1) {
            return buildOraclePrice("pyth", 100, 0.5);
          }
          if (mint === mockMint2) {
            return buildOraclePrice("pyth", 1, 0.001);
          }
          return null;
        });

      const mockRoute: any = {
        expectedOutput: 90.0, // 10% worse than oracle (suspicious)
      };

      const result = await service.verifyRoutePrice(
        mockRoute,
        mockMint1,
        mockMint2,
        1.0,
        0.02 // 2% max deviation
      );

      expect(result.isAcceptable).toBe(false);
      expect(result.warning).toBeDefined();
      expect(result.deviation).toBeGreaterThan(0.02);
    });

    it("should attach oracle metadata for both sides", async () => {
      const mockMint1 = "So11111111111111111111111111111111111111112";
      const mockMint2 = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

      vi.spyOn(service as unknown as Record<string, any>, "fetchPythPrice")
        .mockImplementation(async (mint: string) => {
          if (mint === mockMint1) {
            return buildOraclePrice("pyth", 100, 0.1);
          }
          if (mint === mockMint2) {
            return buildOraclePrice("pyth", 1, 0.002);
          }
          return null;
        });

      switchboardSpy.mockImplementation(async (mint: string) => {
        if (mint === mockMint1) {
          return buildOraclePrice("switchboard", 101, 0.8);
        }
        if (mint === mockMint2) {
          return buildOraclePrice("switchboard", 0.99, 0.003);
        }
        return null;
      });

      const mockRoute: any = {
        expectedOutput: 100,
      };

      const result = await service.verifyRoutePrice(
        mockRoute,
        mockMint1,
        mockMint2,
        1.0,
        0.02
      );

      expect(result.metadata?.input?.providerUsed).toBe("pyth");
      expect(result.metadata?.input?.fallbackUsed).toBe(false);
      expect(result.metadata?.output?.sources?.switchboard?.price).toBeCloseTo(
        0.99,
        2
      );
    });
  });

  // ============================================================================
  // TEST 5: ERROR HANDLING
  // ============================================================================

  describe("Error Handling", () => {
    it("should handle network errors gracefully", async () => {
      const mockMint = "So11111111111111111111111111111111111111112";

      mockConnection.getAccountInfo.mockRejectedValue(
        new Error("Network timeout")
      );

      await expect(service.getTokenPrice(mockMint)).rejects.toThrow(
        /No oracle price available/
      );
    });

    it("should handle corrupted price data", async () => {
      const mockMint = "So11111111111111111111111111111111111111112";

      // Mock Pyth with corrupted data
      const mockAccountInfo: Partial<AccountInfo<Buffer>> = {
        data: Buffer.alloc(10), // Too small
        owner: new PublicKey("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH"),
        lamports: 1000000,
        executable: false,
      };

      mockConnection.getAccountInfo.mockResolvedValueOnce(mockAccountInfo);
      (parsePriceData as any).mockReturnValue(null); // Parse failure

      // Mock Switchboard also corrupted (buffer too small)
      const corruptedSwitchboardData: Partial<AccountInfo<Buffer>> = {
        data: Buffer.alloc(10), // Too small for Switchboard layout
        owner: new PublicKey("SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f"),
        lamports: 1000000,
        executable: false,
      };
      mockConnection.getAccountInfo.mockResolvedValueOnce(
        corruptedSwitchboardData
      );

      await expect(service.getTokenPrice(mockMint)).rejects.toThrow(
        /No oracle price available/
      );
    });

    it("should provide default verification when oracles unavailable", async () => {
      const mockMint1 = "So11111111111111111111111111111111111111112";
      const mockMint2 = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

      // Mock oracle failure
      mockConnection.getAccountInfo.mockResolvedValue(null);

      const mockRoute: any = {
        expectedOutput: 100,
      };

      const result = await service.verifyRoutePrice(
        mockRoute,
        mockMint1,
        mockMint2,
        1.0
      );

      // Should default to accepting with warning
      expect(result.isAcceptable).toBe(true);
      expect(result.warning).toContain("unavailable");
    });
  });
});
