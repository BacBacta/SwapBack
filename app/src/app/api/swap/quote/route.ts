/**
 * API Route: Get Jupiter Quote + Swap Instructions
 * Proxies requests to Jupiter API to avoid CORS issues
 * Endpoint: POST /api/swap/quote
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  MessageCompiledInstruction,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";
import { recordRouterMetric, getRouterReliabilitySummary } from "@/lib/routerMetrics";
import { buildHybridIntents, type RoutingStrategy } from "@/lib/routing/hybridRouting";
import { getCircuit, retryWithBackoff, CircuitOpenError } from "@/lib/resilience";
import type { JupiterQuoteResponse, JupiterRoutePlanStep } from "@/types/router";

const PRIMARY_JUPITER_API = process.env.JUPITER_API_URL || "https://quote-api.jup.ag/v6";

// Jupiter API endpoints (primary + fallbacks)
const JUPITER_ENDPOINTS = [
  PRIMARY_JUPITER_API,
  "https://public.jupiterapi.com",
  "https://api.jup.ag/v6",
].filter(Boolean);

// Program IDs Jupiter v6 (mainnet/devnet)
const JUPITER_PROGRAM_IDS = new Set([
  "JUP6LkbZBMd1McqTgnmMSpZ88LdKgmhyaXtCXnVQ1Nm",
]);

function extractJupiterAccounts(swapTxBase64: string): {
  accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  programId: string;
} {
  const buf = Buffer.from(swapTxBase64, "base64");
  const vtx = VersionedTransaction.deserialize(buf);
  const msg = vtx.message;
  const acctKeys = msg.getAccountKeys({ accountKeysFromLookups: msg.addressTableLookups });

  // Trouver l'instruction Jupiter (on ignore ComputeBudget)
  const instructions = [...msg.compiledInstructions];
  const jupIx: MessageCompiledInstruction =
    [...instructions]
      .reverse()
      .find((ix) => {
        const pid = acctKeys.get(ix.programIdIndex)?.toBase58();
        if (!pid) return false;
        if (pid === "ComputeBudget111111111111111111111111111111") return false;
        return JUPITER_PROGRAM_IDS.has(pid);
      }) ?? instructions[instructions.length - 1];

  const programId = acctKeys.get(jupIx.programIdIndex)?.toBase58() ?? "";
  const accounts = jupIx.accountKeyIndexes.map((idx) => {
    const pk = acctKeys.get(idx);
    return {
      pubkey: pk.toBase58(),
      isSigner: msg.isAccountSigner(idx),
      isWritable: msg.isAccountWritable(idx),
    };
  });

  return { accounts, programId };
}

// Circuit breaker pour Jupiter API
const jupiterCircuit = getCircuit("jupiter", {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  successThreshold: 2,
});

async function fetchFromJupiter(path: string, init?: RequestInit) {
  // Vérifier le circuit breaker
  if (!jupiterCircuit.canExecute()) {
    const stats = jupiterCircuit.getStats();
    throw new CircuitOpenError("jupiter", stats.timeUntilReset);
  }

  return retryWithBackoff(
    async () => {
      let lastError: unknown = null;

      for (const baseUrl of JUPITER_ENDPOINTS) {
        const url = `${baseUrl.replace(/\/$/, "")}${path}`;
        const attemptStart = Date.now();
        try {
          const response = await fetch(url, {
            ...init,
            headers: {
              Accept: "application/json",
              "User-Agent": "SwapBack/1.0",
              ...(init?.headers || {}),
            },
            signal: AbortSignal.timeout(10000), // 10s timeout
          });

          const latencyMs = Date.now() - attemptStart;

          recordRouterMetric({
            provider: "jupiter",
            endpoint: baseUrl,
            status: response.status,
            ok: response.ok,
            latencyMs,
          });

          if (response.ok) {
            jupiterCircuit.recordSuccess();
            return response;
          }

          // Non-200: store error but continue to next endpoint for >=500 errors only
          lastError = new Error(`Jupiter responded ${response.status}`);
          if (response.status < 500) {
            return response; // client error - no retry on other endpoints
          }
        } catch (error) {
          lastError = error;
          recordRouterMetric({
            provider: "jupiter",
            endpoint: baseUrl,
            status: 0,
            ok: false,
            latencyMs: Date.now() - attemptStart,
          });
          console.warn(`⚠️ Jupiter endpoint failed (${url}):`, error);
          continue;
        }
      }

      jupiterCircuit.recordFailure();
      throw lastError || new Error("All Jupiter endpoints failed");
    },
    {
      maxRetries: 2,
      initialDelayMs: 500,
      backoffMultiplier: 2,
      maxDelayMs: 5000,
      jitter: true,
      retryableErrors: (error) => {
        // Ne pas retry sur les erreurs client (4xx)
        return !error.message.includes("responded 4");
      },
    }
  );
}

// Helper to add no-store header
const withNoStore = (init?: ResponseInit): ResponseInit => {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return { ...init, headers };
};

/**
 * Parse Jupiter quote into readable route information
 */
