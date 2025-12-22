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
import { Connection, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import { getAmountOut } from '@lifinity/sdk';

// Route handler: toujours dynamique (aucune exécution au build)
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

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

async function getMintDecimals(connection: Connection, mint: PublicKey): Promise<number> {
  const mintInfo = await getMint(connection, mint);
  return mintInfo.decimals;
}

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

    const rpcUrl =
      process.env.SOLANA_RPC_URL ||
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
      "https://api.mainnet-beta.solana.com";

    const connection = new Connection(rpcUrl, "confirmed");
    const fromMintPk = new PublicKey(inputMint);
    const toMintPk = new PublicKey(outputMint);

    // L'API venue-quotes passe `amount` en base units.
    // @lifinity/sdk.getAmountOut attend un amount en "token units" (ex: 1.23 SOL).
    const [fromDecimals, toDecimals] = await Promise.all([
      getMintDecimals(connection, fromMintPk),
      getMintDecimals(connection, toMintPk),
    ]);

    const fromDivisor = Math.pow(10, fromDecimals);
    const amountInTokenUnits = amountIn / fromDivisor;
    if (!Number.isFinite(amountInTokenUnits) || amountInTokenUnits <= 0) {
      return NextResponse.json(
        { error: "Invalid amount after decimals conversion" },
        { status: 400, headers: responseHeaders }
      );
    }

    // slippage: bps -> percent (0.5% pour 50 bps)
    const slippagePercent = slippageBps / 100;

    const quote = await getAmountOut(connection, amountInTokenUnits, fromMintPk, toMintPk, slippagePercent);
    if (!quote) {
      return NextResponse.json(
        { error: "No Lifinity pool for this pair" },
        { status: 404, headers: responseHeaders }
      );
    }

    const amountOutTokenUnits = Number(quote.amountOutWithSlippage ?? quote.amountOut ?? 0);
    const outMultiplier = Math.pow(10, toDecimals);
    const outputAmount = Math.floor(amountOutTokenUnits * outMultiplier);

    if (!Number.isFinite(outputAmount) || outputAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid Lifinity SDK quote output", details: quote },
        { status: 502, headers: responseHeaders }
      );
    }

    if (!Number.isSafeInteger(outputAmount)) {
      return NextResponse.json(
        { error: "Lifinity quote too large (unsafe integer)", outputAmount },
        { status: 502, headers: responseHeaders }
      );
    }

    console.log(`[Lifinity] Quote for ${inputMint.slice(0, 8)}... -> ${outputMint.slice(0, 8)}...`, {
      amountIn,
      amountInTokenUnits,
      outputAmount,
      amountOutTokenUnits,
      slippageBps,
      rpcUrl,
    });

    return NextResponse.json(
      {
        inputMint,
        outputMint,
        inputAmount: amountIn,
        outputAmount,
        priceImpactBps: 0,
        slippageBps,
        source: "lifinity-sdk",
        feePercent: quote.feePercent,
      },
      { headers: responseHeaders }
    );

  } catch (error) {
    console.error('[Lifinity Quote API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Lifinity quote', details: String(error) },
      { status: 502, headers: responseHeaders }
    );
  }
}
