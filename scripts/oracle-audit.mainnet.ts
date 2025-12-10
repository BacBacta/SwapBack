#!/usr/bin/env npx tsx
/**
 * Oracle Audit Script - Mainnet
 * 
 * Vérifie la validité de tous les oracles Pyth V2 Push Feeds sur mainnet.
 * Génère un rapport JSON avec le statut de chaque feed.
 * 
 * Les Push Feeds V2 utilisent le format PriceUpdateV2, pas l'ancien PriceFeed.
 * Référence: https://docs.pyth.network/price-feeds/core/push-feeds/solana
 * 
 * Usage: npx tsx scripts/oracle-audit.mainnet.ts
 * 
 * @author SwapBack Team
 * @date December 10, 2025
 */

import { Connection, PublicKey, Commitment } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

// ============================================================================
// CONFIGURATION
// ============================================================================

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const MAX_STALENESS_SECONDS = 600; // 10 minutes - feeds older than this are BROKEN
const MAX_CONFIDENCE_BPS = 500; // 5% - confidence > this is LOW_QUALITY

// Token Mints (mainnet)
const MINTS: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  RAY: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
  ORCA: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  WIF: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  JTO: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
  PYTH: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
};

// Pyth Price Feeds (mainnet) - V2 Push Feeds (sponsored by Pyth Data Association)
// https://docs.pyth.network/price-feeds/core/push-feeds/solana
// Addresses derived via scripts/derive-push-feed-addresses.ts on 2025-12-10
// ALL VERIFIED OK in audit
const PYTH_FEEDS: Record<string, string> = {
  SOL_USD: "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE",
  USDC_USD: "Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX",
  USDT_USD: "HT2PLQBcG5EiCcNSaMHAjSgd9F98ecpATbk4Sk5oYuM",
  JUP_USD: "g6eRCbboSwK4tSWngn773RCMexr1APQr4uA9bGZBYfo",
  BONK_USD: "8ihFLu5FimgTQ1Unh4dVyEHUGodJ5gJQCrQf4KUVB9bN",
  WIF_USD: "6B23K3tkb51vLZA14jcEQVCA1pfHptzEHFA93V5dYwbT",
  ORCA_USD: "4CBshVeNBEXz24GAxNhnMdpLxBALHL8iAoYQf4VwS8GS",
  PYTH_USD: "nrYkQQQur7z8rYTST3HWceMziog46ZQU5vCa8iLvsY4",
  ETH_USD: "42amVS4KgzR9rA28tkVYqVXjq9Qa8dcZQMbH5EYFX6XC",
  BTC_USD: "4cSM2e6rvbGQUFiJbqytoVMi5GgghSMr8LwVrT9VPSPo",
};

// Switchboard V2 is EOL - no longer tested
const SWITCHBOARD_FEEDS: Record<string, string> = {};

// ============================================================================
// TYPES
// ============================================================================

type FeedStatus = "OK" | "STALE" | "BROKEN" | "NOT_FOUND" | "LOW_QUALITY" | "UNKNOWN";

interface FeedAuditResult {
  feedName: string;
  address: string;
  provider: "pyth" | "switchboard";
  status: FeedStatus;
  price?: number;
  confidence?: number;
  confidenceBps?: number;
  publishTime?: number;
  ageSeconds?: number;
  error?: string;
}

interface AuditReport {
  timestamp: string;
  rpcUrl: string;
  maxStalenessSeconds: number;
  maxConfidenceBps: number;
  feeds: FeedAuditResult[];
  summary: {
    total: number;
    ok: number;
    stale: number;
    broken: number;
    notFound: number;
    lowQuality: number;
    unknown: number;
  };
}

// ============================================================================
// PYTH V2 DECODER
// ============================================================================

/**
 * Pyth PriceUpdateV2 account structure (simplified)
 * Reference: https://github.com/pyth-network/pyth-crosschain/blob/main/target_chains/solana/pyth_solana_receiver_sdk/src/price_update.rs
 * 
 * PriceUpdateV2 layout:
 * - discriminator: 8 bytes
 * - write_authority: 32 bytes
 * - verification_level: 1 byte
 * - price_message: PriceFeedMessage
 *   - feed_id: 32 bytes
 *   - price: i64
 *   - conf: u64
 *   - exponent: i32
 *   - publish_time: i64
 *   - prev_publish_time: i64
 *   - ema_price: i64
 *   - ema_conf: u64
 * - posted_slot: u64
 */
