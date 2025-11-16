/**
 * API Route: Swap (Simplified for Build)
 * Returns mock routes until SDK is integrated
 */

import { NextRequest, NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import { checkRateLimit, getClientIdentifier } from "../../../lib/rateLimit";
import { sanitizeAmount, isValidPublicKey } from "../../../lib/validation";
import { DEFAULT_SOLANA_RPC_URL } from "@/config/constants";

const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  DEFAULT_SOLANA_RPC_URL;

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
      inputAmount,
      useMEVProtection = true,
    } = await request.json();

    // Security: Validate inputs
    if (!inputMint || !outputMint || !inputAmount) {
      return NextResponse.json(
        {
          error: "Missing required fields: inputMint, outputMint, inputAmount",
        },
        { status: 400 }
      );
    }

    // Security: Validate public keys
    if (!isValidPublicKey(inputMint) || !isValidPublicKey(outputMint)) {
      return NextResponse.json(
        { error: "Invalid token mint address" },
        { status: 400 }
      );
    }

    // Security: Validate amount
    const validatedAmount = sanitizeAmount(inputAmount.toString(), {
      min: 0.000001,
      max: 1e12,
    });

    if (validatedAmount === null) {
      return NextResponse.json(
        { error: "Invalid input amount" },
        { status: 400 }
      );
    }

    // Return mock routes (replace with actual SDK integration later)
    const routes = [
      {
        id: "route-1",
        venues: ["Orca"],
        expectedOutput: (inputAmount * 0.99).toString(),
        effectiveRate: 0.99,
        totalCost: inputAmount * 0.01,
        mevRisk: useMEVProtection ? "low" : "medium",
        estimatedTime: 1200,
        splits: [],
      },
      {
        id: "route-2",
        venues: ["Raydium"],
        expectedOutput: (inputAmount * 0.98).toString(),
        effectiveRate: 0.98,
        totalCost: inputAmount * 0.02,
        mevRisk: useMEVProtection ? "low" : "high",
        estimatedTime: 1500,
        splits: [],
      },
    ];

    return NextResponse.json({ routes, success: true });
  } catch (error) {
    console.error("Error in /api/swap:", error);
    return NextResponse.json(
      { error: "Internal server error" },
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
