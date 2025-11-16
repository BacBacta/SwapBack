import { NextRequest, NextResponse } from "next/server";

/**
 * Debug endpoint pour voir exactement ce qui est envoyé à Jupiter
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inputMint, outputMint, amount, slippageBps = 50 } = body;

    const parsedAmount = typeof amount === "string" ? parseFloat(amount) : amount;

    // Exact construction of parameters as in route.ts
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: Math.floor(parsedAmount).toString(),
      slippageBps: slippageBps.toString(),
    });

    const JUPITER_API = process.env.JUPITER_API_URL || "https://lite-api.jup.ag/ultra/v1";
    const jupiterEndpoint = `/order?${params.toString()}`;
    const quoteUrl = `${JUPITER_API}${jupiterEndpoint}`;

    return NextResponse.json({
      debug: {
        receivedBody: body,
        parsedParams: {
          inputMint,
          outputMint,
          amount: parsedAmount,
          amountFloored: Math.floor(parsedAmount),
          slippageBps,
        },
        urlSearchParams: Object.fromEntries(params.entries()),
        finalUrl: quoteUrl,
        jupiterApiFromEnv: JUPITER_API,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Debug endpoint error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
