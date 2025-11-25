#!/usr/bin/env ts-node
/**
 * Interactive MEV Protection Test Script
 * Manually test bundle eligibility and MEV savings
 */

import * as readline from "readline";
import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { SwapExecutor } from "../sdk/src/services/SwapExecutor";
import { LiquidityDataCollector } from "../sdk/src/services/LiquidityDataCollector";
import { RouteOptimizationEngine } from "../sdk/src/services/RouteOptimizationEngine";
import { IntelligentOrderRouter } from "../sdk/src/services/IntelligentOrderRouter";
import { OraclePriceService } from "../sdk/src/services/OraclePriceService";
import { JitoBundleService } from "../sdk/src/services/JitoBundleService";
import { CircuitBreaker } from "../sdk/src/utils/circuit-breaker";

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEVNET_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

// Test scenarios
const TEST_SCENARIOS = [
  {
    name: "Small Trade (0.5 SOL)",
    inputAmount: 0.5,
    expectedEligible: false,
    reason: "Below minimum threshold",
  },
  {
    name: "Medium Trade (5 SOL)",
    inputAmount: 5,
    expectedEligible: false,
    reason: "Below 10 SOL threshold",
  },
  {
    name: "Large Trade (15 SOL)",
    inputAmount: 15,
    expectedEligible: true,
    reason: "Above 10 SOL threshold",
  },
  {
    name: "Very Large Trade (50 SOL)",
    inputAmount: 50,
    expectedEligible: true,
    reason: "High value trade",
  },
];

// ============================================================================
// COLORS
// ============================================================================

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

