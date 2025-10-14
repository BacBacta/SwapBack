/**
 * API Route: Swap (Simplified for Build)
 * Returns mock routes until SDK is integrated
 */

import { NextRequest, NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";

const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

export async function POST(request: NextRequest) {
  try {
    const {
      inputMint,
      outputMint,
      inputAmount,
      slippageTolerance = 0.01,
      useMEVProtection = true,
      priorityLevel = "medium",
    } = await request.json();

    // Validate inputs
    if (!inputMint || !outputMint || !inputAmount) {
      return NextResponse.json(
        {
          error: "Missing required fields: inputMint, outputMint, inputAmount",
        },
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
  } catch (error) {
    return NextResponse.json(
      { status: "error", error: "RPC connection failed" },
      { status: 500 }
    );
  }
}
