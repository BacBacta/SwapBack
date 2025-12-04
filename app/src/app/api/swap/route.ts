/**
 * API Route: Swap Execution
 * Gets swap transaction from Jupiter API (server-side to avoid CORS)
 */

import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { checkRateLimit, getClientIdentifier } from "../../../lib/rateLimit";
import { sanitizeAmount, isValidPublicKey } from "../../../lib/validation";
import { DEFAULT_SOLANA_RPC_URL } from "@/config/constants";

const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  DEFAULT_SOLANA_RPC_URL;

const JUPITER_API =
  process.env.JUPITER_API_URL || "https://quote-api.jup.ag/v6";

export async function POST(request: NextRequest) {
  try {
    // Security: Rate limiting (30 requests per minute)
    const clientId = getClientIdentifier(request.headers);
    const rateLimit = checkRateLimit(clientId, { maxRequests: 30, windowMs: 60000 });
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: "Rate limit exceeded. Please try again later.",
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '30',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetAt.toString(),
          },
        }
      );
    }

    const {
      inputMint,
      outputMint,
      amount,
      inputAmount, // Legacy support
      slippageBps = 50,
      userPublicKey,
      priorityFee,
    } = await request.json();

    const actualAmount = amount || inputAmount;

    // Security: Validate inputs
    if (!inputMint || !outputMint || !actualAmount || !userPublicKey) {
      return NextResponse.json(
        {
          error: "Missing required fields: inputMint, outputMint, amount, userPublicKey",
        },
        { status: 400 }
      );
    }

    // Security: Validate public keys
    if (!isValidPublicKey(inputMint) || !isValidPublicKey(outputMint) || !isValidPublicKey(userPublicKey)) {
      return NextResponse.json(
        { error: "Invalid public key address" },
        { status: 400 }
      );
    }

    // Security: Validate amount
    const validatedAmount = sanitizeAmount(actualAmount.toString(), {
      min: 1,
      max: 1e18,
    });

    if (validatedAmount === null) {
      return NextResponse.json(
        { error: "Invalid input amount" },
        { status: 400 }
      );
    }

    console.log("🔄 Getting swap transaction:", {
      inputMint: inputMint.slice(0, 8) + "...",
      outputMint: outputMint.slice(0, 8) + "...",
      amount: validatedAmount,
      user: userPublicKey.slice(0, 8) + "...",
    });

    // Step 1: Get quote from Jupiter
    const quoteParams = new URLSearchParams({
      inputMint,
      outputMint,
      amount: Math.floor(validatedAmount).toString(),
      slippageBps: slippageBps.toString(),
    });

    const quoteResponse = await fetch(`${JUPITER_API}/quote?${quoteParams}`, {
      headers: { Accept: "application/json" },
    });

    if (!quoteResponse.ok) {
      const error = await quoteResponse.text();
      console.error("❌ Jupiter quote failed:", error);
      return NextResponse.json(
        { error: "Failed to get quote from Jupiter", details: error },
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
    const userPk = new PublicKey(userPublicKey);
    const inputMintPk = new PublicKey(inputMint);
    const outputMintPk = new PublicKey(outputMint);

    const userSourceAta = getAssociatedTokenAddressSync(
      inputMintPk,
      userPk,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const userDestinationAta = getAssociatedTokenAddressSync(
      outputMintPk,
      userPk,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

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
      },
      body: JSON.stringify(swapBody),
    });

    if (!swapResponse.ok) {
      const error = await swapResponse.text();
      console.error("❌ Jupiter swap failed:", error);
      return NextResponse.json(
        { error: "Failed to get swap transaction from Jupiter", details: error },
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
    console.error("Error in /api/swap:", error);
    
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const connection = new Connection(RPC_ENDPOINT);
    const slot = await connection.getSlot();

    return NextResponse.json({
      status: "ok",
      rpc: RPC_ENDPOINT,
      jupiterApi: JUPITER_API,
      currentSlot: slot,
      timestamp: Date.now(),
    });
  } catch {
    return NextResponse.json(
      { status: "error", error: "RPC connection failed" },
      { status: 500 }
    );
  }
}
