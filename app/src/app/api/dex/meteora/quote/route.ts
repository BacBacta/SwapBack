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

const NO_STORE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
  Pragma: "no-cache",
};

// Known high-liquidity Meteora DLMM pools for major pairs
// This avoids the slow fetch of all 10,000+ pools from the API
const KNOWN_METEORA_POOLS: Record<string, string> = {
  // SOL/USDC pools (most liquid)
  'So11111111111111111111111111111111111111112:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'FoSDw2L5DmTuQTFe55gWPDXf88euaxAEKFre74CnvQbX',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v:So11111111111111111111111111111111111111112': 'FoSDw2L5DmTuQTFe55gWPDXf88euaxAEKFre74CnvQbX',
  // SOL/USDT
  'So11111111111111111111111111111111111111112:Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': '6EdpDdvowKUTvQ3Y8mWrVgWKMZ2nj6mxhgagFqEJNDEn',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB:So11111111111111111111111111111111111111112': '6EdpDdvowKUTvQ3Y8mWrVgWKMZ2nj6mxhgagFqEJNDEn',
  // USDC/USDT
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v:Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'ARwi1S4DaiTG5DX7S4M4ZsrXqpMD1MrTmbu9ue2tpmEq',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'ARwi1S4DaiTG5DX7S4M4ZsrXqpMD1MrTmbu9ue2tpmEq',
  // JUP/SOL
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN:So11111111111111111111111111111111111111112': '6shHmqVs4d9qwReVDPqFKNJJLKVm8k1VoLYkpoKq4WjD',
  'So11111111111111111111111111111111111111112:JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': '6shHmqVs4d9qwReVDPqFKNJJLKVm8k1VoLYkpoKq4WjD',
  // JUP/USDC
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': '6U49JHvkSLdzVDaFTidLR5VD8qsLxNMorr6CbLzrDYQ5',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v:JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': '6U49JHvkSLdzVDaFTidLR5VD8qsLxNMorr6CbLzrDYQ5',
};

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
    headers: { ...getCorsHeaders(request), ...NO_STORE_HEADERS },
  });
}

export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);
  // forceFresh est accepté pour cohérence avec les autres quote endpoints.
  // La quote Meteora est calculée on-chain via SDK, donc forceFresh ne change pas le résultat,
  // mais on s'assure que la réponse n'est jamais cachée.
  void request.nextUrl.searchParams.get("forceFresh");
  const responseHeaders = { ...corsHeaders, ...NO_STORE_HEADERS };
  const searchParams = request.nextUrl.searchParams;
  const inputMint = searchParams.get("inputMint");
  const outputMint = searchParams.get("outputMint");
  const amount = searchParams.get("amount");
  let pairAddress = searchParams.get("pairAddress");
  const slippageBpsParam = searchParams.get("slippageBps");

  if (!inputMint || !outputMint || !amount) {
    return NextResponse.json(
      {
        error:
          "Missing required parameters: inputMint, outputMint, amount",
      },
      { status: 400, headers: responseHeaders }
    );
  }

  // Si pairAddress n'est pas fourni, on utilise d'abord les pools connus
  // puis on fallback sur l'API Meteora
  if (!pairAddress) {
    // 1. Check known pools first (fast path)
    const pairKey = `${inputMint}:${outputMint}`;
    if (KNOWN_METEORA_POOLS[pairKey]) {
      pairAddress = KNOWN_METEORA_POOLS[pairKey];
      console.log(`[Meteora] Using known pool: ${pairAddress}`);
    } else {
      // 2. Fallback to API discovery (slow path)
      try {
        const pairsResponse = await fetch(
          `https://dlmm-api.meteora.ag/pair/all`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (pairsResponse.ok) {
          const pairs = await pairsResponse.json();
          // Find ALL matching pools for this pair
          const matchingPools = pairs.filter((p: any) => 
            (p.mint_x === inputMint && p.mint_y === outputMint) ||
            (p.mint_y === inputMint && p.mint_x === outputMint)
          );
          
          if (matchingPools.length > 0) {
            // Sort by liquidity (descending) and pick the most liquid pool
            const sortedPools = matchingPools.sort((a: any, b: any) => {
              const liqA = parseFloat(a.liquidity || '0');
              const liqB = parseFloat(b.liquidity || '0');
              return liqB - liqA;
            });
          
            // Try pools in order of liquidity until we find one that works
            // Start with the top 3 most liquid pools
            for (const pool of sortedPools.slice(0, 3)) {
              const liq = parseFloat(pool.liquidity || '0');
              if (liq > 0.1) { // Minimum liquidity threshold
                pairAddress = pool.address;
                console.log(`[Meteora] Selected pool ${pool.address} with liquidity ${liq}`);
                break;
              }
            }
          
            // If no pool meets threshold, use the most liquid one anyway
            if (!pairAddress && sortedPools[0]?.address) {
              pairAddress = sortedPools[0].address;
              console.log(`[Meteora] Using best available pool ${pairAddress}`);
            }
          }
        }
      } catch (e) {
        console.warn("[Meteora Quote] Pool discovery failed:", e);
      }
    }
    
    if (!pairAddress) {
      return NextResponse.json(
        { error: "No Meteora DLMM pool found for this pair" },
        { status: 404, headers: responseHeaders }
      );
    }
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
        { status: 502, headers: responseHeaders }
      );
    }

    const dlmm = await DLMM.create(connection, new PublicKey(pairAddress));

    const tokenX = dlmm.tokenX?.mint?.address?.toBase58?.();
    const tokenY = dlmm.tokenY?.mint?.address?.toBase58?.();

    if (!tokenX || !tokenY) {
      return NextResponse.json(
        { error: "Invalid DLMM pair: missing token mints" },
        { status: 502, headers: responseHeaders }
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
        { status: 400, headers: responseHeaders }
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
        { status: 502, headers: responseHeaders }
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
      { headers: responseHeaders }
    );
  } catch (error) {
    console.error("[Meteora Quote API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Meteora quote", details: String(error) },
      { status: 502, headers: responseHeaders }
    );
  }
}