function parseRouteInfo(quote: JupiterQuoteResponse) {
  const routes = quote.routePlan ?? [];

  const steps = routes.map((route, index) => ({
    stepNumber: index + 1,
    ammKey: route.swapInfo?.ammKey ?? "Unknown",
    label: route.swapInfo?.label ?? `Step ${index + 1}`,
    inputMint: route.swapInfo?.inputMint ?? "",
    outputMint: route.swapInfo?.outputMint ?? "",
    inAmount: route.swapInfo?.inAmount ?? "0",
    outAmount: route.swapInfo?.outAmount ?? "0",
    feeAmount: route.swapInfo?.feeAmount ?? "0",
    feeMint: route.swapInfo?.feeMint ?? "",
  }));

  const priceImpact =
    typeof quote.priceImpactPct === "string"
      ? parseFloat(quote.priceImpactPct)
      : (quote.priceImpactPct ?? 0);

  return {
    totalSteps: routes.length,
    inputAmount: quote.inAmount ?? "0",
    outputAmount: quote.outAmount ?? "0",
    priceImpactPct: priceImpact,
    steps,
    otherAmountThreshold: quote.otherAmountThreshold,
    swapMode: quote.swapMode ?? "ExactIn",
  };
}

// Detect transient DNS / network resolution errors so we can surface a clearer message
const isNetworkResolutionError = (error: unknown) => {
  const code = (error as any)?.code ?? (error as any)?.cause?.code;
  return code === "ENOTFOUND" || code === "EAI_AGAIN";
};

