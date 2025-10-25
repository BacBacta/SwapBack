/**
 * API Route: Execute Swap Transaction
 * Sends signed transaction to Solana network and confirms it
 */

import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  VersionedTransaction,
} from "@solana/web3.js";

const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export async function POST(request: NextRequest) {
  try {
    const {
      signedTransaction,
    } = await request.json();

    if (!signedTransaction) {
      return NextResponse.json(
        { error: "Missing signedTransaction" },
        { status: 400 }
      );
    }

    console.log("📡 Sending transaction to network...");

    const connection = new Connection(RPC_ENDPOINT, "confirmed");
    const txBuffer = Buffer.from(signedTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(txBuffer);

    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      {
        skipPreflight: false,
        maxRetries: 3,
        preflightCommitment: "confirmed",
      }
    );

    console.log("✅ Transaction sent:", signature);
    console.log("⏳ Confirming transaction...");
    
    // Use polling instead of deprecated confirmTransaction
    let confirmed = false;
    let attempt = 0;
    const maxAttempts = 30;
    
    while (!confirmed && attempt < maxAttempts) {
      try {
        const status = await connection.getSignatureStatus(signature);
        if (status.value?.confirmationStatus === "confirmed" || 
            status.value?.confirmationStatus === "finalized") {
          confirmed = true;
          break;
        }
      } catch (_error) {
        console.log(`Confirmation check attempt ${attempt + 1}/${maxAttempts}`);
      }
      
      attempt++;
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between checks
    }

    if (!confirmed) {
      console.error("❌ Transaction failed: Timeout waiting for confirmation");

      return NextResponse.json(
        {
          success: false,
          error: "Transaction confirmation timeout",
          signature,
        },
        { status: 400 }
      );
    }

    console.log("🎉 Transaction confirmed:", signature);

    return NextResponse.json({
      success: true,
      signature,
      confirmed: true,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("❌ Error executing transaction:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        success: false,
        error: "Failed to execute transaction",
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const connection = new Connection(RPC_ENDPOINT);
    const slot = await connection.getSlot();
    const blockHeight = await connection.getBlockHeight();

    return NextResponse.json({
      status: "ok",
      service: "Transaction Execute API",
      rpc: RPC_ENDPOINT,
      currentSlot: slot,
      blockHeight,
      timestamp: Date.now(),
    });
  } catch (_error) {
    return NextResponse.json(
      {
        status: "error",
        error: "Health check failed",
      },
      { status: 500 }
    );
  }
}
