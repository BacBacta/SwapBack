/**
 * API Route: Unified Quote Aggregator
 * 
 * ENDPOINT UNIFIÉ qui combine:
 * - /api/venue-quotes (quotes natives DEX)
 * - /api/swap/quote (Jupiter + routing)
 * 
 * Ce endpoint est la source de vérité unique pour toutes les quotes.
 * Il utilise les routes internes /api/dex/* qui sont proxyfiées et fonctionnent.
 * 
 * @author SwapBack Team
 * @date December 22, 2025
 * 
 * Ref: docs/ai/solana-native-router-a2z.md
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getQuoteAggregator, calculateNetOutAmount } from "@/lib/quotes/multiSourceAggregator";
import type { QuoteResult } from "@/lib/quotes/multiSourceAggregator";
import { calculateNpiOpportunity } from "@/lib/rebates/npiEngine";
import { getTokenByMint } from "@/constants/tokens";
import type { JupiterQuoteResponse } from "@/types/router";

// ============================================================================
// TYPES
// ============================================================================

interface UnifiedQuoteRequest {
  inputMint: string;
  outputMint: string;
  amount: number; // en lamports/smallest unit
  slippageBps?: number;
  userPublicKey?: string;
  forceFresh?: boolean;
  /** Si true, inclut toutes les quotes des venues (pas seulement la meilleure) */
  includeAllVenues?: boolean;
}

interface VenueQuote {
  venue: string;
  outputAmount: string;
  outputAmountHuman: number;
  priceImpactBps: number;
  latencyMs: number;
  improvementBps?: number;
  netOutAmount?: string;
  rebateAmount?: string;
  source: 'api' | 'sdk' | 'estimated' | 'cache';
  error?: string;
}

interface UnifiedQuoteResponse {
  success: boolean;
  
  // Best quote (pour exécution immédiate)
  quote: JupiterQuoteResponse | null;
  bestSource: string;
  
  // Toutes les quotes par venue (pour affichage comparatif)
  venueQuotes: VenueQuote[];
  
  // Jupiter comme benchmark
  jupiterBenchmark: VenueQuote | null;
  
  // Meilleure venue native (hors Jupiter)
  bestNativeVenue: string | null;
  bestNativeOutput: number;
  
  // NPI et rebates
  npiOpportunity: {
    hasOpportunity: boolean;
    estimatedNpiBps: number;
    estimatedRebateBps: number;
    estimatedRebateUsd: number;
  } | null;
  
  // Métadonnées
  fromCache: boolean;
  totalLatencyMs: number;
  timestamp: number;
  
  // Debug info
  debug?: {
    sourcesQueried: string[];
    sourcesSucceeded: string[];
    sourcesFailed: string[];
  };
  
  error?: string;
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

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
    ...(allowOrigin !== '*' ? { 
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin'
    } : {}),
  };
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

/**
 * GET /api/quotes - Quick quote lookup (compatible avec venue-quotes)
 */
export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin'));
  const { searchParams } = new URL(request.url);
  
  const inputMint = searchParams.get('inputMint');
  const outputMint = searchParams.get('outputMint');
  const amount = searchParams.get('amount');
  const slippageBps = parseInt(searchParams.get('slippageBps') || '50');
  const includeAllVenues = searchParams.get('includeAllVenues') !== 'false';
  
  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json(
      { success: false, error: 'Missing required parameters: inputMint, outputMint, amount' },
      { status: 400, headers: corsHeaders }
    );
  }
  
  const amountNum = parseInt(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return NextResponse.json(
      { success: false, error: 'Invalid amount' },
      { status: 400, headers: corsHeaders }
    );
  }
  
  return handleQuoteRequest({
    inputMint,
    outputMint,
    amount: amountNum,
    slippageBps,
    includeAllVenues,
  }, corsHeaders);
}

/**
 * POST /api/quotes - Full quote with options (compatible avec swap/quote)
 */
export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin'));
  
  try {
    const body: UnifiedQuoteRequest = await request.json();
    
    if (!body.inputMint || !body.outputMint || !body.amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: inputMint, outputMint, amount' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    if (body.amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid amount' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    return handleQuoteRequest({
      ...body,
      slippageBps: body.slippageBps ?? 50,
      includeAllVenues: body.includeAllVenues ?? true,
    }, corsHeaders);
  } catch (error) {
    console.error('[quotes] Error parsing request:', error);
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400, headers: corsHeaders }
    );
  }
}

// ============================================================================
// MAIN QUOTE HANDLER
// ============================================================================

