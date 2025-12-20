#!/usr/bin/env npx tsx
/**
 * Debug UserRebate PDA on mainnet.
 *
 * Usage:
 *   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com \
 *   npx tsx scripts/debug-user-rebate.ts --wallet=<WALLET_PUBKEY>
 */

import { Connection, PublicKey } from "@solana/web3.js";

const DEFAULT_ROUTER_PROGRAM_ID =
  process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID ||
  process.env.ROUTER_PROGRAM_ID ||
  "APHj6L2b2bA2q62jwYZp38dqbTxQUqwatqdUum1trPnN";

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of argv) {
    if (!part.startsWith("--")) continue;
    const [rawKey, ...rest] = part.slice(2).split("=");
    const key = rawKey.trim();
    const value = rest.join("=");
    out[key] = value === "" ? "true" : value;
  }
  return out;
}

function resolveRpcUrl(arg?: string): string {
  const rpc = arg ?? process.env.SOLANA_RPC_URL;
  if (!rpc) {
    throw new Error(
      "RPC manquant: fournir --rpc=<URL> ou SOLANA_RPC_URL=<URL>."
    );
  }
  return rpc;
}

function readU64LE(buf: Buffer, offset: number): bigint {
  return buf.readBigUInt64LE(offset);
}

function readI64LE(buf: Buffer, offset: number): bigint {
  return buf.readBigInt64LE(offset);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rpcUrl = resolveRpcUrl(args.rpc);
  const walletStr = args.wallet;
  if (!walletStr) {
    throw new Error("Wallet manquant: fournir --wallet=<PUBKEY>.");
  }

  const programId = new PublicKey(args.programId ?? DEFAULT_ROUTER_PROGRAM_ID);
  const wallet = new PublicKey(walletStr);

  const connection = new Connection(rpcUrl, "confirmed");

  const [userRebatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_rebate"), wallet.toBuffer()],
    programId
  );

  console.log("=== SwapBack UserRebate Debug ===");
  console.log("RPC:", rpcUrl);
  console.log("Program:", programId.toBase58());
  console.log("Wallet:", wallet.toBase58());
  console.log("UserRebate PDA:", userRebatePda.toBase58());

  const info = await connection.getAccountInfo(userRebatePda, "confirmed");
  if (!info) {
    console.log("\n❌ Compte user_rebate introuvable on-chain.");
    console.log(
      "➡️  Dans l'état actuel du programme, si ce compte n'est pas fourni au swap, le crédit rebates est ignoré."
    );
    return;
  }

  console.log("\n✅ Compte user_rebate trouvé");
  console.log("Owner:", info.owner.toBase58());
  console.log("Lamports:", info.lamports);
  console.log("Data length:", info.data.length);

  if (info.data.length < 81) {
    console.log("⚠️  Data trop courte pour décoder UserRebate.");
    return;
  }

  const data = Buffer.from(info.data);
  let offset = 8; // discriminator
  const user = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const unclaimed = readU64LE(data, offset);
  offset += 8;
  const totalClaimed = readU64LE(data, offset);
  offset += 8;
  const totalSwaps = readU64LE(data, offset);
  offset += 8;
  const lastSwapTs = readI64LE(data, offset);
  offset += 8;
  const lastClaimTs = readI64LE(data, offset);
  offset += 8;
  const bump = data.readUInt8(offset);

  const unclaimedUsdc = Number(unclaimed) / 1e6;
  const totalClaimedUsdc = Number(totalClaimed) / 1e6;

  console.log("\n--- Decoded ---");
  console.log("User:", user.toBase58());
  console.log(
    "Unclaimed rebate:",
    unclaimed.toString(),
    `(~${unclaimedUsdc.toFixed(6)} USDC)`
  );
  console.log(
    "Total claimed:",
    totalClaimed.toString(),
    `(~${totalClaimedUsdc.toFixed(6)} USDC)`
  );
  console.log("Total swaps:", totalSwaps.toString());
  console.log("Last swap timestamp:", lastSwapTs.toString());
  console.log("Last claim timestamp:", lastClaimTs.toString());
  console.log("Bump:", bump);
}

main().catch((e) => {
  console.error("\n❌", e);
  process.exit(1);
});
