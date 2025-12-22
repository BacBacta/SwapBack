/**
 * API Route: /api/dex/saber/quote
 * 
 * Proxy pour obtenir des quotes Saber (StableSwap AMM)
 * Optimisé pour les paires stables avec frais très bas (4 bps)
 * 
 * @see https://docs.saber.so/
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

// Token decimals for supported stablecoins and LSTs
const TOKEN_DECIMALS: Record<string, number> = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6,  // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 6,  // USDT
  'So11111111111111111111111111111111111111112': 9,   // SOL (wrapped)
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 9,  // mSOL
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1': 9,  // bSOL
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': 9, // jitoSOL
  '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj': 9, // stSOL
};

// Saber pools - StableSwap with very low fees (4 bps)
// These are the main stable pairs on Saber
const SABER_POOLS: Record<string, { 
  pool: string; 
  tokenAMint: string; 
  tokenBMint: string; 
  feeBps: number;
  type: 'stable' | 'lst';
}> = {
  // USDC/USDT - Main stablecoin pair
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v:Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
    pool: '2wAXj7rF2wF9xKgZKcsMJgPQBzVP6b2pCCMvbAD2x6PJ',
    tokenAMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    tokenBMint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    feeBps: 4,
    type: 'stable',
  },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    pool: '2wAXj7rF2wF9xKgZKcsMJgPQBzVP6b2pCCMvbAD2x6PJ',
    tokenAMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    tokenBMint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    feeBps: 4,
    type: 'stable',
  },
  // SOL/mSOL - Liquid staking pair via Saber wSOL-mSOL pool
  'So11111111111111111111111111111111111111112:mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': {
    pool: 'Lee1XZJfJ9Hm2K1qTyeCz1LXNc1YBZaKZszvNY4KCDw',
    tokenAMint: 'So11111111111111111111111111111111111111112',
    tokenBMint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
    feeBps: 4,
    type: 'lst',
  },
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So:So11111111111111111111111111111111111111112': {
    pool: 'Lee1XZJfJ9Hm2K1qTyeCz1LXNc1YBZaKZszvNY4KCDw',
    tokenAMint: 'So11111111111111111111111111111111111111112',
    tokenBMint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
    feeBps: 4,
    type: 'lst',
  },
  // SOL/bSOL
  'So11111111111111111111111111111111111111112:bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1': {
    pool: 'SoLYBLzHpJPEaqcuRwKrRYjGH4sTKX7JVdCvPvFrGLz',
    tokenAMint: 'So11111111111111111111111111111111111111112',
    tokenBMint: 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1',
    feeBps: 4,
    type: 'lst',
  },
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1:So11111111111111111111111111111111111111112': {
    pool: 'SoLYBLzHpJPEaqcuRwKrRYjGH4sTKX7JVdCvPvFrGLz',
    tokenAMint: 'So11111111111111111111111111111111111111112',
    tokenBMint: 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1',
    feeBps: 4,
    type: 'lst',
  },
};

// LST exchange rates (approximate, should be fetched from on-chain in production)
const LST_RATES: Record<string, number> = {
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 1.08,  // 1 mSOL = ~1.08 SOL
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1': 1.05,  // 1 bSOL = ~1.05 SOL
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': 1.06, // 1 jitoSOL = ~1.06 SOL
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
    const poolInfo = SABER_POOLS[pairKey];

    if (!poolInfo) {
      return NextResponse.json(
        { error: "No Saber pool for this pair", availablePairs: Object.keys(SABER_POOLS).slice(0, 5) },
        { status: 404, headers: responseHeaders }
      );
    }

    let estimatedOutput: number;
    
    if (poolInfo.type === 'stable') {
      // Stablecoin swap - 1:1 minus fees
      // Adjust for decimal differences
      const inputDecimals = TOKEN_DECIMALS[inputMint] || 6;
      const outputDecimals = TOKEN_DECIMALS[outputMint] || 6;
      
      // Convert to normalized amount then to output decimals
      const normalizedAmount = amountIn / Math.pow(10, inputDecimals);
      const rawOutput = normalizedAmount * Math.pow(10, outputDecimals);
      
      // Apply Saber's low fee (4 bps = 0.04%)
      estimatedOutput = Math.floor(rawOutput * (10000 - poolInfo.feeBps) / 10000);
    } else {
      // LST swap - apply exchange rate
      const isInputLST = LST_RATES[inputMint] !== undefined;
      const isOutputLST = LST_RATES[outputMint] !== undefined;
      
      const inputDecimals = TOKEN_DECIMALS[inputMint] || 9;
      const outputDecimals = TOKEN_DECIMALS[outputMint] || 9;
      
      // Convert to SOL equivalent
      const inputInSol = amountIn / Math.pow(10, inputDecimals);
      let solEquivalent: number;
      
      if (isInputLST) {
        // Converting LST to SOL
        solEquivalent = inputInSol * (LST_RATES[inputMint] || 1);
      } else {
        // Converting SOL to LST
        solEquivalent = inputInSol;
      }
      
      // Convert to output
      let outputAmount: number;
      if (isOutputLST) {
        // Getting LST from SOL
        outputAmount = solEquivalent / (LST_RATES[outputMint] || 1);
      } else {
        // Getting SOL from LST
        outputAmount = solEquivalent;
      }
      
      // Apply fees and convert to lamports
      const rawOutput = outputAmount * Math.pow(10, outputDecimals);
      estimatedOutput = Math.floor(rawOutput * (10000 - poolInfo.feeBps) / 10000);
    }

    console.log(`[Saber] Quote for ${inputMint.slice(0, 8)}... -> ${outputMint.slice(0, 8)}...`);
    console.log(`[Saber] Input: ${amountIn}, Output estimate: ${estimatedOutput}, Type: ${poolInfo.type}`);

    return NextResponse.json({
      inputMint,
      outputMint,
      inputAmount: amountIn,
      outputAmount: estimatedOutput,
      priceImpact: poolInfo.type === 'stable' ? 0.0001 : 0.001, // Very low for stables
      priceImpactBps: poolInfo.type === 'stable' ? 0 : 1,
      slippageBps,
      pool: poolInfo.pool,
      feeBps: poolInfo.feeBps,
      poolType: poolInfo.type,
      source: 'saber-estimated',
    }, { headers: responseHeaders });

  } catch (error) {
    console.error('[Saber Quote API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Saber quote', details: String(error) },
      { status: 502, headers: responseHeaders }
    );
  }
}
