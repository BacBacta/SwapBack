#!/usr/bin/env -S npx tsx
/**
 * Debug Meteora DLMM account resolution (no swap, no funds needed).
 *
 * Usage:
 *   SOLANA_RPC_URL=https://... npx tsx scripts/debug-meteora-resolver.ts \
 *     --inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
 *     --outputMint=So11111111111111111111111111111111111111112
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AccountLayout, getAssociatedTokenAddress } from "@solana/spl-token";

import { getMeteoraAccounts } from "../app/src/lib/native-router/dex/DEXAccountResolvers";

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const [k, v] = raw.slice(2).split("=", 2);
    if (!k) continue;
    out[k] = v ?? "true";
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const rpcUrl = (process.env.SOLANA_RPC_URL || args.rpc || "https://api.mainnet-beta.solana.com").trim();
  const inputMint = new PublicKey(args.inputMint);
  const outputMint = new PublicKey(args.outputMint);

  // Use a random user if not provided, but we won't find initialized ATAs for random user.
  // Better to use a real user if possible, or just check the derived addresses.
  const user = args.user ? new PublicKey(args.user) : new PublicKey("GqrXQUFtFxBh8xPB8Z2eS8hfF4MXVFWot1BiWDHXxYfM"); // Use the user from logs if possible

  const connection = new Connection(rpcUrl, "confirmed");

  console.log("Resolving Meteora accounts...");
  const resolved = await getMeteoraAccounts(connection, inputMint, outputMint, user);
  if (!resolved) {
    console.log("[debug-meteora-resolver] getMeteoraAccounts returned null");
    process.exit(2);
  }

  const a = resolved.accounts;
  const lbPair = a[0];
  const reserveX = a[2];
  const reserveY = a[3];
  const userTokenX = a[4];
  const userTokenY = a[5];
  const tokenXMint = a[6];
  const tokenYMint = a[7];
  const tokenXProgram = a[11];
  const tokenYProgram = a[12];

  console.log("--- Meteora DLMM resolution ---");
  console.log("RPC:", rpcUrl);
  console.log("user:", user.toBase58());
  console.log("inputMint:", inputMint.toBase58());
  console.log("outputMint:", outputMint.toBase58());
  console.log("lbPair:", lbPair.toBase58());
  console.log("reserveX:", reserveX.toBase58());
  console.log("reserveY:", reserveY.toBase58());
  console.log("tokenXMint:", tokenXMint.toBase58());
  console.log("tokenYMint:", tokenYMint.toBase58());
  console.log("tokenXProgram:", tokenXProgram.toBase58());
  console.log("tokenYProgram:", tokenYProgram.toBase58());
  console.log("userTokenX:", userTokenX.toBase58());
  console.log("userTokenY:", userTokenY.toBase58());
  console.log("binArrays:", Math.max(0, a.length - 15));

  const [rxInfo, ryInfo] = await connection.getMultipleAccountsInfo([reserveX, reserveY], "confirmed");
  if (rxInfo?.data && ryInfo?.data) {
    const rx = AccountLayout.decode(rxInfo.data);
    const ry = AccountLayout.decode(ryInfo.data);
    console.log("reserveX.mint:", new PublicKey(rx.mint).toBase58());
    console.log("reserveY.mint:", new PublicKey(ry.mint).toBase58());
  } else {
    console.log("(reserve token accounts missing?)");
  }

  // Check User ATAs mints
  const [uxInfo, uyInfo] = await connection.getMultipleAccountsInfo([userTokenX, userTokenY], "confirmed");
  if (uxInfo?.data) {
    const ux = AccountLayout.decode(uxInfo.data);
    console.log("userTokenX.mint:", new PublicKey(ux.mint).toBase58());
  } else {
    console.log("userTokenX not initialized or empty");
  }
  if (uyInfo?.data) {
    const uy = AccountLayout.decode(uyInfo.data);
    console.log("userTokenY.mint:", new PublicKey(uy.mint).toBase58());
  } else {
    console.log("userTokenY not initialized or empty");
  }

  // Simulate Router Logic
  // Router expects user_token_account_a to be Input ATA, b to be Output ATA.
  
  // We need to derive what the CLIENT (true-native-swap) would pass as A and B.
  // true-native-swap uses getAssociatedTokenAddress(inputMint, user) and (outputMint, user).
  // It assumes standard Token Program unless specified? No, it uses mint owner.
  
  const inputMintInfo = await connection.getAccountInfo(inputMint);
  const outputMintInfo = await connection.getAccountInfo(outputMint);
  const inputProgram = inputMintInfo?.owner ?? new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const outputProgram = outputMintInfo?.owner ?? new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

  const userTokenA = await getAssociatedTokenAddress(inputMint, user, false, inputProgram); // Input ATA
  const userTokenB = await getAssociatedTokenAddress(outputMint, user, false, outputProgram); // Output ATA
  
  console.log("--- Router Simulation ---");
  console.log("userTokenA (Input):", userTokenA.toBase58());
  console.log("userTokenB (Output):", userTokenB.toBase58());
  
  let x_to_y: boolean | undefined;
  if (userTokenX.equals(userTokenA) && userTokenY.equals(userTokenB)) {
    console.log("Match: X=Input, Y=Output => x_to_y = TRUE");
    x_to_y = true;
  } else if (userTokenX.equals(userTokenB) && userTokenY.equals(userTokenA)) {
    console.log("Match: X=Output, Y=Input => x_to_y = FALSE");
    x_to_y = false;
  } else {
    console.log("MISMATCH: User tokens do not match Input/Output pair!");
    console.log("userTokenX:", userTokenX.toBase58());
    console.log("userTokenY:", userTokenY.toBase58());
  }

  if (x_to_y !== undefined) {
    console.log(`Swap Direction: ${x_to_y ? "X -> Y" : "Y -> X"}`);
    const sourceUser = x_to_y ? userTokenX : userTokenY;
    const destReserve = x_to_y ? reserveX : reserveY;
    const mint = x_to_y ? tokenXMint : tokenYMint;
    
    console.log("Expected Transfer:");
    console.log("From:", sourceUser.toBase58());
    console.log("To:", destReserve.toBase58());
    console.log("Mint:", mint.toBase58());
    
    // Verify consistency
    if (uxInfo && x_to_y) {
        const ux = AccountLayout.decode(uxInfo.data);
        if (!new PublicKey(ux.mint).equals(mint)) console.error("❌ ERROR: Source Account Mint mismatch!");
        else console.log("✅ Source Account Mint matches");
    }
    if (uyInfo && !x_to_y) {
        const uy = AccountLayout.decode(uyInfo.data);
        if (!new PublicKey(uy.mint).equals(mint)) console.error("❌ ERROR: Source Account Mint mismatch!");
        else console.log("✅ Source Account Mint matches");
    }
  }
}

main().catch((e) => {
  console.error("[debug-meteora-resolver] error:", e);
  process.exit(1);
});
