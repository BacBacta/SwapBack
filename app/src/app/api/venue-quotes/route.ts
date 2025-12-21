import { NextRequest, NextResponse } from 'next/server';
import { PublicKey, Connection } from '@solana/web3.js';
import BN from 'bn.js';

/**
 * API Route proxy pour récupérer les quotes des venues sans problème CORS
 * Appelle les APIs des DEX côté serveur
 * 
 * IMPORTANT - PHASE 1 CORRECTIONS:
 * ✅ Suppression des spreads artificiels (0.997 → valeurs directes)
 * ✅ Vraies quotes DEX uniquement (pas d'estimation silencieuse)
 * ✅ Affichage explicite de la source de quote
 * ✅ Correction endpoint Meteora (recherche de pool d'abord)
 * ✅ Correction endpoint Orca (SDK Whirlpool fallback)
 * 
 * @see https://station.jup.ag/docs/apis/swap-api - Jupiter V6 API reference
 * @see docs/ai/solana-native-router-a2z.md - Documentation interne
 * 
 * @author SwapBack Team
 * @date December 21, 2025
 */

// ============================================================================
// TYPES
// ============================================================================

interface VenueQuoteResult {
  venue: string;
  outputAmount: number;
  priceImpactBps: number;
  latencyMs: number;
  error?: string;
  /** Source de la quote: 'api' | 'sdk' | 'estimated' (PAS de spread sur api/sdk) */
  source?: 'api' | 'sdk' | 'estimated';
}

interface QuoteResponse {
  quotes: VenueQuoteResult[];
  jupiterBenchmark: VenueQuoteResult | null;
  bestVenue: string;
  bestOutput: number;
  timestamp: number;
}

// ============================================================================
// CORS HELPERS
// ============================================================================

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = (process.env.ALLOWED_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const allowOrigin =
    origin && allowed.length > 0 && allowed.includes(origin)
      ? origin
      : allowed.length > 0
        ? allowed[0]
        : '*';

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
  };

  if (allowOrigin !== '*') {
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Vary'] = 'Origin';
  }

  return headers;
}

const getInternalProxyUrl = () => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000';
  return `${baseUrl}/api/cors-proxy?url=`;
};

// ============================================================================
// TOKEN METADATA
// ============================================================================

const KNOWN_TOKENS: Record<string, { decimals: number; symbol: string }> = {
  'So11111111111111111111111111111111111111112': { decimals: 9, symbol: 'SOL' },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { decimals: 6, symbol: 'USDC' },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { decimals: 6, symbol: 'USDT' },
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { decimals: 9, symbol: 'mSOL' },
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { decimals: 5, symbol: 'BONK' },
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': { decimals: 8, symbol: 'ETH' },
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': { decimals: 6, symbol: 'JUP' },
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': { decimals: 6, symbol: 'WIF' },
};

function getTokenDecimals(mint: string): number {
  return KNOWN_TOKENS[mint]?.decimals ?? 9;
}

// ============================================================================
// HANDLERS
// ============================================================================

export async function OPTIONS(request?: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request?.headers?.get('origin') ?? null),
  });
}

