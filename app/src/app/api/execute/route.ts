/**
 * API Route: Execute Transaction
 * Executes the selected swap route and returns transaction signature
 */

import { NextRequest, NextResponse } from "next/server";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { checkRateLimit, getClientIdentifier } from "../../../lib/rateLimit";
import { DEFAULT_SOLANA_RPC_URL } from "@/config/constants";

// ============================================================================
// CONFIGURATION
// ============================================================================

const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  DEFAULT_SOLANA_RPC_URL;

// ============================================================================
// API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Security: Rate limiting (10 requests per minute for execute - more restrictive)
    const clientId = getClientIdentifier(request.headers);
    const rateLimit = checkRateLimit(clientId, { maxRequests: 10, windowMs: 60000 });
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: "Rate limit exceeded. Please try again later.",
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetAt.toString(),
          },
        }
      );
    }

    const body = await request.json();
    const {
      signedTransaction, // Base64 encoded signed transaction
    } = body;

    // Security: Validate required fields
    if (!signedTransaction) {
      return NextResponse.json(
        { error: "Missing signedTransaction" },
        { status: 400 }
      );
    }

    // Security: Validate base64 format
    if (typeof signedTransaction !== 'string' || !signedTransaction.match(/^[A-Za-z0-9+/=]+$/)) {
      return NextResponse.json(
        { error: "Invalid transaction format" },
        { status: 400 }
      );
    }

    // Initialize connection
    const connection = new Connection(RPC_ENDPOINT, "confirmed");

    // Decode transaction
    const txBuffer = Buffer.from(signedTransaction, "base64");
    let signature: string;

    try {
      // Try as VersionedTransaction first
      const versionedTx = VersionedTransaction.deserialize(txBuffer);
      signature = await connection.sendRawTransaction(versionedTx.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
    } catch (error) {
      console.error("Failed to send transaction:", error);
      throw new Error("Invalid transaction format");
    }

    // Wait for confirmation (initial)
    const latestBlockhash = await connection.getLatestBlockhash("confirmed");

    return NextResponse.json({
      success: true,
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    });
  } catch (error) {
    console.error("Transaction execution error:", error);
    return NextResponse.json(
      {
        error: "Transaction execution failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