async function handleQuoteRequest(
  params: UnifiedQuoteRequest,
  corsHeaders: Record<string, string>
): Promise<NextResponse> {
  const startTime = Date.now();
  
  console.log(`[quotes] Fetching unified quotes for ${params.inputMint.slice(0,8)}... -> ${params.outputMint.slice(0,8)}..., amount: ${params.amount}`);
  
  try {
    // Get token info for decimals
    const inputToken = getTokenByMint(params.inputMint);
    const outputToken = getTokenByMint(params.outputMint);
    const inputDecimals = inputToken?.decimals ?? 9;
    const outputDecimals = outputToken?.decimals ?? 6;
    
    // Calculate human-readable amount
    const amountTokens = params.amount / Math.pow(10, inputDecimals);
    
    // Get aggregator
    const aggregator = getQuoteAggregator();
    
    // Fetch best quote using multi-source aggregator
    const aggregatedResult = await aggregator.getBestQuote({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amountTokens,
      amountLamports: params.amount,
      inputDecimals,
      outputDecimals,
      slippageBps: params.slippageBps ?? 50,
      userPublicKey: params.userPublicKey,
      bypassCache: params.forceFresh,
    });
    
    // Process venue quotes
    const venueQuotes: VenueQuote[] = [];
    let jupiterBenchmark: VenueQuote | null = null;
    let bestNativeVenue: string | null = null;
    let bestNativeOutput = 0;
    
    const sourcesQueried: string[] = [];
    const sourcesSucceeded: string[] = [];
    const sourcesFailed: string[] = [];
    
    for (const result of aggregatedResult.alternativeQuotes) {
      sourcesQueried.push(result.source);
      
      if (result.error || !result.quote) {
        sourcesFailed.push(result.source);
        if (params.includeAllVenues) {
          venueQuotes.push({
            venue: result.source.toUpperCase(),
            outputAmount: '0',
            outputAmountHuman: 0,
            priceImpactBps: 0,
            latencyMs: result.latencyMs,
            source: 'api',
            error: result.error || 'No quote available',
          });
        }
        continue;
      }
      
      sourcesSucceeded.push(result.source);
      
      const outputAmount = BigInt(result.quote.outAmount);
      const outputAmountHuman = Number(outputAmount) / Math.pow(10, outputDecimals);
      const priceImpactBps = Math.floor(parseFloat(result.quote.priceImpactPct || '0') * 100);
      
      const venueQuote: VenueQuote = {
        venue: result.source.toUpperCase(),
        outputAmount: result.quote.outAmount,
        outputAmountHuman,
        priceImpactBps,
        latencyMs: result.latencyMs,
        improvementBps: result.improvementBps,
        netOutAmount: result.netOutAmount,
        rebateAmount: result.rebateAmount,
        source: aggregatedResult.fromCache ? 'cache' : 'api',
      };
      
      if (result.source === 'jupiter') {
        jupiterBenchmark = venueQuote;
      } else {
        venueQuotes.push(venueQuote);
        
        // Track best native venue
        if (outputAmountHuman > bestNativeOutput) {
          bestNativeOutput = outputAmountHuman;
          bestNativeVenue = result.source.toUpperCase();
        }
      }
    }
    
    // Sort venues by output amount (descending)
    venueQuotes.sort((a, b) => b.outputAmountHuman - a.outputAmountHuman);
    
    // Calculate NPI opportunity
    let npiOpportunity = null;
    if (jupiterBenchmark && bestNativeOutput > 0) {
      const jupiterOutput = jupiterBenchmark.outputAmountHuman;
      if (bestNativeOutput > jupiterOutput) {
        const improvementPct = (bestNativeOutput - jupiterOutput) / jupiterOutput;
        const estimatedNpiBps = Math.floor(improvementPct * 10000);
        const estimatedRebateBps = Math.floor(estimatedNpiBps * 0.7); // 70% rebate
        
        // Rough USD estimation (assuming output is USDC-like for common pairs)
        const estimatedRebateUsd = (bestNativeOutput - jupiterOutput) * 0.7;
        
        npiOpportunity = {
          hasOpportunity: estimatedNpiBps > 0,
          estimatedNpiBps,
          estimatedRebateBps,
          estimatedRebateUsd,
        };
      }
    }
    
    // If no NPI calculated but we have a quote, try using the NPI engine
    if (!npiOpportunity && aggregatedResult.bestQuote) {
      try {
        const npiCalc = calculateNpiOpportunity({
          quote: aggregatedResult.bestQuote,
          jupiterBenchmark: jupiterBenchmark ? {
            outAmount: jupiterBenchmark.outputAmount,
          } : undefined,
          source: aggregatedResult.source,
        });
        
        if (npiCalc && npiCalc.hasOpportunity) {
          npiOpportunity = {
            hasOpportunity: true,
            estimatedNpiBps: npiCalc.npiBps || 0,
            estimatedRebateBps: npiCalc.rebateBps || 0,
            estimatedRebateUsd: npiCalc.rebateUsd || 0,
          };
        }
      } catch {
        // NPI calculation failed, continue without it
      }
    }
    
    const response: UnifiedQuoteResponse = {
      success: true,
      quote: aggregatedResult.bestQuote,
      bestSource: aggregatedResult.source,
      venueQuotes,
      jupiterBenchmark,
      bestNativeVenue,
      bestNativeOutput,
      npiOpportunity,
      fromCache: aggregatedResult.fromCache,
      totalLatencyMs: Date.now() - startTime,
      timestamp: Date.now(),
      debug: {
        sourcesQueried,
        sourcesSucceeded,
        sourcesFailed,
      },
    };
    
    console.log(`[quotes] Success: best=${aggregatedResult.source}, venues=${sourcesSucceeded.length}/${sourcesQueried.length}, latency=${response.totalLatencyMs}ms`);
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        ...corsHeaders,
      },
    });
    
  } catch (error) {
    console.error('[quotes] Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      success: false,
      quote: null,
      bestSource: 'none',
      venueQuotes: [],
      jupiterBenchmark: null,
      bestNativeVenue: null,
      bestNativeOutput: 0,
      npiOpportunity: null,
      fromCache: false,
      totalLatencyMs: Date.now() - startTime,
      timestamp: Date.now(),
      error: errorMessage,
    } as UnifiedQuoteResponse, {
      status: 500,
      headers: corsHeaders,
    });
  }
}
