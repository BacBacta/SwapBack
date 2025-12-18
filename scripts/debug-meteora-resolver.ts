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
import { AccountLayout } from "@solana/spl-token";

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

  const user = args.user ? new PublicKey(args.user) : Keypair.generate().publicKey;

  const connection = new Connection(rpcUrl, "confirmed");

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

  const suspicious = tokenXMint.equals(reserveX) || tokenXMint.equals(reserveY) || tokenYMint.equals(reserveX) || tokenYMint.equals(reserveY);
  if (suspicious) {
    console.log("⚠️ Suspicious: a token mint equals a reserve token account address");
    process.exit(3);
  }
}

main().catch((e) => {
  console.error("[debug-meteora-resolver] error:", e);
  process.exit(1);
});