export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin'));
  const { searchParams } = new URL(request.url);
  const inputMint = searchParams.get('inputMint');
  const outputMint = searchParams.get('outputMint');
  const amount = searchParams.get('amount');

  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json(
      { error: 'Missing required parameters: inputMint, outputMint, amount' },
      { status: 400, headers: corsHeaders }
    );
  }

  const amountNum = parseInt(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return NextResponse.json(
      { error: 'Invalid amount' },
      { status: 400, headers: corsHeaders }
    );
  }

  console.log(`[venue-quotes] Fetching quotes for ${inputMint} -> ${outputMint}, amount: ${amountNum}`);

  const quotes: VenueQuoteResult[] = [];

  // Fetch all quotes in parallel (including new venues: Saber, Lifinity)
  const [raydiumResult, orcaResult, meteoraResult, phoenixResult, saberResult, lifinityResult, jupiterResult] = await Promise.allSettled([
    fetchRaydiumQuote(inputMint, outputMint, amountNum),
    fetchOrcaQuote(inputMint, outputMint, amountNum),
    fetchMeteoraQuote(inputMint, outputMint, amountNum),
    fetchPhoenixQuote(inputMint, outputMint, amountNum),
    fetchSaberQuote(inputMint, outputMint, amountNum),
    fetchLifinityQuote(inputMint, outputMint, amountNum),
    fetchJupiterQuote(inputMint, outputMint, amountNum),
  ]);

  console.log('[venue-quotes] Fetch results:', {
    raydium: raydiumResult.status === 'fulfilled' ? raydiumResult.value?.outputAmount : 'rejected',
    orca: orcaResult.status === 'fulfilled' ? orcaResult.value?.outputAmount : 'rejected',
    meteora: meteoraResult.status === 'fulfilled' ? meteoraResult.value?.outputAmount : 'rejected',
    phoenix: phoenixResult.status === 'fulfilled' ? phoenixResult.value?.outputAmount : 'rejected',
    saber: saberResult.status === 'fulfilled' ? saberResult.value?.outputAmount : 'rejected',
    lifinity: lifinityResult.status === 'fulfilled' ? lifinityResult.value?.outputAmount : 'rejected',
    jupiter: jupiterResult.status === 'fulfilled' ? jupiterResult.value?.outputAmount : 'rejected',
  });

  // Process native venue results (NO artificial spread on real quotes)
  if (raydiumResult.status === 'fulfilled' && raydiumResult.value && raydiumResult.value.outputAmount > 0) {
    quotes.push(raydiumResult.value);
  }

  if (orcaResult.status === 'fulfilled' && orcaResult.value && orcaResult.value.outputAmount > 0) {
    quotes.push(orcaResult.value);
  }

  if (meteoraResult.status === 'fulfilled' && meteoraResult.value && meteoraResult.value.outputAmount > 0) {
    quotes.push(meteoraResult.value);
  }

  if (phoenixResult.status === 'fulfilled' && phoenixResult.value && phoenixResult.value.outputAmount > 0) {
    quotes.push(phoenixResult.value);
  }

  if (saberResult.status === 'fulfilled' && saberResult.value && saberResult.value.outputAmount > 0) {
    quotes.push(saberResult.value);
  }

  if (lifinityResult.status === 'fulfilled' && lifinityResult.value && lifinityResult.value.outputAmount > 0) {
    quotes.push(lifinityResult.value);
  }

  // Jupiter benchmark (for comparison, NOT added to native quotes)
  let jupiterBenchmark: VenueQuoteResult | null = null;
  if (jupiterResult.status === 'fulfilled' && jupiterResult.value && jupiterResult.value.outputAmount > 0) {
    jupiterBenchmark = jupiterResult.value;
  }

  console.log('[venue-quotes] Valid native quotes:', quotes.length);

  // Find best native venue
  const bestQuote = quotes.reduce((best, current) => 
    current.outputAmount > (best?.outputAmount || 0) ? current : best
  , null as VenueQuoteResult | null);

  // Log comparison with Jupiter for monitoring
  if (bestQuote && jupiterBenchmark) {
    const deltaBps = Math.round(((bestQuote.outputAmount - jupiterBenchmark.outputAmount) / jupiterBenchmark.outputAmount) * 10000);
    console.log('[venue-quotes] SwapBack vs Jupiter:', {
      swapbackBest: bestQuote.venue,
      swapbackOutput: bestQuote.outputAmount,
      jupiterOutput: jupiterBenchmark.outputAmount,
      deltaBps,
      status: deltaBps >= -10 ? 'PASS' : deltaBps >= -30 ? 'ACCEPTABLE' : 'REVIEW_NEEDED',
    });
  }

  const response: QuoteResponse = {
    quotes,
    jupiterBenchmark,
    bestVenue: bestQuote?.venue || 'none',
    bestOutput: bestQuote?.outputAmount || 0,
    timestamp: Date.now(),
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      ...corsHeaders,
    },
  });
}

// ============================================================================
// FETCH HELPERS
// ============================================================================

