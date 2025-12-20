/**
 * API Route: /api/dex/meteora/quote
 *
 * Quote Meteora DLMM via SDK on-chain (évite la dépendance aux endpoints REST qui
 * peuvent changer et renvoyer "invalid pair address").
 *
 * Référence (doc A→Z): https://docs.meteora.ag/developer-guide/guides/dlmm/typescript-sdk/getting-started
 */

import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  // Same-origin calls will often not send Origin; in that case we can skip strict checks.
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

async function loadDlmmClass(): Promise<any> {
  // @meteora-ag/dlmm ESM entry can fail in some Node runtimes because Anchor's ESM build
  // does not export BN (named export). Fallback to the CJS entry when that happens.
  try {
    const mod: any = await import("@meteora-ag/dlmm");
    return mod?.DLMM ?? mod?.default ?? mod;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isNode = typeof process !== "undefined" && !!process.versions?.node;
    const missingBnExport = msg.includes("export named 'BN'") || msg.includes('export named "BN"');
    if (isNode && missingBnExport) {
      const nodeModule: any = await import(/* webpackIgnore: true */ "node:module");
      const createRequire = nodeModule?.createRequire;
      if (typeof createRequire !== "function") throw e;
      const req = createRequire(import.meta.url);
      const mod: any = req("@meteora-ag/dlmm");
      return mod?.DLMM ?? mod?.default ?? mod;
    }
    throw e;
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);
  const searchParams = request.nextUrl.searchParams;
  const inputMint = searchParams.get("inputMint");
  const outputMint = searchParams.get("outputMint");
  const amount = searchParams.get("amount");
  const pairAddress = searchParams.get("pairAddress");
  const slippageBpsParam = searchParams.get("slippageBps");

  if (!inputMint || !outputMint || !amount || !pairAddress) {
    return NextResponse.json(
      {
        error:
          "Missing required parameters: inputMint, outputMint, amount, pairAddress",
      },
      { status: 400, headers: corsHeaders }
    );
  }

  const amountIn = Number(amount);
  if (!Number.isFinite(amountIn) || amountIn <= 0) {
    return NextResponse.json(
      { error: "Invalid amount" },
      { status: 400, headers: corsHeaders }
    );
  }

  const slippageBpsRaw = slippageBpsParam ? Number(slippageBpsParam) : undefined;
  const slippageBps =
    typeof slippageBpsRaw === "number" && Number.isFinite(slippageBpsRaw)
      ? Math.min(10_000, Math.max(0, Math.floor(slippageBpsRaw)))
      : 50;

  try {
    const rpcUrl =
      process.env.SOLANA_RPC_URL ||
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
      "https://api.mainnet-beta.solana.com";

    const connection = new Connection(rpcUrl, "confirmed");
    const DLMM = await loadDlmmClass();
    if (!DLMM?.create) {
      return NextResponse.json(
        { error: "Meteora DLMM SDK unavailable (missing create())" },
        { status: 502, headers: corsHeaders }
      );
    }

    const dlmm = await DLMM.create(connection, new PublicKey(pairAddress));

    const tokenX = dlmm.tokenX?.mint?.address?.toBase58?.();
    const tokenY = dlmm.tokenY?.mint?.address?.toBase58?.();

    if (!tokenX || !tokenY) {
      return NextResponse.json(
        { error: "Invalid DLMM pair: missing token mints" },
        { status: 502, headers: corsHeaders }
      );
    }

    let swapForY: boolean;
    if (tokenX === inputMint && tokenY === outputMint) {
      swapForY = true;
    } else if (tokenY === inputMint && tokenX === outputMint) {
      swapForY = false;
    } else {
      return NextResponse.json(
        {
          error: "Pair does not match input/output mints",
          pairAddress,
          tokenX,
          tokenY,
          inputMint,
          outputMint,
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const binArrays = await dlmm.getBinArrayForSwap(swapForY);
    const quote = await dlmm.swapQuote(
      new BN(amountIn.toString()),
      swapForY,
      new BN(slippageBps),
      binArrays
    );

    const outAmountStr = quote?.outAmount?.toString?.() ?? "0";
    const outAmount = Number(outAmountStr);
    if (!Number.isFinite(outAmount) || outAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid Meteora SDK quote output", outAmount: outAmountStr },
        { status: 502, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        inputMint,
        outputMint,
        inputAmount: amountIn,
        outputAmount: outAmount,
        priceImpactBps: 0,
        slippageBps,
        pairAddress,
        swapForY,
        source: "meteora-sdk",
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("[Meteora Quote API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Meteora quote", details: String(error) },
      { status: 502, headers: corsHeaders }
    );
  }
}
