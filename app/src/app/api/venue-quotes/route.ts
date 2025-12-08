import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route proxy pour récupérer les quotes des venues sans problème CORS
 * Appelle les APIs des DEX côté serveur
 * 
 * Solutions CORS implémentées:
 * 1. Appels côté serveur (Next.js API Route) - pas de CORS
 * 2. Fallback via proxy interne /api/cors-proxy
 * 3. Estimation basée sur les prix si APIs échouent
 * 
 * CORS: Cette route supporte les preflight requests (OPTIONS)
 */

interface VenueQuoteResult {
  venue: string;
  outputAmount: number;
  priceImpactBps: number;
  latencyMs: number;
  error?: string;
  source?: string; // 'direct' | 'proxy' | 'estimated'
}

interface QuoteResponse {
  quotes: VenueQuoteResult[];
  jupiterBenchmark: VenueQuoteResult | null;
  bestVenue: string;
  bestOutput: number;
  timestamp: number;
}

// Helper pour les headers CORS
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
  'Access-Control-Allow-Credentials': 'true',
};

// Proxy interne (plus fiable que corsfix.com)
const getInternalProxyUrl = () => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000';
  return `${baseUrl}/api/cors-proxy?url=`;
};

/**
 * Handler OPTIONS pour les preflight requests CORS
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const inputMint = searchParams.get('inputMint');
  const outputMint = searchParams.get('outputMint');
  const amount = searchParams.get('amount');

  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json(
      { error: 'Missing required parameters: inputMint, outputMint, amount' },
      { status: 400 }
    );
  }

  const amountNum = parseInt(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return NextResponse.json(
      { error: 'Invalid amount' },
      { status: 400 }
    );
  }

  console.log(`[venue-quotes] Fetching quotes for ${inputMint} -> ${outputMint}, amount: ${amountNum}`);

  const quotes: VenueQuoteResult[] = [];
  let jupiterBenchmark: VenueQuoteResult | null = null;

  // Fetch all quotes in parallel
  const [raydiumResult, orcaResult, meteoraResult, phoenixResult, jupiterResult] = await Promise.allSettled([
    fetchRaydiumQuote(inputMint, outputMint, amountNum),
    fetchOrcaQuote(inputMint, outputMint, amountNum),
    fetchMeteoraQuote(inputMint, outputMint, amountNum),
    fetchPhoenixQuote(inputMint, outputMint, amountNum),
    fetchJupiterQuote(inputMint, outputMint, amountNum),
  ]);

  console.log('[venue-quotes] Fetch results:', {
    raydium: raydiumResult.status === 'fulfilled' ? raydiumResult.value : 'rejected',
    orca: orcaResult.status === 'fulfilled' ? orcaResult.value : 'rejected',
    meteora: meteoraResult.status === 'fulfilled' ? meteoraResult.value : 'rejected',
    phoenix: phoenixResult.status === 'fulfilled' ? phoenixResult.value : 'rejected',
    jupiter: jupiterResult.status === 'fulfilled' ? jupiterResult.value : 'rejected',
  });

  // Process all results - les fonctions retournent toujours un objet maintenant
  if (raydiumResult.status === 'fulfilled' && raydiumResult.value.outputAmount > 0) {
    quotes.push(raydiumResult.value);
  }

  if (orcaResult.status === 'fulfilled' && orcaResult.value.outputAmount > 0) {
    quotes.push(orcaResult.value);
  }

  if (meteoraResult.status === 'fulfilled' && meteoraResult.value.outputAmount > 0) {
    quotes.push(meteoraResult.value);
  }

  if (phoenixResult.status === 'fulfilled' && phoenixResult.value.outputAmount > 0) {
    quotes.push(phoenixResult.value);
  }

  // Process Jupiter (benchmark)
  if (jupiterResult.status === 'fulfilled' && jupiterResult.value.outputAmount > 0) {
    jupiterBenchmark = jupiterResult.value;
  }

  console.log('[venue-quotes] Valid quotes:', quotes.length, 'Jupiter benchmark:', !!jupiterBenchmark);

  // Find best venue among native venues (exclure Jupiter du tri)
  const nativeQuotes = quotes.filter(q => q.venue !== 'JUPITER');
  let bestQuote = nativeQuotes.reduce((best, current) => 
    current.outputAmount > (best?.outputAmount || 0) ? current : best
  , null as VenueQuoteResult | null);

  // FALLBACK 1: Si aucune venue native n'a de quote valide, utiliser Jupiter
  if (!bestQuote && jupiterBenchmark && jupiterBenchmark.outputAmount > 0) {
    console.log('[venue-quotes] No native venues, using Jupiter as fallback');
    bestQuote = {
      ...jupiterBenchmark,
      venue: 'JUPITER_FALLBACK',
    };
    quotes.push(bestQuote);
  }

  // FALLBACK 2: Si toujours rien, générer des quotes synthétiques basées sur les prix
  if (!bestQuote || quotes.length === 0) {
    console.log('[venue-quotes] No quotes at all, generating synthetic quotes from prices...');
    
    const syntheticQuotes = await generateSyntheticQuotes(inputMint, outputMint, amountNum);
    
    if (syntheticQuotes.length > 0) {
      quotes.push(...syntheticQuotes);
      bestQuote = syntheticQuotes.reduce((best, current) => 
        current.outputAmount > (best?.outputAmount || 0) ? current : best
      , null as VenueQuoteResult | null);
      
      // Utiliser la meilleure quote synthétique comme benchmark Jupiter si pas de benchmark
      if (!jupiterBenchmark && bestQuote) {
        jupiterBenchmark = {
          ...bestQuote,
          venue: 'JUPITER',
          source: 'synthetic',
        };
      }
      
      console.log('[venue-quotes] Generated', syntheticQuotes.length, 'synthetic quotes, best:', bestQuote?.venue);
    }
  }

  console.log('[venue-quotes] Final result:', {
    quotesCount: quotes.length,
    bestVenue: bestQuote?.venue,
    bestOutput: bestQuote?.outputAmount,
    bestSource: bestQuote?.source,
  });

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
      ...CORS_HEADERS,
    },
  });
}

// ============================================================================
// GÉNÉRATION DE QUOTES SYNTHÉTIQUES (fallback ultime)
// ============================================================================

/**
 * Génère des quotes synthétiques pour toutes les venues principales
 * basées sur les prix du marché. Utilisé quand toutes les APIs échouent.
 */
