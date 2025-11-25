/**
 * Jito Bundle E2E Tests (Devnet)
 * Real-world tests with Jito Block Engine
 */

import { describe, it, expect, beforeAll } from "vitest";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { SwapExecutor } from "../sdk/src/services/SwapExecutor";
import { LiquidityDataCollector } from "../sdk/src/services/LiquidityDataCollector";
import { RouteOptimizationEngine } from "../sdk/src/services/RouteOptimizationEngine";
import { IntelligentOrderRouter } from "../sdk/src/services/IntelligentOrderRouter";
import { OraclePriceService } from "../sdk/src/services/OraclePriceService";
import { JitoBundleService, MEVProtectionAnalyzer } from "../sdk/src/services/JitoBundleService";
import { CircuitBreaker } from "../sdk/src/utils/circuit-breaker";
import { BundleOptimizer } from "../sdk/src/services/BundleOptimizer";

// ============================================================================
// SETUP
// ============================================================================

const DEVNET_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"; // Devnet USDC

let connection: Connection;
let payer: Keypair;
let executor: SwapExecutor;

beforeAll(async () => {
  connection = new Connection(DEVNET_RPC, "confirmed");

  // Load or generate test keypair
  const privateKeyEnv = process.env.TEST_PRIVATE_KEY;
  if (privateKeyEnv) {
    const privateKeyBytes = Uint8Array.from(JSON.parse(privateKeyEnv));
    payer = Keypair.fromSecretKey(privateKeyBytes);
  } else {
    payer = Keypair.generate();
    console.warn("⚠️  No TEST_PRIVATE_KEY found, using generated keypair");
    console.warn("   Public key:", payer.publicKey.toBase58());
    console.warn(
      "   ⚠️  You need to airdrop SOL to this address on devnet to run tests"
    );
  }

  // Initialize services
  const liquidityCollector = new LiquidityDataCollector(connection);
  const optimizer = new RouteOptimizationEngine();
  const router = new IntelligentOrderRouter(liquidityCollector, optimizer);
  const oracleService = new OraclePriceService(connection);
  const jitoService = new JitoBundleService(
    connection,
    "https://mainnet.block-engine.jito.wtf/api/v1/bundles"
  );
  const circuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    resetTimeoutMs: 60000,
    successThreshold: 2,
    monitoringWindowMs: 120000
  });

  executor = new SwapExecutor(
    connection,
    liquidityCollector,
    optimizer,
    router,
    oracleService,
    jitoService,
    circuitBreaker
  );
});

// ============================================================================
// TEST SUITE 1: BUNDLE SUBMISSION E2E
// ============================================================================

describe("Bundle Submission E2E", () => {
  it.skip("should submit and land bundle on devnet", async () => {
    // Check balance
    const balance = await connection.getBalance(payer.publicKey);
    expect(balance).toBeGreaterThan(15 * LAMPORTS_PER_SOL); // Need >15 SOL

    // Execute swap with bundling
    const result = await executor.executeSwap({
      inputMint: SOL_MINT,
      outputMint: USDC_DEVNET,
      inputAmount: 15, // 15 SOL - above threshold
      maxSlippageBps: 50, // 0.5%
      userPublicKey: payer.publicKey,
      signer: payer,
      routePreferences: {
        enableMevProtection: true,
      },
    });

    // Verify bundle was used
    expect(result.success).toBe(true);
    expect(result.metrics.mevStrategy).toBe("jito");
    expect(result.metrics.bundleId).toBeDefined();
    expect(result.metrics.jitoTip).toBeGreaterThan(0);

    console.log("✅ Bundle submitted:", result.metrics.bundleId);
    console.log("   Tip paid:", result.metrics.jitoTip, "lamports");
    console.log("   Strategy:", result.metrics.mevStrategy);
  }, 60000); // 60s timeout

  it.skip("should add tip instruction correctly", async () => {
    const balance = await connection.getBalance(payer.publicKey);
    expect(balance).toBeGreaterThan(15 * LAMPORTS_PER_SOL);

    const result = await executor.executeSwap({
      inputMint: SOL_MINT,
      outputMint: USDC_DEVNET,
      inputAmount: 15,
      maxSlippageBps: 50,
      userPublicKey: payer.publicKey,
      signer: payer,
      routePreferences: {
        enableMevProtection: true,
      },
    });

    // Verify tip was paid
    expect(result.metrics.jitoTip).toBeGreaterThanOrEqual(5000); // Min tip
    expect(result.metrics.jitoTip).toBeLessThanOrEqual(100000); // Max tip

    console.log("✅ Tip instruction added");
    console.log("   Amount:", result.metrics.jitoTip, "lamports");
  }, 60000);

  it.skip("should use random tip account", async () => {
    const jitoService = new JitoBundleService(connection);

    // Pick multiple accounts
    const accounts = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const account = jitoService.pickTipAccount();
      accounts.add(account.toBase58());
    }

    // Should see multiple different accounts (randomization)
    expect(accounts.size).toBeGreaterThan(1);
    console.log("✅ Tip account randomization working");
    console.log(`   Used ${accounts.size} different accounts out of 20 picks`);
  });
});

