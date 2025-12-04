/**
 * API Route: Fetch Jupiter Tokens
 * Proxies requests to Jupiter Token API to avoid CORS issues
 * Endpoint: GET /api/tokens
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

interface JupiterToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
}

// Popular tokens fallback (real mainnet addresses)
const FALLBACK_TOKENS: JupiterToken[] = [
  { address: "So11111111111111111111111111111111111111112", symbol: "SOL", name: "Solana", decimals: 9, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png", tags: ["verified"] },
  { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC", name: "USD Coin", decimals: 6, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png", tags: ["verified", "stablecoin"] },
  { address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", symbol: "USDT", name: "Tether USD", decimals: 6, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png", tags: ["verified", "stablecoin"] },
  { address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", symbol: "JUP", name: "Jupiter", decimals: 6, logoURI: "https://static.jup.ag/jup/icon.png", tags: ["verified"] },
  { address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", symbol: "BONK", name: "Bonk", decimals: 5, logoURI: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I", tags: ["verified"] },
  { address: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", symbol: "ETH", name: "Wrapped Ether (Wormhole)", decimals: 8, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs/logo.png", tags: ["verified"] },
  { address: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", symbol: "mSOL", name: "Marinade Staked SOL", decimals: 9, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png", tags: ["verified"] },
  { address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", symbol: "WIF", name: "dogwifhat", decimals: 6, logoURI: "https://bafkreibk3covs5ltyqxa272uodhculbr6kea6betidfwy3ajsav2vjzyum.ipfs.nftstorage.link", tags: ["verified"] },
  { address: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", symbol: "PYTH", name: "Pyth Network", decimals: 6, logoURI: "https://pyth.network/token.svg", tags: ["verified"] },
  { address: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL", symbol: "JTO", name: "Jito", decimals: 9, logoURI: "https://metadata.jito.network/token/jto/image", tags: ["verified"] },
];

// Cache tokens in memory
let cachedTokens: JupiterToken[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in ms

/**
 * GET /api/tokens
 * Returns list of verified tokens from Jupiter
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
      
      try {
        // Try tokens.jup.ag first (newer API)
        const response = await fetch("https://tokens.jup.ag/tokens?tags=verified", {
          headers: {
            Accept: "application/json",
            "User-Agent": "SwapBack/1.0",
          },
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });

        if (response.ok) {
          cachedTokens = await response.json();
          cacheTimestamp = now;
          console.log(`✅ Cached ${cachedTokens?.length || 0} tokens from tokens.jup.ag`);
        } else {
          throw new Error(`API returned ${response.status}`);
        }
      } catch (fetchError) {
        console.warn("⚠️ Failed to fetch from Jupiter, using fallback tokens:", fetchError);
        cachedTokens = FALLBACK_TOKENS;
        cacheTimestamp = now;
      }
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
