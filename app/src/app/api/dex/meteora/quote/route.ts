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
import DLMM from "@meteora-ag/dlmm";

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
  const pairAddress = searchParams.get("pairAddress");
  const slippageBpsParam = searchParams.get("slippageBps");

  if (!inputMint || !outputMint || !amount || !pairAddress) {
    return NextResponse.json(
      {
        error:
          "Missing required parameters: inputMint, outputMint, amount, pairAddress",
      },
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
    const dlmm = await DLMM.create(connection, new PublicKey(pairAddress));

    const tokenX = dlmm.tokenX?.mint?.address?.toBase58?.();
    const tokenY = dlmm.tokenY?.mint?.address?.toBase58?.();

    if (!tokenX || !tokenY) {
      return NextResponse.json(
        { error: "Invalid DLMM pair: missing token mints" },
        { status: 502, headers: CORS_HEADERS }
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
        { status: 400, headers: CORS_HEADERS }
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
        { status: 502, headers: CORS_HEADERS }
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
