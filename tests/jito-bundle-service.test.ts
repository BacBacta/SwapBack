/**
 * Unit Tests for JitoBundleService & MEVProtectionAnalyzer
 * Tests bundle submission, retry logic, tip calculation, MEV risk analysis
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Connection, Transaction, PublicKey } from "@solana/web3.js";
import {
  JitoBundleService,
  MEVProtectionAnalyzer,
} from "../sdk/src/services/JitoBundleService";
import {
  RouteCandidate,
  VenueName,
  VenueType,
  RouteSplit,
  LiquiditySource,
} from "../sdk/src/types/smart-router";

// ============================================================================
// MOCKS
// ============================================================================

// Mock fetch globally
global.fetch = vi.fn();

// ============================================================================
// MOCK DATA
// ============================================================================

const createMockTransaction = (): Transaction => {
  const tx = new Transaction();
  tx.add = vi.fn().mockReturnThis();
  tx.serialize = vi.fn().mockReturnValue(Buffer.from("mock-serialized-tx"));
  return tx;
};

const createMockLiquiditySource = (
  venue: VenueName,
  type: VenueType,
  slippagePercent = 0.005
): LiquiditySource => ({
  venue,
  venueType: type,
  tokenPair: ["SOL", "USDC"],
  depth: 100000,
  effectivePrice: 100,
  feeAmount: 0.003,
  slippagePercent,
  route: ["SOL", "USDC"],
  timestamp: Date.now(),
});

const createMockRouteCandidate = (
  venues: VenueName[],
  inputAmount: number,
  slippagePercent = 0.005
): RouteCandidate => {
  const splits: RouteSplit[] = venues.map((venue) => ({
    venue,
     weight: 100 / venues.length,
    inputAmount: inputAmount / venues.length,
    expectedOutput: (inputAmount / venues.length) * 100,
    liquiditySource: createMockLiquiditySource(
      venue,
      VenueType.AMM,
      slippagePercent
    ),
  }));

  return {
    id: `test-route-${Date.now()}`,
    venues,
    path: ["SOL", "USDC"],
    hops: 1,
    splits,
    expectedOutput: inputAmount * 100,
    totalCost: 0.01,
    effectiveRate: 100,
    riskScore: 0,
    mevRisk: "low",
    instructions: [],
    estimatedComputeUnits: 100000,
  };
};

// ============================================================================
// TEST SUITE - JitoBundleService
// ============================================================================

describe("JitoBundleService", () => {
  let service: JitoBundleService;
  let mockConnection: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConnection = {
      getLatestBlockhash: vi.fn().mockResolvedValue({
        blockhash: "mock-blockhash",
        lastValidBlockHeight: 123456,
      }),
    };

    service = new JitoBundleService(
      mockConnection as Connection,
      "https://test-jito-url.com/api/v1/bundles",
      10000
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // TEST 1: BUNDLE SUBMISSION
  // ============================================================================

  describe("Bundle Submission", () => {
    it("should submit bundle successfully", async () => {
      const mockTx = createMockTransaction();
      const transactions = [mockTx];

      // Mock successful Jito response
      (global.fetch as any).mockResolvedValue({
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: "bundle-id-12345",
        }),
      });

      const result = await service.submitBundle(transactions, {
        enabled: true,
        tipLamports: 10000,
      });

      expect(result).toBeDefined();
      expect(result.bundleId).toBe("bundle-id-12345");
      expect(result.status).toBe("pending");
      expect(result.signatures).toBeDefined();

      // Verify fetch was called with correct params
      expect(global.fetch).toHaveBeenCalledWith(
        "https://test-jito-url.com/api/v1/bundles",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    it("should add tip instruction to first transaction", async () => {
      const mockTx = createMockTransaction();
      const transactions = [mockTx];

      (global.fetch as any).mockResolvedValue({
        json: async () => ({ result: "bundle-id" }),
      });

      await service.submitBundle(transactions, {
        enabled: true,
        tipLamports: 20000,
      });

      // Verify tx.add was called (tip instruction added)
      expect(mockTx.add).toHaveBeenCalledWith(
        expect.objectContaining({
          keys: expect.any(Array),
          programId: expect.any(PublicKey),
          data: expect.any(Buffer),
        })
      );
    });

    it("should serialize transactions correctly", async () => {
      const mockTx1 = createMockTransaction();
      const mockTx2 = createMockTransaction();
      const transactions = [mockTx1, mockTx2];

      (global.fetch as any).mockResolvedValue({
        json: async () => ({ result: "bundle-id" }),
      });

      await service.submitBundle(transactions);

      // Verify both transactions were serialized
      expect(mockTx1.serialize).toHaveBeenCalled();
      expect(mockTx2.serialize).toHaveBeenCalled();
    });

    it("should throw error when bundling is disabled", async () => {
      const mockTx = createMockTransaction();
      const transactions = [mockTx];

      await expect(
        service.submitBundle(transactions, { enabled: false })
      ).rejects.toThrow("Jito bundling is disabled");
    });

    it("should handle Jito API errors", async () => {
      const mockTx = createMockTransaction();
      const transactions = [mockTx];

      (global.fetch as any).mockResolvedValue({
        json: async () => ({
          error: {
            code: -32000,
            message: "Bundle simulation failed",
          },
        }),
      });

      await expect(service.submitBundle(transactions)).rejects.toThrow(
        "Jito bundle submission failed"
      );
    });

    it("should handle network errors", async () => {
      const mockTx = createMockTransaction();
      const transactions = [mockTx];

      (global.fetch as any).mockRejectedValue(new Error("Network timeout"));

      await expect(service.submitBundle(transactions)).rejects.toThrow(
        "Network timeout"
      );
    });
  });

  // ============================================================================
  // TEST 2: BUNDLE STATUS
  // ============================================================================

  describe("Bundle Status Checking", () => {
    it('should return "landed" for confirmed bundle', async () => {
      (global.fetch as any).mockResolvedValue({
        json: async () => ({
          result: {
            value: [{ confirmation_status: "confirmed" }],
          },
        }),
      });

      const status = await service.getBundleStatus("test-bundle-id");
      expect(status).toBe("landed");
    });

    it('should return "landed" for finalized bundle', async () => {
      (global.fetch as any).mockResolvedValue({
        json: async () => ({
          result: {
            value: [{ confirmation_status: "finalized" }],
          },
        }),
      });

      const status = await service.getBundleStatus("test-bundle-id");
      expect(status).toBe("landed");
    });

    it('should return "pending" for unconfirmed bundle', async () => {
      (global.fetch as any).mockResolvedValue({
        json: async () => ({
          result: {
            value: [{ confirmation_status: "pending" }],
          },
        }),
      });

      const status = await service.getBundleStatus("test-bundle-id");
      expect(status).toBe("pending");
    });

    it('should return "failed" on API error', async () => {
      (global.fetch as any).mockResolvedValue({
        json: async () => ({
          error: { message: "Bundle not found" },
        }),
      });

      const status = await service.getBundleStatus("invalid-bundle-id");
      expect(status).toBe("failed");
    });

    it('should return "failed" on network error', async () => {
      (global.fetch as any).mockRejectedValue(new Error("Network error"));

      const status = await service.getBundleStatus("test-bundle-id");
      expect(status).toBe("failed");
    });
  });

  // ============================================================================
  // TEST 3: BUNDLE WAITING
  // ============================================================================

  describe("Bundle Waiting", () => {
    it("should wait for bundle to land successfully", async () => {
      // First call: pending, second call: landed
      let callCount = 0;
      (global.fetch as any).mockImplementation(async () => {
        callCount++;
        return {
          json: async () => ({
            result: {
              value: [
                {
                  confirmation_status:
                    callCount === 1 ? "pending" : "confirmed",
                },
              ],
            },
          }),
        };
      });

      const result = await service.waitForBundle("test-bundle-id", 5000);

      expect(result.bundleId).toBe("test-bundle-id");
      expect(result.status).toBe("landed");
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should throw error when bundle fails", async () => {
      (global.fetch as any).mockResolvedValue({
        json: async () => ({
          error: { message: "Bundle rejected" },
        }),
      });

      await expect(
        service.waitForBundle("test-bundle-id", 2000)
      ).rejects.toThrow("Bundle failed to land");
    });

    it("should throw error on timeout", async () => {
      // Always return pending
      (global.fetch as any).mockResolvedValue({
        json: async () => ({
          result: {
            value: [{ confirmation_status: "pending" }],
          },
        }),
      });

      await expect(
        service.waitForBundle("test-bundle-id", 1000)
      ).rejects.toThrow("Bundle timeout");
    }, 10000); // Increase test timeout to 10s
  });

  // ============================================================================
  // TEST 4: TIP CALCULATION
  // ============================================================================

  describe("Tip Calculation", () => {
    it("should calculate low priority tip", async () => {
      const tip = await service.calculateOptimalTip("low");
      expect(tip).toBe(5000);
    });

    it("should calculate medium priority tip", async () => {
      const tip = await service.calculateOptimalTip("medium");
      expect(tip).toBe(10000);
    });

    it("should calculate high priority tip", async () => {
      const tip = await service.calculateOptimalTip("high");
      expect(tip).toBe(50000);
    });

    it("should default to medium priority", async () => {
      const tip = await service.calculateOptimalTip();
      expect(tip).toBe(10000);
    });
  });
});

// ============================================================================
// TEST SUITE - MEVProtectionAnalyzer
// ============================================================================

describe("MEVProtectionAnalyzer", () => {
  let analyzer: MEVProtectionAnalyzer;

  beforeEach(() => {
    analyzer = new MEVProtectionAnalyzer();
  });

  // ============================================================================
  // TEST 5: MEV RISK ASSESSMENT
  // ============================================================================

  describe("MEV Risk Assessment", () => {
    it("should assess low risk for small CLOB trade", () => {
      const route = createMockRouteCandidate([VenueName.PHOENIX], 100, 0.001);
      route.splits[0].liquiditySource.venueType = VenueType.CLOB;

      const assessment = analyzer.assessMEVRisk(route);

      expect(assessment.riskLevel).toBe("low");
      expect(assessment.vulnerabilities.length).toBe(0);
      expect(assessment.recommendations).toContain(
        "Standard transaction submission is acceptable"
      );
    });

    it("should assess high risk for large AMM trade", () => {
      const route = createMockRouteCandidate([VenueName.ORCA], 15000, 0.015);
      route.splits[0].liquiditySource.venueType = VenueType.AMM;

      const assessment = analyzer.assessMEVRisk(route);

      expect(assessment.riskLevel).toBe("high");
      expect(assessment.vulnerabilities.length).toBeGreaterThan(0);
      expect(assessment.vulnerabilities).toContain(
        "Large trade size makes it attractive to MEV bots"
      );
      expect(assessment.vulnerabilities).toContain(
        "AMM swaps are predictable and sandwich-able"
      );
      expect(assessment.recommendations).toContain(
        "Strongly recommend Jito bundling + TWAP strategy"
      );
    });

    it("should detect AMM-only vulnerability", () => {
      const route = createMockRouteCandidate([VenueName.ORCA], 1000, 0.005);
      route.splits[0].liquiditySource.venueType = VenueType.AMM;

      const assessment = analyzer.assessMEVRisk(route);

      expect(assessment.vulnerabilities).toContain(
        "AMM swaps are predictable and sandwich-able"
      );
      expect(assessment.recommendations).toContain(
        "Use Jito bundling for atomic execution"
      );
    });

    it("should detect high slippage vulnerability", () => {
      const route = createMockRouteCandidate([VenueName.RAYDIUM], 5000, 0.02); // 2% slippage

      const assessment = analyzer.assessMEVRisk(route);

      expect(assessment.vulnerabilities).toContain(
        "High slippage tolerance leaves room for sandwich attacks"
      );
      expect(assessment.recommendations).toContain(
        "Tighten slippage tolerance or use smaller trade size"
      );
    });

    it("should detect multi-venue complexity", () => {
      const route = createMockRouteCandidate(
        [VenueName.ORCA, VenueName.RAYDIUM],
        5000
      );

      const assessment = analyzer.assessMEVRisk(route);

      expect(assessment.vulnerabilities).toContain(
        "Multi-venue execution increases attack surface"
      );
      expect(assessment.recommendations).toContain(
        "Ensure all instructions are in same bundle"
      );
    });

    it("should assess medium risk for moderate conditions", () => {
      // Create a route with moderate risk factors
      const route = createMockRouteCandidate([VenueName.ORCA], 8000, 0.012);
      route.splits[0].liquiditySource.venueType = VenueType.AMM;

      const assessment = analyzer.assessMEVRisk(route);

      // Should be medium due to: AMM-only (25) + high slippage (20) = 45
      expect(assessment.riskLevel).toBe("medium");
      expect(assessment.recommendations).toContain(
        "Consider Jito bundling for MEV protection"
      );
    });
  });

  // ============================================================================
  // TEST 6: TIP RECOMMENDATION
  // ============================================================================

  describe("Tip Recommendation", () => {
    it("should calculate tip based on trade value", () => {
      const tradeValueUSD = 10000; // $10k trade
      const tip = analyzer.calculateRecommendedTip(tradeValueUSD);

      // 0.01% of $10k = $1 = 0.01 SOL (at $100/SOL) = 10000000 lamports
      expect(tip).toBeGreaterThan(0);
      expect(tip).toBeLessThan(100000000); // Less than 1 SOL
    });

    it("should have minimum tip floor", () => {
      const smallTradeValueUSD = 10; // $10 trade
      const tip = analyzer.calculateRecommendedTip(smallTradeValueUSD);

      // Should have a minimum tip (>= 5000 lamports)
      expect(tip).toBeGreaterThanOrEqual(5000);
    });

    it("should scale tip with trade value and respect min/max bounds", () => {
      const tinyTip = analyzer.calculateRecommendedTip(1); // $1 trade
      const smallTip = analyzer.calculateRecommendedTip(100); // $100 trade
      const largeTip = analyzer.calculateRecommendedTip(1000000); // $1M trade

      // All tips should be within bounds
      expect(tinyTip).toBeGreaterThanOrEqual(5000); // >= min
      expect(tinyTip).toBeLessThanOrEqual(100000); // <= max
      expect(smallTip).toBeGreaterThanOrEqual(5000);
      expect(smallTip).toBeLessThanOrEqual(100000);
      expect(largeTip).toBeGreaterThanOrEqual(5000);
      expect(largeTip).toBeLessThanOrEqual(100000);

      // Large tip should hit the max (100000 lamports)
      expect(largeTip).toBe(100000);

      // Tiny tip should be at minimum (5000 lamports)
      expect(tinyTip).toBe(5000);
    });
  });
});
