/**
 * API Route: Native Quote
 * 
 * Récupère des quotes depuis les venues natives SwapBack
 * (Raydium, Orca, Meteora, Phoenix) au lieu de Jupiter.
 * 
 * Fonctionnalités:
 * - Quotes temps réel depuis les APIs DEX
 * - Fallback via /api/price pour les tokens sans quote
 * - Support du slippage personnalisé
 * - Flag isFallback pour identifier les quotes estimées
 * 
 * @author SwapBack Team
 * @date December 8, 2025
 */

import { NextRequest, NextResponse } from "next/server";

// Headers CORS
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
  'Access-Control-Allow-Credentials': 'true',
};

// DEX APIs
const DEX_APIS = {
  raydium: "https://api-v3.raydium.io",
  orca: "https://api.mainnet.orca.so",
  meteora: "https://dlmm-api.meteora.ag",
  // Phoenix nécessite un SDK, on utilise une estimation basée sur les prix
};

// Tokens connus avec leurs décimales
const KNOWN_DECIMALS: Record<string, number> = {
  'So11111111111111111111111111111111111111112': 9,  // SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6, // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 6, // USDT
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 9,  // mSOL
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 5, // BONK
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 6,  // JUP
};

interface VenueQuote {
  venue: string;
  inputAmount: string;
  outputAmount: string;
  priceImpactBps: number;
  estimatedNpiBps: number;
  latencyMs: number;
  isFallback: boolean;  // true si quote estimée via /api/price
  source: 'direct' | 'estimated';
}

interface NativeQuoteResponse {
  success: boolean;
  quotes: VenueQuote[];
  bestQuote: VenueQuote | null;
  totalLatencyMs: number;
  error?: string;
  failedVenues?: string[];
}

/**
 * Handler OPTIONS pour les preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * Récupère le prix d'un token via l'API /api/price interne
 */
async function getTokenPrice(mint: string): Promise<number> {
  try {
    // Construire l'URL de l'API interne
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    
    const response = await fetch(`${baseUrl}/api/price?mint=${mint}`, {
      signal: AbortSignal.timeout(5000),
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.price > 0) {
        console.log(`[native-quote] Price for ${mint.slice(0, 8)}...: $${data.price} (source: ${data.source})`);
        return data.price;
      }
    }
  } catch (error) {
    console.warn(`[native-quote] Failed to get price for ${mint}:`, error);
  }
  return 0;
}

/**
 * Génère une quote de fallback basée sur les prix du marché
 */
async function generateFallbackQuote(
  venue: string,
  inputMint: string,
  outputMint: string,
  amount: string,
  spreadBps: number = 30 // 0.3% spread conservateur
): Promise<VenueQuote | null> {
  const startTime = Date.now();
  
  try {
    const [inputPrice, outputPrice] = await Promise.all([
      getTokenPrice(inputMint),
      getTokenPrice(outputMint),
    ]);
    
    if (inputPrice <= 0 || outputPrice <= 0) {
      console.log(`[native-quote] Cannot generate fallback for ${venue}: missing prices`);
      return null;
    }
    
    const inputDecimals = KNOWN_DECIMALS[inputMint] ?? 9;
    const outputDecimals = KNOWN_DECIMALS[outputMint] ?? 6;
    
    const inputAmountNum = BigInt(amount);
    const inputNormalized = Number(inputAmountNum) / Math.pow(10, inputDecimals);
    const inputValueUsd = inputNormalized * inputPrice;
    const outputNormalized = inputValueUsd / outputPrice;
    
    // Appliquer le spread conservateur
    const outputWithSpread = outputNormalized * (10000 - spreadBps) / 10000;
    const outputAmount = Math.floor(outputWithSpread * Math.pow(10, outputDecimals));
    
    console.log(`[native-quote] Generated fallback for ${venue}: ${inputNormalized} -> ${outputWithSpread} (spread: ${spreadBps}bps)`);
    
    return {
      venue,
      inputAmount: amount,
      outputAmount: outputAmount.toString(),
      priceImpactBps: spreadBps,
      estimatedNpiBps: 0, // Pas de NPI pour les fallbacks
      latencyMs: Date.now() - startTime,
      isFallback: true,
      source: 'estimated',
    };
  } catch (error) {
    console.warn(`[native-quote] Fallback generation failed for ${venue}:`, error);
    return null;
  }
}

/**
 * Fetch quote from Raydium
 */
