import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  AtomicSwapLeg,
  AtomicSwapPlan,
  RouteCandidate,
  VenueName,
  VenueType,
} from "../src/types/smart-router";
import { SwapExecutor, SwapParams } from "../src/services/SwapExecutor";
import { LiquidityDataCollector } from "../src/services/LiquidityDataCollector";
import { RouteOptimizationEngine } from "../src/services/RouteOptimizationEngine";
import { IntelligentOrderRouter } from "../src/services/IntelligentOrderRouter";
import { OraclePriceService } from "../src/services/OraclePriceService";
import { JitoBundleService } from "../src/services/JitoBundleService";
import { CircuitBreaker } from "../src/utils/circuit-breaker";

interface StubContext {
  startTime: number;
  routes: RouteCandidate[];
  oraclePrice: number;
  signature?: string;
  chunkSignatures?: string[];
}

const DUMMY_PUBLIC_KEY = new PublicKey("11111111111111111111111111111111");

function buildSnapshot(
  venue: VenueName
): Record<
  VenueName,
  { effectivePrice: number; depth: number; timestamp: number }
> {
  return Object.values(VenueName).reduce(
    (acc, name) => {
      acc[name] = {
        effectivePrice: name === venue ? 95 : 100,
        depth: name === venue ? 1_000_000 : 500_000,
        timestamp: Date.now(),
      };
      return acc;
    },
    {} as Record<
      VenueName,
      { effectivePrice: number; depth: number; timestamp: number }
    >
  );
}

function createStubPlan(
  id: string,
  venue: VenueName,
  fallbackPlans: AtomicSwapPlan[] = []
): AtomicSwapPlan {
  const route: RouteCandidate = {
    id: `${id}-route`,
    venues: [venue],
    path: [
      "So11111111111111111111111111111111111111112",
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    ],
    hops: 1,
    splits: [
      {
        venue,
        weight: 100,
        inputAmount: 10,
        expectedOutput: 950,
        liquiditySource: {
          venue,
          venueType: VenueType.AMM,
          tokenPair: [
            "So11111111111111111111111111111111111111112",
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          ],
          depth: 1_000_000,
          effectivePrice: 95,
          feeAmount: 0.1,
          slippagePercent: 0.2,
          route: [
            "So11111111111111111111111111111111111111112",
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          ],
          timestamp: Date.now(),
        },
      },
    ],
    expectedOutput: 950,
    totalCost: 2,
    effectiveRate: 95,
    riskScore: 12,
    mevRisk: "medium",
    instructions: [],
    estimatedComputeUnits: 300_000,
  };

  const leg: AtomicSwapLeg = {
    venue,
    venueType: VenueType.AMM,
    route: route.path,
    inputAmount: 10,
    expectedOutput: 950,
    minOutput: 900,
    feeAmount: 0.1,
    slippagePercent: 0.2,
    quote: {
      inputAmount: 10,
      outputAmount: 950,
      effectivePrice: 95,
      marginalPrice: 95,
      slippagePercent: 0.2,
      feeAmount: 0.1,
    },
    liquiditySource: route.splits[0].liquiditySource,
  };

  return {
    id,
    inputMint: "So11111111111111111111111111111111111111112",
    outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    totalInput: 10,
    expectedOutput: 950,
    minOutput: 900,
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000,
    quoteValidityMs: 60_000,
    legs: [leg],
    simulations: [],
    baseRoute: route,
    fallbackPlans,
    maxSlippageBps: 100,
    driftRebalanceBps: 50,
    minLiquidityRatio: 0.5,
    maxStalenessMs: 30_000,
    liquiditySnapshot: buildSnapshot(venue),
  };
}

function createStubExecutor(): SwapExecutor {
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const liquidityCollector = {} as unknown as LiquidityDataCollector;
  const optimizer = {} as unknown as RouteOptimizationEngine;
  const router = {} as unknown as IntelligentOrderRouter;
  const oracle = {} as unknown as OraclePriceService;
  const jito = {
    pickTipAccount: () => DUMMY_PUBLIC_KEY,
    submitProtectedBundle: async () => ({
      bundleId: "stub",
      signatures: [],
      strategy: "jito" as const,
      status: "landed" as const,
      tipLamports: 0,
      priorityFeeMicroLamports: 0,
    }),
  } as unknown as JitoBundleService;
  const circuitBreaker: CircuitBreaker = {
    isTripped: () => false,
    getNextRetryTime: () => Date.now(),
    recordFailure: () => undefined,
    recordSuccess: () => undefined,
  } as CircuitBreaker;

  return new SwapExecutor(
    connection,
    liquidityCollector,
    optimizer,
    router,
    oracle,
    jito,
    circuitBreaker
  );
}