function parsePriceUpdateV2(data: Buffer): {
  price: number;
  confidence: number;
  exponent: number;
  publishTime: number;
} | null {
  // Minimum size for PriceUpdateV2
  if (data.length < 120) {
    return null;
  }

  try {
    // Offsets based on PriceUpdateV2 layout
    const PRICE_MESSAGE_OFFSET = 8 + 32 + 1; // discriminator + write_authority + verification_level
    const FEED_ID_SIZE = 32;
    
    // Price message offsets (relative to PRICE_MESSAGE_OFFSET)
    const priceOffset = PRICE_MESSAGE_OFFSET + FEED_ID_SIZE;
    const confOffset = priceOffset + 8;
    const exponentOffset = confOffset + 8;
    const publishTimeOffset = exponentOffset + 4;
    
    // Read values
    const priceRaw = data.readBigInt64LE(priceOffset);
    const confRaw = data.readBigUInt64LE(confOffset);
    const exponent = data.readInt32LE(exponentOffset);
    const publishTime = Number(data.readBigInt64LE(publishTimeOffset));
    
    // Convert to float with exponent
    const price = Number(priceRaw) * Math.pow(10, exponent);
    const confidence = Number(confRaw) * Math.pow(10, exponent);
    
    return { price, confidence, exponent, publishTime };
  } catch (e) {
    return null;
  }
}

async function auditPythFeed(
  connection: Connection,
  feedName: string,
  address: string
): Promise<FeedAuditResult> {
  const result: FeedAuditResult = {
    feedName,
    address,
    provider: "pyth",
    status: "UNKNOWN",
  };

  try {
    const pubkey = new PublicKey(address);
    const accountInfo = await connection.getAccountInfo(pubkey);

    if (!accountInfo || !accountInfo.data) {
      result.status = "NOT_FOUND";
      result.error = "Account not found on-chain";
      return result;
    }

    // Parse Pyth V2 PriceUpdateV2 data
    const priceData = parsePriceUpdateV2(accountInfo.data);
    
    if (!priceData) {
      result.status = "BROKEN";
      result.error = "Failed to parse PriceUpdateV2 data";
      return result;
    }
    
    if (!priceData.price || priceData.price === 0) {
      result.status = "BROKEN";
      result.error = "Price is zero or undefined";
      return result;
    }

    const now = Math.floor(Date.now() / 1000);
    const publishTime = priceData.publishTime;
    const ageSeconds = now - publishTime;

    result.price = priceData.price;
    result.confidence = priceData.confidence;
    result.publishTime = publishTime;
    result.ageSeconds = ageSeconds;

    // Calculate confidence in basis points
    if (priceData.price > 0 && priceData.confidence) {
      result.confidenceBps = Math.round((priceData.confidence / Math.abs(priceData.price)) * 10000);
    }

    // Check staleness
    if (ageSeconds > MAX_STALENESS_SECONDS) {
      result.status = "STALE";
      result.error = `Data is ${ageSeconds}s old (max: ${MAX_STALENESS_SECONDS}s)`;
      return result;
    }

    // Check confidence
    if (result.confidenceBps && result.confidenceBps > MAX_CONFIDENCE_BPS) {
      result.status = "LOW_QUALITY";
      result.error = `Confidence too wide: ${result.confidenceBps} bps (max: ${MAX_CONFIDENCE_BPS} bps)`;
      return result;
    }

    result.status = "OK";
    return result;
  } catch (e) {
    result.status = "BROKEN";
    result.error = e instanceof Error ? e.message : "Unknown error";
    return result;
  }
}

// ============================================================================
// SWITCHBOARD DECODER
// ============================================================================

async function auditSwitchboardFeed(
  connection: Connection,
  feedName: string,
  address: string
): Promise<FeedAuditResult> {
  const result: FeedAuditResult = {
    feedName,
    address,
    provider: "switchboard",
    status: "UNKNOWN",
  };

  try {
    const pubkey = new PublicKey(address);
    const accountInfo = await connection.getAccountInfo(pubkey);

    if (!accountInfo || !accountInfo.data) {
      result.status = "NOT_FOUND";
      result.error = "Account not found on-chain";
      return result;
    }

    // Switchboard AggregatorAccountData structure
    // The layout is complex, but we need:
    // - latestConfirmedRound.result (f128 at offset ~288)
    // - latestConfirmedRound.roundOpenTimestamp (i64 at offset ~280)
    
    const data = accountInfo.data;
    
    // Check minimum size for aggregator account
    if (data.length < 500) {
      result.status = "BROKEN";
      result.error = "Account data too small for Switchboard aggregator";
      return result;
    }

    // Read latestConfirmedRound.roundOpenTimestamp (i64 at offset 280)
    // Note: This is a simplified decode - production should use @switchboard-xyz/solana.js
    try {
      // Offset for latestConfirmedRound.roundOpenTimestamp
      const timestampOffset = 280;
      const timestampBigInt = data.readBigInt64LE(timestampOffset);
      const timestamp = Number(timestampBigInt);
      
      // Offset for latestConfirmedRound.result (SwitchboardDecimal is 16 bytes)
      const resultOffset = 288;
      // SwitchboardDecimal: mantissa (i128, 16 bytes) + scale (u32, 4 bytes)
      // We'll read mantissa as two i64s and combine
      const mantissaLow = data.readBigInt64LE(resultOffset);
      const mantissaHigh = data.readBigInt64LE(resultOffset + 8);
      const scale = data.readInt32LE(resultOffset + 16);
      
      // Combine mantissa (simplified - may lose precision for very large numbers)
      const mantissa = Number(mantissaLow) + Number(mantissaHigh) * 2**64;
      const price = mantissa / Math.pow(10, scale);
      
      const now = Math.floor(Date.now() / 1000);
      const ageSeconds = now - timestamp;
      
      result.price = price;
      result.publishTime = timestamp;
      result.ageSeconds = ageSeconds;
      
      if (price === 0 || !isFinite(price)) {
        result.status = "BROKEN";
        result.error = "Price is zero or invalid";
        return result;
      }
      
      if (ageSeconds > MAX_STALENESS_SECONDS) {
        result.status = "STALE";
        result.error = `Data is ${ageSeconds}s old (max: ${MAX_STALENESS_SECONDS}s)`;
        return result;
      }
      
      result.status = "OK";
      return result;
    } catch (decodeErr) {
      // If manual decode fails, mark as broken
      result.status = "BROKEN";
      result.error = `Decode error: ${decodeErr instanceof Error ? decodeErr.message : "Unknown"}`;
      return result;
    }
  } catch (e) {
    result.status = "BROKEN";
    result.error = e instanceof Error ? e.message : "Unknown error";
    return result;
  }
}

