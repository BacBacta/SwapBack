/**
 * API Route: Fetch Jupiter Tokens
 * Proxies requests to Jupiter Token API to avoid CORS issues
 * Endpoint: GET /api/tokens
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

// CORS Headers for cross-origin requests
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

/**
 * OPTIONS /api/tokens
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

interface JupiterToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
}

interface DexScreenerPair {
  chainId: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  liquidity?: { usd: number };
  info?: { imageUrl?: string };
}

/**
 * Fetch token from DexScreener API
 * This catches tokens not on Jupiter (PumpSwap, new memecoins, etc.)
 */
async function fetchFromDexScreener(address: string): Promise<JupiterToken | null> {
  try {
    console.log(`🔍 [DexScreener] Searching for token: ${address}`);
    const response = await fetch(
      `https://api.dexscreener.com/tokens/v1/solana/${address}`,
      {
        headers: { Accept: "application/json", "User-Agent": "SwapBack/1.0" },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!response.ok) {
      console.log(`❌ [DexScreener] API returned ${response.status}`);
      return null;
    }
    
    const pairs: DexScreenerPair[] = await response.json();
    console.log(`📊 [DexScreener] Found ${pairs?.length || 0} pairs`);
    
    if (!pairs || pairs.length === 0) return null;
    
    // Find the pair where our address is the baseToken OR quoteToken
    const relevantPair = pairs.find(p => 
      p.baseToken?.address?.toLowerCase() === address.toLowerCase() ||
      p.quoteToken?.address?.toLowerCase() === address.toLowerCase()
    );
    
    if (!relevantPair) {
      console.log(`❌ [DexScreener] Token not found in any pair`);
      return null;
    }
    
    // Determine if we're looking at baseToken or quoteToken
    const isBaseToken = relevantPair.baseToken?.address?.toLowerCase() === address.toLowerCase();
    const tokenInfo = isBaseToken ? relevantPair.baseToken : relevantPair.quoteToken;
    
    if (!tokenInfo) return null;
    
    console.log(`✅ [DexScreener] Found: ${tokenInfo.symbol} (${tokenInfo.name})`);
    
    return {
      address: tokenInfo.address,
      symbol: tokenInfo.symbol || "UNKNOWN",
      name: tokenInfo.name || "Unknown Token",
      decimals: 9, // Default, will be updated by on-chain fetch if needed
      logoURI: relevantPair.info?.imageUrl,
      tags: ["dexscreener"],
    };
  } catch (e) {
    console.warn("DexScreener fetch failed:", e);
    return null;
  }
}

/**
 * Fetch token metadata from on-chain (Metaplex/SPL Token)
 * Last resort for tokens not on any API
 */
async function fetchFromOnChain(address: string): Promise<JupiterToken | null> {
  try {
    // Try multiple RPC endpoints
    const heliusApiKey = process.env.HELIUS_API_KEY || process.env.NEXT_PUBLIC_HELIUS_API_KEY;
    const rpcUrls = [
      heliusApiKey ? `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}` : null,
      process.env.SOLANA_RPC_URL,
      process.env.NEXT_PUBLIC_HELIUS_RPC_URL,
      "https://api.mainnet-beta.solana.com",
    ].filter(Boolean) as string[];
    
    console.log(`🔍 [On-chain] Checking mint: ${address} via ${rpcUrls.length} RPCs`);
    
    for (const rpcUrl of rpcUrls) {
      try {
        // Fetch account info to verify it's a valid mint
        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getAccountInfo",
            params: [address, { encoding: "jsonParsed" }],
          }),
          signal: AbortSignal.timeout(5000),
        });
        
        if (!response.ok) continue;
        const data = await response.json();
        
        if (!data.result?.value) continue;
        
        const accountData = data.result.value.data;
        
        // Check if it's an SPL token mint
        if (accountData?.program === "spl-token" && accountData?.parsed?.type === "mint") {
          const mintInfo = accountData.parsed.info;
          console.log(`✅ [On-chain] Found SPL mint with ${mintInfo?.decimals || 9} decimals`);
          
          return {
            address,
            symbol: "???",
            name: `Token ${address.slice(0, 6)}...${address.slice(-4)}`,
            decimals: mintInfo?.decimals ?? 9,
            logoURI: undefined,
            tags: ["on-chain", "unverified"],
          };
        }
        
        // Even if not parsed as spl-token, if account exists it might be valid
        if (data.result?.value?.owner) {
          console.log(`⚠️ [On-chain] Account exists but not recognized as SPL mint, owner: ${data.result.value.owner}`);
          // Token-2022 program
          if (data.result.value.owner === "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb") {
            return {
              address,
              symbol: "???",
              name: `Token-2022 ${address.slice(0, 6)}...`,
              decimals: 9,
              logoURI: undefined,
              tags: ["on-chain", "token-2022", "unverified"],
            };
          }
        }
      } catch (e) {
        console.log(`[On-chain] RPC ${rpcUrl.slice(0, 30)}... failed:`, e);
        continue;
      }
    }
    
    console.log(`❌ [On-chain] Could not verify mint: ${address}`);
    return null;
  } catch (e) {
    console.warn("On-chain fetch failed:", e);
    return null;
  }
}