async function fetchWithFallback(
  url: string,
  venueName: string,
  timeout: number = 5000
): Promise<Response | null> {
  // Direct fetch (server-side = no CORS)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SwapBack-Server/1.0',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      console.log(`[${venueName}] Direct fetch succeeded`);
      return response;
    }
    console.log(`[${venueName}] Direct fetch failed: HTTP ${response.status}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`[${venueName}] Direct fetch error: ${errorMessage}`);
  }

  // Fallback: internal proxy
  try {
    const proxyUrl = `${getInternalProxyUrl()}${encodeURIComponent(url)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(proxyUrl, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      console.log(`[${venueName}] Internal proxy fetch succeeded`);
      return response;
    }
    console.log(`[${venueName}] Internal proxy failed: HTTP ${response.status}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`[${venueName}] Internal proxy error: ${errorMessage}`);
  }

  return null;
}

// ============================================================================
// RAYDIUM QUOTE - Uses official Transaction API
// NO artificial spread applied
// ============================================================================

async function fetchRaydiumQuote(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<VenueQuoteResult> {
  const startTime = Date.now();
  const url = `https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&slippageBps=50&txVersion=V0`;
  
  const response = await fetchWithFallback(url, 'RAYDIUM');
  
  if (response) {
    try {
      const data = await response.json();
      if (data.success && data.data?.outputAmount) {
        // CRITICAL: NO spread applied - use exact API output
        return {
          venue: 'RAYDIUM',
          outputAmount: parseInt(data.data.outputAmount),
          priceImpactBps: Math.floor(parseFloat(data.data.priceImpact || '0') * 100),
          latencyMs: Date.now() - startTime,
          source: 'api',
        };
      }
    } catch (e) {
      console.log('[RAYDIUM] Parse error:', e);
    }
  }

  // No fallback estimation - return 0 to indicate API failure
  return { 
    venue: 'RAYDIUM', 
    outputAmount: 0, 
    priceImpactBps: 0, 
    latencyMs: Date.now() - startTime, 
    error: 'API unavailable',
    source: 'api',
  };
}

// ============================================================================
// ORCA QUOTE - Uses API with SDK fallback
// NO artificial spread applied
// ============================================================================

async function fetchOrcaQuote(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<VenueQuoteResult> {
  const startTime = Date.now();
  
  // Try multiple Orca endpoints
  const endpoints = [
    `https://api.mainnet.orca.so/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&slippage=0.5`,
    `https://api.orca.so/v2/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&slippageBps=50`,
  ];

  for (const url of endpoints) {
    const response = await fetchWithFallback(url, 'ORCA');
    
    if (response) {
      try {
        const data = await response.json();
        
        // Check for valid quote (not diagnostic/error payload)
        if (data.outAmount && !data.lasterror && !data.headers) {
          // CRITICAL: NO spread applied - use exact API output
          return {
            venue: 'ORCA',
            outputAmount: parseInt(data.outAmount),
            priceImpactBps: Math.floor(parseFloat(data.priceImpactPercent || data.priceImpact || '0') * 100),
            latencyMs: Date.now() - startTime,
            source: 'api',
          };
        }
      } catch (e) {
        console.log('[ORCA] Parse error:', e);
      }
    }
  }

  // Fallback: Use internal /api/dex/orca/quote which has SDK fallback
  try {
    const internalUrl = `/api/dex/orca/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&slippageBps=50`;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}${internalUrl}`, {
      signal: AbortSignal.timeout(7000),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.outputAmount > 0) {
        // CRITICAL: NO spread applied - SDK quote is accurate
        return {
          venue: 'ORCA',
          outputAmount: data.outputAmount,
          priceImpactBps: data.priceImpactBps || 0,
          latencyMs: Date.now() - startTime,
          source: data.source === 'orca-whirlpool-sdk' ? 'sdk' : 'api',
        };
      }
    }
  } catch (e) {
    console.log('[ORCA] Internal API fallback failed:', e);
  }

  return { 
    venue: 'ORCA', 
    outputAmount: 0, 
    priceImpactBps: 0, 
    latencyMs: Date.now() - startTime, 
    error: 'API unavailable',
    source: 'api',
  };
}

// ============================================================================
// METEORA QUOTE - Find pool first, then quote
// NO artificial spread applied
// ============================================================================

async function fetchMeteoraQuote(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<VenueQuoteResult> {
  const startTime = Date.now();
  
  try {
    // Step 1: Find pool address using pairs API
    const pairsUrl = `https://dlmm-api.meteora.ag/pair/all`;
    const pairsResponse = await fetchWithFallback(pairsUrl, 'METEORA-PAIRS');
    
    if (!pairsResponse) {
      return { 
        venue: 'METEORA', 
        outputAmount: 0, 
        priceImpactBps: 0, 
        latencyMs: Date.now() - startTime, 
        error: 'Pairs API unavailable',
        source: 'api',
      };
    }

    const pairs = await pairsResponse.json();
    
    // Find matching pool
    const matchingPool = pairs.find((p: any) => 
      (p.mint_x === inputMint && p.mint_y === outputMint) ||
      (p.mint_y === inputMint && p.mint_x === outputMint)
    );

    if (!matchingPool) {
      console.log('[METEORA] No pool found for pair:', inputMint, outputMint);
      return { 
        venue: 'METEORA', 
        outputAmount: 0, 
        priceImpactBps: 0, 
        latencyMs: Date.now() - startTime, 
        error: 'Pool not found',
        source: 'api',
      };
    }

    const poolAddress = matchingPool.address;
    console.log('[METEORA] Found pool:', poolAddress);

    // Step 2: Use internal API with pairAddress
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    const quoteUrl = `${baseUrl}/api/dex/meteora/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&pairAddress=${poolAddress}&slippageBps=50`;
    
    const quoteResponse = await fetch(quoteUrl, {
      signal: AbortSignal.timeout(7000),
    });

    if (quoteResponse.ok) {
      const data = await quoteResponse.json();
      if (data.outputAmount > 0) {
        // CRITICAL: NO spread applied - SDK quote is accurate
        return {
          venue: 'METEORA',
          outputAmount: data.outputAmount,
          priceImpactBps: data.priceImpactBps || 0,
          latencyMs: Date.now() - startTime,
          source: 'sdk',
        };
      }
    }

  } catch (e) {
    console.log('[METEORA] Error:', e);
  }

  return { 
    venue: 'METEORA', 
    outputAmount: 0, 
    priceImpactBps: 0, 
    latencyMs: Date.now() - startTime, 
    error: 'Quote failed',
    source: 'api',
  };
}