/**
 * POST /api/swap/quote
 * Get a quote from Jupiter API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      inputMint,
      outputMint,
      amount,
      slippageBps = 50,
      routingStrategy = "smart",
      userPublicKey,
    } = body as {
      inputMint?: string;
      outputMint?: string;
      amount?: number | string;
      slippageBps?: number;
      routingStrategy?: RoutingStrategy;
      userPublicKey?: string | null;
    };

    // Validate inputs
    if (!inputMint || !outputMint || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: inputMint, outputMint, amount" },
        withNoStore({ status: 400 })
      );
    }

    // Validate amount
    const parsedAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount: must be a positive number" },
        withNoStore({ status: 400 })
      );
    }

    const amountLamports = Math.floor(parsedAmount);

    // Build Jupiter API URL
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amountLamports.toString(),
      slippageBps: slippageBps.toString(),
    });

    const endpointPath = `/quote?${params.toString()}`;

    console.log("🔄 Fetching Jupiter quote:", {
      path: endpointPath,
      inputMint: inputMint.slice(0, 8) + "...",
      outputMint: outputMint.slice(0, 8) + "...",
      amount: parsedAmount,
    });

    // Fetch quote from Jupiter
    let response: Response;
    try {
      response = await fetchFromJupiter(endpointPath, {
        method: "GET",
      });
    } catch (fetchError) {
      if (isNetworkResolutionError(fetchError)) {
        console.warn("🌐 Jupiter DNS lookup failed, sending 503", fetchError);
        return NextResponse.json(
          {
            error: "Jupiter indisponible (résolution DNS). Réessayez dans quelques instants.",
          },
          withNoStore({ status: 503 })
        );
      }
      throw fetchError;
    }

    console.log("📡 Jupiter response:", {
      status: response.status,
      ok: response.ok,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Jupiter API error:", response.status, errorText);
      
      return NextResponse.json(
        {
          error: "Jupiter API error",
          details: errorText,
          status: response.status,
        },
        withNoStore({ status: response.status >= 500 ? 502 : response.status })
      );
    }

    const quote = await response.json() as JupiterQuoteResponse;

    if (!quote || !quote.outAmount) {
      return NextResponse.json(
        { error: "Invalid quote response from Jupiter" },
        withNoStore({ status: 502 })
      );
    }

    console.log("✅ Quote received:", {
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      priceImpact: quote.priceImpactPct,
      routes: quote.routePlan?.length || 0,
    });

    // Parse route information
    const routeInfo = parseRouteInfo(quote);
    const reliabilitySummary = getRouterReliabilitySummary();
    const intents = buildHybridIntents({
      quote,
      strategy: routingStrategy,
      amountLamports,
      slippageBps,
      priceImpactPct: routeInfo.priceImpactPct ?? 0,
    });

    // Si userPublicKey est fourni, récupérer les instructions de swap + comptes pour le router
    let jupiterCpi = null;
    if (userPublicKey) {
      console.log("🔧 Fetching swap instructions for:", userPublicKey.slice(0, 8) + "...");

      try {
        let swapResponse: Response | null = null;
        try {
          swapResponse = await fetchFromJupiter("/swap", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              quoteResponse: quote,
              userPublicKey,
              wrapAndUnwrapSol: true,
              useSharedAccounts: true,
              dynamicComputeUnitLimit: true,
              skipUserAccountsRpcCalls: false,
              dynamicSlippage: { minBps: 50, maxBps: slippageBps },
            }),
          });
        } catch (swapErr) {
          if (isNetworkResolutionError(swapErr)) {
            console.warn("🌐 Jupiter DNS lookup failed for /swap", swapErr);
            swapResponse = null;
          } else {
            throw swapErr;
          }
        }

        if (swapResponse?.ok) {
          const swapData = await swapResponse.json();

          if (swapData.swapTransaction) {
            const parsed = extractJupiterAccounts(swapData.swapTransaction);

            if (parsed.accounts.length === 0 || !parsed.programId) {
              console.warn("⚠️ Jupiter accounts extraction failed");
            } else {
              jupiterCpi = {
                expectedInputAmount: quote.inAmount,
                swapInstruction: swapData.swapTransaction, // Transaction sérialisée base64
                accounts: parsed.accounts,
                programId: parsed.programId,
                // Données additionnelles utiles
                lastValidBlockHeight: swapData.lastValidBlockHeight,
                prioritizationFeeLamports: swapData.prioritizationFeeLamports,
                computeUnitLimit: swapData.computeUnitLimit,
              };
              console.log("✅ Swap instructions obtained (accounts parsed)");
            }
          }
        } else if (swapResponse) {
          const swapError = await swapResponse.text();
          console.warn("⚠️ Failed to get swap instructions:", swapError);
        } else {
          console.warn("⚠️ Jupiter swap instructions skipped (network resolution error)");
        }
      } catch (swapError) {
        console.warn("⚠️ Error fetching swap instructions:", swapError);
        // Continue without jupiterCpi - user will need to retry with wallet connected
      }
    }

    return NextResponse.json(
      {
        success: true,
        quote,
        routeInfo,
        intents,
        reliability: reliabilitySummary,
        routingStrategy,
        jupiterCpi,
        timestamp: Date.now(),
      },
      withNoStore()
    );
  } catch (error) {
    console.error("❌ Error in /api/swap/quote:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch quote",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      withNoStore({ status: 500 })
    );
  }
}

/**
 * GET /api/swap/quote
 * Health check endpoint
 */
export async function GET() {
  try {
    const reliability = getRouterReliabilitySummary();
    return NextResponse.json(
      {
        status: "ok",
        service: "Jupiter Quote API Proxy",
        jupiterApi: PRIMARY_JUPITER_API,
        reliability,
        timestamp: Date.now(),
      },
      withNoStore()
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: "Health check failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      withNoStore({ status: 500 })
    );
  }
}
