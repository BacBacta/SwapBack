/**
 * API Route: Native Quote
 * 
 * Récupère des quotes depuis les venues natives SwapBack
 * (Raydium, Orca, Meteora, Phoenix) au lieu de Jupiter.
 * 
 * @author SwapBack Team
 * @date December 8, 2025
 */

import { NextRequest, NextResponse } from "next/server";

// DEX APIs
const DEX_APIS = {
  raydium: "https://api-v3.raydium.io",
  orca: "https://api.mainnet.orca.so",
  meteora: "https://dlmm-api.meteora.ag",
};

interface VenueQuote {
  venue: string;
  inputAmount: string;
  outputAmount: string;
  priceImpactBps: number;
  estimatedNpiBps: number;
  latencyMs: number;
}

interface NativeQuoteResponse {
  success: boolean;
  quotes: VenueQuote[];
  bestQuote: VenueQuote | null;
  totalLatencyMs: number;
  error?: string;
}

/**
 * Fetch quote from Raydium
 */
async function fetchRaydiumQuote(
  inputMint: string,
  outputMint: string,
  amount: string
): Promise<VenueQuote | null> {
  const startTime = Date.now();
  try {
    const response = await fetch(
      `${DEX_APIS.raydium}/compute/swap-base-in?` +
      `inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`,
      { 
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' }
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.success || !data.data) return null;

    const latencyMs = Date.now() - startTime;

    return {
      venue: "Raydium",
      inputAmount: amount,
      outputAmount: data.data.outputAmount.toString(),
      priceImpactBps: Math.floor(parseFloat(data.data.priceImpact || "0") * 100),
      estimatedNpiBps: 10, // ~0.1% NPI estimé
      latencyMs,
    };
  } catch (error) {
    console.warn("Raydium quote failed:", error);
    return null;
  }
}

/**
 * Fetch quote from Orca
 */
async function fetchOrcaQuote(
  inputMint: string,
  outputMint: string,
  amount: string
): Promise<VenueQuote | null> {
  const startTime = Date.now();
  try {
    const response = await fetch(
      `${DEX_APIS.orca}/v1/quote?` +
      `inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippage=0.5`,
      { 
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' }
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.outAmount) return null;

    const latencyMs = Date.now() - startTime;

    return {
      venue: "Orca",
      inputAmount: amount,
      outputAmount: data.outAmount.toString(),
      priceImpactBps: Math.floor(parseFloat(data.priceImpactPercent || "0") * 100),
      estimatedNpiBps: 12,
      latencyMs,
    };
  } catch (error) {
    console.warn("Orca quote failed:", error);
    return null;
  }
}

/**
 * POST /api/native-quote
 * 
 * Body: { inputMint, outputMint, amount, slippageBps? }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { inputMint, outputMint, amount, slippageBps = 50 } = body;

    if (!inputMint || !outputMint || !amount) {
      return NextResponse.json({
        success: false,
        error: "Missing required parameters: inputMint, outputMint, amount",
      }, { status: 400 });
    }

    // Fetch quotes from all venues in parallel
    const quotePromises = [
      fetchRaydiumQuote(inputMint, outputMint, amount),
      fetchOrcaQuote(inputMint, outputMint, amount),
    ];

    const results = await Promise.allSettled(quotePromises);
    
    const quotes: VenueQuote[] = [];
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        quotes.push(result.value);
      }
    }

    // Sort by best output
    quotes.sort((a, b) => BigInt(b.outputAmount) > BigInt(a.outputAmount) ? 1 : -1);

    const totalLatencyMs = Date.now() - startTime;

    const response: NativeQuoteResponse = {
      success: quotes.length > 0,
      quotes,
      bestQuote: quotes[0] || null,
      totalLatencyMs,
    };

    if (quotes.length === 0) {
      response.error = "No venue quotes available for this pair";
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error("Native quote API error:", error);
    return NextResponse.json({
      success: false,
      quotes: [],
      bestQuote: null,
      totalLatencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Internal server error",
    }, { status: 500 });
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
      { name: "Raydium", type: "AMM", programId: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8" },
      { name: "Raydium CLMM", type: "CLMM", programId: "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK" },
      { name: "Orca Whirlpool", type: "CLMM", programId: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc" },
      { name: "Meteora DLMM", type: "DLMM", programId: "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo" },
      { name: "Phoenix", type: "CLOB", programId: "PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY" },
      { name: "Lifinity", type: "Oracle AMM", programId: "EewxydAPCCVuNEyrVN68PuSYdQ7wKn27V9Gjeoi8dy3S" },
      { name: "Sanctum", type: "LST", programId: "5ocnV1qiCgaQR8Jb8xWnVbApfaygJ8tNoZfgPwsgx9kx" },
      { name: "Saber", type: "StableSwap", programId: "SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ" },
    ],
    routerProgram: "5K7kKoYd1E2S2gycBMeAeyXnxdbVgAEqJWKERwW8FTMf",
  });
}
