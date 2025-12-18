#!/usr/bin/env -S npx tsx
import { Connection, Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";
import TrueNativeSwap, { SOL_MINT, USDC_MINT } from "../app/src/lib/native-router/true-native-swap";
import { getDEXAccounts } from "../app/src/lib/native-router/dex/DEXAccountResolvers";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const connection = new Connection(RPC, "confirmed");

// User from logs (likely has USDC/SOL accounts)
const USER = new PublicKey("GqrXQUFtFxBh8xPB8Z2eS8hfF4MXVFWot1BiWDHXxYfM");

async function main() {
  console.log("Reproducing USDC -> SOL via Meteora...");
  console.log("User:", USER.toBase58());

  const swapper = new TrueNativeSwap(connection);

  // Force Meteora Venue
  const venue = "METEORA_DLMM";
  const inputMint = USDC_MINT;
  const outputMint = SOL_MINT;
  const amountIn = 1000000; // 1 USDC

  console.log("Resolving accounts...");
  const dexAccounts = await getDEXAccounts(connection, venue, inputMint, outputMint, USER);
  if (!dexAccounts) {
    console.error("Failed to resolve DEX accounts");
    return;
  }

  console.log("Building transaction...");
  const forcedRoute = {
    venue,
    venueProgramId: new PublicKey("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo"),
    inputAmount: amountIn,
    outputAmount: 0,
    priceImpactBps: 0,
    platformFeeBps: 0,
    dexAccounts,
    allQuotes: [],
  };

  const ix = await swapper.buildNativeSwapInstruction(USER, forcedRoute as any, {
    inputMint,
    outputMint,
    amountIn,
    minAmountOut: 0,
    slippageBps: 50,
    userPublicKey: USER,
  });

  const { blockhash } = await connection.getLatestBlockhash();
  const { TransactionMessage } = await import("@solana/web3.js");
  const msg = new VersionedTransaction(
    new TransactionMessage({
      payerKey: USER,
      recentBlockhash: blockhash,
      instructions: [ix],
    }).compileToV0Message()
  );

  console.log("Simulating...");
  const sim = await connection.simulateTransaction(msg);

  console.log("Simulation Error:", JSON.stringify(sim.value.err));
  console.log("Logs:");
  sim.value.logs?.forEach(l => console.log(l));
}

main().catch(console.error);
