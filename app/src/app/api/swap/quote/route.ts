/**
 * API Route: Get Jupiter Quote
 * Returns real Jupiter V6 quote for token swap
 */

import { NextRequest, NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";

const JUPITER_API = "https://quote-api.jup.ag/v6";
const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  "https://api.devnet.solana.com";

// Mode MOCK pour tests sans réseau (quand Jupiter API inaccessible)
const USE_MOCK_DATA = process.env.USE_MOCK_QUOTES === "true";

export async function POST(request: NextRequest) {
  try {
    const {
      inputMint,
      outputMint,
      amount,
      slippageBps = 50, // 0.5% default
      onlyDirectRoutes = false,
    } = await request.json();

    // Validate inputs
    if (!inputMint || !outputMint || !amount) {
      return NextResponse.json(
        {
          error: "Missing required fields: inputMint, outputMint, amount",
        },
        { status: 400 }
      );
    }

    // Validate amount
    const parsedAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount: must be a positive number" },
        { status: 400 }
      );
    }

    // Build Jupiter quote URL
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: Math.floor(parsedAmount).toString(),
      slippageBps: slippageBps.toString(),
      onlyDirectRoutes: onlyDirectRoutes.toString(),
      swapMode: "ExactIn",
    });

    console.log("🔍 Fetching Jupiter quote:", {
      inputMint: inputMint.slice(0, 8) + "...",
      outputMint: outputMint.slice(0, 8) + "...",
      amount: parsedAmount,
      slippageBps,
    });

    // MODE MOCK pour tests (si problème réseau)
    if (USE_MOCK_DATA) {
      console.log("🧪 Using MOCK data (network unavailable)");
      const mockQuote = generateMockQuote(inputMint, outputMint, parsedAmount, slippageBps);
      const mockRouteInfo = parseRouteInfo(mockQuote);
      
      return NextResponse.json({
        success: true,
        quote: mockQuote,
        routeInfo: mockRouteInfo,
        timestamp: Date.now(),
      });
    }

    // Fetch quote from Jupiter
    const quoteUrl = `${JUPITER_API}/quote?${params.toString()}`;
    const response = await fetch(quoteUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
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
        { status: response.status }
      );
    }

    const quote = await response.json();

    if (!quote || !quote.outAmount) {
      return NextResponse.json(
        { error: "Invalid quote response from Jupiter" },
        { status: 500 }
      );
    }

    console.log("✅ Quote received:", {
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      priceImpact: quote.priceImpactPct,
      routes: quote.routePlan?.length || 0,
    });

    // Parse and enhance the quote with route information
    const routeInfo = parseRouteInfo(quote);

    return NextResponse.json({
      success: true,
      quote,
      routeInfo,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("❌ Error fetching quote:", error);
    
    return NextResponse.json(
      {
        error: "Failed to fetch quote",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Parse Jupiter quote into readable route information
 */
function parseRouteInfo(quote: any) {
  const routes = quote.routePlan || [];
  
  const steps = routes.map((route: any, index: number) => {
    const swapInfo = route.swapInfo || {};
    
    return {
      stepNumber: index + 1,
      ammKey: swapInfo.ammKey || "Unknown",
      label: swapInfo.label || `Step ${index + 1}`,
      inputMint: swapInfo.inputMint || "",
      outputMint: swapInfo.outputMint || "",
      inAmount: swapInfo.inAmount || "0",
      outAmount: swapInfo.outAmount || "0",
      feeAmount: swapInfo.feeAmount || "0",
      feeMint: swapInfo.feeMint || "",
    };
  });

  // Convert priceImpactPct to number if it's a string
  const priceImpact = typeof quote.priceImpactPct === 'string' 
    ? parseFloat(quote.priceImpactPct) 
    : (quote.priceImpactPct || 0);

  return {
    totalSteps: routes.length,
    inputAmount: quote.inAmount,
    outputAmount: quote.outAmount,
    priceImpactPct: priceImpact,
    steps,
    otherAmountThreshold: quote.otherAmountThreshold,
    swapMode: quote.swapMode || "ExactIn",
  };
}

/**
 * Generate mock quote data for testing (when network unavailable)
 */
function generateMockQuote(inputMint: string, outputMint: string, amount: number, slippageBps: number) {
  // Simuler un taux de change SOL/USDC ~ 150 USDC par SOL
  const mockPrice = inputMint.startsWith("So11") && outputMint.startsWith("EPjF") 
    ? 150 
    : 1.05; // Prix par défaut
  
  const outAmount = Math.floor(amount * mockPrice);
  const priceImpact = (amount / 1000000000) * 0.01; // 0.01% par SOL

  return {
    inputMint,
    outputMint,
    inAmount: amount.toString(),
    outAmount: outAmount.toString(),
    otherAmountThreshold: Math.floor(outAmount * (1 - slippageBps / 10000)).toString(),
    swapMode: "ExactIn",
    slippageBps,
    priceImpactPct: priceImpact.toFixed(4),
    price: mockPrice.toString(),
    routePlan: [
      {
        swapInfo: {
          ammKey: "MOCK_ORCA",
          label: "Orca (MOCK)",
          inputMint,
          outputMint,
          inAmount: amount.toString(),
          outAmount: outAmount.toString(),
          feeAmount: Math.floor(amount * 0.003).toString(), // 0.3% fee
          feeMint: inputMint,
        },
        percent: 100,
      },
    ],
    contextSlot: 999999999,
    timeTaken: 0.123,
    _isMockData: true,
  };
}

/**
 * GET handler for health check
 */
export async function GET() {
  try {
    const connection = new Connection(RPC_ENDPOINT);
    const slot = await connection.getSlot();

    return NextResponse.json({
      status: "ok",
      service: "Jupiter Quote API",
      jupiterApi: JUPITER_API,
      rpc: RPC_ENDPOINT,
      currentSlot: slot,
      timestamp: Date.now(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: "Health check failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