async function generateSyntheticQuotes(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<VenueQuoteResult[]> {
  const startTime = Date.now();
  const estimate = await estimateOutputFromPrices(inputMint, outputMint, amountIn);
  
  if (!estimate || estimate.outputAmount <= 0) {
    console.log('[generateSyntheticQuotes] Could not estimate prices');
    return [];
  }

  const baseOutput = estimate.outputAmount;
  
  // Générer des quotes pour chaque venue avec des spreads réalistes
  const venueConfigs: Array<{ venue: string; spreadMultiplier: number; priceImpactBps: number }> = [
    { venue: 'RAYDIUM', spreadMultiplier: 0.998, priceImpactBps: 15 },    // 0.2% spread
    { venue: 'ORCA', spreadMultiplier: 0.9975, priceImpactBps: 12 },      // 0.25% spread  
    { venue: 'METEORA', spreadMultiplier: 0.997, priceImpactBps: 18 },    // 0.3% spread
    { venue: 'PHOENIX', spreadMultiplier: 0.999, priceImpactBps: 5 },     // 0.1% spread (CLOB)
  ];

  const quotes: VenueQuoteResult[] = venueConfigs.map(config => ({
    venue: config.venue,
    outputAmount: Math.floor(baseOutput * config.spreadMultiplier),
    priceImpactBps: config.priceImpactBps,
    latencyMs: Date.now() - startTime,
    source: 'synthetic',
  }));

  // Ajouter Jupiter comme benchmark (prix du marché exact)
  quotes.push({
    venue: 'JUPITER',
    outputAmount: baseOutput,
    priceImpactBps: 10,
    latencyMs: Date.now() - startTime,
    source: 'synthetic',
  });

  console.log('[generateSyntheticQuotes] Generated quotes:', quotes.map(q => `${q.venue}:${q.outputAmount}`).join(', '));
  
  return quotes;
}

// ============================================================================
// VENUE FETCHERS avec fallbacks robustes
// ============================================================================

/**
 * Helper pour fetch avec retry et fallback via proxy interne
 * Stratégie:
 * 1. Appel direct (côté serveur Next.js = pas de CORS)
 * 2. Fallback via proxy interne /api/cors-proxy
 */
async function fetchWithFallback(
  url: string,
  venueName: string,
  timeout: number = 8000
): Promise<Response | null> {
  // Tentative 1: Appel direct (côté serveur, devrait toujours fonctionner)
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

  // Tentative 2: Via proxy interne (plus fiable que services externes)
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

/**
 * Tokens connus avec leurs décimales
 */
const KNOWN_TOKENS: Record<string, { decimals: number; symbol: string }> = {
  'So11111111111111111111111111111111111111112': { decimals: 9, symbol: 'SOL' },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { decimals: 6, symbol: 'USDC' },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { decimals: 6, symbol: 'USDT' },
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { decimals: 9, symbol: 'mSOL' },
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { decimals: 5, symbol: 'BONK' },
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': { decimals: 8, symbol: 'ETH' },
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': { decimals: 6, symbol: 'JUP' },
};

/**
 * Récupère les décimales d'un token
 */
function getTokenDecimals(mint: string): number {
  return KNOWN_TOKENS[mint]?.decimals ?? 9; // Par défaut 9 (comme SOL)
}

/**
 * Récupère le prix d'un token via Jupiter Price API avec fallbacks
 */
async function getTokenPrice(mint: string): Promise<number> {
  // Tentative 1: Jupiter Price API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(
      `https://api.jup.ag/price/v2?ids=${mint}`,
      { signal: controller.signal }
    );
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      const price = parseFloat(data.data?.[mint]?.price || '0');
      if (price > 0) {
        console.log(`[getTokenPrice] Jupiter price for ${mint.slice(0, 8)}...: $${price}`);
        return price;
      }
    }
  } catch (error) {
    console.log(`[getTokenPrice] Jupiter failed for ${mint.slice(0, 8)}...`);
  }

  // Tentative 2: Prix hardcodés pour les tokens majeurs (fallback de secours)
  const hardcodedPrices: Record<string, number> = {
    'So11111111111111111111111111111111111111112': 180, // SOL ~$180
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 1, // USDC = $1
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1, // USDT = $1
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 200, // mSOL ~$200
  };
  
  if (hardcodedPrices[mint]) {
    console.log(`[getTokenPrice] Using hardcoded price for ${mint.slice(0, 8)}...: $${hardcodedPrices[mint]}`);
    return hardcodedPrices[mint];
  }

  return 0;
}

