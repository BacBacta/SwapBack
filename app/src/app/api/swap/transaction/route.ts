/**
 * API Route: Build Jupiter Swap Transaction
 * Proxies requests to Jupiter API to avoid CORS issues
 * Endpoint: POST /api/swap/build
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

const JUPITER_API = "https://quote-api.jup.ag/v6";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${JUPITER_API}/swap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        quoteResponse: body.quoteResponse,
        userPublicKey: body.userPublicKey,
        wrapAndUnwrapSol: body.wrapAndUnwrapSol ?? true,
        useSharedAccounts: body.useSharedAccounts ?? true,
        feeAccount: body.feeAccount,
        trackingAccount: body.trackingAccount,
        computeUnitPriceMicroLamports: body.computeUnitPriceMicroLamports,
        prioritizationFeeLamports: body.prioritizationFeeLamports ?? "auto",
        asLegacyTransaction: body.asLegacyTransaction ?? false,
        useTokenLedger: body.useTokenLedger ?? false,
        destinationTokenAccount: body.destinationTokenAccount,
        dynamicComputeUnitLimit: body.dynamicComputeUnitLimit ?? true,
        skipUserAccountsRpcCalls: body.skipUserAccountsRpcCalls ?? false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API/swap/build] Jupiter error:", response.status, errorText);
      return NextResponse.json(
        { error: `Jupiter swap build failed: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API/swap/build] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
