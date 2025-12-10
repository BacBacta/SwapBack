#!/usr/bin/env npx tsx
/**
 * Script to derive Pyth Push Feed addresses from Feed IDs
 * 
 * Uses the correct PDA derivation from @pythnetwork/pyth-solana-receiver
 * Seeds: [shardBuffer (2 bytes LE), feedId (32 bytes)]
 * Program: pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT (Push Oracle)
 * 
 * Reference: https://docs.pyth.network/price-feeds/core/push-feeds/solana
 */

import { PublicKey } from "@solana/web3.js";

// Pyth Push Oracle Program ID (mainnet) - from @pythnetwork/pyth-solana-receiver
const PYTH_PUSH_ORACLE_PROGRAM_ID = new PublicKey("pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT");

// Feed IDs from Pyth (hex strings without 0x prefix)
// https://www.pyth.network/developers/price-feed-ids
// Verified via https://hermes.pyth.network/v2/price_feeds
const FEED_IDS: Record<string, string> = {
  SOL_USD: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  USDC_USD: "eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
  USDT_USD: "2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
  JUP_USD: "0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996",
  BONK_USD: "72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419",
  WIF_USD: "4ca4beeca86f0d164160323817a4e42b10010a724c2217c6ee41b54cd4cc61fc",
  ORCA_USD: "37505261e557e251290b8c8899453064e8d760ed5c65a779726f2490980da74c", // Corrected
  PYTH_USD: "0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff",
  ETH_USD: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  BTC_USD: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
};

/**
 * Derive the PriceUpdateV2 account address for a given feed ID and shard
 * Matches the implementation in @pythnetwork/pyth-solana-receiver
 */
function derivePriceUpdateAccount(feedId: string, shard: number = 0): PublicKey {
  const feedIdBuffer = Buffer.from(feedId, "hex");
  if (feedIdBuffer.length !== 32) {
    throw new Error("Feed ID should be 32 bytes long");
  }
  
  const shardBuffer = Buffer.alloc(2);
  shardBuffer.writeUInt16LE(shard);
  
  // Seeds: [shardBuffer, feedIdBuffer] - NO prefix
  const [pda] = PublicKey.findProgramAddressSync(
    [shardBuffer, feedIdBuffer],
    PYTH_PUSH_ORACLE_PROGRAM_ID
  );
  
  return pda;
}

async function main() {
  console.log("🔍 Deriving Pyth Push Feed Addresses (Shard 0)\n");
  console.log("PYTH_PUSH_ORACLE_PROGRAM_ID:", PYTH_PUSH_ORACLE_PROGRAM_ID.toBase58());
  console.log("");
  
  const results: Record<string, string> = {};
  
  for (const [name, feedId] of Object.entries(FEED_IDS)) {
    const address = derivePriceUpdateAccount(feedId, 0);
    results[name] = address.toBase58();
    console.log(`${name}: "${address.toBase58()}"`);
  }
  
  console.log("\n// Copy this to oracles.ts:");
  console.log("const PYTH_FEEDS = {");
  for (const [name, address] of Object.entries(results)) {
    console.log(`  ${name}: "${address}",`);
  }
  console.log("};");
}

main().catch(console.error);