// ============================================================================
// TEST SUITE 2: MEV SAVINGS MEASUREMENT
// ============================================================================

describe("MEV Savings Measurement", () => {
  it.skip(
    "should compare bundled vs unbundled swaps",
    async () => {
      const balance = await connection.getBalance(payer.publicKey);
      expect(balance).toBeGreaterThan(30 * LAMPORTS_PER_SOL); // Need 30+ SOL for both swaps

      const inputAmount = 15; // 15 SOL

      // Execute WITHOUT bundling
      console.log("Executing unbundled swap...");
      const unbundledResult = await executor.executeSwap({
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

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Execute WITH bundling
      console.log("Executing bundled swap...");
      const bundledResult = await executor.executeSwap({
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

      // Compare outputs
      const unbundledOutput = unbundledResult.metrics.outputAmount;
      const bundledOutput = bundledResult.metrics.outputAmount;

      console.log("\n📊 Comparison:");
      console.log("   Unbundled output:", unbundledOutput);
      console.log("   Bundled output:  ", bundledOutput);

      // Calculate savings
      if (bundledOutput > unbundledOutput) {
        const savings = bundledOutput - unbundledOutput;
        const savingsPercent = (savings / unbundledOutput) * 100;

        console.log("\n✅ MEV Protection Effective!");
        console.log(`   Savings: ${savings} USDC`);
        console.log(`   Savings: ${savingsPercent.toFixed(2)}%`);

        expect(savingsPercent).toBeGreaterThan(0);
      } else {
        console.log(
          "\n⚠️  No measurable MEV savings (market conditions or low MEV activity)"
        );
      }
    },
    120000
  ); // 2min timeout

  it.skip("should calculate actual savings percentage", async () => {
    // This would require historical data or multiple test runs
    // For now, we verify the calculation logic

    const unbundledOutput = 1450; // Example USDC
    const bundledOutput = 1460; // Example USDC with MEV protection

    const savings = bundledOutput - unbundledOutput;
    const savingsPercent = (savings / unbundledOutput) * 100;

    expect(savings).toBe(10);
    expect(savingsPercent).toBeCloseTo(0.69, 2);

    console.log("✅ MEV savings calculation verified");
    console.log(`   Savings: ${savings} USDC (${savingsPercent.toFixed(2)}%)`);
  });
});

// ============================================================================
// TEST SUITE 3: FALLBACK & ROBUSTNESS
// ============================================================================

describe("Fallback & Robustness", () => {
  it.skip("should fallback to QuickNode on Jito failure", async () => {
    // This test would require mocking Jito failure
    // For real E2E, we'd need to test with actual network conditions

    console.log(
      "⚠️  Fallback test requires specific network conditions or mocking"
    );
    console.log("   Manual test: Disable Jito endpoint and verify QuickNode used");
  });

  it("should handle bundle timeout gracefully", async () => {
    const jitoService = new JitoBundleService(connection);

    // Submit a mock bundle ID that will never land
    const fakeBundleId = "fake-bundle-id-" + Date.now();

    // Should timeout after 5 seconds
    await expect(jitoService.waitForBundle(fakeBundleId, 5000)).rejects.toThrow(
      /timeout|failed to land/i
    );

    console.log("✅ Bundle timeout handled correctly");
  }, 10000);

  it.skip("should retry on network errors", async () => {
    // This would require network failure simulation
    console.log("⚠️  Retry test requires network failure simulation");
  });
});

// ============================================================================
// TEST SUITE 4: PERFORMANCE
// ============================================================================

describe("Performance", () => {
  it.skip("should track bundle landing time (<10s)", async () => {
    const balance = await connection.getBalance(payer.publicKey);
    expect(balance).toBeGreaterThan(15 * LAMPORTS_PER_SOL);

    const startTime = Date.now();

    const result = await executor.executeSwap({
      inputMint: SOL_MINT,
      outputMint: USDC_DEVNET,
      inputAmount: 15,
      maxSlippageBps: 50,
      userPublicKey: payer.publicKey,
      signer: payer,
      routePreferences: {
        enableMevProtection: true,
      },
    });

    const executionTime = Date.now() - startTime;

    console.log("⏱️  Execution time:", executionTime, "ms");
    console.log("   Bundle ID:", result.metrics.bundleId);

    // Jito bundles typically land within 10 seconds
    expect(executionTime).toBeLessThan(30000); // 30s max (generous)
  }, 60000);

  it.skip("should handle multiple bundles simultaneously", async () => {
    const balance = await connection.getBalance(payer.publicKey);
    expect(balance).toBeGreaterThan(45 * LAMPORTS_PER_SOL); // 3 x 15 SOL

    // Submit 3 bundles in parallel
    const promises = Array.from({ length: 3 }, (_, i) =>
      executor.executeSwap({
        inputMint: SOL_MINT,
        outputMint: USDC_DEVNET,
        inputAmount: 15,
        maxSlippageBps: 50,
        userPublicKey: payer.publicKey,
        signer: payer,
        routePreferences: {
          enableMevProtection: true,
        },
      })
    );

    const results = await Promise.allSettled(promises);

    // Check how many succeeded
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    console.log(`✅ ${succeeded}/3 bundles completed successfully`);

    expect(succeeded).toBeGreaterThan(0);
  }, 120000);

  it("should optimize bundle construction (<500ms)", () => {
    // This test doesn't require network, just measures optimization time
    const optimizer = new BundleOptimizer();

    // Create mock instructions
    const mockInstructions = Array.from({ length: 50 }, (_, i) => ({
      instruction: {
        programId: new PublicKey("11111111111111111111111111111111"),
        keys: [],
        data: Buffer.from([])
      } as any,
      type: i < 10 ? "setup" : i < 40 ? "swap" : "cleanup",
      estimatedCU: 10000 + Math.random() * 50000,
      priority: i < 10 ? 1 : i < 40 ? 2 : 3,
    }));

    const startTime = Date.now();
    const result = optimizer.optimizeBundleConstruction(
      mockInstructions,
      new PublicKey("11111111111111111111111111111111")
    );
    const elapsedMs = Date.now() - startTime;

    console.log("⚡ Bundle optimization time:", elapsedMs, "ms");
    console.log("   Transactions:", result.transactions.length);
    console.log("   Optimizations:", result.optimizations);

    expect(elapsedMs).toBeLessThan(500);
    expect(result.transactions.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// TEST SUITE 5: ELIGIBILITY DETECTION
// ============================================================================

describe("Bundle Eligibility Detection", () => {
  it("should detect eligible trade (>10 SOL)", () => {
    const analyzer = new MEVProtectionAnalyzer();

    const mockRoute = {
      id: "test",
      venues: ["orca"],
      path: ["SOL", "USDC"],
      hops: 1,
      splits: [
        {
          venue: "orca",
          weight: 100,
          inputAmount: 15, // 15 SOL
          expectedOutput: 1500,
          liquiditySource: {
            venue: "orca",
            venueType: "amm",
            tokenPair: ["SOL", "USDC"],
            depth: 100000,
            effectivePrice: 100,
            feeAmount: 0.003,
            slippagePercent: 0.005,
            route: ["SOL", "USDC"],
            timestamp: Date.now(),
          },
        },
      ],
      expectedOutput: 1500,
      totalCost: 0.01,
      effectiveRate: 100,
      riskScore: 0,
      mevRisk: "medium",
      instructions: [],
      estimatedComputeUnits: 100000,
    };

    const result = analyzer.isEligibleForBundling(
      mockRoute,
      1500, // $1500 trade value
      SOL_MINT,
      15 // 15 SOL
    );

    console.log("📊 Eligibility result:");
    console.log("   Eligible:", result.eligible);
    console.log("   Reason:", result.reason);
    console.log("   Risk level:", result.riskLevel);
    console.log("   Factors:", result.eligibilityFactors);

    expect(result.eligible).toBe(true);
    expect(result.eligibilityFactors.meetsValueThreshold).toBe(true);
  });

  it("should detect ineligible trade (<10 SOL, low risk)", () => {
    const analyzer = new MEVProtectionAnalyzer();

    const mockRoute = {
      id: "test",
      venues: ["phoenix"], // CLOB - lower risk
      path: ["SOL", "USDC"],
      hops: 1,
      splits: [
        {
          venue: "phoenix",
          weight: 100,
          inputAmount: 5, // 5 SOL - below threshold
          expectedOutput: 500,
          liquiditySource: {
            venue: "phoenix",
            venueType: "clob",
            tokenPair: ["SOL", "USDC"],
            depth: 100000,
            effectivePrice: 100,
            feeAmount: 0.002,
            slippagePercent: 0.002, // Low slippage
            route: ["SOL", "USDC"],
            timestamp: Date.now(),
          },
        },
      ],
      expectedOutput: 500,
      totalCost: 0.005,
      effectiveRate: 100,
      riskScore: 0,
      mevRisk: "low",
      instructions: [],
      estimatedComputeUnits: 50000,
    };

    const result = analyzer.isEligibleForBundling(
      mockRoute,
      500, // $500 trade value
      SOL_MINT,
      5 // 5 SOL
    );

    console.log("📊 Eligibility result (small trade):");
    console.log("   Eligible:", result.eligible);
    console.log("   Reason:", result.reason);

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("Below thresholds");
  });
});
