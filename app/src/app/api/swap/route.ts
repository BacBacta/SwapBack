/**
 * API Route: Swap Execution
 * Gets swap transaction from Jupiter API (server-side to avoid CORS)
 * Endpoint: POST /api/swap
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

// Jupiter API - using public.jupiterapi.com which works on Vercel
const JUPITER_API = process.env.JUPITER_API_URL || "https://public.jupiterapi.com";

// Simple rate limiting in memory
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(clientId: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 30;
  
  let entry = rateLimitMap.get(clientId);
  
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitMap.set(clientId, entry);
  }
  
  entry.count++;
  
  return {
    allowed: entry.count <= maxRequests,
    remaining: Math.max(0, maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}

function getClientId(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
         headers.get("x-real-ip") || 
         "anonymous";
}

function isValidBase58(str: string): boolean {
  if (!str || str.length < 32 || str.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(str);
}

/**
 * POST /api/swap
 * Get swap transaction from Jupiter
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientId(request.headers);
    const rateLimit = checkRateLimit(clientId);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { 
          status: 429,
          headers: {
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
            "X-RateLimit-Reset": rateLimit.resetAt.toString(),
          },
        }
      );
    }

    const body = await request.json();
    const {
      inputMint,
      outputMint,
      amount,
      slippageBps = 50,
      userPublicKey,
      priorityFee,
    } = body;

    // Validate inputs
    if (!inputMint || !outputMint || !amount || !userPublicKey) {
      return NextResponse.json(
        { error: "Missing required fields: inputMint, outputMint, amount, userPublicKey" },
        { status: 400 }
      );
    }

    // Validate addresses
    if (!isValidBase58(inputMint) || !isValidBase58(outputMint) || !isValidBase58(userPublicKey)) {
      return NextResponse.json(
        { error: "Invalid address format" },
        { status: 400 }
      );
    }

    // Validate amount
    const parsedAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    console.log("🔄 Getting swap transaction:", {
      inputMint: inputMint.slice(0, 8) + "...",
      outputMint: outputMint.slice(0, 8) + "...",
      amount: parsedAmount,
      user: userPublicKey.slice(0, 8) + "...",
    });

    // Step 1: Get quote from Jupiter
    const quoteParams = new URLSearchParams({
      inputMint,
      outputMint,
      amount: Math.floor(parsedAmount).toString(),
      slippageBps: slippageBps.toString(),
    });

    const quoteResponse = await fetch(`${JUPITER_API}/quote?${quoteParams}`, {
      headers: { 
        Accept: "application/json",
        "User-Agent": "SwapBack/1.0",
      },
    });

    if (!quoteResponse.ok) {
      const error = await quoteResponse.text();
      console.error("❌ Jupiter quote failed:", quoteResponse.status, error);
      return NextResponse.json(
        { error: "Failed to get quote", details: error },
        { status: 502 }
      );
    }

    const quote = await quoteResponse.json();

    console.log("📊 Quote received:", {
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      priceImpact: quote.priceImpactPct,
    });

    // Step 2: Get swap transaction from Jupiter
    const swapBody: Record<string, unknown> = {
      quoteResponse: quote,
      userPublicKey: userPublicKey,
      wrapAndUnwrapSol: true,
      useSharedAccounts: true,
      dynamicComputeUnitLimit: true,
      asLegacyTransaction: false,
    };

    if (priorityFee) {
      swapBody.computeUnitPriceMicroLamports = priorityFee;
    }

    const swapResponse = await fetch(`${JUPITER_API}/swap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "SwapBack/1.0",
      },
      body: JSON.stringify(swapBody),
    });

    if (!swapResponse.ok) {
      const error = await swapResponse.text();
      console.error("❌ Jupiter swap failed:", swapResponse.status, error);
      return NextResponse.json(
        { error: "Failed to get swap transaction", details: error },
        { status: 502 }
      );
    }

    const swapData = await swapResponse.json();

    console.log("✅ Swap transaction created:", {
      lastValidBlockHeight: swapData.lastValidBlockHeight,
      hasTransaction: !!swapData.swapTransaction,
    });

    return NextResponse.json({
      success: true,
      quote,
      swapTransaction: swapData.swapTransaction,
      lastValidBlockHeight: swapData.lastValidBlockHeight,
      prioritizationFeeLamports: swapData.prioritizationFeeLamports,
    });
  } catch (error) {
    console.error("❌ Error in /api/swap:", error);
    
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/swap
 * Health check
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "Jupiter Swap API Proxy",
    jupiterApi: JUPITER_API,
    timestamp: Date.now(),
  });
}
