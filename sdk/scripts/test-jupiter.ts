/**
 * Test Script: Jupiter Integration on Devnet
 *
 * This script tests the real Jupiter API integration by:
 * 1. Getting a quote for SOL -> USDC swap
 * 2. Displaying route information
 * 3. (Optional) Executing a real swap on devnet
 *
 * Usage:
 *   npm run test:jupiter
 *
 * Or with custom params:
 *   AMOUNT=0.1 EXECUTE=true npm run test:jupiter
 */

import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { JupiterService } from "../src/services/JupiterService";
import * as fs from "fs";
import * as path from "path";

// Common token addresses on Solana
const TOKENS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
};

async function loadKeypair(): Promise<Keypair> {
  // Try to load from default Solana CLI location
  const keypairPath = path.join(
    process.env.HOME || "",
    ".config",
    "solana",
    "id.json"
  );

  if (fs.existsSync(keypairPath)) {
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(keypairData));
  }

  // Create new keypair for testing
  console.log("⚠️  No keypair found, creating new one for testing...");
  const keypair = Keypair.generate();
  console.log("🔑 Keypair created:", keypair.publicKey.toBase58());
  console.log(
    "💡 Get devnet SOL: solana airdrop 2",
    keypair.publicKey.toBase58(),
    "--url devnet"
  );
  return keypair;
}

async function testJupiterQuote() {
  console.log("🧪 Testing Jupiter Integration on Devnet\n");

  // Setup
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  const jupiter = new JupiterService(connection);
  const keypair = await loadKeypair();

  console.log("📡 Connected to Solana devnet");
  console.log("👛 Wallet:", keypair.publicKey.toBase58());

  // Check balance
  const balance = await connection.getBalance(keypair.publicKey);
  console.log("💰 Balance:", balance / 1e9, "SOL\n");

  if (balance === 0) {
    console.log("❌ No SOL balance. Get devnet SOL with:");
    console.log(
      `   solana airdrop 2 ${keypair.publicKey.toBase58()} --url devnet\n`
    );
    return;
  }

  // Test parameters
  const inputMint = TOKENS.SOL;
  const outputMint = TOKENS.USDC;
  const amount = process.env.AMOUNT
    ? parseFloat(process.env.AMOUNT) * 1e9
    : 0.1 * 1e9; // Default: 0.1 SOL
  const slippageBps = 50; // 0.5%

  console.log("🔍 Getting quote from Jupiter...");
  console.log("   Input: SOL");
  console.log("   Output: USDC");
  console.log("   Amount:", amount / 1e9, "SOL");
  console.log("   Slippage:", slippageBps / 100, "%\n");

  try {
    // Get quote
    const quote = await jupiter.getQuote(
      inputMint,
      outputMint,
      Math.floor(amount),
      slippageBps
    );

    // Display results
    console.log("✅ Quote received!\n");
    console.log("📊 Quote Details:");
    console.log("   Input Amount:", parseInt(quote.inAmount) / 1e9, "SOL");
    console.log("   Output Amount:", parseInt(quote.outAmount) / 1e6, "USDC");
    console.log("   Price Impact:", quote.priceImpactPct, "%");
    console.log("   Slippage:", quote.slippageBps / 100, "%");
    console.log("   Swap Mode:", quote.swapMode);

    // Calculate effective price
    const effectivePrice = jupiter.calculateEffectivePrice(quote, 9, 6);
    console.log(
      "   Effective Price:",
      effectivePrice.toFixed(4),
      "USDC per SOL\n"
    );

    // Display route
    const routeInfo = jupiter.parseRouteInfo(quote);
    console.log("🛣️  Route Plan:");
    routeInfo.marketInfos.forEach((market, index) => {
      console.log(`   ${index + 1}. ${market.label}`);
      console.log(`      AMM: ${market.id.slice(0, 8)}...`);
      console.log(`      Fee: ${market.feeAmount} lamports`);
    });
    console.log("");

    // Optional: Execute swap
    if (process.env.EXECUTE === "true") {
      console.log(
        "⚠️  EXECUTE=true detected, performing real swap on devnet...\n"
      );

      // Simple signer function (in production, use wallet adapter)
      const signTransaction = async (tx: any) => {
        tx.sign([keypair]);
        return tx;
      };

      const signature = await jupiter.executeSwap(
        inputMint,
        outputMint,
        Math.floor(amount),
        keypair.publicKey,
        signTransaction,
        slippageBps,
        1000 // 1000 micro-lamports priority fee
      );

      console.log("🎉 Swap executed successfully!");
      console.log("   Signature:", signature);
      console.log(
        "   Explorer: https://explorer.solana.com/tx/" +
          signature +
          "?cluster=devnet\n"
      );
    } else {
      console.log("💡 To execute this swap, run:");
      console.log("   EXECUTE=true npm run test:jupiter\n");
    }

    // Display supported tokens sample
    console.log("🪙 Fetching supported tokens...");
    const tokens = await jupiter.getSupportedTokens();
    console.log("   Total supported tokens:", tokens.length);
    console.log("   Sample tokens:");
    tokens.slice(0, 5).forEach((token) => {
      console.log(`   - ${token.symbol} (${token.name})`);
    });
    console.log("");
  } catch (error) {
    console.error("❌ Error:", error);
    if (error instanceof Error) {
      console.error("   Message:", error.message);
    }
    process.exit(1);
  }

  console.log("✅ Jupiter integration test completed!\n");
}

// Run test
testJupiterQuote()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
