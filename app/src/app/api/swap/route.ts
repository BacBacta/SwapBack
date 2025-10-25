/**
 * API Route: Swap Transaction Builder
 * Builds swap transaction from Jupiter quote
 */

import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

const JUPITER_API = "https://quote-api.jup.ag/v6";
const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  "https://api.devnet.solana.com";

export async function POST(request: NextRequest) {
  try {
    const {
      quoteResponse,
      userPublicKey,
      wrapUnwrapSOL = true,
      priorityFee,
      dynamicComputeUnitLimit = true,
    } = await request.json();

    // Validate inputs
    if (!quoteResponse || !userPublicKey) {
      return NextResponse.json(
        {
          error: "Missing required fields: quoteResponse, userPublicKey",
        },
        { status: 400 }
      );
    }

    // Validate public key
    try {
      new PublicKey(userPublicKey);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid userPublicKey" },
        { status: 400 }
      );
    }

    console.log("🔨 Building swap transaction for:", userPublicKey.slice(0, 8) + "...");

    // Build swap transaction via Jupiter
    const swapResponse = await fetch(`${JUPITER_API}/swap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: wrapUnwrapSOL,
        dynamicComputeUnitLimit,
        computeUnitPriceMicroLamports: priorityFee || "auto",
        asLegacyTransaction: false, // Use versioned transactions
      }),
    });

    if (!swapResponse.ok) {
      const errorText = await swapResponse.text();
      console.error("❌ Jupiter swap API error:", swapResponse.status, errorText);
      
      return NextResponse.json(
        {
          error: "Jupiter swap API error",
          details: errorText,
          status: swapResponse.status,
        },
        { status: swapResponse.status }
      );
    }

    const swapData = await swapResponse.json();

    if (!swapData.swapTransaction) {
      return NextResponse.json(
        { error: "No swap transaction returned from Jupiter" },
        { status: 500 }
      );
    }

    console.log("✅ Swap transaction built successfully");

    return NextResponse.json({
      success: true,
      swapTransaction: swapData.swapTransaction,
      lastValidBlockHeight: swapData.lastValidBlockHeight,
      prioritizationFeeLamports: swapData.prioritizationFeeLamports,
      computeUnitLimit: swapData.computeUnitLimit,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("❌ Error building swap transaction:", error);
    
    return NextResponse.json(
      {
        error: "Failed to build swap transaction",
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
