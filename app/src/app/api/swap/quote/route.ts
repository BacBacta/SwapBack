/**
 * API Route: Get Jupiter Quote
 * Proxies requests to Jupiter API to avoid CORS issues
 * Endpoint: POST /api/swap/quote
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

// Jupiter API - using public.jupiterapi.com which works on Vercel
// The quote-api.jup.ag has DNS resolution issues on some serverless platforms
const JUPITER_API = process.env.JUPITER_API_URL || "https://public.jupiterapi.com";

// Helper to add no-store header
const withNoStore = (init?: ResponseInit): ResponseInit => {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return { ...init, headers };
};

// Types
interface JupiterRoutePlanStep {
  swapInfo?: {
    ammKey?: string;
    label?: string;
    inputMint?: string;
    outputMint?: string;
    inAmount?: string;
    outAmount?: string;
    feeAmount?: string;
    feeMint?: string;
  };
  percent?: number;
}

interface JupiterQuoteResponse {
  inputMint?: string;
  outputMint?: string;
  inAmount?: string;
  outAmount?: string;
  priceImpactPct?: number | string;
  routePlan?: JupiterRoutePlanStep[];
  otherAmountThreshold?: string;
  swapMode?: string;
  slippageBps?: number;
}

/**
 * Parse Jupiter quote into readable route information
 */
function parseRouteInfo(quote: JupiterQuoteResponse) {
  const routes = quote.routePlan ?? [];

  const steps = routes.map((route, index) => ({
    stepNumber: index + 1,
    ammKey: route.swapInfo?.ammKey ?? "Unknown",
    label: route.swapInfo?.label ?? `Step ${index + 1}`,
    inputMint: route.swapInfo?.inputMint ?? "",
    outputMint: route.swapInfo?.outputMint ?? "",
    inAmount: route.swapInfo?.inAmount ?? "0",
    outAmount: route.swapInfo?.outAmount ?? "0",
    feeAmount: route.swapInfo?.feeAmount ?? "0",
    feeMint: route.swapInfo?.feeMint ?? "",
  }));

  const priceImpact =
    typeof quote.priceImpactPct === "string"
      ? parseFloat(quote.priceImpactPct)
      : (quote.priceImpactPct ?? 0);

  return {
    totalSteps: routes.length,
    inputAmount: quote.inAmount ?? "0",
    outputAmount: quote.outAmount ?? "0",
    priceImpactPct: priceImpact,
    steps,
    otherAmountThreshold: quote.otherAmountThreshold,
    swapMode: quote.swapMode ?? "ExactIn",
  };
}

/**
 * POST /api/swap/quote
 * Get a quote from Jupiter API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      inputMint,
      outputMint,
      amount,
      slippageBps = 50,
    } = body;

    // Validate inputs
    if (!inputMint || !outputMint || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: inputMint, outputMint, amount" },
        withNoStore({ status: 400 })
      );
    }

    // Validate amount
    const parsedAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount: must be a positive number" },
        withNoStore({ status: 400 })
      );
    }

    // Build Jupiter API URL
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: Math.floor(parsedAmount).toString(),
      slippageBps: slippageBps.toString(),
    });

    const quoteUrl = `${JUPITER_API}/quote?${params.toString()}`;

    console.log("🔄 Fetching Jupiter quote:", {
      url: quoteUrl,
      inputMint: inputMint.slice(0, 8) + "...",
      outputMint: outputMint.slice(0, 8) + "...",
      amount: parsedAmount,
    });

    // Fetch quote from Jupiter
    const response = await fetch(quoteUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "SwapBack/1.0",
      },
    });

    console.log("📡 Jupiter response:", {
      status: response.status,
      ok: response.ok,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Jupiter API error:", response.status, errorText);
      
      return NextResponse.json(
        {
          error: "Jupiter API error",
          details: errorText,
          status: response.status,
        },
        withNoStore({ status: response.status >= 500 ? 502 : response.status })
      );
    }

    const quote = await response.json() as JupiterQuoteResponse;

    if (!quote || !quote.outAmount) {
      return NextResponse.json(
        { error: "Invalid quote response from Jupiter" },
        withNoStore({ status: 502 })
      );
    }

    console.log("✅ Quote received:", {
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      priceImpact: quote.priceImpactPct,
      routes: quote.routePlan?.length || 0,
    });

    // Parse route information
    const routeInfo = parseRouteInfo(quote);

    return NextResponse.json(
      {
        success: true,
        quote,
        routeInfo,
        timestamp: Date.now(),
      },
      withNoStore()
    );
  } catch (error) {
    console.error("❌ Error in /api/swap/quote:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch quote",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      withNoStore({ status: 500 })
    );
  }
}

/**
 * GET /api/swap/quote
 * Health check endpoint
 */
export async function GET() {
  try {
    // Simple health check - just verify the API is reachable
    return NextResponse.json(
      {
        status: "ok",
        service: "Jupiter Quote API Proxy",
        jupiterApi: JUPITER_API,
        timestamp: Date.now(),
      },
      withNoStore()
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: "Health check failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      withNoStore({ status: 500 })
    );
  }
}
