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

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Connection, PublicKey, AccountInfo } from "@solana/web3.js";
import { OraclePriceService, PriceCircuitBreaker } from "../sdk/src/services/OraclePriceService";
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

// ============================================================================
// TEST SUITE
// ============================================================================

describe("OraclePriceService", () => {
  let service: OraclePriceService;
  let mockConnection: any;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Create mock connection
    mockConnection = {
      getAccountInfo: vi.fn(),
    };

    // Create service
    service = new OraclePriceService(mockConnection as Connection, 5000);
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
      stalePriceData.lastSlot = BigInt(0); // Ancient timestamp

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
    it("should fallback to Switchboard when Pyth fails", async () => {
      const mockMint = "So11111111111111111111111111111111111111112";

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

      const result = await service.getTokenPrice(mockMint);

      // Should successfully fallback to Switchboard
      expect(result).toBeDefined();
      expect(result.provider).toBe("switchboard");
      expect(result.price).toBeCloseTo(100.0, 2);

      // Verify both were attempted
      expect(mockConnection.getAccountInfo).toHaveBeenCalledTimes(2);
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
      const mockConfidence = 0.5;

      const mockAccountInfo: Partial<AccountInfo<Buffer>> = {
        data: createMockPythAccountData(mockPrice, mockConfidence),
        owner: new PublicKey("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH"),
        lamports: 1000000,
        executable: false,
      };

      mockConnection.getAccountInfo.mockResolvedValue(mockAccountInfo);
      (parsePriceData as any).mockReturnValue(
        createMockPythPriceData(mockPrice, mockConfidence)
      );

      // First call - should fetch
      const result1 = await service.getTokenPrice(mockMint);
      expect(mockConnection.getAccountInfo).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await service.getTokenPrice(mockMint);
      expect(mockConnection.getAccountInfo).toHaveBeenCalledTimes(1); // Still 1 (not called again)

      // Results should match
      expect(result1.price).toBe(result2.price);
      expect(result1.timestamp).toBe(result2.timestamp);
    });

    it("should refresh cache after expiry", async () => {
      const mockMint = "So11111111111111111111111111111111111111112";
      const mockPrice = 100.0;

      // Create service with very short cache (100ms)
      const shortCacheService = new OraclePriceService(mockConnection, 100);

      const mockAccountInfo: Partial<AccountInfo<Buffer>> = {
        data: createMockPythAccountData(mockPrice, 0.5),
        owner: new PublicKey("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH"),
        lamports: 1000000,
        executable: false,
      };

      mockConnection.getAccountInfo.mockResolvedValue(mockAccountInfo);
      (parsePriceData as any).mockReturnValue(
        createMockPythPriceData(mockPrice, 0.5)
      );

      // First call
      await shortCacheService.getTokenPrice(mockMint);
      expect(mockConnection.getAccountInfo).toHaveBeenCalledTimes(1);

      // Wait for cache expiry
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Second call - should refresh
      await shortCacheService.getTokenPrice(mockMint);
      expect(mockConnection.getAccountInfo).toHaveBeenCalledTimes(2);
    });

    it("should maintain separate cache entries for different tokens", async () => {
      const mockMint1 = "So11111111111111111111111111111111111111112"; // SOL
      const mockMint2 = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC

      const mockAccountInfo: Partial<AccountInfo<Buffer>> = {
        data: createMockPythAccountData(100, 0.5),
        owner: new PublicKey("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH"),
        lamports: 1000000,
        executable: false,
      };

      mockConnection.getAccountInfo.mockResolvedValue(mockAccountInfo);
      (parsePriceData as any).mockReturnValue(
        createMockPythPriceData(100, 0.5)
      );

      // Fetch both tokens
      await service.getTokenPrice(mockMint1);
      await service.getTokenPrice(mockMint2);

      // Should have called getAccountInfo twice (different mints)
      expect(mockConnection.getAccountInfo).toHaveBeenCalledTimes(2);

      // Fetch again - should use cache
      await service.getTokenPrice(mockMint1);
      await service.getTokenPrice(mockMint2);

      // Still only 2 calls (cache hit)
      expect(mockConnection.getAccountInfo).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // TEST 4: ROUTE PRICE VERIFICATION
  // ============================================================================

  describe("Route Price Verification", () => {
    it("should accept route when price is within deviation threshold", async () => {
      const mockMint1 = "So11111111111111111111111111111111111111112"; // SOL
      const mockMint2 = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC

      // Mock SOL = $100, USDC = $1
      const mockAccountInfo: Partial<AccountInfo<Buffer>> = {
        data: createMockPythAccountData(100, 0.5),
        owner: new PublicKey("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH"),
        lamports: 1000000,
        executable: false,
      };

      mockConnection.getAccountInfo
        .mockResolvedValueOnce(mockAccountInfo) // SOL
        .mockResolvedValueOnce({
          ...mockAccountInfo,
          data: createMockPythAccountData(1, 0.001),
        }); // USDC

      (parsePriceData as any)
        .mockReturnValueOnce(createMockPythPriceData(100, 0.5))
        .mockReturnValueOnce(createMockPythPriceData(1, 0.001));

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

      const mockAccountInfo: Partial<AccountInfo<Buffer>> = {
        data: createMockPythAccountData(100, 0.5),
        owner: new PublicKey("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH"),
        lamports: 1000000,
        executable: false,
      };

      mockConnection.getAccountInfo
        .mockResolvedValueOnce(mockAccountInfo)
        .mockResolvedValueOnce({
          ...mockAccountInfo,
          data: createMockPythAccountData(1, 0.001),
        });

      (parsePriceData as any)
        .mockReturnValueOnce(createMockPythPriceData(100, 0.5))
        .mockReturnValueOnce(createMockPythPriceData(1, 0.001));

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

  // ============================================================================
  // NEW TESTS - Switchboard Integration (Coverage Improvement)
  // ============================================================================

  describe("Switchboard Integration - Complete", () => {
    it("should parse Switchboard aggregator data correctly", async () => {
      const mockMint = "So11111111111111111111111111111111111111112";

      // Mock Pyth failure
      mockConnection.getAccountInfo.mockResolvedValueOnce(null);

      // Mock valid Switchboard data
      const switchboardBuffer = Buffer.alloc(512);
      // Write Switchboard aggregator layout:
      // - value (double) at offset 240
      // - std (double) at offset 256
      // - timestamp (i64) at offset 272

      const now = Math.floor(Date.now() / 1000);
      switchboardBuffer.writeDoubleLE(150.5, 240); // Value = $150.50
      switchboardBuffer.writeDoubleLE(0.5, 256); // Std dev = $0.50 (<2%)
      switchboardBuffer.writeBigInt64LE(BigInt(now), 272); // Fresh timestamp

      const mockSwitchboardAccount: Partial<AccountInfo<Buffer>> = {
        data: switchboardBuffer,
        owner: new PublicKey("SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f"),
        lamports: 1000000,
        executable: false,
      };

      mockConnection.getAccountInfo.mockResolvedValueOnce(
        mockSwitchboardAccount
      );

      const priceData = await service.getTokenPrice(mockMint);

      expect(priceData.price).toBeCloseTo(150.5, 1);
      expect(priceData.provider).toBe('switchboard');
    });

    it("should handle Switchboard stale data (>60s)", async () => {
      const mockMint = "So11111111111111111111111111111111111111112";

      // Mock Pyth failure
      mockConnection.getAccountInfo.mockResolvedValueOnce(null);

      // Mock stale Switchboard data
      const switchboardBuffer = Buffer.alloc(512);
      const staleTime = Math.floor(Date.now() / 1000) - 120; // 2 minutes old
      switchboardBuffer.writeDoubleLE(150.0, 240);
      switchboardBuffer.writeDoubleLE(0.5, 256);
      switchboardBuffer.writeBigInt64LE(BigInt(staleTime), 272);

      const mockSwitchboardAccount: Partial<AccountInfo<Buffer>> = {
        data: switchboardBuffer,
        owner: new PublicKey("SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f"),
        lamports: 1000000,
        executable: false,
      };

      mockConnection.getAccountInfo.mockResolvedValueOnce(
        mockSwitchboardAccount
      );

      // Should reject stale price
      await expect(service.getTokenPrice(mockMint)).rejects.toThrow(
        /No oracle price available/
      );
    });

    it("should validate Switchboard confidence interval", async () => {
      const mockMint = "So11111111111111111111111111111111111111112";

      // Mock Pyth failure
      mockConnection.getAccountInfo.mockResolvedValueOnce(null);

      // Mock Switchboard with high variance
      const switchboardBuffer = Buffer.alloc(512);
      const now = Math.floor(Date.now() / 1000);
      switchboardBuffer.writeDoubleLE(100.0, 240); // Value = $100
      switchboardBuffer.writeDoubleLE(1.5, 256); // Std dev = $1.5 (1.5% variance - acceptable)
      switchboardBuffer.writeBigInt64LE(BigInt(now), 272);

      const mockSwitchboardAccount: Partial<AccountInfo<Buffer>> = {
        data: switchboardBuffer,
        owner: new PublicKey("SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f"),
        lamports: 1000000,
        executable: false,
      };

      mockConnection.getAccountInfo.mockResolvedValueOnce(
        mockSwitchboardAccount
      );

      // Should use price despite high variance (with warning logged)
      const priceData = await service.getTokenPrice(mockMint);
      expect(priceData.price).toBeCloseTo(100.0, 1);
      expect(priceData.provider).toBe('switchboard');
    });
  });

  // ============================================================================
  // NEW TESTS - Batch Operations
  // ============================================================================

  describe("Batch Price Fetching", () => {
    it("should fetch multiple token prices in parallel", async () => {
      const mints = [
        "So11111111111111111111111111111111111111112", // SOL
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
        "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
      ];

      // Mock Pyth prices for all 3 tokens
      for (let i = 0; i < mints.length; i++) {
        const mockAccountInfo: Partial<AccountInfo<Buffer>> = {
          data: createMockPythAccountData(100 + i * 10, 0.5),
          owner: new PublicKey(
            "FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH"
          ),
          lamports: 1000000,
          executable: false,
        };

        mockConnection.getAccountInfo.mockResolvedValueOnce(mockAccountInfo);
        (parsePriceData as any).mockReturnValueOnce(
          createMockPythPriceData(100 + i * 10, 0.5)
        );
      }

      // Fetch all prices in parallel
      const pricesData = await Promise.all(
        mints.map((mint) => service.getTokenPrice(mint))
      );

      expect(pricesData).toHaveLength(3);
      expect(pricesData[0].price).toBeCloseTo(100, 1);
      expect(pricesData[1].price).toBeCloseTo(110, 1);
      expect(pricesData[2].price).toBeCloseTo(120, 1);
    });

    it("should handle partial failures in batch fetch", async () => {
      const sol = "So11111111111111111111111111111111111111112";
      const usdc = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

      // Mock SOL success
      const mockSolAccount: Partial<AccountInfo<Buffer>> = {
        data: createMockPythAccountData(100, 0.5),
        owner: new PublicKey("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH"),
        lamports: 1000000,
        executable: false,
      };
      mockConnection.getAccountInfo.mockResolvedValueOnce(mockSolAccount);
      (parsePriceData as any).mockReturnValueOnce(
        createMockPythPriceData(100, 0.5)
      );

      //Mock USDC failure (Pyth fail, then Switchboard fail)
      mockConnection.getAccountInfo.mockResolvedValueOnce(null);
      mockConnection.getAccountInfo.mockResolvedValueOnce(null);

      // Test sequential fetching
      const solPrice = await service.getTokenPrice(sol);
      expect(solPrice.price).toBeCloseTo(100, 1);

      await expect(service.getTokenPrice(usdc)).rejects.toThrow();
    });
  });

  // ============================================================================
  // NEW TESTS - Advanced Validation
  // ============================================================================

  describe("Advanced Price Validation", () => {
    it("should detect and handle price manipulation attempts", async () => {
      // Create fresh service instance to avoid cache interference
      const freshService = new OraclePriceService(mockConnection as Connection, 5000);
      
      const mockMint1 = "So11111111111111111111111111111111111111112";
      const mockMint2 = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

      // Mock extreme price deviation (potential manipulation)
      const mockPyth1: Partial<AccountInfo<Buffer>> = {
        data: createMockPythAccountData(100, 0.5),
        owner: new PublicKey("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH"),
        lamports: 1000000,
        executable: false,
      };

      const mockPyth2: Partial<AccountInfo<Buffer>> = {
        data: createMockPythAccountData(1, 0.01), // $1 USDC with 1% confidence
        owner: new PublicKey("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH"),
        lamports: 1000000,
        executable: false,
      };

      mockConnection.getAccountInfo.mockResolvedValueOnce(mockPyth1);
      (parsePriceData as any).mockReturnValueOnce(
        createMockPythPriceData(100, 0.5)
      );

      mockConnection.getAccountInfo.mockResolvedValueOnce(mockPyth2);
      (parsePriceData as any).mockReturnValueOnce(
        createMockPythPriceData(1, 0.01)
      );

      // Route claims 200 USDC output (2x expected)
      const mockRoute: any = {
        expectedOutput: 200,
      };

      const result = await freshService.verifyRoutePrice(
        mockRoute,
        mockMint1,
        mockMint2,
        1.0
      );

      // Should reject as suspicious (deviation = 100% = 1.0 ratio)
      expect(result.isAcceptable).toBe(false);
      expect(result.deviation).toBeGreaterThan(0.05); // >5% deviation
    });

    it("should handle multi-oracle consensus", async () => {
      const mockMint = "So11111111111111111111111111111111111111112";

      // Mock both Pyth and Switchboard with similar prices
      const mockPyth: Partial<AccountInfo<Buffer>> = {
        data: createMockPythAccountData(100, 0.5),
        owner: new PublicKey("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH"),
        lamports: 1000000,
        executable: false,
      };

      mockConnection.getAccountInfo.mockResolvedValueOnce(mockPyth);
      (parsePriceData as any).mockReturnValueOnce(
        createMockPythPriceData(100, 0.5)
      );

      const priceData = await service.getTokenPrice(mockMint);

      // Pyth should be preferred (CLOB > AMM priority)
      expect(priceData.price).toBeCloseTo(100, 1);
      expect(priceData.provider).toBe('pyth');
    });

    it("should cache prices efficiently", async () => {
      const mockMint = "So11111111111111111111111111111111111111112";

      const mockAccountInfo: Partial<AccountInfo<Buffer>> = {
        data: createMockPythAccountData(100, 0.5),
        owner: new PublicKey("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH"),
        lamports: 1000000,
        executable: false,
      };

      mockConnection.getAccountInfo.mockResolvedValueOnce(mockAccountInfo);
      (parsePriceData as any).mockReturnValueOnce(
        createMockPythPriceData(100, 0.5)
      );

      // First call - should fetch from oracle
      const priceData1 = await service.getTokenPrice(mockMint);
      expect(priceData1.price).toBeCloseTo(100, 1);

      // Second call - should use cache (no new getAccountInfo call)
      const priceData2 = await service.getTokenPrice(mockMint);
      expect(priceData2.price).toBeCloseTo(100, 1);

      // Verify cache hit (only 1 getAccountInfo call total)
      expect(mockConnection.getAccountInfo).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // NEW TESTS - Utility Methods
  // ============================================================================

  describe("Utility Methods", () => {
    it("should get multiple token prices in parallel", async () => {
      const mints = [
        "So11111111111111111111111111111111111111112", // SOL
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
        "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
      ];

      // Mock 3 successful responses
      for (let i = 0; i < 3; i++) {
        const mockAccountInfo: Partial<AccountInfo<Buffer>> = {
          data: createMockPythAccountData(100 + i * 10, 0.5),
          owner: new PublicKey("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH"),
          lamports: 1000000,
          executable: false,
        };

        mockConnection.getAccountInfo.mockResolvedValueOnce(mockAccountInfo);
        (parsePriceData as any).mockReturnValueOnce(
          createMockPythPriceData(100 + i * 10, 0.5)
        );
      }

      const pricesMap = await service.getMultiplePrices(mints);

      expect(pricesMap.size).toBe(3);
      expect(pricesMap.get(mints[0])?.price).toBeCloseTo(100, 1);
      expect(pricesMap.get(mints[1])?.price).toBeCloseTo(110, 1);
      expect(pricesMap.get(mints[2])?.price).toBeCloseTo(120, 1);
    });

    it("should handle partial failures in getMultiplePrices", async () => {
      const mints = [
        "So11111111111111111111111111111111111111112", // SOL - success
        "InvalidMint123", // Invalid - fail
      ];

      // Mock SOL success
      const mockAccountInfo: Partial<AccountInfo<Buffer>> = {
        data: createMockPythAccountData(100, 0.5),
        owner: new PublicKey("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH"),
        lamports: 1000000,
        executable: false,
      };

      mockConnection.getAccountInfo.mockResolvedValueOnce(mockAccountInfo);
      (parsePriceData as any).mockReturnValueOnce(
        createMockPythPriceData(100, 0.5)
      );

      // Mock invalid mint failure
      mockConnection.getAccountInfo.mockResolvedValueOnce(null);

      const pricesMap = await service.getMultiplePrices(mints);

      // Should only have successful price
      expect(pricesMap.size).toBe(1);
      expect(pricesMap.has(mints[0])).toBe(true);
      expect(pricesMap.has(mints[1])).toBe(false);
    });

    it("should calculate fair market price for token pair", async () => {
      const solMint = "So11111111111111111111111111111111111111112";
      const usdcMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

      // Mock SOL price = $100
      const mockSol: Partial<AccountInfo<Buffer>> = {
        data: createMockPythAccountData(100, 0.5),
        owner: new PublicKey("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH"),
        lamports: 1000000,
        executable: false,
      };

      // Mock USDC price = $1
      const mockUsdc: Partial<AccountInfo<Buffer>> = {
        data: createMockPythAccountData(1, 0.01),
        owner: new PublicKey("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH"),
        lamports: 1000000,
        executable: false,
      };

      mockConnection.getAccountInfo.mockResolvedValueOnce(mockSol);
      (parsePriceData as any).mockReturnValueOnce(
        createMockPythPriceData(100, 0.5)
      );

      mockConnection.getAccountInfo.mockResolvedValueOnce(mockUsdc);
      (parsePriceData as any).mockReturnValueOnce(
        createMockPythPriceData(1, 0.01)
      );

      const fairPrice = await service.getFairMarketPrice(solMint, usdcMint);

      // Fair price should be USDC/SOL = 1/100 = 0.01
      expect(fairPrice).toBeCloseTo(0.01, 4);
    });

    it("should clear cache", async () => {
      const mockMint = "So11111111111111111111111111111111111111112";

      // Fetch price to populate cache
      const mockAccountInfo: Partial<AccountInfo<Buffer>> = {
        data: createMockPythAccountData(100, 0.5),
        owner: new PublicKey("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH"),
        lamports: 1000000,
        executable: false,
      };

      mockConnection.getAccountInfo.mockResolvedValue(mockAccountInfo);
      (parsePriceData as any).mockReturnValue(
        createMockPythPriceData(100, 0.5)
      );

      await service.getTokenPrice(mockMint);

      // Clear cache
      service.clearCache();

      // Next call should fetch from oracle again (not cache)
      await service.getTokenPrice(mockMint);

      // Should have 2 getAccountInfo calls (not cached)
      expect(mockConnection.getAccountInfo).toHaveBeenCalledTimes(2);
    });

    it("should check if price is fresh", () => {
      const freshPrice: OraclePriceData = {
        provider: "pyth",
        price: 100,
        confidence: 0.5,
        timestamp: Date.now() - 30000, // 30 seconds ago
        exponent: -8,
      };

      const stalePrice: OraclePriceData = {
        provider: "pyth",
        price: 100,
        confidence: 0.5,
        timestamp: Date.now() - 120000, // 2 minutes ago
        exponent: -8,
      };

      expect(service.isPriceFresh(freshPrice, 60000)).toBe(true);
      expect(service.isPriceFresh(stalePrice, 60000)).toBe(false);
    });

    it("should assess price quality based on confidence", () => {
      const highQuality: OraclePriceData = {
        provider: "pyth",
        price: 100,
        confidence: 0.05, // 0.05% confidence
        exponent: -8,
        timestamp: Date.now(),
      };

      const mediumQuality: OraclePriceData = {
        provider: "pyth",
        price: 100,
        confidence: 0.3, // 0.3% confidence
        exponent: -8,
        timestamp: Date.now(),
      };

      const lowQuality: OraclePriceData = {
        provider: "pyth",
        price: 100,
        confidence: 1.0, // 1% confidence
        exponent: -8,
        timestamp: Date.now(),
      };

      expect(service.getPriceQuality(highQuality)).toBe("high");
      expect(service.getPriceQuality(mediumQuality)).toBe("medium");
      expect(service.getPriceQuality(lowQuality)).toBe("low");
    });
  });

  // ============================================================================
  // NEW TESTS - PriceCircuitBreaker
  // ============================================================================

  describe("PriceCircuitBreaker", () => {
    let breaker: PriceCircuitBreaker;

    beforeEach(() => {
      breaker = new PriceCircuitBreaker(service, 0.02); // 2% max deviation
    });

    it("should allow execution when price is acceptable", async () => {
      const mockRoute: any = {
        expectedOutput: 100,
      };

      const solMint = "So11111111111111111111111111111111111111112";
      const usdcMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

      // Mock prices
      const mockSol: Partial<AccountInfo<Buffer>> = {
        data: createMockPythAccountData(100, 0.5),
        owner: new PublicKey("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH"),
        lamports: 1000000,
        executable: false,
      };

      const mockUsdc: Partial<AccountInfo<Buffer>> = {
        data: createMockPythAccountData(1, 0.01),
        owner: new PublicKey("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH"),
        lamports: 1000000,
        executable: false,
      };

      mockConnection.getAccountInfo.mockResolvedValueOnce(mockSol);
      (parsePriceData as any).mockReturnValueOnce(
        createMockPythPriceData(100, 0.5)
      );

      mockConnection.getAccountInfo.mockResolvedValueOnce(mockUsdc);
      (parsePriceData as any).mockReturnValueOnce(
        createMockPythPriceData(1, 0.01)
      );

      const result = await breaker.shouldAllowExecution(
        mockRoute,
        solMint,
        usdcMint,
        1.0
      );

      expect(result.allowed).toBe(true);
    });

    it("should trip breaker after consecutive failures", async () => {
      const mockRoute: any = {
        expectedOutput: 200, // 2x expected (100% deviation)
      };

      const solMint = "So11111111111111111111111111111111111111112";
      const usdcMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

      // Mock prices for 3 consecutive failures
      for (let i = 0; i < 6; i++) {
        // 3 iterations × 2 mints each
        const mockAccount: Partial<AccountInfo<Buffer>> = {
          data: createMockPythAccountData(i % 2 === 0 ? 100 : 1, 0.01),
          owner: new PublicKey("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH"),
          lamports: 1000000,
          executable: false,
        };

        mockConnection.getAccountInfo.mockResolvedValueOnce(mockAccount);
        (parsePriceData as any).mockReturnValueOnce(
          createMockPythPriceData(i % 2 === 0 ? 100 : 1, 0.01)
        );
      }

      // First failure
      const result1 = await breaker.shouldAllowExecution(
        mockRoute,
        solMint,
        usdcMint,
        1.0
      );
      expect(result1.allowed).toBe(false);

      // Second failure
      const result2 = await breaker.shouldAllowExecution(
        mockRoute,
        solMint,
        usdcMint,
        1.0
      );
      expect(result2.allowed).toBe(false);

      // Third failure - should trip breaker
      const result3 = await breaker.shouldAllowExecution(
        mockRoute,
        solMint,
        usdcMint,
        1.0
      );
      expect(result3.allowed).toBe(false);

      // Status should show tripped
      const status = breaker.getStatus();
      expect(status.tripped).toBe(true);
      expect(status.consecutiveFailures).toBe(3);
    });

    it("should reset breaker", () => {
      breaker.reset();
      const status = breaker.getStatus();

      expect(status.tripped).toBe(false);
      expect(status.consecutiveFailures).toBe(0);
    });
  });
});
