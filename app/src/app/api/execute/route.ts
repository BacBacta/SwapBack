/**
 * API Route: Execute Swap Transaction
 * Sends signed transaction to Solana network and confirms it
 */

import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  VersionedTransaction,
  TransactionConfirmationStrategy,
} from "@solana/web3.js";

const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export async function POST(request: NextRequest) {
  try {
    const {
      signedTransaction,
      lastValidBlockHeight,
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

    const latestBlockhash = await connection.getLatestBlockhash("confirmed");
    const confirmationStrategy: TransactionConfirmationStrategy = {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight:
        lastValidBlockHeight || latestBlockhash.lastValidBlockHeight,
    };

    const confirmation = await connection.confirmTransaction(
      confirmationStrategy,
      "confirmed"
    );

    if (confirmation.value.err) {
      console.error("❌ Transaction failed:", confirmation.value.err);

      return NextResponse.json(
        {
          success: false,
          error: "Transaction failed",
          signature,
          details: confirmation.value.err,
        },
        { status: 400 }
      );
    }

    console.log("🎉 Transaction confirmed:", signature);

    return NextResponse.json({
      success: true,
      signature,
      confirmed: true,
      slot: confirmation.context.slot,
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
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: "Health check failed",
      },
      { status: 500 }
    );
  }
}
