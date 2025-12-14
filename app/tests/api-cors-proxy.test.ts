/**
 * API Route Tests - /api/cors-proxy
 * Tests for CORS proxy endpoint
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST, OPTIONS } from "../src/app/api/cors-proxy/route";
import { NextRequest } from "next/server";

// ============================================================================
// MOCKS
// ============================================================================

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createMockGetRequest(targetUrl: string): NextRequest {
  const url = `http://localhost:3000/api/cors-proxy?url=${encodeURIComponent(targetUrl)}`;

  return {
    method: "GET",
    url,
    headers: new Headers({}),
  } as unknown as NextRequest;
}

function createMockPostRequest(targetUrl: string, body: any): NextRequest {
  const url = `http://localhost:3000/api/cors-proxy?url=${encodeURIComponent(targetUrl)}`;

  return {
    json: async () => body,
    text: async () => JSON.stringify(body),
    method: "POST",
    url,
    headers: new Headers({ "Content-Type": "application/json" }),
  } as unknown as NextRequest;
}

// ============================================================================
// TEST SUITE: OPTIONS Handler
// ============================================================================

describe("API Route: /api/cors-proxy OPTIONS", () => {
  it("should return 204 with CORS headers", async () => {
    const response = await OPTIONS();
    
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeDefined();
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});

// ============================================================================
// TEST SUITE: GET Handler
// ============================================================================

describe("API Route: /api/cors-proxy GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 400 for missing url parameter", async () => {
    const request = {
      method: "GET",
      url: "http://localhost:3000/api/cors-proxy",
      headers: new Headers({}),
    } as unknown as NextRequest;
    
    const response = await GET(request);
    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data.error).toContain("url");
  });

  it("should return 403 for non-whitelisted domain", async () => {
    const request = createMockGetRequest("https://malicious-site.com/api");
    
    const response = await GET(request);
    expect(response.status).toBe(403);
    
    const data = await response.json();
    expect(data.error).toContain("not allowed");
  });

  it("should proxy request to whitelisted domain (Jupiter)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: () => Promise.resolve({ price: 180 }),
      text: () => Promise.resolve(JSON.stringify({ price: 180 })),
    });

    const request = createMockGetRequest("https://api.jup.ag/price/v2?ids=SOL");
    
    const response = await GET(request);
    expect(response.status).toBe(200);
    
    // Vérifier que fetch a été appelé avec la bonne URL
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.jup.ag/price/v2?ids=SOL",
      expect.any(Object)
    );
  });

  it("should proxy request to Raydium", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify({ data: {} })),
    });

    const request = createMockGetRequest("https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=SOL");
    
    const response = await GET(request);
    expect(response.status).toBe(200);
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("transaction-v1.raydium.io"),
      expect.any(Object)
    );
  });

  it("should proxy request to Orca", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify({ route: [] })),
    });

    const request = createMockGetRequest("https://api.mainnet.orca.so/v1/quote?inputMint=SOL");
    
    const response = await GET(request);
    expect(response.status).toBe(200);
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("orca.so"),
      expect.any(Object)
    );
  });

  it("should proxy request to Meteora", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify({ outAmount: "100" })),
    });

    const request = createMockGetRequest("https://dlmm-api.meteora.ag/pair/quote?inMint=SOL");
    
    const response = await GET(request);
    expect(response.status).toBe(200);
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("meteora.ag"),
      expect.any(Object)
    );
  });

  it("should include CORS headers in response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify({})),
    });

    const request = createMockGetRequest("https://api.jup.ag/price/v2?ids=SOL");
    
    const response = await GET(request);
    
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeDefined();
  });

  it("should handle upstream API errors gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers({ "Content-Type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify({ error: "Server error" })),
    });

    const request = createMockGetRequest("https://api.jup.ag/price/v2?ids=SOL");
    
    const response = await GET(request);
    // Le proxy devrait transférer le status upstream
    expect(response.status).toBe(500);
  });

  it("should handle network errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const request = createMockGetRequest("https://api.jup.ag/price/v2?ids=SOL");
    
    const response = await GET(request);
    // Le proxy retourne 502 Bad Gateway pour les erreurs réseau upstream
    expect(response.status).toBe(502);
    
    const data = await response.json();
    expect(data.error).toBeDefined();
  });
});

// ============================================================================
// TEST SUITE: POST Handler
// ============================================================================

describe("API Route: /api/cors-proxy POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should proxy POST request to whitelisted domain", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify({ success: true })),
    });

    const request = createMockPostRequest(
      "https://api.jup.ag/swap",
      { inputMint: "SOL", outputMint: "USDC" }
    );
    
    const response = await POST(request);
    expect(response.status).toBe(200);
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("api.jup.ag"),
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("should return 403 for non-whitelisted domain", async () => {
    const request = createMockPostRequest(
      "https://evil-site.com/api",
      { data: "hack" }
    );
    
    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it("should forward request body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify({ success: true })),
    });

    const bodyData = { inputMint: "SOL", outputMint: "USDC", amount: "1000" };
    const request = createMockPostRequest(
      "https://transaction-v1.raydium.io/compute/swap-base-in",
      bodyData
    );
    
    await POST(request);
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        body: expect.any(String),
      })
    );
  });
});

// ============================================================================
// TEST SUITE: Domain Whitelist
// ============================================================================

describe("API Route: /api/cors-proxy Domain Whitelist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const allowedDomains = [
    "api.jup.ag",
    "quote-api.jup.ag",
    "transaction-v1.raydium.io",
    "api-v3.raydium.io",
    "api.mainnet.orca.so",
    "dlmm-api.meteora.ag",
    "api.dexscreener.com",
    "public-api.birdeye.so",
  ];

  for (const domain of allowedDomains) {
    it(`should allow requests to ${domain}`, async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "application/json" }),
        text: () => Promise.resolve(JSON.stringify({})),
      });

      const request = createMockGetRequest(`https://${domain}/test`);
      
      const response = await GET(request);
      // Ne devrait pas être 403
      expect(response.status).not.toBe(403);
    });
  }

  const blockedDomains = [
    "evil-site.com",
    "attacker.io",
    "localhost:8080",
    "api.fake-jupiter.com",
  ];

  for (const domain of blockedDomains) {
    it(`should block requests to ${domain}`, async () => {
      const request = createMockGetRequest(`https://${domain}/api`);
      
      const response = await GET(request);
      expect(response.status).toBe(403);
    });
  }
});