async function fetchRaydiumQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number
): Promise<VenueQuote | null> {
  const startTime = Date.now();
  try {
    const response = await fetch(
      `${DEX_APIS.raydium}/compute/swap-base-in?` +
      `inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`,
      { 
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' }
      }
    );

    if (!response.ok) {
      console.log(`[native-quote] Raydium returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data.success || !data.data?.outputAmount) {
      console.log(`[native-quote] Raydium invalid response:`, data);
      return null;
    }

    const latencyMs = Date.now() - startTime;
    console.log(`[native-quote] Raydium quote: ${data.data.outputAmount} (${latencyMs}ms)`);

    return {
      venue: "Raydium",
      inputAmount: amount,
      outputAmount: data.data.outputAmount.toString(),
      priceImpactBps: Math.floor(parseFloat(data.data.priceImpact || "0") * 100),
      estimatedNpiBps: 0, // Sera calculé par le router
      latencyMs,
      isFallback: false,
      source: 'direct',
    };
  } catch (error) {
    console.warn("[native-quote] Raydium quote failed:", error);
    return null;
  }
}

/**
 * Fetch quote from Orca
 */
async function fetchOrcaQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number
): Promise<VenueQuote | null> {
  const startTime = Date.now();
  try {
    const slippagePercent = slippageBps / 100;
    const response = await fetch(
      `${DEX_APIS.orca}/v1/quote?` +
      `inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippage=${slippagePercent}`,
      { 
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' }
      }
    );

    if (!response.ok) {
      console.log(`[native-quote] Orca returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data.outAmount) {
      console.log(`[native-quote] Orca invalid response:`, data);
      return null;
    }

    const latencyMs = Date.now() - startTime;
    console.log(`[native-quote] Orca quote: ${data.outAmount} (${latencyMs}ms)`);

    return {
      venue: "Orca",
      inputAmount: amount,
      outputAmount: data.outAmount.toString(),
      priceImpactBps: Math.floor(parseFloat(data.priceImpactPercent || data.priceImpact || "0") * 100),
      estimatedNpiBps: 0,
      latencyMs,
      isFallback: false,
      source: 'direct',
    };
  } catch (error) {
    console.warn("[native-quote] Orca quote failed:", error);
    return null;
  }
}

/**
 * Fetch quote from Meteora DLMM
 */
async function fetchMeteoraQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number
): Promise<VenueQuote | null> {
  const startTime = Date.now();
  try {
    const response = await fetch(
      `${DEX_APIS.meteora}/pair/quote?` +
      `inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&swapMode=ExactIn&slippageBps=${slippageBps}`,
      { 
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' }
      }
    );

    if (!response.ok) {
      console.log(`[native-quote] Meteora returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data.outAmount) {
      console.log(`[native-quote] Meteora invalid response:`, data);
      return null;
    }

    const latencyMs = Date.now() - startTime;
    console.log(`[native-quote] Meteora quote: ${data.outAmount} (${latencyMs}ms)`);

    return {
      venue: "Meteora",
      inputAmount: amount,
      outputAmount: data.outAmount.toString(),
      priceImpactBps: Math.floor(parseFloat(data.priceImpact || "0") * 10000),
      estimatedNpiBps: 0,
      latencyMs,
      isFallback: false,
      source: 'direct',
    };
  } catch (error) {
    console.warn("[native-quote] Meteora quote failed:", error);
    return null;
  }
}

/**
 * Phoenix n'a pas d'API publique simple, on génère un fallback via /api/price
 * Note: Pour une implémentation complète, utiliser @ellipsis-labs/phoenix-sdk
 */
async function fetchPhoenixQuote(
  inputMint: string,
  outputMint: string,
  amount: string
): Promise<VenueQuote | null> {
  // Phoenix = CLOB avec généralement de meilleurs spreads
  // Mais sans API publique, on utilise un fallback avec spread minimal
  return generateFallbackQuote("Phoenix", inputMint, outputMint, amount, 15); // 0.15% spread
}

/**
 * POST /api/native-quote
 * 
 * Body: { inputMint, outputMint, amount, slippageBps? }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const failedVenues: string[] = [];

  try {
    const body = await request.json();
    const { inputMint, outputMint, amount, slippageBps = 50 } = body;

    if (!inputMint || !outputMint || !amount) {
      return NextResponse.json({
        success: false,
        error: "Missing required parameters: inputMint, outputMint, amount",
      }, { status: 400, headers: CORS_HEADERS });
    }

    console.log(`[native-quote] Fetching quotes for ${inputMint.slice(0, 8)}... -> ${outputMint.slice(0, 8)}..., amount: ${amount}, slippage: ${slippageBps}bps`);

    // Fetch quotes from all venues in parallel
    const quotePromises = [
      fetchRaydiumQuote(inputMint, outputMint, amount, slippageBps),
      fetchOrcaQuote(inputMint, outputMint, amount, slippageBps),
      fetchMeteoraQuote(inputMint, outputMint, amount, slippageBps),
      fetchPhoenixQuote(inputMint, outputMint, amount),
    ];

    const venueNames = ["Raydium", "Orca", "Meteora", "Phoenix"];
    const results = await Promise.allSettled(quotePromises);
    
    const quotes: VenueQuote[] = [];
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const venueName = venueNames[i];
      
      if (result.status === "fulfilled" && result.value) {
        quotes.push(result.value);
      } else {
        failedVenues.push(venueName);
        console.log(`[native-quote] ${venueName} failed:`, result.status === 'rejected' ? result.reason : 'null response');
      }
    }

    // FALLBACK: Si pas de quotes directes, générer des quotes via /api/price
    if (quotes.filter(q => !q.isFallback).length === 0) {
      console.log(`[native-quote] No direct quotes, generating fallbacks via /api/price...`);
      
      const fallbackPromises = venueNames
        .filter(v => !quotes.find(q => q.venue === v))
        .map(venue => generateFallbackQuote(venue, inputMint, outputMint, amount, 30));
      
      const fallbackResults = await Promise.allSettled(fallbackPromises);
      
      for (const result of fallbackResults) {
        if (result.status === "fulfilled" && result.value) {
          quotes.push(result.value);
        }
      }
    }

    // Sort by best output (descending)
    quotes.sort((a, b) => {
      const aOutput = BigInt(a.outputAmount);
      const bOutput = BigInt(b.outputAmount);
      return bOutput > aOutput ? 1 : bOutput < aOutput ? -1 : 0;
    });

    const totalLatencyMs = Date.now() - startTime;

    console.log(`[native-quote] Final result: ${quotes.length} quotes, best: ${quotes[0]?.venue || 'none'}, latency: ${totalLatencyMs}ms`);

    const response: NativeQuoteResponse = {
      success: quotes.length > 0,
      quotes,
      bestQuote: quotes[0] || null,
      totalLatencyMs,
      failedVenues: failedVenues.length > 0 ? failedVenues : undefined,
    };

    if (quotes.length === 0) {
      response.error = "No venue quotes available for this pair";
    }

    return NextResponse.json(response, { headers: CORS_HEADERS });

  } catch (error) {
    console.error("[native-quote] API error:", error);
    return NextResponse.json({
      success: false,
      quotes: [],
      bestQuote: null,
      totalLatencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Internal server error",
      failedVenues,
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * GET /api/native-quote/venues
 * 
 * Returns list of supported venues
 */
export async function GET() {
  return NextResponse.json({
    venues: [
      { name: "Raydium", type: "AMM", programId: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", apiAvailable: true },
      { name: "Raydium CLMM", type: "CLMM", programId: "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK", apiAvailable: true },
      { name: "Orca Whirlpool", type: "CLMM", programId: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc", apiAvailable: true },
      { name: "Meteora DLMM", type: "DLMM", programId: "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo", apiAvailable: true },
      { name: "Phoenix", type: "CLOB", programId: "PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY", apiAvailable: false, note: "Fallback estimation only" },
      { name: "Lifinity", type: "Oracle AMM", programId: "EewxydAPCCVuNEyrVN68PuSYdQ7wKn27V9Gjeoi8dy3S", apiAvailable: false },
      { name: "Sanctum", type: "LST", programId: "5ocnV1qiCgaQR8Jb8xWnVbApfaygJ8tNoZfgPwsgx9kx", apiAvailable: false },
      { name: "Saber", type: "StableSwap", programId: "SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ", apiAvailable: false },
    ],
    routerProgram: "FuzLkp1G7v39XXxobvr5pnGk7xZucBUroa215LrCjsAg",
    fallbackEnabled: true,
    fallbackSource: "/api/price (Jupiter/Birdeye/DexScreener)",
  }, { headers: CORS_HEADERS });
}
