/**
 * API Route: Execute Transaction
 * Executes the selected swap route and returns transaction signature
 */

import { NextRequest, NextResponse } from "next/server";
import { Connection, VersionedTransaction } from "@solana/web3.js";

// ============================================================================
// CONFIGURATION
// ============================================================================

const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

// ============================================================================
// API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      signedTransaction, // Base64 encoded signed transaction
    } = body;

    if (!signedTransaction) {
      return NextResponse.json(
        { error: "Missing signedTransaction" },
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
