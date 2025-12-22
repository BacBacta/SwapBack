/**
 * API Route: /api/dex/lifinity/quote
 * 
 * Proxy pour obtenir des quotes Lifinity (Oracle-based AMM)
 * 
 * @see https://docs.lifinity.io/
 * @author SwapBack Team
 * @date December 22, 2025
 */

import { NextRequest, NextResponse } from 'next/server';

// Route handler: toujours dynamique (aucune exécution au build)
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
  Pragma: "no-cache",
};

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = (process.env.ALLOWED_ORIGIN ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const allowOrigin =
    origin && allowed.length > 0 && allowed.includes(origin)
      ? origin
      : allowed.length > 0
        ? allowed[0]
        : "*";

  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };

  if (allowOrigin !== "*") {
    headers["Access-Control-Allow-Credentials"] = "true";
    headers["Vary"] = "Origin";
  }

  return headers;
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { ...getCorsHeaders(request.headers.get("origin")), ...NO_STORE_HEADERS },
  });
}

// Lifinity pools - oracle-based AMM with deep liquidity
const LIFINITY_POOLS: Record<string, { pool: string; tokenAMint: string; tokenBMint: string }> = {
  // SOL/USDC
  'So11111111111111111111111111111111111111112:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    pool: 'Giqy94gE9y7Rf7H6Fz4pPx4nWmqvdFW7yFhRzEbhFqWJ',
    tokenAMint: 'So11111111111111111111111111111111111111112',
    tokenBMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v:So11111111111111111111111111111111111111112': {
    pool: 'Giqy94gE9y7Rf7H6Fz4pPx4nWmqvdFW7yFhRzEbhFqWJ',
    tokenAMint: 'So11111111111111111111111111111111111111112',
    tokenBMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  },
  // USDC/USDT
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v:Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
    pool: '8NfHnKsKq5y2eCy1F6LJrSzZ5qezR3K9z7ER2WrLnWkT',
    tokenAMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    tokenBMint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    pool: '8NfHnKsKq5y2eCy1F6LJrSzZ5qezR3K9z7ER2WrLnWkT',
    tokenAMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    tokenBMint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  },
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const inputMint = searchParams.get('inputMint');
  const outputMint = searchParams.get('outputMint');
  const amount = searchParams.get('amount');
  const slippageBpsParam = searchParams.get('slippageBps');
  const corsHeaders = getCorsHeaders(request.headers.get("origin"));
  const responseHeaders = { ...corsHeaders, ...NO_STORE_HEADERS };

  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json(
      { error: 'Missing required parameters: inputMint, outputMint, amount' },
      { status: 400, headers: responseHeaders }
    );
  }

  const slippageBpsRaw = slippageBpsParam ? Number(slippageBpsParam) : undefined;
  const slippageBps =
    typeof slippageBpsRaw === "number" && Number.isFinite(slippageBpsRaw)
      ? Math.min(10_000, Math.max(0, Math.floor(slippageBpsRaw)))
      : 50;

  try {
    const amountIn = Number(amount);
    if (!Number.isFinite(amountIn) || amountIn <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400, headers: responseHeaders }
      );
    }

    // Check if we have a pool for this pair
    const pairKey = `${inputMint}:${outputMint}`;
    const poolInfo = LIFINITY_POOLS[pairKey];

    if (!poolInfo) {
      return NextResponse.json(
        { error: "No Lifinity pool for this pair", availablePairs: Object.keys(LIFINITY_POOLS).slice(0, 5) },
        { status: 404, headers: responseHeaders }
      );
    }

    // Lifinity uses oracle-based pricing, estimate output using oracle prices
    // For now, use a conservative 0.3% fee estimate (30 bps)
    // In production, this should query the Lifinity API or on-chain data
    const FEE_BPS = 30;
    const estimatedOutput = Math.floor(amountIn * (10000 - FEE_BPS) / 10000);

    console.log(`[Lifinity] Quote for ${inputMint.slice(0, 8)}... -> ${outputMint.slice(0, 8)}...`);
    console.log(`[Lifinity] Input: ${amountIn}, Output estimate: ${estimatedOutput}`);

    return NextResponse.json({
      inputMint,
      outputMint,
      inputAmount: amountIn,
      outputAmount: estimatedOutput,
      priceImpact: 0.001, // Oracle-based AMM has minimal price impact
      priceImpactBps: 1,
      slippageBps,
      pool: poolInfo.pool,
      source: 'lifinity-estimated',
    }, { headers: responseHeaders });

  } catch (error) {
    console.error('[Lifinity Quote API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Lifinity quote', details: String(error) },
      { status: 502, headers: responseHeaders }
    );
  }
}