// Comprehensive token list with categories (real mainnet addresses)
const FALLBACK_TOKENS: JupiterToken[] = [
  // Blue chips
  { address: "So11111111111111111111111111111111111111112", symbol: "SOL", name: "Solana", decimals: 9, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png", tags: ["verified", "blue-chip"] },
  { address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", symbol: "JUP", name: "Jupiter", decimals: 6, logoURI: "https://static.jup.ag/jup/icon.png", tags: ["verified", "blue-chip", "defi"] },
  { address: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL", symbol: "JTO", name: "Jito", decimals: 9, logoURI: "https://metadata.jito.network/token/jto/image", tags: ["verified", "blue-chip", "defi"] },
  { address: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", symbol: "PYTH", name: "Pyth Network", decimals: 6, logoURI: "https://pyth.network/token.svg", tags: ["verified", "blue-chip", "defi"] },
  { address: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE", symbol: "ORCA", name: "Orca", decimals: 6, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png", tags: ["verified", "blue-chip", "defi"] },
  { address: "RasQSonic11111111111111111111111111111111111", symbol: "RAY", name: "Raydium", decimals: 6, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png", tags: ["verified", "blue-chip", "defi"] },
  { address: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", symbol: "RAY", name: "Raydium", decimals: 6, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png", tags: ["verified", "blue-chip", "defi"] },
  
  // Stablecoins
  { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC", name: "USD Coin", decimals: 6, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png", tags: ["verified", "stablecoin"] },
  { address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", symbol: "USDT", name: "Tether USD", decimals: 6, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png", tags: ["verified", "stablecoin"] },
  { address: "USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX", symbol: "USDH", name: "USDH", decimals: 6, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX/usdh.svg", tags: ["verified", "stablecoin"] },
  { address: "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj", symbol: "stSOL", name: "Lido Staked SOL", decimals: 9, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj/logo.png", tags: ["verified", "stablecoin", "lsd"] },
  
  // Liquid Staking
  { address: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", symbol: "mSOL", name: "Marinade Staked SOL", decimals: 9, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png", tags: ["verified", "lsd"] },
  { address: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1", symbol: "bSOL", name: "BlazeStake Staked SOL", decimals: 9, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1/logo.png", tags: ["verified", "lsd"] },
  { address: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", symbol: "jitoSOL", name: "Jito Staked SOL", decimals: 9, logoURI: "https://storage.googleapis.com/token-metadata/JitoSOL-256.png", tags: ["verified", "lsd"] },
  
  // Meme tokens
  { address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", symbol: "BONK", name: "Bonk", decimals: 5, logoURI: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I", tags: ["verified", "meme"] },
  { address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", symbol: "WIF", name: "dogwifhat", decimals: 6, logoURI: "https://bafkreibk3covs5ltyqxa272uodhculbr6kea6betidfwy3ajsav2vjzyum.ipfs.nftstorage.link", tags: ["verified", "meme"] },
  { address: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5", symbol: "MEW", name: "cat in a dogs world", decimals: 5, logoURI: "https://bafkreidlwyr565dxtao2ipsze6bmzpszqzybz7sqi2zaet5fs7k6u5oi4i.ipfs.nftstorage.link/", tags: ["verified", "meme"] },
  { address: "ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82", symbol: "BOME", name: "BOOK OF MEME", decimals: 6, logoURI: "https://bafkreiao5s5lsdzezluxikn3k4ynbmhzlhji5dgotuymwn3ygr2adb2ddy.ipfs.nftstorage.link/", tags: ["verified", "meme"] },
  { address: "A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump", symbol: "FARTCOIN", name: "Fartcoin", decimals: 6, logoURI: "https://ipfs.io/ipfs/QmQr7j7Fnj9Y1N8qT8LHiPtqKEJr7M7hUzQFkdBY6x7o4t", tags: ["verified", "meme"] },
  { address: "Grass7B4RdKfBCjTKgSqnXkqjwiGvQyFbuSCUJr3XXjs", symbol: "GRASS", name: "Grass", decimals: 9, logoURI: "https://sznsyxelqffs7ntnqcax7jq7ka6yegvcqlz5l7jb3uhlz7u4imcq.arweave.net/gf-xLW4sVjvsIJIk_z-5e0d7yO8tsL5_G4b7jl1mKEc", tags: ["verified", "meme"] },
  
  // Cross-chain
  { address: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", symbol: "ETH", name: "Wrapped Ether (Wormhole)", decimals: 8, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs/logo.png", tags: ["verified", "blue-chip"] },
  { address: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", symbol: "WBTC", name: "Wrapped BTC (Wormhole)", decimals: 8, logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh/logo.png", tags: ["verified", "blue-chip"] },
  
  // AI tokens
  { address: "FUAfBo2jgks6gB4Z4LfZkqSZgzNucisEHqnNebaRxM1P", symbol: "AI16Z", name: "ai16z", decimals: 9, logoURI: "https://ipfs.io/ipfs/QmVU6tGb4qhMBiB6CpNrpnQZaGcJ5sFMBv5j9n7k6J7xSy", tags: ["verified", "ai"] },
  { address: "Gu3LDkn7Vx3bmCzLafYNKcDxv2mH7YN44NJZFXnyai16", symbol: "GRIFFAIN", name: "Griffain", decimals: 6, logoURI: "https://arweave.net/6M_FjVUJFj2E3cT0_K-h5M7nwMhKF7NHu9KMgpxVBFk", tags: ["verified", "ai"] },
  { address: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump", symbol: "FWOG", name: "Fwog", decimals: 6, logoURI: "https://ipfs.io/ipfs/QmZqNf2AqoAFbvd7iVz3FpMQpzWBw7VjqHqpKX8yqw8h5h", tags: ["verified", "meme"] },
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
    const limit = parseInt(searchParams.get("limit") || "200");
    const category = searchParams.get("category"); // New: filter by category

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

    // Filter by address (supports partial match for better UX)
    if (address) {
      // First try exact match in verified tokens
      let found: JupiterToken | null = tokens.find((t) => t.address === address) || null;
      let source = "jupiter-verified";
      
      // If not found in strict list, try fetching from Jupiter all tokens
      if (!found) {
        try {
          const allResponse = await fetch(`https://token.jup.ag/all`, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(5000),
          });
          if (allResponse.ok) {
            const allTokens: JupiterToken[] = await allResponse.json();
            found = allTokens.find((t) => t.address === address) || null;
            if (found) source = "jupiter-all";
          }
        } catch {
          // Ignore errors for unverified token lookup
        }
      }
      
      // If still not found, try DexScreener (catches PumpSwap, new memecoins)
      if (!found) {
        console.log(`🔍 Token ${address} not on Jupiter, trying DexScreener...`);
        found = await fetchFromDexScreener(address);
        if (found) source = "dexscreener";
      }
      
      // Try DexScreener search API as fallback (sometimes tokens/v1 misses new tokens)
      if (!found) {
        console.log(`🔍 Token ${address} not in DexScreener tokens, trying search API...`);
        try {
          const searchResponse = await fetch(
            `https://api.dexscreener.com/latest/dex/search?q=${address}`,
            {
              headers: { Accept: "application/json", "User-Agent": "SwapBack/1.0" },
              signal: AbortSignal.timeout(5000),
            }
          );
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const pairs = searchData?.pairs || [];
            // Find pair where address matches base or quote token
            const matchingPair = pairs.find((p: DexScreenerPair) => 
              p.chainId === "solana" && (
                p.baseToken?.address?.toLowerCase() === address.toLowerCase() ||
                p.quoteToken?.address?.toLowerCase() === address.toLowerCase()
              )
            );
            if (matchingPair) {
              const isBase = matchingPair.baseToken?.address?.toLowerCase() === address.toLowerCase();
              const tokenInfo = isBase ? matchingPair.baseToken : matchingPair.quoteToken;
              found = {
                address: tokenInfo.address,
                symbol: tokenInfo.symbol || "???",
                name: tokenInfo.name || "Unknown",
                decimals: 9,
                logoURI: matchingPair.info?.imageUrl,
                tags: ["dexscreener-search"],
              };
              source = "dexscreener-search";
              console.log(`✅ [DexScreener Search] Found: ${tokenInfo.symbol}`);
            }
          }
        } catch (e) {
          console.log(`[DexScreener Search] Failed:`, e);
        }
      }
      
      // Last resort: fetch on-chain metadata
      if (!found) {
        console.log(`🔍 Token ${address} not on DexScreener, trying on-chain...`);
        found = await fetchFromOnChain(address);
        if (found) source = "on-chain";
      }

      if (found) {
        const isVerified = source === "jupiter-verified";
        return NextResponse.json({
          success: true,
          tokens: [{ 
            ...found, 
            verified: isVerified,
            tags: found.tags || (isVerified ? ["verified"] : ["unverified"]),
          }],
          total: 1,
          source,
        }, { headers: CORS_HEADERS });
      }

      return NextResponse.json({
        success: true,
        tokens: [],
        total: 0,
        message: "Token not found on Jupiter, DexScreener, or on-chain. It may be too new or the address is invalid.",
        searchedSources: ["jupiter-verified", "jupiter-all", "dexscreener", "dexscreener-search", "on-chain"],
      }, { headers: CORS_HEADERS });
    }

    // Filter by category
    if (category) {
      tokens = tokens.filter((t) => t.tags?.includes(category));
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
    }, {
      headers: CORS_HEADERS,
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
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
