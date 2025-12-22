/**
 * API Route: /api/dex/orca/quote
 *
 * Quote Orca Whirlpools via SDK uniquement (plus stable que l'API REST).
 * 
 * L'API REST Orca (api.mainnet.orca.so) est derrière Cloudflare et retourne
 * souvent des réponses "diagnostic" cachées qui causent des erreurs.
 * Le SDK on-chain est plus fiable.
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
import { getOrcaWhirlpool, ORCA_WHIRLPOOL_PROGRAM_ID } from "@/sdk/config/orca-pools";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const BUILD_COMMIT =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.VERCEL_GITHUB_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  "unknown";

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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  };

  if (allowOrigin !== "*") {
    headers["Access-Control-Allow-Credentials"] = "true";
    headers["Vary"] = "Origin";
  }

  return headers;
}

function withBuildHeaders(headers: Record<string, string>): Record<string, string> {
  return { ...headers, "X-SwapBack-Commit": BUILD_COMMIT };
}

/**
 * ReadonlyWallet - Wallet minimal pour les quotes (pas de signature)
 */
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

/**
 * Quote via Orca Whirlpool SDK (on-chain)
 */
async function quoteWithOrcaWhirlpoolSdk(params: {
  rpcUrl: string;
  pool: string;
  inputMint: string;
  outputMint: string;
  amountIn: number;
  slippageBps: number;
}): Promise<{ outAmount: number; priceImpact: number }> {
  const connection = new Connection(params.rpcUrl, "confirmed");
  const provider = new AnchorProvider(
    connection,
    new ReadonlyWallet() as any,
    AnchorProvider.defaultOptions()
  );
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
      `Pool mints mismatch (tokenA=${tokenA.mint.toBase58()}, tokenB=${tokenB.mint.toBase58()})`
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

  // Estimate price impact from the quote
  // Price impact ≈ (amountIn / estimatedAmountIn - 1) or similar heuristic
  const priceImpact = 0; // SDK doesn't provide this directly, set to 0

  return { outAmount, priceImpact };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: withBuildHeaders({ ...getCorsHeaders(request.headers.get("origin")), ...NO_STORE_HEADERS }),
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const inputMint = searchParams.get("inputMint");
  const outputMint = searchParams.get("outputMint");
  const amount = searchParams.get("amount");
  const poolParam = searchParams.get("pool");
  const slippageBpsParam = searchParams.get("slippageBps");
  
  const corsHeaders = getCorsHeaders(request.headers.get("origin"));
  const responseHeaders = withBuildHeaders({ ...corsHeaders, ...NO_STORE_HEADERS });

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

  const slippageBpsRaw = slippageBpsParam ? Number(slippageBpsParam) : undefined;
  const slippageBps =
    typeof slippageBpsRaw === "number" && Number.isFinite(slippageBpsRaw)
      ? Math.min(10_000, Math.max(0, Math.floor(slippageBpsRaw)))
      : 50;

  // Resolve pool: either provided by caller or from our known pools
  let poolAddress: string | null = poolParam ?? null;
  
  if (!poolAddress) {
    try {
      const inputPk = new PublicKey(inputMint);
      const outputPk = new PublicKey(outputMint);
      poolAddress = getOrcaWhirlpool(inputPk, outputPk)?.toBase58() ?? null;
    } catch {
      // Invalid mint format
    }
  }

  if (!poolAddress) {
    // No known Orca pool for this pair
    return NextResponse.json(
      { 
        error: "No Orca Whirlpool found for this token pair",
        inputMint,
        outputMint,
        hint: "This pair is not supported on Orca Whirlpools or the pool is not in our registry"
      },
      { status: 404, headers: responseHeaders }
    );
  }

  // Get RPC URL
  const rpcUrl =
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    "https://api.mainnet-beta.solana.com";

  try {
    const quote = await quoteWithOrcaWhirlpoolSdk({
      rpcUrl,
      pool: poolAddress,
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
        outputAmount: quote.outAmount,
        priceImpact: quote.priceImpact,
        priceImpactBps: Math.floor(quote.priceImpact * 100),
        slippageBps,
        pool: poolAddress,
        venue: "ORCA",
        source: "orca-whirlpool-sdk",
      },
      { headers: responseHeaders }
    );
  } catch (error) {
    console.error("[Orca Quote] SDK error:", {
      pool: poolAddress,
      inputMint,
      outputMint,
      error: String(error),
    });

    return NextResponse.json(
      {
        error: "Failed to get Orca quote",
        pool: poolAddress,
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 502, headers: responseHeaders }
    );
  }
}
