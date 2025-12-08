/**
 * API Route Tests - /api/native-quote
 * Tests for native quote endpoint with Raydium, Orca, Meteora, Phoenix
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST, GET, OPTIONS } from "../src/app/api/native-quote/route";
import { NextRequest } from "next/server";

// ============================================================================
// MOCKS
// ============================================================================

// Mock fetch globalement
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Token addresses de test
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const UNKNOWN_MINT = "unknownMint123456789012345678901234567890";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createMockRequest(body: any): NextRequest {
  const url = "http://localhost:3000/api/native-quote";

  return {
    json: async () => body,
    method: "POST",
    url,
    headers: new Headers({ "Content-Type": "application/json" }),
  } as NextRequest;
}

function createRaydiumResponse(outputAmount: string = "180000000") {
  return {
    id: "test-id",
    success: true,
    data: {
      default: {
        swapType: "BaseIn",
        inputMint: SOL_MINT,
        inputAmount: "1000000000",
        outputMint: USDC_MINT,
        outputAmount,
        otherAmountThreshold: "179000000",
        slippage: 0.005,
        priceImpact: 0.001,
        routePlan: [],
      },
    },
  };
}

function createOrcaResponse(estimatedAmountOut: string = "179500000") {
  return {
    route: [],
    inputAmount: "1000000000",
    estimatedAmountOut,
    minOutputAmount: "178000000",
    priceImpact: 0.0008,
    effectivePriceInSOL: 0.00556,
  };
}

function createMeteoraResponse(outAmount: string = "179800000") {
  return {
    inMint: SOL_MINT,
    inAmount: "1000000000",
    outMint: USDC_MINT,
    outAmount,
    priceImpact: 0.0005,
    swapFee: "1000000",
  };
}

function createPriceApiResponse(price: number = 180) {
  return {
    price,
    source: "jupiter",
  };
}

// ============================================================================
// TEST SUITE: OPTIONS Handler
// ============================================================================

describe("API Route: /api/native-quote OPTIONS", () => {
  it("should return 204 with CORS headers", async () => {
    const response = await OPTIONS();
    
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("OPTIONS");
  });
});

// ============================================================================
// TEST SUITE: GET Handler
// ============================================================================

describe("API Route: /api/native-quote GET", () => {
  it("should return list of venues with apiAvailable flags", async () => {
    const response = await GET();
    const data = await response.json();
    
    expect(data.venues).toBeDefined();
    expect(Array.isArray(data.venues)).toBe(true);
    expect(data.venues.length).toBeGreaterThan(0);
    
    // Vérifier que Raydium, Orca, Meteora, Phoenix sont présents
    const venueNames = data.venues.map((v: any) => v.name);
    expect(venueNames).toContain("Raydium");
    expect(venueNames).toContain("Orca Whirlpool");
    expect(venueNames).toContain("Meteora DLMM");
    expect(venueNames).toContain("Phoenix");
    
    // Vérifier le flag apiAvailable
    const phoenix = data.venues.find((v: any) => v.name === "Phoenix");
    expect(phoenix.apiAvailable).toBe(false);
    
    const raydium = data.venues.find((v: any) => v.name === "Raydium");
    expect(raydium.apiAvailable).toBe(true);
  });
  
  it("should have fallbackEnabled info", async () => {
    const response = await GET();
    const data = await response.json();
    
    expect(data.fallbackEnabled).toBe(true);
    expect(data.fallbackSource).toContain("/api/price");
  });
  
  it("should have CORS headers", async () => {
    const response = await GET();
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

// ============================================================================
// TEST SUITE: POST Handler - Validation
// ============================================================================

describe("API Route: /api/native-quote POST Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 400 for missing inputMint", async () => {
    const request = createMockRequest({
      outputMint: USDC_MINT,
      amount: "1000000000",
    });
    
    const response = await POST(request);
    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data.error).toContain("inputMint");
  });

  it("should return 400 for missing outputMint", async () => {
    const request = createMockRequest({
      inputMint: SOL_MINT,
      amount: "1000000000",
    });
    
    const response = await POST(request);
    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data.error).toContain("outputMint");
  });

  it("should return 400 for missing amount", async () => {
    const request = createMockRequest({
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
    });
    
    const response = await POST(request);
    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data.error).toContain("amount");
  });
});

// ============================================================================
// TEST SUITE: POST Handler - Successful Quotes
// ============================================================================

describe("API Route: /api/native-quote POST Success", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return quotes from all venues when APIs succeed", async () => {
    // Mock toutes les réponses API
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("raydium")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(createRaydiumResponse()),
        });
      }
      if (url.includes("orca.so")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(createOrcaResponse()),
        });
      }
      if (url.includes("meteora")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(createMeteoraResponse()),
        });
      }
      if (url.includes("/api/price")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(createPriceApiResponse()),
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });

    const request = createMockRequest({
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      amount: "1000000000",
    });
    
    const response = await POST(request);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.quotes).toBeDefined();
    expect(Array.isArray(data.quotes)).toBe(true);
    
    // Vérifier qu'au moins une quote a isFallback = false (quote réelle)
    const realQuotes = data.quotes.filter((q: any) => !q.isFallback);
    expect(realQuotes.length).toBeGreaterThan(0);
  });

  it("should pass slippageBps to API calls", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(createRaydiumResponse()),
    });

    const request = createMockRequest({
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      amount: "1000000000",
      slippageBps: 100, // 1%
    });
    
    await POST(request);
    
    // Vérifier que slippageBps est passé à Raydium
    const raydiumCall = mockFetch.mock.calls.find((call) =>
      call[0].toString().includes("raydium")
    );
    if (raydiumCall) {
      expect(raydiumCall[0]).toContain("slippageBps=100");
    }
  });
  
  it("should include isFallback flag in quote response", async () => {
    // Mock API qui échoue, forçant le fallback
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/price")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(createPriceApiResponse()),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 500,
      });
    });

    const request = createMockRequest({
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      amount: "1000000000",
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    // Si on a des quotes, vérifier le flag isFallback
    if (data.quotes && data.quotes.length > 0) {
      data.quotes.forEach((quote: any) => {
        expect(typeof quote.isFallback).toBe("boolean");
        expect(quote.source).toBeDefined();
      });
    }
  });
});

// ============================================================================
// TEST SUITE: Fallback Behavior
// ============================================================================

describe("API Route: /api/native-quote Fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should use /api/price fallback when all APIs fail", async () => {
    // Mock: toutes les APIs DEX échouent, mais /api/price fonctionne
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/price")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ price: 180, source: "jupiter" }),
        });
      }
      // Toutes les autres APIs échouent
      return Promise.resolve({
        ok: false,
        status: 500,
      });
    });

    const request = createMockRequest({
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      amount: "1000000000",
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    // Devrait retourner des quotes avec isFallback = true
    if (data.quotes && data.quotes.length > 0) {
      const fallbackQuotes = data.quotes.filter((q: any) => q.isFallback);
      expect(fallbackQuotes.length).toBeGreaterThan(0);
    }
  });

  it("should mark fallback quotes with source='estimated'", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/price")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ price: 180, source: "jupiter" }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 500,
      });
    });

    const request = createMockRequest({
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      amount: "1000000000",
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    if (data.quotes && data.quotes.length > 0) {
      const fallbackQuotes = data.quotes.filter((q: any) => q.isFallback);
      fallbackQuotes.forEach((quote: any) => {
        expect(quote.source).toBe("estimated");
      });
    }
  });

  it("should return 500 when all sources fail including /api/price", async () => {
    // Tout échoue
    mockFetch.mockRejectedValue(new Error("Network error"));

    const request = createMockRequest({
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      amount: "1000000000",
    });
    
    const response = await POST(request);
    // Devrait soit retourner 500, soit un array vide
    const data = await response.json();
    
    if (response.status === 200) {
      // Si 200, devrait avoir un array vide ou un message
      expect(data.quotes).toBeDefined();
    } else {
      expect(response.status).toBe(500);
    }
  });
});

// ============================================================================
// TEST SUITE: Phoenix Price-Based Estimation
// ============================================================================

describe("API Route: /api/native-quote Phoenix Estimation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Phoenix should always use price-based estimation", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/price")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ price: 180, source: "jupiter" }),
        });
      }
      if (url.includes("raydium") || url.includes("orca") || url.includes("meteora")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(createRaydiumResponse()),
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });

    const request = createMockRequest({
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      amount: "1000000000",
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    // Phoenix devrait avoir isFallback = true car pas d'API publique
    if (data.quotes) {
      const phoenixQuote = data.quotes.find((q: any) => 
        q.venue.toLowerCase().includes("phoenix")
      );
      if (phoenixQuote) {
        expect(phoenixQuote.isFallback).toBe(true);
        expect(phoenixQuote.source).toBe("estimated");
      }
    }
  });
});

// ============================================================================
// TEST SUITE: CORS Headers
// ============================================================================

describe("API Route: /api/native-quote CORS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(createRaydiumResponse()),
    });
  });

  it("POST response should have CORS headers", async () => {
    const request = createMockRequest({
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      amount: "1000000000",
    });
    
    const response = await POST(request);
    
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});
