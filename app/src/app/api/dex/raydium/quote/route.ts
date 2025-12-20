/**
 * API Route: /api/dex/raydium/quote
 * 
 * Proxy pour obtenir des quotes Raydium AMM directement
 */

import { NextRequest, NextResponse } from 'next/server';

const RAYDIUM_API_BASE = 'https://transaction-v1.raydium.io';

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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const inputMint = searchParams.get('inputMint');
  const outputMint = searchParams.get('outputMint');
  const amount = searchParams.get('amount');
  const poolId = searchParams.get('poolId');
  const slippageBpsParam = searchParams.get('slippageBps');
  const forceFresh = searchParams.get("forceFresh") === "1" || searchParams.get("forceFresh") === "true";
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
    // Obtenir la quote via l'API Raydium
    const quoteUrl = new URL(`${RAYDIUM_API_BASE}/compute/swap-base-in`);
    quoteUrl.searchParams.set('inputMint', inputMint);
    quoteUrl.searchParams.set('outputMint', outputMint);
    quoteUrl.searchParams.set('amount', amount);
    quoteUrl.searchParams.set('slippageBps', slippageBps.toString());
    quoteUrl.searchParams.set('txVersion', 'V0');
    if (poolId) {
      quoteUrl.searchParams.set('poolId', poolId);
    }

    const response = await fetch(quoteUrl.toString(), {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
      ...(forceFresh ? { cache: "no-store" as const } : {}),
    });

    if (!response.ok) {
      throw new Error(`Raydium API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      return NextResponse.json(
        { error: 'Raydium quote failed', details: data.msg },
        { status: 502, headers: responseHeaders }
      );
    }

    const outputAmount = parseInt(data.data?.outputAmount || '0');
    const minOutAmount = parseInt(data.data?.otherAmountThreshold || '0');
    const priceImpactPctRaw = data.data?.priceImpactPct;
    const priceImpactPct = typeof priceImpactPctRaw === "string" ? Number(priceImpactPctRaw) : Number(priceImpactPctRaw ?? 0);
    const priceImpact = Number.isFinite(priceImpactPct) ? priceImpactPct / 100 : 0;

    // Formater la réponse
    return NextResponse.json({
      inputMint,
      outputMint,
      inputAmount: parseInt(amount),
      outputAmount,
      minOutAmount,
      slippageBpsUsed: data.data?.slippageBps ?? slippageBps,
      // ratio (ex: 0.01 = 1%) pour rester compatible avec le reste du code
      priceImpact,
      fee: data.data?.fee || 0,
      route: data.data?.routePlan || [],
      poolId: data.data?.poolId || poolId,
    }, { headers: responseHeaders });
  } catch (error) {
    console.error('[Raydium Quote API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Raydium quote', details: String(error) },
      { status: 502, headers: responseHeaders }
    );
  }
}
