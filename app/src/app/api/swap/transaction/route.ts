/**
 * API Route: Build Jupiter Swap Transaction
 * Proxies requests to Jupiter API to avoid CORS issues
 * Endpoint: POST /api/swap/transaction
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

const JUPITER_API = "https://public.jupiterapi.com";
const TIMEOUT_MS = 30000; // 30 seconds timeout

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.quoteResponse) {
      return NextResponse.json(
        { error: "Missing quoteResponse in request body" },
        { status: 400 }
      );
    }
    if (!body.userPublicKey) {
      return NextResponse.json(
        { error: "Missing userPublicKey in request body" },
        { status: 400 }
      );
    }

    console.log("[API/swap/transaction] Building swap for user:", body.userPublicKey);
    
    const response = await fetchWithTimeout(
      `${JUPITER_API}/swap`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "SwapBack/1.0",
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
      },
      TIMEOUT_MS
    );

    const elapsed = Date.now() - startTime;
    console.log(`[API/swap/transaction] Jupiter response in ${elapsed}ms, status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API/swap/transaction] Jupiter error:", response.status, errorText);
      return NextResponse.json(
        { error: `Jupiter swap build failed: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[API/swap/transaction] Success, swapTransaction present:", !!data.swapTransaction);
    return NextResponse.json(data);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[API/swap/transaction] Error after ${elapsed}ms:`, error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return NextResponse.json(
          { error: "Jupiter API timeout - please try again" },
          { status: 504 }
        );
      }
      if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        return NextResponse.json(
          { error: "Cannot reach Jupiter API - network issue" },
          { status: 503 }
        );
      }
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