// ============================================================================
// MAIN AUDIT
// ============================================================================

async function main() {
  console.log("🔍 SwapBack Oracle Audit - Mainnet");
  console.log("================================\n");
  
  const connection = new Connection(RPC_URL, "confirmed" as Commitment);
  
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Max Staleness: ${MAX_STALENESS_SECONDS}s`);
  console.log(`Max Confidence: ${MAX_CONFIDENCE_BPS} bps\n`);
  
  const results: FeedAuditResult[] = [];
  
  // Audit Pyth feeds
  console.log("📊 Auditing Pyth feeds...");
  for (const [name, address] of Object.entries(PYTH_FEEDS)) {
    const result = await auditPythFeed(connection, name, address);
    results.push(result);
    const statusEmoji = result.status === "OK" ? "✅" : result.status === "STALE" ? "⏰" : "❌";
    console.log(`  ${statusEmoji} ${name}: ${result.status}${result.ageSeconds ? ` (${result.ageSeconds}s old)` : ""}`);
  }
  
  console.log("\n📊 Auditing Switchboard feeds...");
  for (const [name, address] of Object.entries(SWITCHBOARD_FEEDS)) {
    const result = await auditSwitchboardFeed(connection, name, address);
    results.push(result);
    const statusEmoji = result.status === "OK" ? "✅" : result.status === "STALE" ? "⏰" : "❌";
    console.log(`  ${statusEmoji} ${name}: ${result.status}${result.ageSeconds ? ` (${result.ageSeconds}s old)` : ""}`);
  }
  
  // Calculate summary
  const summary = {
    total: results.length,
    ok: results.filter(r => r.status === "OK").length,
    stale: results.filter(r => r.status === "STALE").length,
    broken: results.filter(r => r.status === "BROKEN").length,
    notFound: results.filter(r => r.status === "NOT_FOUND").length,
    lowQuality: results.filter(r => r.status === "LOW_QUALITY").length,
    unknown: results.filter(r => r.status === "UNKNOWN").length,
  };
  
  // Generate report
  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    rpcUrl: RPC_URL,
    maxStalenessSeconds: MAX_STALENESS_SECONDS,
    maxConfidenceBps: MAX_CONFIDENCE_BPS,
    feeds: results,
    summary,
  };
  
  // Save report
  const outputPath = path.join(process.cwd(), "oracle_audit_report.json");
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved to: ${outputPath}`);
  
  // Print summary
  console.log("\n📊 SUMMARY");
  console.log("==========");
  console.log(`Total feeds:    ${summary.total}`);
  console.log(`✅ OK:          ${summary.ok}`);
  console.log(`⏰ Stale:       ${summary.stale}`);
  console.log(`❌ Broken:      ${summary.broken}`);
  console.log(`🔍 Not Found:   ${summary.notFound}`);
  console.log(`⚠️  Low Quality: ${summary.lowQuality}`);
  console.log(`❓ Unknown:     ${summary.unknown}`);
  
  // List broken/stale feeds
  const problemFeeds = results.filter(r => r.status !== "OK");
  if (problemFeeds.length > 0) {
    console.log("\n⚠️  FEEDS REQUIRING ATTENTION:");
    for (const feed of problemFeeds) {
      console.log(`  - ${feed.feedName} (${feed.provider}): ${feed.status}`);
      if (feed.error) console.log(`    Error: ${feed.error}`);
    }
  }
  
  // Exit with error if critical issues
  if (summary.broken > 0 || summary.notFound > 0) {
    console.log("\n❌ Audit FAILED: Some feeds are broken or not found.");
    process.exit(1);
  }
  
  if (summary.stale > 0) {
    console.log("\n⚠️  Audit WARNING: Some feeds are stale.");
    process.exit(0);
  }
  
  console.log("\n✅ Audit PASSED: All feeds are healthy.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
