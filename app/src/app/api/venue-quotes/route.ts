import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route pour récupérer les quotes des venues DEX natives
 * 
 * UTILISE LES APIs INTERNES /api/dex/* qui sont déjà proxyfiées et fonctionnent
 * 
 * @author SwapBack Team
 * @date December 22, 2025 - Refactored to use internal APIs
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
  const slippageBps = searchParams.get('slippageBps') || '50';

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

  console.log(`[venue-quotes] Fetching quotes for ${inputMint.slice(0,8)}... -> ${outputMint.slice(0,8)}..., amount: ${amountNum}`);

  // Get base URL for internal API calls
  const baseUrl = getBaseUrl(request);
  console.log(`[venue-quotes] Using base URL: ${baseUrl}`);
  
  const quotes: VenueQuoteResult[] = [];

  // Fetch all quotes in parallel using INTERNAL APIs
  // Includes ALL 8 venues: Raydium, Orca, Meteora, Phoenix, Lifinity, Saber, PumpSwap, LaunchLab
  const [
    raydiumResult, 
    orcaResult, 
    meteoraResult, 
    phoenixResult, 
    lifinityResult, 
    saberResult,
    pumpswapResult,
    launchlabResult,
    jupiterResult
  ] = await Promise.allSettled([
    fetchInternalQuote(baseUrl, 'raydium', inputMint, outputMint, amountNum, slippageBps),
    fetchInternalQuote(baseUrl, 'orca', inputMint, outputMint, amountNum, slippageBps),
    fetchInternalQuote(baseUrl, 'meteora', inputMint, outputMint, amountNum, slippageBps),
    fetchInternalQuote(baseUrl, 'phoenix', inputMint, outputMint, amountNum, slippageBps),
    fetchInternalQuote(baseUrl, 'lifinity', inputMint, outputMint, amountNum, slippageBps),
    fetchInternalQuote(baseUrl, 'saber', inputMint, outputMint, amountNum, slippageBps),
    fetchInternalQuote(baseUrl, 'pumpswap', inputMint, outputMint, amountNum, slippageBps),
    fetchInternalQuote(baseUrl, 'launchlab', inputMint, outputMint, amountNum, slippageBps),
    fetchJupiterQuote(inputMint, outputMint, amountNum),
  ]);

  console.log('[venue-quotes] Fetch results:', {
    raydium: raydiumResult.status === 'fulfilled' ? raydiumResult.value?.outputAmount : 'rejected',
    orca: orcaResult.status === 'fulfilled' ? orcaResult.value?.outputAmount : 'rejected',
    meteora: meteoraResult.status === 'fulfilled' ? meteoraResult.value?.outputAmount : 'rejected',
    phoenix: phoenixResult.status === 'fulfilled' ? phoenixResult.value?.outputAmount : 'rejected',
    lifinity: lifinityResult.status === 'fulfilled' ? lifinityResult.value?.outputAmount : 'rejected',
    saber: saberResult.status === 'fulfilled' ? saberResult.value?.outputAmount : 'rejected',
    pumpswap: pumpswapResult.status === 'fulfilled' ? pumpswapResult.value?.outputAmount : 'rejected',
    launchlab: launchlabResult.status === 'fulfilled' ? launchlabResult.value?.outputAmount : 'rejected',
    jupiter: jupiterResult.status === 'fulfilled' ? jupiterResult.value?.outputAmount : 'rejected',
  });

  // Process native venue results
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

  if (lifinityResult.status === 'fulfilled' && lifinityResult.value && lifinityResult.value.outputAmount > 0) {
    quotes.push(lifinityResult.value);
  }

  if (saberResult.status === 'fulfilled' && saberResult.value && saberResult.value.outputAmount > 0) {
    quotes.push(saberResult.value);
  }

  if (pumpswapResult.status === 'fulfilled' && pumpswapResult.value && pumpswapResult.value.outputAmount > 0) {
    quotes.push(pumpswapResult.value);
  }

  if (launchlabResult.status === 'fulfilled' && launchlabResult.value && launchlabResult.value.outputAmount > 0) {
    quotes.push(launchlabResult.value);
  }

  // Jupiter benchmark
  let jupiterBenchmark: VenueQuoteResult | null = null;
  if (jupiterResult.status === 'fulfilled' && jupiterResult.value && jupiterResult.value.outputAmount > 0) {
    jupiterBenchmark = jupiterResult.value;
  }

  console.log('[venue-quotes] Valid native quotes:', quotes.length, quotes.map(q => q.venue));

  // Find best native venue
  const bestQuote = quotes.reduce((best, current) => 
    current.outputAmount > (best?.outputAmount || 0) ? current : best
  , null as VenueQuoteResult | null);

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
// HELPERS
// ============================================================================

function getBaseUrl(request: NextRequest): string {
  // For Fly.io: use internal URL for self-calls (faster, no external network)
  // Fly.io sets FLY_APP_NAME environment variable
  if (process.env.FLY_APP_NAME) {
    // Use localhost for internal calls on Fly.io (same container)
    return 'http://localhost:3000';
  }
  
  // For Vercel: use the request origin
  const url = new URL(request.url);
  if (url.origin && url.origin !== 'null' && !url.origin.includes('localhost')) {
    return url.origin;
  }
  
  // Fallback to environment variables
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  return 'http://localhost:3000';
}

// ============================================================================
// INTERNAL API QUOTE FETCHER
// Uses our own /api/dex/* endpoints which are already working
// ============================================================================

async function fetchInternalQuote(
  baseUrl: string,
  venue: 'raydium' | 'orca' | 'meteora' | 'phoenix' | 'lifinity' | 'saber' | 'pumpswap',
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: string
): Promise<VenueQuoteResult> {
  const startTime = Date.now();
  const venueUpper = venue.toUpperCase();
  
  try {
    const url = `${baseUrl}/api/dex/${venue}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;
    console.log(`[${venueUpper}] Fetching: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`[${venueUpper}] Internal API returned ${response.status}`);
      return {
        venue: venueUpper,
        outputAmount: 0,
        priceImpactBps: 0,
        latencyMs: Date.now() - startTime,
        error: `HTTP ${response.status}`,
        source: 'api',
      };
    }
    
    const data = await response.json();
    
    // Handle error responses
    if (data.error) {
      console.log(`[${venueUpper}] Internal API error:`, data.error);
      return {
        venue: venueUpper,
        outputAmount: 0,
        priceImpactBps: 0,
        latencyMs: Date.now() - startTime,
        error: data.error,
        source: 'api',
      };
    }
    
    // Extract output amount
    const outputAmount = parseInt(data.outputAmount || data.outAmount || '0');
    
    if (outputAmount > 0) {
      console.log(`[${venueUpper}] Quote success: ${outputAmount}`);
      return {
        venue: venueUpper,
        outputAmount,
        priceImpactBps: data.priceImpactBps || Math.floor((data.priceImpact || 0) * 100),
        latencyMs: Date.now() - startTime,
        source: data.source || 'api',
      };
    }
    
    return {
      venue: venueUpper,
      outputAmount: 0,
      priceImpactBps: 0,
      latencyMs: Date.now() - startTime,
      error: 'No output amount',
      source: 'api',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`[${venueUpper}] Internal API error:`, errorMessage);
    return {
      venue: venueUpper,
      outputAmount: 0,
      priceImpactBps: 0,
      latencyMs: Date.now() - startTime,
      error: errorMessage,
      source: 'api',
    };
  }
}

// ============================================================================
// JUPITER QUOTE - Direct API call (always works)
// ============================================================================

async function fetchJupiterQuote(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<VenueQuoteResult> {
  const startTime = Date.now();
  
  try {
    const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&slippageBps=50`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return {
        venue: 'JUPITER',
        outputAmount: 0,
        priceImpactBps: 0,
        latencyMs: Date.now() - startTime,
        error: `HTTP ${response.status}`,
        source: 'api',
      };
    }
    
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
    
    return {
      venue: 'JUPITER',
      outputAmount: 0,
      priceImpactBps: 0,
      latencyMs: Date.now() - startTime,
      error: 'No output amount',
      source: 'api',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      venue: 'JUPITER',
      outputAmount: 0,
      priceImpactBps: 0,
      latencyMs: Date.now() - startTime,
      error: errorMessage,
      source: 'api',
    };
  }
}
