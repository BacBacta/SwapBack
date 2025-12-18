/**
 * API Route: /api/dex/meteora/quote
 *
 * Proxy serveur vers l'endpoint officiel Meteora DLMM (côté serveur = pas de CORS).
 *
 * Référence (doc A→Z): https://docs.meteora.ag/developer-guide/guides/dlmm/typescript-sdk/getting-started
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With",
  "Access-Control-Allow-Credentials": "true",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const inputMint = searchParams.get("inputMint");
  const outputMint = searchParams.get("outputMint");
  const amount = searchParams.get("amount");

  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json(
      { error: "Missing required parameters: inputMint, outputMint, amount" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const amountIn = Number(amount);
  if (!Number.isFinite(amountIn) || amountIn <= 0) {
    return NextResponse.json(
      { error: "Invalid amount" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  try {
    // Meteora DLMM quote endpoint.
    // swapMode=ExactIn (on quote des swaps exact-in côté UI).
    const url =
      `https://dlmm-api.meteora.ag/pair/quote?` +
      new URLSearchParams({
        inputMint,
        outputMint,
        amount: amountIn.toString(),
        swapMode: "ExactIn",
      });

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
      next: { revalidate: 2 },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return NextResponse.json(
        { error: "Meteora upstream error", status: response.status, body },
        { status: 502, headers: CORS_HEADERS }
      );
    }

    const data = await response.json();

    const outAmount = Number(data.outAmount ?? 0);
    const priceImpact = Number(data.priceImpact ?? 0);

    if (!Number.isFinite(outAmount) || outAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid Meteora quote response", data },
        { status: 502, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        inputMint,
        outputMint,
        inputAmount: amountIn,
        outputAmount: outAmount,
        priceImpactBps: Number.isFinite(priceImpact) ? Math.round(priceImpact * 10_000) : 0,
        source: "meteora-api",
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("[Meteora Quote API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Meteora quote", details: String(error) },
      { status: 502, headers: CORS_HEADERS }
    );
  }
}