async function simulateFallback(): Promise<void> {
  const executor = createStubExecutor();
  const executorAny = executor as any;

  const fallbackPlan = createStubPlan("amm_fallback", VenueName.METEORA);
  const primaryPlan = createStubPlan("clob_primary", VenueName.PHOENIX, [
    fallbackPlan,
  ]);

  const params: SwapParams = {
    inputMint: primaryPlan.inputMint,
    outputMint: primaryPlan.outputMint,
    inputAmount: 10,
    maxSlippageBps: 100,
    userPublicKey: DUMMY_PUBLIC_KEY,
    signer: Keypair.generate(),
    routePreferences: {
      enableFallbackRouting: true,
    },
  };

  const ctx: StubContext = {
    startTime: Date.now(),
    routes: [],
    oraclePrice: 0,
  };

  let attempts = 0;
  executorAny.executePlanCandidate = async (
    _params: SwapParams,
    plan: AtomicSwapPlan,
    context: StubContext
  ) => {
    attempts += 1;
    if (plan.id === "clob_primary") {
      throw new Error("primary venue reverted");
    }

    context.signature = `sig-${plan.id}`;
    context.routes = plan.baseRoute ? [plan.baseRoute] : [];
  };

  await executorAny.runPlanWithFallback(
    params,
    [primaryPlan, fallbackPlan],
    ctx,
    0.01
  );

  console.log("Fallback simulation ✅");
  console.log("- Attempts:", attempts);
  console.log("- Final signature:", ctx.signature);
  console.log(
    "- Routes used:",
    ctx.routes.map((route) => route.id)
  );
}

async function simulateTwap(): Promise<void> {
  const executor = createStubExecutor();
  const executorAny = executor as any;

  const twapPlan = createStubPlan("twap_primary", VenueName.ORCA);
  const params: SwapParams = {
    inputMint: twapPlan.inputMint,
    outputMint: twapPlan.outputMint,
    inputAmount: 100,
    maxSlippageBps: 100,
    userPublicKey: DUMMY_PUBLIC_KEY,
    signer: Keypair.generate(),
    minOutputAmount: 9000,
    routePreferences: {
      enableTwapMode: true,
      twapThresholdRatio: 0.2,
      twapMaxSlices: 3,
      twapIntervalMs: 250,
    },
  };

  const ctx: StubContext = {
    startTime: Date.now(),
    routes: [],
    oraclePrice: 0,
  };

  const sliceResults: StubContext[] = [
    {
      startTime: Date.now(),
      routes: [twapPlan.baseRoute],
      oraclePrice: 95,
      signature: "twap-sig-1",
    },
    {
      startTime: Date.now(),
      routes: [twapPlan.baseRoute],
      oraclePrice: 95,
      signature: "twap-sig-2",
    },
  ];

  executorAny.processTwapSlice = async () => {
    const next = sliceResults.shift();
    if (!next) {
      throw new Error("no slice context remaining");
    }

    return next;
  };

  executorAny.awaitTwapInterval = async () => undefined;

  const config = executorAny.evaluateTwapConfig(params, twapPlan);
  if (!config.enabled) {
    console.warn("TWAP configuration not enabled, aborting simulation");
    return;
  }

  await executorAny.executeTwapSlices(params, twapPlan, ctx, 0.01, {
    ...config,
    slices: sliceResults.length + 1,
  });

  console.log("TWAP simulation ✅");
  console.log("- Chunk signatures:", ctx.chunkSignatures);
  console.log(
    "- Routes aggregated:",
    ctx.routes.map((route) => route.id)
  );
  console.log("- Final signature:", ctx.signature);
}

async function main(): Promise<void> {
  await simulateFallback();
  await simulateTwap();
}

main().catch((error) => {
  console.error("Simulation failed:", error);
  process.exit(1);
});
