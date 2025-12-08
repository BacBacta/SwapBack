import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route proxy pour récupérer les quotes des venues sans problème CORS
 * Appelle les APIs des DEX côté serveur
 */

interface VenueQuoteResult {
  venue: string;
  outputAmount: number;
  priceImpactBps: number;
  latencyMs: number;
  error?: string;
}

interface QuoteResponse {
  quotes: VenueQuoteResult[];
  jupiterBenchmark: VenueQuoteResult | null;
  bestVenue: string;
  bestOutput: number;
  timestamp: number;
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

  // Process Raydium
  if (raydiumResult.status === 'fulfilled' && raydiumResult.value) {
    quotes.push(raydiumResult.value);
  }

  // Process Orca
  if (orcaResult.status === 'fulfilled' && orcaResult.value) {
    quotes.push(orcaResult.value);
  }

  // Process Meteora
  if (meteoraResult.status === 'fulfilled' && meteoraResult.value) {
    quotes.push(meteoraResult.value);
  }

  // Process Phoenix
  if (phoenixResult.status === 'fulfilled' && phoenixResult.value) {
    quotes.push(phoenixResult.value);
  }

  // Process Jupiter (benchmark)
  if (jupiterResult.status === 'fulfilled' && jupiterResult.value) {
    jupiterBenchmark = jupiterResult.value;
  }

  // Find best venue
  const validQuotes = quotes.filter(q => q.outputAmount > 0 && !q.error);
  const bestQuote = validQuotes.reduce((best, current) => 
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
    },
  });
}

// ============================================================================
// VENUE FETCHERS
// ============================================================================

async function fetchRaydiumQuote(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<VenueQuoteResult | null> {
  const startTime = Date.now();
  try {
    const response = await fetch(
      `https://api-v3.raydium.io/compute/swap-base-in?` +
      `inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&slippageBps=50`,
      { 
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' },
      }
    );

    if (!response.ok) {
      return { venue: 'RAYDIUM', outputAmount: 0, priceImpactBps: 0, latencyMs: Date.now() - startTime, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      return { venue: 'RAYDIUM', outputAmount: 0, priceImpactBps: 0, latencyMs: Date.now() - startTime, error: 'No data' };
    }

    return {
      venue: 'RAYDIUM',
      outputAmount: parseInt(data.data.outputAmount || '0'),
      priceImpactBps: Math.floor(parseFloat(data.data.priceImpact || '0') * 100),
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    return { venue: 'RAYDIUM', outputAmount: 0, priceImpactBps: 0, latencyMs: Date.now() - startTime, error: String(error) };
  }
}

async function fetchOrcaQuote(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<VenueQuoteResult | null> {
  const startTime = Date.now();
  try {
    const response = await fetch(
      `https://api.mainnet.orca.so/v1/quote?` +
      `inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&slippage=0.5`,
      { 
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' },
      }
    );

    if (!response.ok) {
      return { venue: 'ORCA', outputAmount: 0, priceImpactBps: 0, latencyMs: Date.now() - startTime, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    if (!data.outAmount) {
      return { venue: 'ORCA', outputAmount: 0, priceImpactBps: 0, latencyMs: Date.now() - startTime, error: 'No outAmount' };
    }

    return {
      venue: 'ORCA',
      outputAmount: parseInt(data.outAmount),
      priceImpactBps: Math.floor(parseFloat(data.priceImpactPercent || '0') * 100),
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    return { venue: 'ORCA', outputAmount: 0, priceImpactBps: 0, latencyMs: Date.now() - startTime, error: String(error) };
  }
}

async function fetchMeteoraQuote(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<VenueQuoteResult | null> {
  const startTime = Date.now();
  try {
    const response = await fetch(
      `https://dlmm-api.meteora.ag/pair/quote?` +
      `inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&swapMode=ExactIn`,
      { 
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' },
      }
    );

    if (!response.ok) {
      return { venue: 'METEORA', outputAmount: 0, priceImpactBps: 0, latencyMs: Date.now() - startTime, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    if (!data.outAmount) {
      return { venue: 'METEORA', outputAmount: 0, priceImpactBps: 0, latencyMs: Date.now() - startTime, error: 'No outAmount' };
    }

    return {
      venue: 'METEORA',
      outputAmount: parseInt(data.outAmount),
      priceImpactBps: Math.floor(parseFloat(data.priceImpact || '0') * 100),
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    return { venue: 'METEORA', outputAmount: 0, priceImpactBps: 0, latencyMs: Date.now() - startTime, error: String(error) };
  }
}

async function fetchPhoenixQuote(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<VenueQuoteResult | null> {
  const startTime = Date.now();
  try {
    // Phoenix API endpoint
    const response = await fetch(
      `https://api.phoenix.trade/v1/quote?` +
      `baseMint=${inputMint}&quoteMint=${outputMint}&amount=${amountIn}&side=sell`,
      { 
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' },
      }
    );

    if (!response.ok) {
      return { venue: 'PHOENIX', outputAmount: 0, priceImpactBps: 0, latencyMs: Date.now() - startTime, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return {
      venue: 'PHOENIX',
      outputAmount: parseInt(data.expectedOutput || '0'),
      priceImpactBps: Math.floor(parseFloat(data.priceImpact || '0') * 100),
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    return { venue: 'PHOENIX', outputAmount: 0, priceImpactBps: 0, latencyMs: Date.now() - startTime, error: String(error) };
  }
}

async function fetchJupiterQuote(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<VenueQuoteResult | null> {
  const startTime = Date.now();
  try {
    const response = await fetch(
      `https://quote-api.jup.ag/v6/quote?` +
      `inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&slippageBps=50`,
      { 
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' },
      }
    );

    if (!response.ok) {
      return { venue: 'JUPITER', outputAmount: 0, priceImpactBps: 0, latencyMs: Date.now() - startTime, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    if (!data.outAmount) {
      return { venue: 'JUPITER', outputAmount: 0, priceImpactBps: 0, latencyMs: Date.now() - startTime, error: 'No outAmount' };
    }

    return {
      venue: 'JUPITER',
      outputAmount: parseInt(data.outAmount),
      priceImpactBps: Math.floor(parseFloat(data.priceImpactPct || '0') * 100),
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    return { venue: 'JUPITER', outputAmount: 0, priceImpactBps: 0, latencyMs: Date.now() - startTime, error: String(error) };
  }
}
