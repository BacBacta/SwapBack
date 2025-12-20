#!/usr/bin/env -S npx tsx
import { Connection, Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";
import TrueNativeSwap, { SOL_MINT, USDC_MINT } from "../app/src/lib/native-router/true-native-swap";
import { getDEXAccounts } from "../app/src/lib/native-router/dex/DEXAccountResolvers";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const connection = new Connection(RPC, "confirmed");

// User from logs (likely has USDC/SOL accounts) or override via --user or USER_PUBKEY env var
const args = process.argv.slice(2).reduce((acc: any, raw) => {
  if (!raw.startsWith("--")) return acc;
  const [k, v] = raw.slice(2).split("=", 2);
  acc[k] = v ?? "true";
  return acc;
}, {} as Record<string, string>);
const USER = new PublicKey(args.user ?? process.env.USER_PUBKEY ?? "GqrXQUFtFxBh8xPB8Z2eS8hfF4MXVFWot1BiWDHXxYfM");

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

  // Debug: print the DEX account slice and the swap instruction keys
  console.log('\n--- DEX account slice (first 30) ---');
  dexAccounts.accounts.slice(0, 30).forEach((a, i) => console.log(` [${i}] ${a.toBase58()}`));

  console.log('\n--- swapIx keys ---');
  ix.keys.forEach((k, i) => console.log(` [${i}] ${k.pubkey.toBase58()} writable=${k.isWritable} signer=${k.isSigner}`));

  // Map expected indices for Meteora
  console.log('\n--- Expected Meteora indices ---');
  console.log(' lb_pair [0] =', dexAccounts.accounts[0].toBase58());
  console.log(' reserve_x [2] =', dexAccounts.accounts[2].toBase58());
  console.log(' reserve_y [3] =', dexAccounts.accounts[3].toBase58());
  console.log(' user_token_x [4] =', dexAccounts.accounts[4].toBase58());
  console.log(' user_token_y [5] =', dexAccounts.accounts[5].toBase58());
  console.log(' token_x_mint [6] =', dexAccounts.accounts[6].toBase58());
  console.log(' token_y_mint [7] =', dexAccounts.accounts[7].toBase58());

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
  const sim = await connection.simulateTransaction(msg, { replaceRecentBlockhash: true, sigVerify: false });

  console.log("Simulation Error:", JSON.stringify(sim.value.err));
  console.log("Logs:");
  sim.value.logs?.forEach(l => console.log(l));
}

main().catch(console.error);
