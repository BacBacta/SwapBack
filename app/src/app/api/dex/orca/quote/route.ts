/**
 * API Route: /api/dex/orca/quote
 *
 * Proxy serveur vers l'endpoint Orca officiel (côté serveur = pas de CORS).
 *
 * Important: l'ancienne implémentation renvoyait une estimation fixe (fee-only)
 * qui surévaluait souvent le outputAmount sur CLMM → minOut trop strict
 * → AnchorError AmountOutBelowMinimum (6036) au moment de la simulation.
 */

import { NextRequest, NextResponse } from "next/server";

// Route handler: toujours dynamique (aucune exécution au build)
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Headers CORS (pattern repo)
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With",
  "Access-Control-Allow-Credentials": "true",
};

// Retry config for transient Cloudflare/CDN errors (code 1016, 502, 503, 504)
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

/**
 * Safe JSON parse: returns null if body is not valid JSON
 */
async function safeJsonParse(response: Response): Promise<{ json: unknown; text: string } | null> {
  const text = await response.text();
  try {
    const json = JSON.parse(text);
    return { json, text };
  } catch {
    return { json: null, text };
  }
}

/**
 * Check if error is retryable (Cloudflare CDN errors, rate limits, etc.)
 */
function isRetryableError(status: number, body: string): boolean {
  // Cloudflare error codes in HTML body
  if (body.includes("error code: 1016") || body.includes("error code: 1015")) {
    return true;
  }
  // HTTP 502/503/504 are typically transient
  if (status === 502 || status === 503 || status === 504 || status === 429) {
    return true;
  }
  return false;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const inputMint = searchParams.get('inputMint');
  const outputMint = searchParams.get('outputMint');
  const amount = searchParams.get('amount');
  const slippageBpsParam = searchParams.get("slippageBps");

  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json(
      { error: 'Missing required parameters: inputMint, outputMint, amount' },
      { status: 400, headers: CORS_HEADERS }
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
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Orca Quote API (déjà utilisée ailleurs dans le repo)
    // Note: le paramètre `slippage` est en % (0.5 = 0.5%)
    const slippagePct = (slippageBps / 100).toString();
    const url =
      `https://api.mainnet.orca.so/v1/quote?` +
      new URLSearchParams({
        inputMint,
        outputMint,
        amount: amountIn.toString(),
        slippage: slippagePct,
      });

    let lastError: { status: number; body: string } | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        console.log(`[Orca Quote API] Retry ${attempt}/${MAX_RETRIES} after transient error`);
        await sleep(RETRY_DELAY_MS * attempt);
      }

      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(7000),
        // Cache faible: l'état pool peut changer vite
        next: { revalidate: 2 },
      });

      // Parse response safely (may be HTML error page from Cloudflare)
      const parsed = await safeJsonParse(response);
      const body = parsed?.text ?? "";
      const data = parsed?.json as Record<string, unknown> | null;

      if (!response.ok) {
        console.warn(`[Orca Quote API] Upstream error ${response.status}:`, body.slice(0, 200));
        
        // Check if retryable
        if (isRetryableError(response.status, body) && attempt < MAX_RETRIES) {
          lastError = { status: response.status, body: body.slice(0, 500) };
          continue; // retry
        }

        return NextResponse.json(
          { error: "Orca upstream error", status: response.status, body: body.slice(0, 500) },
          { status: 502, headers: CORS_HEADERS }
        );
      }

      // Check if we got valid JSON
      if (!data || typeof data !== "object") {
        console.warn(`[Orca Quote API] Invalid JSON response:`, body.slice(0, 200));
        
        if (isRetryableError(200, body) && attempt < MAX_RETRIES) {
          lastError = { status: 200, body: body.slice(0, 500) };
          continue; // retry
        }

        return NextResponse.json(
          { error: "Orca returned invalid JSON", body: body.slice(0, 500) },
          { status: 502, headers: CORS_HEADERS }
        );
      }

      const outAmount = Number(data.outAmount ?? 0);
      const priceImpactPercent = Number(data.priceImpactPercent ?? 0);
      const priceImpactBps = Number.isFinite(priceImpactPercent)
        ? Math.round(priceImpactPercent * 100)
        : 0;

      if (!Number.isFinite(outAmount) || outAmount <= 0) {
        return NextResponse.json(
          { error: "Invalid Orca quote response", data },
          { status: 502, headers: CORS_HEADERS }
        );
      }

      return NextResponse.json(
        {
          inputMint,
          outputMint,
          inputAmount: amountIn,
          outputAmount: outAmount,
          priceImpact: Number.isFinite(priceImpactPercent) ? priceImpactPercent / 100 : 0,
          priceImpactBps,
          slippageBps,
          source: "orca-api",
        },
        { headers: CORS_HEADERS }
      );
    }

    // All retries exhausted
    return NextResponse.json(
      { error: "Orca API unavailable after retries", lastError },
      { status: 503, headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('[Orca Quote API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Orca quote', details: String(error) },
      { status: 502, headers: CORS_HEADERS }
    );
  }
}