function log(
  message: string,
  color: keyof typeof COLORS = "reset"
): void {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

// ============================================================================
// MENU
// ============================================================================

function printMenu(): void {
  console.log("\n" + "=".repeat(60));
  log("🛡️  MEV Protection Test Suite", "bright");
  console.log("=".repeat(60));
  console.log("\nChoose a test scenario:\n");

  TEST_SCENARIOS.forEach((scenario, i) => {
    const emoji = scenario.expectedEligible ? "🟢" : "🔴";
    console.log(
      `  ${emoji} ${i + 1}. ${scenario.name} - ${scenario.reason}`
    );
  });

  console.log("\n  5. Custom trade size");
  console.log("  6. Compare bundled vs unbundled");
  console.log("  7. Run all scenarios");
  console.log("  0. Exit\n");
}

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initializeServices(): Promise<{
  connection: Connection;
  executor: SwapExecutor;
  payer: Keypair;
}> {
  log("\n🔧 Initializing services...", "cyan");

  const connection = new Connection(DEVNET_RPC, "confirmed");

  // Load keypair
  const privateKeyEnv = process.env.TEST_PRIVATE_KEY;
  let payer: Keypair;

  if (privateKeyEnv) {
    const privateKeyBytes = Uint8Array.from(JSON.parse(privateKeyEnv));
    payer = Keypair.fromSecretKey(privateKeyBytes);
    log(`✅ Loaded keypair: ${payer.publicKey.toBase58()}`, "green");
  } else {
    log("⚠️  No TEST_PRIVATE_KEY found, generating new keypair", "yellow");
    payer = Keypair.generate();
    log(`   Public key: ${payer.publicKey.toBase58()}`, "yellow");
    log(
      "   ⚠️  You need to airdrop SOL to this address to run tests",
      "yellow"
    );
  }

  // Check balance
  const balance = await connection.getBalance(payer.publicKey);
  const balanceSOL = balance / LAMPORTS_PER_SOL;

  if (balanceSOL < 1) {
    log(`\n❌ Insufficient balance: ${balanceSOL.toFixed(4)} SOL`, "red");
    log("   You need at least 1 SOL to run tests", "red");
    log(
      `   Run: solana airdrop 10 ${payer.publicKey.toBase58()} --url devnet`,
      "cyan"
    );
    process.exit(1);
  } else {
    log(`✅ Balance: ${balanceSOL.toFixed(4)} SOL`, "green");
  }

  // Initialize services
  const liquidityCollector = new LiquidityDataCollector(connection);
  const optimizer = new RouteOptimizationEngine();
  const router = new IntelligentOrderRouter(liquidityCollector, optimizer);
  const oracleService = new OraclePriceService(connection, {
    pythProgramId: "gSbePebfvPy7tRqimPoVecS2UsBvYv46ynrzWocc92s",
    switchboardProgramId: "SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f"
  });
  const jitoService = new JitoBundleService(
    connection,
    "https://mainnet.block-engine.jito.wtf/api/v1/bundles"
  );
  const circuitBreaker = new CircuitBreaker({

  const executor = new SwapExecutor(
    connection,
    liquidityCollector,
    optimizer,
    router,
    oracleService,
    jitoService,
    circuitBreaker
  );

  log("✅ All services initialized", "green");

  return { connection, executor, payer };
}

// ============================================================================
// TEST EXECUTION
// ============================================================================

async function runTestScenario(
  executor: SwapExecutor,
  payer: Keypair,
  scenario: (typeof TEST_SCENARIOS)[0],
  enableMevProtection: boolean
): Promise<void> {
  const mevStatus = enableMevProtection ? "ENABLED" : "DISABLED";
  log(
    `\n🚀 Running: ${scenario.name} (MEV Protection: ${mevStatus})`,
    "bright"
  );
  console.log("-".repeat(60));

  try {
    const startTime = Date.now();

    const result = await executor.executeSwap({
      inputMint: SOL_MINT,
      outputMint: USDC_DEVNET,
      inputAmount: scenario.inputAmount,
      maxSlippageBps: 50, // 0.5%
      userPublicKey: payer.publicKey,
      signer: payer,
      routePreferences: {
        enableMevProtection,
      },
    });

    const executionTime = Date.now() - startTime;

    // Print results
    console.log("\n📊 Results:");
    log(`   Success: ${result.success}`, result.success ? "green" : "red");
    log(`   Output: ${result.metrics.outputAmount} USDC`, "cyan");
    log(`   Execution time: ${executionTime}ms`, "cyan");

    if (enableMevProtection) {
      log(`   MEV Strategy: ${(result as any).metrics?.mevStrategy || "N/A"}`, "cyan");
      log(`   Bundle ID: ${(result as any).metrics?.bundleId || "N/A"}`, "cyan");
      log(`   Tip paid: ${(result as any).metrics?.jitoTip || 0} lamports`, "cyan");
    }

    log(`   Signature: ${result.signature}`, "blue");

    // Print eligibility analysis
    if ((result as any).executionContext?.bundleEligibility) {
      const eligibility = (result as any).executionContext.bundleEligibility;
      console.log("\n🔍 Eligibility Analysis:");
      log(`   Eligible: ${eligibility.eligible}`, "cyan");
      log(`   Reason: ${eligibility.reason}`, "cyan");
      log(`   Risk Level: ${eligibility.riskLevel}`, "cyan");
      console.log("   Factors:");
      console.log(
        `     - Value Threshold: ${eligibility.eligibilityFactors.meetsValueThreshold}`
      );
      console.log(
        `     - High MEV Risk: ${eligibility.eligibilityFactors.hasHighMEVRisk}`
      );
      console.log(
        `     - AMM Only: ${eligibility.eligibilityFactors.isAMMOnly}`
      );
      console.log(
        `     - High Slippage: ${eligibility.eligibilityFactors.hasHighSlippage}`
      );
    }
  } catch (error: any) {
    log(`\n❌ Error: ${error.message}`, "red");
    if (error.logs) {
      console.log("\n📜 Transaction logs:");
      error.logs.forEach((logLine: string) => console.log(`   ${logLine}`));
    }
  }
}

async function runComparison(
  executor: SwapExecutor,
  payer: Keypair,
  inputAmount: number
): Promise<void> {
  log("\n📊 Running Comparison Test", "bright");
  console.log("=".repeat(60));

  const results: Array<{
    protected: boolean;
    output: number;
    time: number;
    tip: number;
  }> = [];

  // Test WITHOUT protection
  log("\n1️⃣  Testing WITHOUT MEV protection...", "yellow");
  try {
    const startTime = Date.now();
    const result = await executor.executeSwap({
      inputMint: SOL_MINT,
      outputMint: USDC_DEVNET,
      inputAmount,
      maxSlippageBps: 50,
      userPublicKey: payer.publicKey,
      signer: payer,
      routePreferences: {
        enableMevProtection: false,
      },
    });
    const time = Date.now() - startTime;

    results.push({
      protected: false,
      output: result.metrics.outputAmount,
      time,
      tip: 0,
    });

    log(`✅ Completed in ${time}ms`, "green");
    log(`   Output: ${result.metrics.outputAmount} USDC`, "cyan");
  } catch (error: any) {
    log(`❌ Failed: ${error.message}`, "red");
  }

  // Wait a bit
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Test WITH protection
  log("\n2️⃣  Testing WITH MEV protection...", "yellow");
  try {
    const startTime = Date.now();
    const result = await executor.executeSwap({
      inputMint: SOL_MINT,
      outputMint: USDC_DEVNET,
      inputAmount,
      maxSlippageBps: 50,
      userPublicKey: payer.publicKey,
      signer: payer,
      routePreferences: {
        enableMevProtection: true,
      },
    });
    const time = Date.now() - startTime;

    results.push({
      protected: true,
      output: result.metrics.outputAmount,
      time,
      tip: (result as any).metrics?.jitoTip || 0,
    });

    log(`✅ Completed in ${time}ms`, "green");
    log(`   Output: ${result.metrics.outputAmount} USDC`, "cyan");
    log(`   Tip: ${result.metrics.jitoTip} lamports`, "cyan");
  } catch (error: any) {
    log(`❌ Failed: ${error.message}`, "red");
  }

  // Print comparison
  if (results.length === 2) {
    console.log("\n" + "=".repeat(60));
    log("📈 Comparison Results", "bright");
    console.log("=".repeat(60));

    const [unbundled, bundled] = results;

    console.log("\n┌─────────────────────┬──────────────┬──────────────┐");
    console.log("│ Metric              │ Unbundled    │ Bundled      │");
    console.log("├─────────────────────┼──────────────┼──────────────┤");
    console.log(
      `│ Output (USDC)       │ ${unbundled.output.toFixed(2).padStart(12)} │ ${bundled.output.toFixed(2).padStart(12)} │`
    );
    console.log(
      `│ Execution Time (ms) │ ${unbundled.time.toString().padStart(12)} │ ${bundled.time.toString().padStart(12)} │`
    );
    console.log(
      `│ Tip Paid (lamports) │ ${unbundled.tip.toString().padStart(12)} │ ${bundled.tip.toString().padStart(12)} │`
    );
    console.log("└─────────────────────┴──────────────┴──────────────┘");

    // Calculate savings
    const outputDiff = bundled.output - unbundled.output;
    const savingsPercent = (outputDiff / unbundled.output) * 100;
    const timeDiff = bundled.time - unbundled.time;

    console.log("\n📊 Analysis:");
    if (outputDiff > 0) {
      log(
        `   ✅ MEV Protection Effective: +${outputDiff.toFixed(2)} USDC (${savingsPercent.toFixed(2)}%)`,
        "green"
      );
    } else if (outputDiff < 0) {
      log(
        `   ⚠️  Lower output with bundling: ${outputDiff.toFixed(2)} USDC (${savingsPercent.toFixed(2)}%)`,
        "yellow"
      );
      log("      (Tip cost may have exceeded MEV savings)", "yellow");
    } else {
      log("   ➡️  No difference in output", "cyan");
    }

    if (timeDiff > 0) {
      log(`   ⏱️  Bundling added ${timeDiff}ms latency`, "yellow");
    } else {
      log(`   ⚡ Bundling saved ${-timeDiff}ms`, "green");
    }
  }
}

async function runAllScenarios(
  executor: SwapExecutor,
  payer: Keypair
): Promise<void> {
  log("\n🏃 Running All Test Scenarios", "bright");
  console.log("=".repeat(60));

  for (const scenario of TEST_SCENARIOS) {
    await runTestScenario(executor, payer, scenario, true);
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2s between tests
  }

  log("\n✅ All scenarios completed!", "green");
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const { connection, executor, payer } = await initializeServices();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = (question: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  };

  while (true) {
    printMenu();
    const choice = await prompt("Enter your choice: ");

    const choiceNum = parseInt(choice);

    if (choiceNum === 0) {
      log("\n👋 Goodbye!", "cyan");
      rl.close();
      process.exit(0);
    } else if (choiceNum >= 1 && choiceNum <= 4) {
      const scenario = TEST_SCENARIOS[choiceNum - 1];
      const mevProtection = await prompt(
        "Enable MEV protection? (y/n): "
      );
      const enableMev = mevProtection.toLowerCase() === "y";
      await runTestScenario(executor, payer, scenario, enableMev);
    } else if (choiceNum === 5) {
      const amountStr = await prompt("Enter trade size (SOL): ");
      const amount = parseFloat(amountStr);

      if (isNaN(amount) || amount <= 0) {
        log("❌ Invalid amount", "red");
        continue;
      }

      const mevProtection = await prompt(
        "Enable MEV protection? (y/n): "
      );
      const enableMev = mevProtection.toLowerCase() === "y";

      await runTestScenario(
        executor,
        payer,
        {
          name: `Custom (${amount} SOL)`,
          inputAmount: amount,
          expectedEligible: amount >= 10,
          reason: "Custom test",
        },
        enableMev
      );
    } else if (choiceNum === 6) {
      const amountStr = await prompt("Enter trade size (SOL): ");
      const amount = parseFloat(amountStr);

      if (isNaN(amount) || amount <= 0) {
        log("❌ Invalid amount", "red");
        continue;
      }

      await runComparison(executor, payer, amount);
    } else if (choiceNum === 7) {
      await runAllScenarios(executor, payer);
    } else {
      log("❌ Invalid choice", "red");
    }

    await prompt("\nPress Enter to continue...");
  }
}

// Run
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