/**
 * Estime un output basé sur les prix du marché
 * Utilisé comme fallback quand les APIs DEX échouent
 * Détecte automatiquement les décimales des tokens connus
 */
async function estimateOutputFromPrices(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<{ outputAmount: number; priceImpactBps: number } | null> {
  try {
    const inputDecimals = getTokenDecimals(inputMint);
    const outputDecimals = getTokenDecimals(outputMint);
    
    const [inputPrice, outputPrice] = await Promise.all([
      getTokenPrice(inputMint),
      getTokenPrice(outputMint),
    ]);

    console.log(`[estimateOutputFromPrices] Prices: input=$${inputPrice}, output=$${outputPrice}, inputDec=${inputDecimals}, outputDec=${outputDecimals}`);

    if (inputPrice > 0 && outputPrice > 0) {
      // Convertir le montant d'entrée en USD
      const inputAmountNormalized = amountIn / Math.pow(10, inputDecimals);
      const inputValueUsd = inputAmountNormalized * inputPrice;
      
      // Calculer le montant de sortie
      const outputAmountNormalized = inputValueUsd / outputPrice;
      const outputAmount = Math.floor(outputAmountNormalized * Math.pow(10, outputDecimals));
      
      console.log(`[estimateOutputFromPrices] Calculated: ${inputAmountNormalized} input -> $${inputValueUsd.toFixed(2)} -> ${outputAmountNormalized} output (raw: ${outputAmount})`);
      
      // Estimer un price impact de 0.1% pour les estimations
      return { outputAmount, priceImpactBps: 10 };
    }
  } catch (error) {
    console.log(`[estimateOutputFromPrices] Error:`, error);
  }
  return null;
}

async function fetchRaydiumQuote(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<VenueQuoteResult> {
  const startTime = Date.now();
  const url = `https://api-v3.raydium.io/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&slippageBps=50`;
  
  const response = await fetchWithFallback(url, 'RAYDIUM');
  
  if (response) {
    try {
      const data = await response.json();
      if (data.success && data.data?.outputAmount) {
        return {
          venue: 'RAYDIUM',
          outputAmount: parseInt(data.data.outputAmount),
          priceImpactBps: Math.floor(parseFloat(data.data.priceImpact || '0') * 100),
          latencyMs: Date.now() - startTime,
          source: 'direct',
        };
      }
    } catch (e) {
      console.log('[RAYDIUM] Parse error:', e);
    }
  }

  // Fallback: estimation basée sur les prix
  const estimate = await estimateOutputFromPrices(inputMint, outputMint, amountIn);
  if (estimate) {
    return {
      venue: 'RAYDIUM',
      outputAmount: Math.floor(estimate.outputAmount * 0.998), // 0.2% moins que le prix (spread simulé)
      priceImpactBps: estimate.priceImpactBps,
      latencyMs: Date.now() - startTime,
      source: 'estimated',
    };
  }

  return { venue: 'RAYDIUM', outputAmount: 0, priceImpactBps: 0, latencyMs: Date.now() - startTime, error: 'All methods failed' };
}

async function fetchOrcaQuote(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<VenueQuoteResult> {
  const startTime = Date.now();
  const url = `https://api.mainnet.orca.so/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&slippage=0.5`;
  
  const response = await fetchWithFallback(url, 'ORCA');
  
  if (response) {
    try {
      const data = await response.json();
      if (data.outAmount) {
        return {
          venue: 'ORCA',
          outputAmount: parseInt(data.outAmount),
          priceImpactBps: Math.floor(parseFloat(data.priceImpactPercent || '0') * 100),
          latencyMs: Date.now() - startTime,
          source: 'direct',
        };
      }
    } catch (e) {
      console.log('[ORCA] Parse error:', e);
    }
  }

  // Fallback: estimation basée sur les prix
  const estimate = await estimateOutputFromPrices(inputMint, outputMint, amountIn);
  if (estimate) {
    return {
      venue: 'ORCA',
      outputAmount: Math.floor(estimate.outputAmount * 0.997), // 0.3% moins
      priceImpactBps: estimate.priceImpactBps,
      latencyMs: Date.now() - startTime,
      source: 'estimated',
    };
  }

  return { venue: 'ORCA', outputAmount: 0, priceImpactBps: 0, latencyMs: Date.now() - startTime, error: 'All methods failed' };
}

async function fetchMeteoraQuote(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<VenueQuoteResult> {
  const startTime = Date.now();
  const url = `https://dlmm-api.meteora.ag/pair/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&swapMode=ExactIn`;
  
  const response = await fetchWithFallback(url, 'METEORA');
  
  if (response) {
    try {
      const data = await response.json();
      if (data.outAmount) {
        return {
          venue: 'METEORA',
          outputAmount: parseInt(data.outAmount),
          priceImpactBps: Math.floor(parseFloat(data.priceImpact || '0') * 10000),
          latencyMs: Date.now() - startTime,
          source: 'direct',
        };
      }
    } catch (e) {
      console.log('[METEORA] Parse error:', e);
    }
  }

  // Fallback: estimation basée sur les prix
  const estimate = await estimateOutputFromPrices(inputMint, outputMint, amountIn);
  if (estimate) {
    return {
      venue: 'METEORA',
      outputAmount: Math.floor(estimate.outputAmount * 0.996), // 0.4% moins (DLMM spread)
      priceImpactBps: estimate.priceImpactBps,
      latencyMs: Date.now() - startTime,
      source: 'estimated',
    };
  }

  return { venue: 'METEORA', outputAmount: 0, priceImpactBps: 0, latencyMs: Date.now() - startTime, error: 'All methods failed' };
}

async function fetchPhoenixQuote(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<VenueQuoteResult> {
  const startTime = Date.now();
  // Phoenix n'a pas d'API publique simple, on va estimer
  const estimate = await estimateOutputFromPrices(inputMint, outputMint, amountIn);
  
  if (estimate) {
    return {
      venue: 'PHOENIX',
      outputAmount: Math.floor(estimate.outputAmount * 0.999), // CLOB a généralement de meilleurs spreads
      priceImpactBps: 5, // Très faible pour un CLOB
      latencyMs: Date.now() - startTime,
      source: 'estimated',
    };
  }

  return { venue: 'PHOENIX', outputAmount: 0, priceImpactBps: 0, latencyMs: Date.now() - startTime, error: 'Estimation failed' };
}

async function fetchJupiterQuote(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<VenueQuoteResult> {
  const startTime = Date.now();
  const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&slippageBps=50`;
  
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
          source: 'direct',
        };
      }
    } catch (e) {
      console.log('[JUPITER] Parse error:', e);
    }
  }

  // Fallback: estimation basée sur les prix (Jupiter est le benchmark)
  const estimate = await estimateOutputFromPrices(inputMint, outputMint, amountIn);
  if (estimate) {
    return {
      venue: 'JUPITER',
      outputAmount: estimate.outputAmount, // Jupiter = prix du marché
      priceImpactBps: estimate.priceImpactBps,
      latencyMs: Date.now() - startTime,
      source: 'estimated',
    };
  }

  return { venue: 'JUPITER', outputAmount: 0, priceImpactBps: 0, latencyMs: Date.now() - startTime, error: 'All methods failed' };
}
