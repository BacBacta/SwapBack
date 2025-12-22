/**
 * API Route: /api/dex/launchlab/quote
 *
 * Quote LaunchLab (Raydium) via DexScreener API
 * LaunchLab is Raydium's token launch platform with bonding curves
 * Similar to pump.fun but powered by Raydium
 * 
 * @see https://docs.raydium.io/raydium/pool-creation/launchlab
 * @see https://docs.dexscreener.com/api/reference
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
  Pragma: "no-cache",
};

// Token decimals lookup
const TOKEN_DECIMALS: Record<string, number> = {
  'So11111111111111111111111111111111111111112': 9,  // SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6, // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 6, // USDT
};

function getTokenDecimals(mint: string): number {
  return TOKEN_DECIMALS[mint] ?? 6; // Default to 6 for LaunchLab tokens
}

function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGIN || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getCorsHeaders(request?: NextRequest): Record<string, string> {
  const requestOrigin = request?.headers.get("origin") ?? "";
  const allowed = getAllowedOrigins();

  const originAllowed = requestOrigin && (allowed.length === 0 || allowed.includes(requestOrigin));
  const allowOrigin = originAllowed
    ? requestOrigin
    : allowed.length > 0
      ? allowed[0]
      : "*";

  const allowCredentials = allowOrigin !== "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With",
    ...(allowCredentials ? { "Access-Control-Allow-Credentials": "true" } : {}),
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { ...getCorsHeaders(request), ...NO_STORE_HEADERS },
  });
}

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd?: string;
  liquidity?: { usd: number; base: number; quote: number };
  volume?: { h24: number };
  fdv?: number;
}

export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);
  const responseHeaders = { ...corsHeaders, ...NO_STORE_HEADERS };
  const searchParams = request.nextUrl.searchParams;
  const inputMint = searchParams.get("inputMint");
  const outputMint = searchParams.get("outputMint");
  const amount = searchParams.get("amount");
  const slippageBpsParam = searchParams.get("slippageBps");

  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json(
      { error: "Missing required parameters: inputMint, outputMint, amount" },
      { status: 400, headers: responseHeaders }
    );
  }

  const amountIn = Number(amount);
  if (!Number.isFinite(amountIn) || amountIn <= 0) {
    return NextResponse.json(
      { error: "Invalid amount" },
      { status: 400, headers: responseHeaders }
    );
  }

  const slippageBps = slippageBpsParam ? Math.min(10000, Math.max(0, Number(slippageBpsParam))) : 50;

  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  
  // LaunchLab typically pairs tokens against SOL
  // Determine which token to look up (the non-SOL token)
  const lookupMint = inputMint === SOL_MINT ? outputMint : inputMint;

  try {
    // Use DexScreener to find LaunchLab pools
    const response = await fetch(
      `https://api.dexscreener.com/tokens/v1/solana/${lookupMint}`,
      {
        headers: { Accept: 'application/json', 'User-Agent': 'SwapBack/1.0' },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "DexScreener API unavailable", status: response.status },
        { status: 502, headers: responseHeaders }
      );
    }

    const pairs: DexScreenerPair[] = await response.json();

    // Filter for LaunchLab pools only
    const launchlabPairs = pairs.filter(p => p.dexId === 'launchlab');

    if (launchlabPairs.length === 0) {
      return NextResponse.json(
        { error: "No LaunchLab pool found for this token" },
        { status: 404, headers: responseHeaders }
      );
    }

    // Find the best pool (highest liquidity)
    const bestPool = launchlabPairs.reduce((best, current) => {
      const currentLiq = current.liquidity?.usd || 0;
      const bestLiq = best.liquidity?.usd || 0;
      return currentLiq > bestLiq ? current : best;
    });

    if (!bestPool.priceNative || !bestPool.liquidity) {
      return NextResponse.json(
        { error: "Insufficient pool data from DexScreener" },
        { status: 404, headers: responseHeaders }
      );
    }

    // Calculate quote based on price and direction
    const priceNative = parseFloat(bestPool.priceNative);
    const inputDecimals = getTokenDecimals(inputMint);
    const outputDecimals = getTokenDecimals(outputMint);

    let outputAmount: number;
    let isBuying: boolean;

    if (inputMint === SOL_MINT) {
      // Buying token with SOL: divide by price (price is token/SOL)
      const amountInSol = amountIn / Math.pow(10, inputDecimals);
      const tokensOut = amountInSol / priceNative;
      outputAmount = Math.floor(tokensOut * Math.pow(10, outputDecimals));
      isBuying = true;
    } else {
      // Selling token for SOL: multiply by price
      const amountInTokens = amountIn / Math.pow(10, inputDecimals);
      const solOut = amountInTokens * priceNative;
      outputAmount = Math.floor(solOut * Math.pow(10, outputDecimals));
      isBuying = false;
    }

    // Calculate price impact based on trade size vs liquidity
    const liquidityUsd = bestPool.liquidity.usd || 1;
    // Estimate trade value in USD (rough: assume SOL = $130)
    const solPrice = 130;
    const tradeValueUsd = inputMint === SOL_MINT 
      ? (amountIn / Math.pow(10, inputDecimals)) * solPrice
      : (outputAmount / Math.pow(10, outputDecimals)) * solPrice;
    
    // Price impact: larger trades relative to liquidity have more impact
    const impactPercent = Math.min((tradeValueUsd / liquidityUsd) * 100, 50);
    const priceImpactBps = Math.floor(impactPercent * 100);

    // Apply price impact to output (reduce output for slippage)
    const outputWithImpact = Math.floor(outputAmount * (1 - impactPercent / 100));
    
    // Apply slippage for minOutAmount
    const minOutAmount = Math.floor(outputWithImpact * (1 - slippageBps / 10000));

    console.log('[LaunchLab] Quote:', {
      pool: bestPool.pairAddress,
      priceNative,
      inputAmount: amountIn,
      outputAmount: outputWithImpact,
      priceImpactBps,
      liquidityUsd,
      isBuying,
    });

    return NextResponse.json({
      inputMint,
      outputMint,
      inputAmount: amountIn,
      outputAmount: outputWithImpact,
      minOutAmount,
      priceImpactBps,
      slippageBps,
      pool: bestPool.pairAddress,
      liquidity: liquidityUsd,
      source: 'launchlab-dexscreener',
      baseToken: bestPool.baseToken,
      quoteToken: bestPool.quoteToken,
    }, { headers: responseHeaders });

  } catch (e) {
    console.error("[LaunchLab Quote] Error:", e);
    return NextResponse.json(
      { 
        error: "Failed to fetch LaunchLab quote", 
        details: e instanceof Error ? e.message : String(e) 
      },
      { status: 500, headers: responseHeaders }
    );
  }
}
