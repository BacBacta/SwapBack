/**
 * API Route: /api/dex/pumpswap/quote
 *
 * Quote PumpSwap AMM - Native on-chain calculation with DexScreener fallback
 * PumpSwap is the AMM for pump.fun tokens that have graduated
 * 
 * Program ID: pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA
 * 
 * Strategy:
 * 1. Try native on-chain quote (read pool reserves, calculate via constant product)
 * 2. Fall back to DexScreener API if on-chain read fails
 * 
 * @see https://docs.dexscreener.com/api/reference
 */

import { NextRequest, NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import { getPumpSwapQuote } from "../../../../../lib/dex/pumpswap";

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
  return TOKEN_DECIMALS[mint] ?? 6; // Default to 6 for pump.fun tokens
}

/**
 * Get RPC connection
 */
function getConnection(): Connection {
  // Try Helius first, then fallback to public RPC
  const heliusKey = process.env.HELIUS_API_KEY || process.env.NEXT_PUBLIC_HELIUS_API_KEY;
  const rpcUrl = heliusKey 
    ? `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`
    : process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  
  return new Connection(rpcUrl, { commitment: "confirmed" });
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

  const amountIn = BigInt(amount);
  const ZERO = BigInt(0);
  if (amountIn <= ZERO) {
    return NextResponse.json(
      { error: "Invalid amount" },
      { status: 400, headers: responseHeaders }
    );
  }

  const slippageBps = slippageBpsParam ? Math.min(10000, Math.max(0, Number(slippageBpsParam))) : 50;

  // Check if Helius is configured - only try native if we have a fast RPC
  const heliusKey = process.env.HELIUS_API_KEY || process.env.NEXT_PUBLIC_HELIUS_API_KEY;
  const hasHelius = !!heliusKey;

  // Only try native on-chain quote if we have Helius (fast RPC)
  // Otherwise skip to DexScreener to avoid slow RPC timeout
  if (hasHelius) {
    try {
      const connection = getConnection();
      
      // Add 3 second timeout to native quote
      const nativeQuotePromise = getPumpSwapQuote(
        connection,
        inputMint,
        outputMint,
        amountIn,
        slippageBps
      );
      
      const timeoutPromise = new Promise<null>((resolve) => 
        setTimeout(() => resolve(null), 3000)
      );
      
      const nativeQuote = await Promise.race([nativeQuotePromise, timeoutPromise]);

      if (nativeQuote) {
        console.log("[PumpSwap] Native on-chain quote succeeded");
        return NextResponse.json({
          inputMint: nativeQuote.inputMint,
          outputMint: nativeQuote.outputMint,
          inputAmount: nativeQuote.inputAmount.toString(),
          outputAmount: nativeQuote.outputAmount.toString(),
          minOutAmount: nativeQuote.minOutputAmount.toString(),
          priceImpactBps: nativeQuote.priceImpactBps,
          slippageBps,
          pool: nativeQuote.pool,
          feeBps: nativeQuote.feeBps,
          feeAmount: nativeQuote.feeAmount.toString(),
          baseReserve: nativeQuote.baseReserve.toString(),
          quoteReserve: nativeQuote.quoteReserve.toString(),
          source: 'pumpswap-native',
        }, { headers: responseHeaders });
      }
      
      console.log("[PumpSwap] Native quote returned null or timeout, trying DexScreener fallback");
    } catch (nativeError) {
      console.warn("[PumpSwap] Native quote failed, trying DexScreener fallback:", nativeError);
    }
  } else {
    console.log("[PumpSwap] No Helius API key, skipping native quote, using DexScreener");
  }

  // Fallback to DexScreener
  return await getDexScreenerQuote(request, inputMint, outputMint, amountIn, slippageBps, responseHeaders);
}

/**
 * DexScreener fallback for when native quote fails
 */
async function getDexScreenerQuote(
  request: NextRequest,
  inputMint: string,
  outputMint: string,
  amountIn: bigint,
  slippageBps: number,
  responseHeaders: Record<string, string>
) {
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  const lookupMint = inputMint === SOL_MINT ? outputMint : inputMint;

  try {
    // Use DexScreener to find PumpSwap pools
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

    // Filter for PumpSwap pools only
    const pumpSwapPairs = pairs.filter(p => p.dexId === 'pumpswap');

    if (pumpSwapPairs.length === 0) {
      return NextResponse.json(
        { error: "No PumpSwap pool found for this token" },
        { status: 404, headers: responseHeaders }
      );
    }

    // Find the best pool (highest liquidity)
    const bestPool = pumpSwapPairs.reduce((best, current) => {
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
    const amountInNumber = Number(amountIn);

    let outputAmount: number;
    let isBuying: boolean;

    if (inputMint === SOL_MINT) {
      // Buying token with SOL: divide by price (price is token/SOL)
      const amountInSol = amountInNumber / Math.pow(10, inputDecimals);
      const tokensOut = amountInSol / priceNative;
      outputAmount = Math.floor(tokensOut * Math.pow(10, outputDecimals));
      isBuying = true;
    } else {
      // Selling token for SOL: multiply by price
      const amountInTokens = amountInNumber / Math.pow(10, inputDecimals);
      const solOut = amountInTokens * priceNative;
      outputAmount = Math.floor(solOut * Math.pow(10, outputDecimals));
      isBuying = false;
    }

    // Calculate price impact based on trade size vs liquidity
    const liquidityUsd = bestPool.liquidity.usd || 1;
    // Estimate trade value in USD (rough: assume SOL = $130)
    const solPrice = 130;
    const tradeValueUsd = inputMint === SOL_MINT 
      ? (amountInNumber / Math.pow(10, inputDecimals)) * solPrice
      : (outputAmount / Math.pow(10, outputDecimals)) * solPrice;
    
    // Price impact: larger trades relative to liquidity have more impact
    const impactPercent = Math.min((tradeValueUsd / liquidityUsd) * 100, 50);
    const priceImpactBps = Math.floor(impactPercent * 100);

    // Apply price impact to output (reduce output for slippage)
    const outputWithImpact = Math.floor(outputAmount * (1 - impactPercent / 100));
    
    // Apply slippage for minOutAmount
    const minOutAmount = Math.floor(outputWithImpact * (1 - slippageBps / 10000));

    console.log('[PumpSwap DexScreener Fallback] Quote:', {
      pool: bestPool.pairAddress,
      priceNative,
      inputAmount: amountInNumber,
      outputAmount: outputWithImpact,
      priceImpactBps,
      liquidityUsd,
      isBuying,
    });

    return NextResponse.json({
      inputMint,
      outputMint,
      inputAmount: amountIn.toString(),
      outputAmount: outputWithImpact.toString(),
      minOutAmount: minOutAmount.toString(),
      priceImpactBps,
      slippageBps,
      pool: bestPool.pairAddress,
      liquidity: liquidityUsd,
      source: 'pumpswap-dexscreener',
      baseToken: bestPool.baseToken,
      quoteToken: bestPool.quoteToken,
    }, { headers: responseHeaders });

  } catch (e) {
    console.error("[PumpSwap Quote] Error:", e);
    return NextResponse.json(
      { 
        error: "Failed to fetch PumpSwap quote", 
        details: e instanceof Error ? e.message : String(e) 
      },
      { status: 500, headers: responseHeaders }
    );
  }
}
