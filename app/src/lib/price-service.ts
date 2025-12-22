/**
 * Real-Time Price Service for SwapBack
 * 
 * Centralizes all price fetching with fallback chain:
 * 1. Jupiter Price API v2 (primary)
 * 2. Birdeye API (with API key)
 * 3. DexScreener API (free, no key)
 * 4. Pyth/Chainlink oracles (for specific pairs)
 * 
 * @author SwapBack Team
 * @date December 8, 2025
 */

// Cache for prices (15 second TTL)
interface PriceCache {
  price: number;
  timestamp: number;
  source: string;
}

const priceCache = new Map<string, PriceCache>();
const CACHE_TTL_MS = 5_000; // 5 seconds - réduit pour prix plus frais

// Well-known token addresses
const KNOWN_TOKENS: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  BACK: '862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux',
};

// Stablecoins (always $1)
const STABLECOINS = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  'USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX',  // USDH
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // Devnet USDC
]);

/**
 * Fetch real-time price for a token mint
 * Uses a fallback chain of price sources
 */
export async function getTokenPrice(mint: string): Promise<{ price: number; source: string }> {
  // Check stablecoins first
  if (STABLECOINS.has(mint)) {
    return { price: 1.0, source: 'stablecoin' };
  }

  // Check cache
  const cached = priceCache.get(mint);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { price: cached.price, source: `cached:${cached.source}` };
  }

  // Try Jupiter Price API v2 (primary source)
  try {
    const jupiterPrice = await fetchJupiterPrice(mint);
    if (jupiterPrice > 0) {
      cachePrice(mint, jupiterPrice, 'jupiter');
      return { price: jupiterPrice, source: 'jupiter' };
    }
  } catch (error) {
    console.warn('Jupiter price fetch failed:', error);
  }

  // Try Birdeye API (if API key is available)
  const birdeyeApiKey = process.env.BIRDEYE_API_KEY || process.env.NEXT_PUBLIC_BIRDEYE_API_KEY;
  if (birdeyeApiKey) {
    try {
      const birdeyePrice = await fetchBirdeyePrice(mint, birdeyeApiKey);
      if (birdeyePrice > 0) {
        cachePrice(mint, birdeyePrice, 'birdeye');
        return { price: birdeyePrice, source: 'birdeye' };
      }
    } catch (error) {
      console.warn('Birdeye price fetch failed:', error);
    }
  }

  // Try DexScreener API (free, no key needed)
  try {
    const dexScreenerPrice = await fetchDexScreenerPrice(mint);
    if (dexScreenerPrice > 0) {
      cachePrice(mint, dexScreenerPrice, 'dexscreener');
      return { price: dexScreenerPrice, source: 'dexscreener' };
    }
  } catch (error) {
    console.warn('DexScreener price fetch failed:', error);
  }

  // Return cached value if fresh enough (extend TTL for fallback)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS * 4) {
    return { price: cached.price, source: `stale-cached:${cached.source}` };
  }

  // No price available
  return { price: 0, source: 'none' };
}

/**
 * Fetch price from Jupiter Price API v2
 */
async function fetchJupiterPrice(mint: string): Promise<number> {
  const response = await fetch(
    `https://api.jup.ag/price/v2?ids=${mint}`,
    {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    }
  );

  if (!response.ok) {
    throw new Error(`Jupiter API error: ${response.status}`);
  }

  const data = await response.json();
  const price = data?.data?.[mint]?.price;
  
  return typeof price === 'string' ? parseFloat(price) : (price || 0);
}

/**
 * Fetch price from Birdeye API
 */
async function fetchBirdeyePrice(mint: string, apiKey: string): Promise<number> {
  const response = await fetch(
    `https://public-api.birdeye.so/defi/price?address=${mint}`,
    {
      headers: {
        'Accept': 'application/json',
        'X-API-KEY': apiKey,
      },
      signal: AbortSignal.timeout(5000),
    }
  );

  if (!response.ok) {
    throw new Error(`Birdeye API error: ${response.status}`);
  }

  const data = await response.json();
  return data?.data?.value || 0;
}

/**
 * Fetch price from DexScreener API
 */
async function fetchDexScreenerPrice(mint: string): Promise<number> {
  const response = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
    {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    }
  );

  if (!response.ok) {
    throw new Error(`DexScreener API error: ${response.status}`);
  }

  const data = await response.json();
  const pairs = data?.pairs;
  
  if (!pairs || pairs.length === 0) {
    return 0;
  }

  // Get price from the most liquid pair
  const sortedPairs = pairs.sort((a: any, b: any) => 
    (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
  );
  
  return parseFloat(sortedPairs[0]?.priceUsd) || 0;
}

/**
 * Cache a price
 */
function cachePrice(mint: string, price: number, source: string): void {
  priceCache.set(mint, {
    price,
    timestamp: Date.now(),
    source,
  });
}

/**
 * Get SOL price in USD (convenience function)
 */
export async function getSolPrice(): Promise<number> {
  const result = await getTokenPrice(KNOWN_TOKENS.SOL);
  return result.price;
}

/**
 * Get multiple token prices at once (batched)
 */
export async function getTokenPrices(mints: string[]): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  
  // Filter out stablecoins and cached values
  const uncached: string[] = [];
  
  for (const mint of mints) {
    if (STABLECOINS.has(mint)) {
      results.set(mint, 1.0);
      continue;
    }
    
    const cached = priceCache.get(mint);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      results.set(mint, cached.price);
      continue;
    }
    
    uncached.push(mint);
  }
  
  // Batch fetch from Jupiter
  if (uncached.length > 0) {
    try {
      const response = await fetch(
        `https://api.jup.ag/price/v2?ids=${uncached.join(',')}`,
        {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (response.ok) {
        const data = await response.json();
        for (const mint of uncached) {
          const price = data?.data?.[mint]?.price;
          const numPrice = typeof price === 'string' ? parseFloat(price) : (price || 0);
          if (numPrice > 0) {
            cachePrice(mint, numPrice, 'jupiter-batch');
            results.set(mint, numPrice);
          }
        }
      }
    } catch (error) {
      console.warn('Batch price fetch failed:', error);
    }
  }
  
  // Fetch remaining prices individually
  for (const mint of mints) {
    if (!results.has(mint)) {
      const result = await getTokenPrice(mint);
      results.set(mint, result.price);
    }
  }
  
  return results;
}

/**
 * Calculate USD value for a token amount
 */
export async function calculateUsdValue(
  mint: string, 
  amount: number, 
  decimals: number = 9
): Promise<number> {
  const { price } = await getTokenPrice(mint);
  const tokenAmount = amount / Math.pow(10, decimals);
  return tokenAmount * price;
}

/**
 * Clear the price cache (useful for testing)
 */
export function clearPriceCache(): void {
  priceCache.clear();
}

/**
 * Get all known token addresses
 */
export function getKnownTokens(): Record<string, string> {
  return { ...KNOWN_TOKENS };
}
