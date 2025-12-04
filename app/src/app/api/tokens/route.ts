/**
 * API Route: Fetch Jupiter Tokens
 * Proxies requests to Jupiter Token API to avoid CORS issues
 * Endpoint: GET /api/tokens
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 3600; // Cache for 1 hour

import { NextRequest, NextResponse } from "next/server";

interface JupiterToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
}

// Cache tokens in memory for 1 hour
let cachedTokens: JupiterToken[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in ms

/**
 * GET /api/tokens
 * Returns list of verified tokens from Jupiter
 * Query params:
 * - search: Search by symbol or name
 * - address: Get specific token by address
 * - limit: Max number of tokens to return (default: 100)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase();
    const address = searchParams.get("address");
    const limit = parseInt(searchParams.get("limit") || "100");

    // Check cache
    const now = Date.now();
    if (!cachedTokens || now - cacheTimestamp > CACHE_TTL) {
      console.log("🔄 Fetching tokens from Jupiter API...");
      
      const response = await fetch("https://token.jup.ag/strict", {
        headers: {
          Accept: "application/json",
          "User-Agent": "SwapBack/1.0",
        },
        next: { revalidate: 3600 },
      });

      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.status}`);
      }

      cachedTokens = await response.json();
      cacheTimestamp = now;
      console.log(`✅ Cached ${cachedTokens?.length || 0} tokens`);
    }

    let tokens = cachedTokens || [];

    // Filter by address
    if (address) {
      const found = tokens.find((t) => t.address === address);
      if (found) {
        return NextResponse.json({
          success: true,
          tokens: [found],
          total: 1,
        });
      }

      // Try fetching from all tokens if not in strict list
      try {
        const allResponse = await fetch(`https://token.jup.ag/all`, {
          headers: { Accept: "application/json" },
        });
        if (allResponse.ok) {
          const allTokens: JupiterToken[] = await allResponse.json();
          const foundAll = allTokens.find((t) => t.address === address);
          if (foundAll) {
            return NextResponse.json({
              success: true,
              tokens: [{ ...foundAll, verified: false }],
              total: 1,
            });
          }
        }
      } catch {
        // Ignore errors for unverified token lookup
      }

      return NextResponse.json({
        success: true,
        tokens: [],
        total: 0,
      });
    }

    // Filter by search query
    if (search) {
      tokens = tokens.filter(
        (t) =>
          t.symbol.toLowerCase().includes(search) ||
          t.name.toLowerCase().includes(search) ||
          t.address.toLowerCase().includes(search)
      );
    }

    // Apply limit
    tokens = tokens.slice(0, limit);

    return NextResponse.json({
      success: true,
      tokens: tokens.map((t) => ({
        address: t.address,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        logoURI: t.logoURI,
        tags: t.tags || [],
        verified: true,
      })),
      total: tokens.length,
    });
  } catch (error) {
    console.error("❌ Error fetching tokens:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch tokens",
        message: error instanceof Error ? error.message : "Unknown error",
        tokens: [],
      },
      { status: 500 }
    );
  }
}
