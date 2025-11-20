/**
 * API Route Tests - /api/swap
 * Tests for swap route endpoint
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, GET } from "../src/app/api/swap/route";
import { NextRequest } from "next/server";

// ============================================================================
// MOCKS
// ============================================================================

// Mock Solana Connection
vi.mock("@solana/web3.js", async () => {
  const actual = await vi.importActual("@solana/web3.js");
  return {
    ...actual,
    Connection: vi.fn().mockImplementation(() => ({
      getSlot: vi.fn().mockResolvedValue(12345678),
    })),
  };
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createMockRequest(body: any, method = "POST"): NextRequest {
  const url = "http://localhost:3000/api/swap";

  return {
    json: async () => body,
    method,
    url,
    headers: new Headers({ "Content-Type": "application/json" }),
  } as NextRequest;
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe("API Route: /api/swap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // POST ENDPOINT TESTS
  // ==========================================================================

  describe("POST /api/swap", () => {
    it("should return routes with valid input", async () => {
      const mockBody = {
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        inputAmount: 1.5,
        slippageTolerance: 0.01,
        useMEVProtection: true,
        priorityLevel: "medium",
      };

      const request = createMockRequest(mockBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.routes).toBeDefined();
      expect(Array.isArray(data.routes)).toBe(true);
      expect(data.routes.length).toBeGreaterThan(0);
    });

    it("should include route details in response", async () => {
      const mockBody = {
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        inputAmount: 1.5,
      };

      const request = createMockRequest(mockBody);
      const response = await POST(request);
      const data = await response.json();

      const route = data.routes[0];
      expect(route).toHaveProperty("id");
      expect(route).toHaveProperty("venues");
      expect(route).toHaveProperty("expectedOutput");
      expect(route).toHaveProperty("effectiveRate");
      expect(route).toHaveProperty("totalCost");
      expect(route).toHaveProperty("mevRisk");
    });

    it("should return 400 if inputMint is missing", async () => {
      const mockBody = {
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        inputAmount: 1.5,
      };

      const request = createMockRequest(mockBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Missing required fields");
    });

    it("should return 400 if outputMint is missing", async () => {
      const mockBody = {
        inputMint: "So11111111111111111111111111111111111111112",
        inputAmount: 1.5,
      };

      const request = createMockRequest(mockBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Missing required fields");
    });

    it("should return 400 if inputAmount is missing", async () => {
      const mockBody = {
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      };

      const request = createMockRequest(mockBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Missing required fields");
    });

    it("should use default values for optional parameters", async () => {
      const mockBody = {
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        inputAmount: 1.5,
        // No slippageTolerance, useMEVProtection, priorityLevel
      };

      const request = createMockRequest(mockBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.routes).toBeDefined();
    });

    it("should adjust MEV risk based on useMEVProtection flag", async () => {
      const mockBodyWithMEV = {
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        inputAmount: 1.5,
        useMEVProtection: true,
      };

      const requestWithMEV = createMockRequest(mockBodyWithMEV);
      const responseWithMEV = await POST(requestWithMEV);
      const dataWithMEV = await responseWithMEV.json();

      expect(dataWithMEV.routes[0].mevRisk).toBe("low");

      const mockBodyWithoutMEV = {
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        inputAmount: 1.5,
        useMEVProtection: false,
      };

      const requestWithoutMEV = createMockRequest(mockBodyWithoutMEV);
      const responseWithoutMEV = await POST(requestWithoutMEV);
      const dataWithoutMEV = await responseWithoutMEV.json();

      expect(dataWithoutMEV.routes[0].mevRisk).toBe("medium");
    });

    it("should calculate expected output based on input amount", async () => {
      const mockBody = {
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        inputAmount: 10,
      };

      const request = createMockRequest(mockBody);
      const response = await POST(request);
      const data = await response.json();

      const route1 = data.routes[0];
      const expectedOutput1 = parseFloat(route1.expectedOutput);

      // Route 1 should output ~99% of input (0.99 rate)
      expect(expectedOutput1).toBeCloseTo(10 * 0.99, 1);
    });

    it("should return multiple route options", async () => {
      const mockBody = {
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        inputAmount: 1.5,
      };

      const request = createMockRequest(mockBody);
      const response = await POST(request);
      const data = await response.json();

      expect(data.routes.length).toBeGreaterThanOrEqual(2);

      // Verify routes have different venues
      const venues = data.routes.map((r: any) => r.venues[0]);
      const uniqueVenues = new Set(venues);
      expect(uniqueVenues.size).toBeGreaterThan(1);
    });

    it("should handle malformed JSON gracefully", async () => {
      const request = {
        json: async () => {
          throw new Error("Invalid JSON");
        },
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });

  // ==========================================================================
  // GET ENDPOINT TESTS (Health Check)
  // ==========================================================================

  describe("GET /api/swap", () => {
    it("should return health check with status ok", async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("ok");
    });

    it("should include RPC endpoint in response", async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.rpc).toBeDefined();
      expect(typeof data.rpc).toBe("string");
    });

    it("should include current blockchain slot", async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.currentSlot).toBeDefined();
      expect(typeof data.currentSlot).toBe("number");
      expect(data.currentSlot).toBe(12345678); // Mocked value
    });

    it("should include timestamp", async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.timestamp).toBeDefined();
      expect(typeof data.timestamp).toBe("number");
      expect(data.timestamp).toBeGreaterThan(0);
    });

    it("should handle RPC connection errors", async () => {
      // Mock Connection to throw error
      const { Connection } = await import("@solana/web3.js");
      (Connection as any).mockImplementationOnce(() => ({
        getSlot: vi.fn().mockRejectedValue(new Error("Network error")),
      }));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.status).toBe("error");
      expect(data.error).toBe("RPC connection failed");
    });
  });
});
