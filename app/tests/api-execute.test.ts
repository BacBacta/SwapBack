/**
 * API Route Tests - /api/execute
 * Tests for transaction execution endpoint
 * 
 * @vitest-environment node
 */

import { describe, it, expect, vi } from "vitest";
import { POST } from "../src/app/api/execute/route";
import { NextRequest } from "next/server";

// ============================================================================
// MOCKS
// ============================================================================

// Mock Solana Connection and Transaction classes
vi.mock("@solana/web3.js", async () => {
  const actual = await vi.importActual("@solana/web3.js");
  return {
    ...actual,
    Connection: vi.fn().mockImplementation(() => ({
      sendRawTransaction: vi.fn().mockResolvedValue(
        "5j7s1QkJwKjZdP3xQqF8vXeC9kT2mN4pL6rV8sW9uY1xZ3cB2aD4eF6gH8iJ9kL"
      ),
      getLatestBlockhash: vi.fn().mockResolvedValue({
        blockhash: "GH7ome3EiwEr7tu9JuTh2dpYWBJK3z69Xm1ZE1c9k12345",
        lastValidBlockHeight: 150000000,
      }),
    })),
    Transaction: {
      from: vi.fn().mockReturnValue({
        serialize: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3, 4])),
      }),
    },
    VersionedTransaction: {
      deserialize: vi.fn().mockReturnValue({
        serialize: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3, 4])),
      }),
    },
  };
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createMockRequest(body: any): NextRequest {
  const url = "http://localhost:3000/api/execute";
  
  return {
    json: async () => body,
    method: "POST",
    url,
    headers: new Headers({ "Content-Type": "application/json" }),
  } as NextRequest;
}

// Create a mock signed transaction (base64)
function createMockSignedTransaction(): string {
  // This is a simplified mock - in reality would be a properly serialized transaction
  const mockTxData = Buffer.from("mock_transaction_data");
  return mockTxData.toString("base64");
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe("API Route: /api/execute", () => {
  // ==========================================================================
  // POST ENDPOINT TESTS
  // ==========================================================================

  describe("POST /api/execute", () => {
    it("should return 400 if signedTransaction is missing", async () => {
      const mockBody = {
        useMEVProtection: true,
      };

      const request = createMockRequest(mockBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Missing signedTransaction");
    });

    it("should handle malformed request body", async () => {
      const request = {
        json: async () => {
          throw new Error("Invalid JSON");
        },
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Transaction execution failed");
    });

    it("should execute transaction with valid signed transaction", async () => {
      const mockBody = {
        signedTransaction: createMockSignedTransaction(),
        useMEVProtection: false,
      };

      const request = createMockRequest(mockBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.signature).toBeDefined();
      expect(typeof data.signature).toBe("string");
    });

    it("should return transaction signature in response", async () => {
      const mockBody = {
        signedTransaction: createMockSignedTransaction(),
      };

      const request = createMockRequest(mockBody);
      const response = await POST(request);
      const data = await response.json();

      expect(data.signature).toBe(
        "5j7s1QkJwKjZdP3xQqF8vXeC9kT2mN4pL6rV8sW9uY1xZ3cB2aD4eF6gH8iJ9kL"
      );
    });

    it("should include blockhash in response", async () => {
      const mockBody = {
        signedTransaction: createMockSignedTransaction(),
      };

      const request = createMockRequest(mockBody);
      const response = await POST(request);
      const data = await response.json();

      expect(data.blockhash).toBeDefined();
      expect(data.blockhash).toBe("GH7ome3EiwEr7tu9JuTh2dpYWBJK3z69Xm1ZE1c9k12345");
    });

    it("should include lastValidBlockHeight in response", async () => {
      const mockBody = {
        signedTransaction: createMockSignedTransaction(),
      };

      const request = createMockRequest(mockBody);
      const response = await POST(request);
      const data = await response.json();

      expect(data.lastValidBlockHeight).toBeDefined();
      expect(data.lastValidBlockHeight).toBe(150000000);
    });

    it("should use default useMEVProtection if not provided", async () => {
      const mockBody = {
        signedTransaction: createMockSignedTransaction(),
        // No useMEVProtection specified
      };

      const request = createMockRequest(mockBody);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should support MEV protection flag", async () => {
      const mockBodyWithMEV = {
        signedTransaction: createMockSignedTransaction(),
        useMEVProtection: true,
      };

      const requestWithMEV = createMockRequest(mockBodyWithMEV);
      const responseWithMEV = await POST(requestWithMEV);
      const dataWithMEV = await responseWithMEV.json();

      expect(responseWithMEV.status).toBe(200);
      expect(dataWithMEV.success).toBe(true);
    });
  });
});
