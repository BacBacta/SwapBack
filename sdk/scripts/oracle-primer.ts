/**
 * Oracle Primer Script
 *
 * Fetches oracle prices for a list of mints using the SDK OraclePriceService
 * to verify publish timestamps and confidence intervals before executing swaps.
 *
 * Usage:
 *   SOLANA_RPC_URL="https://api.mainnet-beta.solana.com" npx tsx scripts/oracle-primer.ts <MINT...>
 *
 * If no mints are provided, defaults to SOL and USDC.
 */

import { Connection, clusterApiUrl } from "@solana/web3.js";
import {
  OraclePriceService,
  formatOraclePrice,
} from "../src/services/OraclePriceService";
import type {
  OraclePriceData,
  OracleVerificationDetail,
} from "../src/types/smart-router";

const DEFAULT_MINTS = [
  "So11111111111111111111111111111111111111112", // SOL
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
];

function getRpcUrl(): string {
  return process.env.SOLANA_RPC_URL ?? clusterApiUrl("mainnet-beta");
}

function formatAge(publishTime: number): string {
  const ageMs = Date.now() - publishTime;
  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return "unknown";
  }
  if (ageMs < 1000) {
    return `${Math.round(ageMs)}ms`;
  }
  if (ageMs < 60_000) {
    return `${(ageMs / 1000).toFixed(2)}s`;
  }
  return `${(ageMs / 60_000).toFixed(2)}m`;
}

function formatConfidence(price: OraclePriceData): string {
  const ratio = Math.abs(price.confidence / price.price);
  return `${(ratio * 100).toFixed(4)}%`;
}

async function main(): Promise<void> {
  const mints = process.argv.slice(2);
  if (mints.length === 0) {
    console.log("ℹ️  No mints supplied, defaulting to SOL/USDC");
  }

  const targets = mints.length ? mints : DEFAULT_MINTS;
  const rpcUrl = getRpcUrl();
  const commitment = (process.env.SOLANA_COMMITMENT as any) ?? "confirmed";

  console.log("🔌 Connecting to", rpcUrl);
  const connection = new Connection(rpcUrl, commitment);
  const oracleService = new OraclePriceService(connection);

  for (const mint of targets) {
    try {
      console.log(`\n🪙 Mint: ${mint}`);
      const price = await oracleService.getTokenPrice(mint);
      const formatted = formatOraclePrice(price);
      console.log("   Price:", formatted);
      console.log("   Provider:", price.provider);
      console.log(
        "   Publish Time:",
        new Date(price.publishTime).toISOString()
      );
      console.log("   Age:", formatAge(price.publishTime));
      console.log("   Confidence:", formatConfidence(price));

      const detail = oracleService.getVerificationDetail(mint);
      if (detail) {
        logVerificationDetail(detail);
      }
    } catch (error) {
      console.error(`   ❌ Failed to fetch oracle price for ${mint}`, error);
    }
  }
}

function logVerificationDetail(detail: OracleVerificationDetail): void {
  const divergence =
    typeof detail.divergencePercent === "number"
      ? `${(detail.divergencePercent * 100).toFixed(4)}%`
      : "n/a";
  const confidencePct =
    detail.price !== 0
      ? `${((Math.abs(detail.confidence) / Math.abs(detail.price)) * 100).toFixed(4)}%`
      : "n/a";
  console.log(
    `   Oracle Meta → provider=${detail.providerUsed}, fallback=${detail.fallbackUsed ? "yes" : "no"}, confidence=${confidencePct}, divergence=${divergence}`
  );
}

main()
  .then(() => {
    console.log("\n✅ Oracle primer complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error while priming oracles", error);
    process.exit(1);
  });