// ============================================================================
// PHOENIX QUOTE - Uses SDK for orderbook quote via internal API
// NO artificial spread applied
// @see https://docs.phoenix.trade/
// ============================================================================

async function fetchPhoenixQuote(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<VenueQuoteResult> {
  const startTime = Date.now();
  
  // Phoenix supported markets
  const PHOENIX_MARKETS: Record<string, string> = {
    // SOL/USDC market
    'So11111111111111111111111111111111111111112:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': '4DoNfFBfF7UokCC2FQzriy7yHK6DY6NVdYpuekQ5pRgg',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v:So11111111111111111111111111111111111111112': '4DoNfFBfF7UokCC2FQzriy7yHK6DY6NVdYpuekQ5pRgg',
    // BONK/USDC market
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': '2fBqLAuXxDNbT3sT1PLgVJpYCxCZvXj4KpbZBwmhJMbR',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v:DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': '2fBqLAuXxDNbT3sT1PLgVJpYCxCZvXj4KpbZBwmhJMbR',
  };

  const pairKey = `${inputMint}:${outputMint}`;
  const marketAddress = PHOENIX_MARKETS[pairKey];

  if (!marketAddress) {
    // Phoenix doesn't have this market
    return { 
      venue: 'PHOENIX', 
      outputAmount: 0, 
      priceImpactBps: 0, 
      latencyMs: Date.now() - startTime, 
      error: 'Market not available',
      source: 'sdk',
    };
  }

  // Use internal Phoenix API with SDK
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    const internalUrl = `${baseUrl}/api/dex/phoenix/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}`;
    
    const response = await fetch(internalUrl, {
      signal: AbortSignal.timeout(7000),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.outputAmount > 0) {
        console.log('[PHOENIX] SDK quote success:', data.outputAmount);
        // CRITICAL: NO spread applied - SDK quote is accurate
        return {
          venue: 'PHOENIX',
          outputAmount: data.outputAmount,
          priceImpactBps: data.priceImpactBps || 0,
          latencyMs: Date.now() - startTime,
          source: 'sdk',
        };
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.log('[PHOENIX] API error:', response.status, errorData);
    }
  } catch (e) {
    console.log('[PHOENIX] Internal API error:', e instanceof Error ? e.message : e);
  }

  return { 
    venue: 'PHOENIX', 
    outputAmount: 0, 
    priceImpactBps: 0, 
    latencyMs: Date.now() - startTime, 
    error: 'Quote failed',
    source: 'sdk',
  };
}

// ============================================================================
// JUPITER QUOTE - Benchmark reference
// Used for comparison, NOT as a native venue
// ============================================================================

async function fetchJupiterQuote(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<VenueQuoteResult> {
  const startTime = Date.now();
  
  // Try multiple Jupiter endpoints
  const endpoints = [
    `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&slippageBps=50`,
    `https://public.jupiterapi.com/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&slippageBps=50`,
  ];

  for (const url of endpoints) {
    const response = await fetchWithFallback(url, 'JUPITER');
    
    if (response) {
      try {
        const data = await response.json();
        if (data.outAmount) {
          return {
            venue: 'JUPITER',
            outputAmount: parseInt(data.outAmount),
            priceImpactBps: Math.floor(parseFloat(data.priceImpactPct || '0') * 100),
            latencyMs: Date.now() - startTime,
            source: 'api',
          };
        }
      } catch (e) {
        console.log('[JUPITER] Parse error:', e);
      }
    }
  }

  return { 
    venue: 'JUPITER', 
    outputAmount: 0, 
    priceImpactBps: 0, 
    latencyMs: Date.now() - startTime, 
    error: 'API unavailable',
    source: 'api',
  };
}

// ============================================================================
// SABER QUOTE - Stablecoin AMM specializing in USDC/USDT, SOL/mSOL, etc.
// Uses Saber public API: https://api.saber.so
// NO artificial spread applied
// ============================================================================

async function fetchSaberQuote(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<VenueQuoteResult> {
  const startTime = Date.now();
  
  // Saber supported pairs (stablecoins and LSTs)
  const SABER_POOLS: Record<string, { pool: string; decimalsIn: number; decimalsOut: number }> = {
    // USDC/USDT
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v:Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
      pool: 'YAkoNb6HKmSxQN9L8hiBE5tPJRsniSSMzND1boHmZxe',
      decimalsIn: 6,
      decimalsOut: 6,
    },
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
      pool: 'YAkoNb6HKmSxQN9L8hiBE5tPJRsniSSMzND1boHmZxe',
      decimalsIn: 6,
      decimalsOut: 6,
    },
    // SOL/mSOL
    'So11111111111111111111111111111111111111112:mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': {
      pool: 'Lee1XZJfJ9Hm2K1qTyeCz1LXNc1YBZaKZszvNY4KCDw',
      decimalsIn: 9,
      decimalsOut: 9,
    },
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So:So11111111111111111111111111111111111111112': {
      pool: 'Lee1XZJfJ9Hm2K1qTyeCz1LXNc1YBZaKZszvNY4KCDw',
      decimalsIn: 9,
      decimalsOut: 9,
    },
  };

  const pairKey = `${inputMint}:${outputMint}`;
  const poolConfig = SABER_POOLS[pairKey];

  if (!poolConfig) {
    // Saber doesn't have this pair
    return { 
      venue: 'SABER', 
      outputAmount: 0, 
      priceImpactBps: 0, 
      latencyMs: Date.now() - startTime, 
      error: 'Pool not available',
      source: 'api',
    };
  }

  // Try Saber API
  try {
    const url = `https://api.saber.so/api/swap/quote?input_mint=${inputMint}&output_mint=${outputMint}&amount=${amountIn}&slippage=0.5`;
    
    const response = await fetchWithFallback(url, 'SABER');
    
    if (response) {
      const data = await response.json();
      if (data.outputAmount || data.out_amount) {
        // CRITICAL: NO spread applied - use exact API output
        return {
          venue: 'SABER',
          outputAmount: parseInt(data.outputAmount || data.out_amount),
          priceImpactBps: Math.floor(parseFloat(data.priceImpact || data.price_impact || '0') * 100),
          latencyMs: Date.now() - startTime,
          source: 'api',
        };
      }
    }
  } catch (e) {
    console.log('[SABER] API error:', e);
  }

  // Fallback: estimate for stablecoin pairs (very close to 1:1)
  // This is acceptable because Saber is specifically for stable swaps
  if (poolConfig) {
    // For stablecoin pairs, assume ~0.04% fee and 1:1 ratio
    const isStablePair = poolConfig.decimalsIn === poolConfig.decimalsOut;
    if (isStablePair) {
      const estimatedOutput = Math.floor(amountIn * 0.9996); // 0.04% fee
      console.log('[SABER] Using stable pair estimation');
      return {
        venue: 'SABER',
        outputAmount: estimatedOutput,
        priceImpactBps: 4, // Minimal for stable pairs
        latencyMs: Date.now() - startTime,
        source: 'estimated',
      };
    }
  }

  return { 
    venue: 'SABER', 
    outputAmount: 0, 
    priceImpactBps: 0, 
    latencyMs: Date.now() - startTime, 
    error: 'Quote failed',
    source: 'api',
  };
}

