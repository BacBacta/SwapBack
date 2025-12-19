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
import { AnchorProvider } from "@coral-xyz/anchor";
import BN from "bn.js";
import { Percentage } from "@orca-so/common-sdk";
import {
  UseFallbackTickArray,
  WhirlpoolContext,
  buildWhirlpoolClient,
  swapQuoteByInputToken,
} from "@orca-so/whirlpools-sdk";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { ORCA_WHIRLPOOL_PROGRAM_ID } from "@/sdk/config/orca-pools";

// Route handler: toujours dynamique (aucune exécution au build)
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Headers CORS (pattern repo)
// Note: en prod, éviter `*` + credentials. Si ALLOWED_ORIGIN n'est pas défini,
// on répond en mode "public" (pas de credentials) pour rester conforme.
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

function isOrcaDiagnosticPayload(data: Record<string, unknown> | null): boolean {
  if (!data) return false;
  // Payload observé quand l'upstream renvoie du `text/plain` avec un JSON “diagnostic”
  // ex: { headers: {...}, lasterror: "SyntaxError... error code: 1016" }
  if (typeof data.lasterror === "string") return true;
  if (data.headers && typeof data.headers === "object" && data.outAmount == null) return true;
  return false;
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

class ReadonlyWallet {
  publicKey: PublicKey;
  payer: Keypair;

  constructor(keypair: Keypair = Keypair.generate()) {
    this.publicKey = keypair.publicKey;
    this.payer = keypair;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async signTransaction(tx: any): Promise<any> {
    return tx;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async signAllTransactions(txs: any[]): Promise<any[]> {
    return txs;
  }
}

async function quoteWithOrcaWhirlpoolSdk(params: {
  rpcUrl: string;
  pool: string;
  inputMint: string;
  outputMint: string;
  amountIn: number;
  slippageBps: number;
}): Promise<{ outAmount: number }> {
  const connection = new Connection(params.rpcUrl, "confirmed");
  const provider = new AnchorProvider(
    connection,
    new ReadonlyWallet() as any,
    AnchorProvider.defaultOptions()
  );
  // NOTE: `withProvider(provider, fetcher?)` — le 2e argument est un *fetcher*, pas le programId.
  // Passer un PublicKey ici casse `ctx.fetcher` (=> getPool is not a function).
  const ctx = WhirlpoolContext.withProvider(provider);
  const client = buildWhirlpoolClient(ctx);

  const poolPk = new PublicKey(params.pool);
  const pool = await client.getPool(poolPk);
  await pool.refreshData();

  const tokenA = pool.getTokenAInfo();
  const tokenB = pool.getTokenBInfo();
  const inputPk = new PublicKey(params.inputMint);
  const outputPk = new PublicKey(params.outputMint);

  const aToB = tokenA.mint.equals(inputPk) && tokenB.mint.equals(outputPk);
  const bToA = tokenB.mint.equals(inputPk) && tokenA.mint.equals(outputPk);

  if (!aToB && !bToA) {
    throw new Error(
      `Pool does not match input/output mints (tokenA=${tokenA.mint.toBase58()}, tokenB=${tokenB.mint.toBase58()})`
    );
  }

  const slippage = Percentage.fromFraction(params.slippageBps, 10_000);
  const quote = await swapQuoteByInputToken(
    pool,
    inputPk,
    new BN(params.amountIn),
    slippage,
    ORCA_WHIRLPOOL_PROGRAM_ID,
    ctx.fetcher,
    undefined,
    UseFallbackTickArray.Situational
  );

  const outAmount = Number(quote.estimatedAmountOut.toString());
  if (!Number.isFinite(outAmount) || outAmount <= 0) {
    throw new Error(`Invalid outAmount from SDK: ${quote.estimatedAmountOut.toString()}`);
  }

  return { outAmount };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get("origin")),
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const inputMint = searchParams.get('inputMint');
  const outputMint = searchParams.get('outputMint');
  const amount = searchParams.get('amount');
  const pool = searchParams.get("pool");
  const slippageBpsParam = searchParams.get("slippageBps");
  const corsHeaders = getCorsHeaders(request.headers.get("origin"));

  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json(
      { error: 'Missing required parameters: inputMint, outputMint, amount' },
      { status: 400, headers: corsHeaders }
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
        { status: 400, headers: corsHeaders }
      );
    }

    const rpcUrl =
      process.env.SOLANA_RPC_URL ||
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
      "https://api.mainnet-beta.solana.com";

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

      const contentType = response.headers.get("content-type") ?? "";

      // Parse response safely (may be HTML error page from Cloudflare)
      const parsed = await safeJsonParse(response);
      const body = parsed?.text ?? "";
      const data = parsed?.json as Record<string, unknown> | null;

      // Même avec status=200, Orca peut répondre en `text/plain` avec un JSON “diagnostic”
      // ou une page HTML Cloudflare.
      const treatAsError =
        !response.ok ||
        !contentType.toLowerCase().includes("application/json") ||
        isOrcaDiagnosticPayload(data);

      if (treatAsError) {
        console.warn(`[Orca Quote API] Upstream error ${response.status}:`, body.slice(0, 200));
        
        // Check if retryable
        if (isRetryableError(response.status, body) && attempt < MAX_RETRIES) {
          lastError = { status: response.status, body: body.slice(0, 500) };
          continue; // retry
        }

        lastError = { status: response.status, body: body.slice(0, 500) };
        break;
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
          { status: 502, headers: corsHeaders }
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
          { status: 502, headers: corsHeaders }
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
        { headers: corsHeaders }
      );
    }

    // Fallback: Orca Whirlpool SDK on-chain (requires `pool`)
    if (pool) {
      try {
        const sdkQuote = await quoteWithOrcaWhirlpoolSdk({
          rpcUrl,
          pool,
          inputMint,
          outputMint,
          amountIn,
          slippageBps,
        });

        return NextResponse.json(
          {
            inputMint,
            outputMint,
            inputAmount: amountIn,
            outputAmount: sdkQuote.outAmount,
            priceImpact: 0,
            priceImpactBps: 0,
            slippageBps,
            source: "orca-whirlpool-sdk",
          },
          { headers: corsHeaders }
        );
      } catch (sdkError) {
        return NextResponse.json(
          {
            error: "Orca quote unavailable (upstream + SDK fallback failed)",
            lastError,
            sdkError: String(sdkError),
          },
          { status: 503, headers: corsHeaders }
        );
      }
    }

    // All retries exhausted (no fallback possible)
    return NextResponse.json(
      { error: "Orca API unavailable after retries", lastError },
      { status: 503, headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Orca Quote API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Orca quote', details: String(error) },
      { status: 502, headers: corsHeaders }
    );
  }
}
