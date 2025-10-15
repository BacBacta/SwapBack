/**
 * Swap Smoke Test
 *
 * Builds and attempts to execute a small swap against the Smart Router pipeline.
 * This harness is intended to be run manually against a funded wallet on devnet
 * or mainnet once the on-chain instruction builders are fully implemented.
 *
 * Usage:
 *   SOLANA_RPC_URL=... SOLANA_KEYPAIR=~/.config/solana/id.json npx tsx scripts/swap-smoke-test.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Signer,
  clusterApiUrl,
} from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

import { LiquidityDataCollector } from "../src/services/LiquidityDataCollector";
import { RouteOptimizationEngine } from "../src/services/RouteOptimizationEngine";
import { IntelligentOrderRouter } from "../src/services/IntelligentOrderRouter";
import { OraclePriceService } from "../src/services/OraclePriceService";
import { JitoBundleService } from "../src/services/JitoBundleService";
import { CircuitBreaker } from "../src/utils/circuit-breaker";
import { SwapExecutor, SwapParams } from "../src/services/SwapExecutor";

const DEFAULT_INPUT_MINT = "So11111111111111111111111111111111111111112"; // SOL
const DEFAULT_OUTPUT_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC

function getRpcUrl(): string {
  return process.env.SOLANA_RPC_URL ?? clusterApiUrl("devnet");
}

function resolveKeypairPath(): string {
  if (process.env.SOLANA_KEYPAIR) {
    return process.env.SOLANA_KEYPAIR;
  }

  return path.join(process.env.HOME ?? "", ".config", "solana", "id.json");
}

function loadKeypair(): Keypair {
  const keypairPath = resolveKeypairPath();
  if (!fs.existsSync(keypairPath)) {
    throw new Error(
      `No keypair found at ${keypairPath}. Set SOLANA_KEYPAIR to a valid keypair file.`
    );
  }

  const secret = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

async function ensureSolBalance(
  connection: Connection,
  publicKey: PublicKey,
  minBalanceLamports: number
): Promise<void> {
  const balance = await connection.getBalance(publicKey);
  console.log("💰 Current balance:", balance / 1e9, "SOL");

  if (balance < minBalanceLamports) {
    throw new Error(
      `Insufficient SOL balance. Need at least ${minBalanceLamports / 1e9} SOL.`
    );
  }
}

async function main(): Promise<void> {
  const rpcUrl = getRpcUrl();
  console.log("🔌 RPC URL:", rpcUrl);

  const connection = new Connection(rpcUrl, "confirmed");
  const keypair = loadKeypair();
  console.log("👛 Wallet:", keypair.publicKey.toBase58());

  await ensureSolBalance(connection, keypair.publicKey, 0.02 * 1e9);

  const liquidityCollector = new LiquidityDataCollector(connection);
  const optimizer = new RouteOptimizationEngine(liquidityCollector);
  const router = new IntelligentOrderRouter(liquidityCollector, optimizer);
  const oracleService = new OraclePriceService(connection);
  const jitoService = new JitoBundleService(connection);
  const circuitBreaker = new CircuitBreaker({
    failureThreshold: 3,
    resetTimeoutMs: 30_000,
  });

  const executor = new SwapExecutor(
    connection,
    liquidityCollector,
    optimizer,
    router,
    oracleService,
    jitoService,
    circuitBreaker
  );

  const inputMint = process.env.INPUT_MINT ?? DEFAULT_INPUT_MINT;
  const outputMint = process.env.OUTPUT_MINT ?? DEFAULT_OUTPUT_MINT;
  const inputAmount = process.env.INPUT_AMOUNT
    ? Number(process.env.INPUT_AMOUNT)
    : 0.1;

  if (!Number.isFinite(inputAmount) || inputAmount <= 0) {
    throw new Error("INPUT_AMOUNT must be a positive number");
  }

  const params: SwapParams = {
    inputMint,
    outputMint,
    inputAmount,
    maxSlippageBps: process.env.MAX_SLIPPAGE_BPS
      ? Number(process.env.MAX_SLIPPAGE_BPS)
      : 75,
    userPublicKey: keypair.publicKey,
    signer: keypair as Signer,
    routePreferences: {
      enableMevProtection: process.env.ENABLE_JITO === "true",
    },
  };

  console.log("\n🛠️  Swap parameters:");
  console.log("   Input mint:", params.inputMint);
  console.log("   Output mint:", params.outputMint);
  console.log("   Amount:", params.inputAmount, "tokens");
  console.log("   Max slippage:", params.maxSlippageBps / 100, "%");

  try {
    console.log("\n📊 Building atomic plan preview...");
    const plan = await router.buildAtomicPlan({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      inputAmount: params.inputAmount,
      maxSlippageBps: params.maxSlippageBps,
    });
    console.log("   Plan ID:", plan.id);
    console.log("   Legs:", plan.legs.length);
    console.log("   Expected output:", plan.expectedOutput);
    console.log("   Min output:", plan.minOutput);
    console.log(
      "   Quote expires in:",
      `${((plan.expiresAt - Date.now()) / 1000).toFixed(2)}s`
    );

    console.log("\n🚀 Executing swap via SwapExecutor...");
    const result = await executor.executeSwap(params);
    console.log("\n✅ Swap result:");
    console.log("   Signature:", result.signature);
    console.log("   Success:", result.success);
    console.log("   Routes used:", result.routes.length);
    console.log("   Output amount:", result.metrics.outputAmount);
  } catch (error) {
    console.error("\n❌ Swap execution failed");
    console.error(error);
    console.error(
      "If this fails due to missing swap instructions, ensure venue-specific builders are implemented before retrying."
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error in swap smoke test", error);
    process.exit(1);
  });