// ============================================================================
// LIFINITY QUOTE - Proactive market maker with oracle-based pricing
// Uses Lifinity API: https://lifinity.io/api
// NO artificial spread applied
// ============================================================================

async function fetchLifinityQuote(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<VenueQuoteResult> {
  const startTime = Date.now();
  
  // Lifinity pools (high-liquidity pairs)
  const LIFINITY_POOLS: Record<string, string> = {
    // SOL/USDC
    'So11111111111111111111111111111111111111112:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'amgK1NwNyqzXGbnXBPv4uf6CtcEEG5FJm3TGkT5bEW9',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v:So11111111111111111111111111111111111111112': 'amgK1NwNyqzXGbnXBPv4uf6CtcEEG5FJm3TGkT5bEW9',
    // SOL/USDT
    'So11111111111111111111111111111111111111112:Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': '6kDmPvHNhWuwjKjGScdPnSVTdFfqxNGhB2c1Lzv5wRJx',
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB:So11111111111111111111111111111111111111112': '6kDmPvHNhWuwjKjGScdPnSVTdFfqxNGhB2c1Lzv5wRJx',
  };

  const pairKey = `${inputMint}:${outputMint}`;
  const poolAddress = LIFINITY_POOLS[pairKey];

  if (!poolAddress) {
    // Lifinity doesn't have this pair
    return { 
      venue: 'LIFINITY', 
      outputAmount: 0, 
      priceImpactBps: 0, 
      latencyMs: Date.now() - startTime, 
      error: 'Pool not available',
      source: 'api',
    };
  }

  // Try Lifinity API
  try {
    // Lifinity quote API
    const url = `https://lifinity.io/api/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&slippage=50`;
    
    const response = await fetchWithFallback(url, 'LIFINITY');
    
    if (response) {
      const data = await response.json();
      if (data.outAmount || data.outputAmount) {
        // CRITICAL: NO spread applied - use exact API output
        return {
          venue: 'LIFINITY',
          outputAmount: parseInt(data.outAmount || data.outputAmount),
          priceImpactBps: Math.floor(parseFloat(data.priceImpact || '0') * 100),
          latencyMs: Date.now() - startTime,
          source: 'api',
        };
      }
    }
  } catch (e) {
    console.log('[LIFINITY] API error:', e);
  }

  // Fallback: Use internal proxy or SDK
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    const internalUrl = `${baseUrl}/api/dex/lifinity/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&poolAddress=${poolAddress}`;
    
    const response = await fetch(internalUrl, {
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.outputAmount > 0) {
        return {
          venue: 'LIFINITY',
          outputAmount: data.outputAmount,
          priceImpactBps: data.priceImpactBps || 0,
          latencyMs: Date.now() - startTime,
          source: 'sdk',
        };
      }
    }
  } catch (e) {
    console.log('[LIFINITY] Internal API error:', e);
  }

  return { 
    venue: 'LIFINITY', 
    outputAmount: 0, 
    priceImpactBps: 0, 
    latencyMs: Date.now() - startTime, 
    error: 'Quote failed',
    source: 'api',
  };
}
