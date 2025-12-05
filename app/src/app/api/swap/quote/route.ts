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
import { getQuoteAggregator } from "@/lib/quotes/multiSourceAggregator";
import type { QuoteResult } from "@/lib/quotes/multiSourceAggregator";
import { calculateNpiOpportunity } from "@/lib/rebates/npiEngine";
import { getTokenByMint } from "@/constants/tokens";
import type { JupiterQuoteResponse, JupiterRoutePlanStep } from "@/types/router";
import { trackServerEvent } from "@/lib/serverAnalytics";

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
  addressTableLookups?: { accountKey: string; writableIndexes: number[]; readonlyIndexes: number[] }[];
  instructionData?: string; // Base64-encoded instruction data for CPI
} {
  try {
    const buf = Buffer.from(swapTxBase64, "base64");
    const vtx = VersionedTransaction.deserialize(buf);
    const msg = vtx.message;
    
    // Pour les transactions V0, on utilise staticAccountKeys au lieu de getAccountKeys
    // car getAccountKeys nécessite les adresses résolues des lookup tables
    const staticKeys = msg.staticAccountKeys || [];
    
    // Vérifier qu'on a des clés statiques
    if (staticKeys.length === 0) {
      console.warn("⚠️ No static account keys in transaction");
      return { accounts: [], programId: "" };
    }

    // Trouver l'instruction Jupiter (on ignore ComputeBudget)
    const instructions = [...msg.compiledInstructions];
    
    // Vérifier que nous avons des instructions
    if (!instructions || instructions.length === 0) {
      console.warn("⚠️ No instructions found in transaction");
      return { accounts: [], programId: "" };
    }
    
    // Chercher l'instruction Jupiter parmi les clés statiques
    const jupIx: MessageCompiledInstruction | undefined =
      [...instructions]
        .reverse()
        .find((ix) => {
          // L'index doit être dans les clés statiques
          if (ix.programIdIndex >= staticKeys.length) return false;
          const pid = staticKeys[ix.programIdIndex]?.toBase58();
          if (!pid) return false;
          if (pid === "ComputeBudget111111111111111111111111111111") return false;
          return JUPITER_PROGRAM_IDS.has(pid);
        });
    
    // Si pas trouvé dans les clés statiques, utiliser la dernière instruction non-ComputeBudget
    const fallbackIx = jupIx ?? [...instructions].reverse().find((ix) => {
      if (ix.programIdIndex >= staticKeys.length) return true; // Probablement dans lookup table
      const pid = staticKeys[ix.programIdIndex]?.toBase58();
      return pid !== "ComputeBudget111111111111111111111111111111";
    }) ?? instructions[instructions.length - 1];

    // Vérifier que nous avons trouvé une instruction
    if (!fallbackIx) {
      console.warn("⚠️ No suitable instruction found in transaction");
      return { accounts: [], programId: "" };
    }

    // Obtenir le programId (peut être dans lookup table)
    const programId = fallbackIx.programIdIndex < staticKeys.length 
      ? staticKeys[fallbackIx.programIdIndex]?.toBase58() ?? ""
      : "";
    
    // Extraire les données de l'instruction Jupiter pour le CPI
    // C'est ce qui sera passé au Router pour exécuter le swap
    const instructionData = Buffer.from(fallbackIx.data).toString('base64');
    console.log(`📦 Jupiter instruction data: ${fallbackIx.data.length} bytes`);
    
    // Vérifier que accountKeyIndexes existe
    if (!fallbackIx.accountKeyIndexes || fallbackIx.accountKeyIndexes.length === 0) {
      console.warn("⚠️ No account key indexes in instruction");
      return { accounts: [], programId, instructionData };
    }
    
    // Extraire les comptes depuis les clés statiques seulement
    // Les comptes dans les lookup tables seront résolus côté client
    const accounts = fallbackIx.accountKeyIndexes
      .filter(idx => idx < staticKeys.length) // Seulement les clés statiques
      .map((idx) => {
        const pk = staticKeys[idx];
        return {
          pubkey: pk?.toBase58() ?? "",
          isSigner: msg.isAccountSigner(idx),
          isWritable: msg.isAccountWritable(idx),
        };
      })
      .filter(acc => acc.pubkey !== "");

    // Inclure les informations sur les lookup tables pour que le client puisse les résoudre
    const addressTableLookups = msg.addressTableLookups?.map(lookup => ({
      accountKey: lookup.accountKey.toBase58(),
      writableIndexes: [...lookup.writableIndexes],
      readonlyIndexes: [...lookup.readonlyIndexes],
    }));

    // Log pour debug
    console.log(`📊 Extracted ${accounts.length} static accounts, ${addressTableLookups?.length || 0} lookup tables, ${fallbackIx.data.length} bytes instruction data`);

    return { accounts, programId, addressTableLookups, instructionData };
  } catch (error) {
    console.error("❌ Error extracting Jupiter accounts:", error);
    return { accounts: [], programId: "" };
  }
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

// CORS headers for cross-origin requests (Vercel frontend → Fly.io API)
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

// Helper to add no-store header and CORS
const withNoStore = (init?: ResponseInit): ResponseInit => {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  // Add CORS headers
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });
  return { ...init, headers };
};

/**
 * OPTIONS handler for CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

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
  const requestStartedAt = Date.now();
  let analyticsId = "swapback-server";
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
      trackServerEvent("Quote API Validation Error", {
        distinctId: analyticsId,
        reason: "missing-fields",
      });
      return NextResponse.json(
        { error: "Missing required fields: inputMint, outputMint, amount" },
        withNoStore({ status: 400 })
      );
    }

    // Validate amount
    const parsedAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      trackServerEvent("Quote API Validation Error", {
        distinctId: analyticsId,
        reason: "invalid-amount",
      });
      return NextResponse.json(
        { error: "Invalid amount: must be a positive number" },
        withNoStore({ status: 400 })
      );
    }

    analyticsId = userPublicKey ?? "swapback-server";

    trackServerEvent("Quote API Requested", {
      distinctId: analyticsId,
      inputMint,
      outputMint,
      amount: parsedAmount,
      routingStrategy,
      slippageBps,
      hasWallet: Boolean(userPublicKey),
    });

    const amountLamports = Math.floor(parsedAmount);

    // Token metadata (decimals) for accurate conversions
    const inputTokenMeta = getTokenByMint(inputMint);
    const outputTokenMeta = getTokenByMint(outputMint);
    const inputDecimals = inputTokenMeta?.decimals ?? 9;
    const outputDecimals = outputTokenMeta?.decimals ?? 9;
    const amountTokens = amountLamports / Math.pow(10, inputDecimals);

    // Kick off multi-source aggregator in parallel (Raydium / Orca / cache)
    const aggregator = getQuoteAggregator();
    const aggregatedQuotePromise = aggregator
      .getBestQuote({
        inputMint,
        outputMint,
        amountTokens,
        amountLamports,
        inputDecimals,
        outputDecimals,
        slippageBps,
        userPublicKey: userPublicKey ?? undefined,
      })
      .catch((aggError) => {
        console.warn("⚠️ Multi-source aggregator failed", aggError);
        return null;
      });

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

    // Fetch quote from Jupiter (primary path)
    let quote: JupiterQuoteResponse | null = null;
    let jupiterFetchError: unknown = null;
    try {
      const response = await fetchFromJupiter(endpointPath, {
        method: "GET",
      });

      console.log("📡 Jupiter response:", {
        status: response.status,
        ok: response.ok,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Jupiter API error:", response.status, errorText);
        jupiterFetchError = new Error(`Jupiter responded ${response.status}`);
      } else {
        quote = (await response.json()) as JupiterQuoteResponse;
        console.log("✅ Quote received:", {
          inAmount: quote.inAmount,
          outAmount: quote.outAmount,
          priceImpact: quote.priceImpactPct,
          routes: quote.routePlan?.length || 0,
        });
      }
    } catch (fetchError) {
      jupiterFetchError = fetchError;
      console.warn("⚠️ Jupiter fetch failed", fetchError);
    }

    const aggregatedQuote = await aggregatedQuotePromise;

    if (!quote?.outAmount) {
      if (aggregatedQuote?.bestQuote) {
        const fallbackQuote = aggregatedQuote.bestQuote;
        const fallbackRouteInfo = parseRouteInfo(fallbackQuote);
        const fallbackReliability = getRouterReliabilitySummary();
        const fallbackIntents = buildHybridIntents({
          quote: fallbackQuote,
          strategy: routingStrategy,
          amountLamports,
          slippageBps,
          priceImpactPct: fallbackRouteInfo.priceImpactPct ?? 0,
        });

        console.warn("⚠️ Using multi-source fallback route", {
          provider: aggregatedQuote.source,
          fromCache: aggregatedQuote.fromCache,
        });

        trackServerEvent("Quote API Fallback", {
          distinctId: analyticsId,
          latencyMs: Date.now() - requestStartedAt,
          provider: aggregatedQuote.source,
          fromCache: aggregatedQuote.fromCache,
          routingStrategy,
          priceImpactPct: fallbackRouteInfo.priceImpactPct ?? null,
        });

        return NextResponse.json(
          {
            success: true,
            quote: fallbackQuote,
            routeInfo: fallbackRouteInfo,
            intents: fallbackIntents,
            reliability: fallbackReliability,
            routingStrategy,
            jupiterCpi: null,
            timestamp: Date.now(),
            nativeRoute: {
              provider: aggregatedQuote.source,
              improvementBps: 0,
              available: true,
              fromCache: aggregatedQuote.fromCache,
              fallback: true,
              explanation: "Route native SwapBack (Jupiter indisponible)",
            },
            multiSourceQuotes: summarizeQuoteResults(aggregatedQuote.alternativeQuotes),
            usedMultiSourceFallback: true,
          },
          withNoStore()
        );
      }

      if (jupiterFetchError && isNetworkResolutionError(jupiterFetchError)) {
        trackServerEvent("Quote API Error", {
          distinctId: analyticsId,
          latencyMs: Date.now() - requestStartedAt,
          reason: "jupiter-dns",
        });
        return NextResponse.json(
          {
            error: "Jupiter indisponible (résolution DNS). Réessayez dans quelques instants.",
          },
          withNoStore({ status: 503 })
        );
      }

      throw jupiterFetchError ?? new Error("Invalid quote response from Jupiter");
    }

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

    let nativeRoute: Record<string, unknown> | null = null;
    let npiOpportunity = null;
    const multiSourceQuotes = aggregatedQuote
      ? summarizeQuoteResults(aggregatedQuote.alternativeQuotes)
      : [];

    if (aggregatedQuote?.bestQuote) {
      nativeRoute = {
        provider: aggregatedQuote.source,
        fromCache: aggregatedQuote.fromCache,
        outAmount: aggregatedQuote.bestQuote.outAmount,
      };

      if (aggregatedQuote.source !== "jupiter") {
        const opportunity = calculateNpiOpportunity({
          primary: quote,
          alternative: aggregatedQuote.bestQuote,
          source: aggregatedQuote.source,
          outputDecimals,
        });

        if (opportunity.available) {
          npiOpportunity = opportunity;
          nativeRoute = {
            ...nativeRoute,
            improvementBps: opportunity.improvementBps,
            npiShareLamports: opportunity.shareLamports,
            npiShareTokens: opportunity.shareTokens,
            explanation: opportunity.explanation,
          };
        }
      }
    }

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

            // On considère réussi si on a soit des comptes statiques, soit des lookup tables
            const hasStaticAccounts = parsed.accounts.length > 0;
            const hasLookupTables = parsed.addressTableLookups && parsed.addressTableLookups.length > 0;
            
            if (!hasStaticAccounts && !hasLookupTables) {
              console.warn("⚠️ Jupiter accounts extraction failed - no accounts or lookup tables");
            } else {
              jupiterCpi = {
                expectedInputAmount: quote.inAmount,
                swapInstruction: swapData.swapTransaction, // Transaction sérialisée base64
                accounts: parsed.accounts,
                programId: parsed.programId,
                addressTableLookups: parsed.addressTableLookups,
                // Données instruction pour CPI Router (bytes bruts)
                instructionData: parsed.instructionData,
                // Données additionnelles utiles
                lastValidBlockHeight: swapData.lastValidBlockHeight,
                prioritizationFeeLamports: swapData.prioritizationFeeLamports,
                computeUnitLimit: swapData.computeUnitLimit,
              };
              console.log(`✅ Swap instructions obtained (${parsed.accounts.length} static accounts, ${parsed.addressTableLookups?.length || 0} lookup tables, instruction data: ${parsed.instructionData?.length || 0} bytes)`);
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

    const responsePayload = {
      success: true,
      quote,
      routeInfo,
      intents,
      reliability: reliabilitySummary,
      routingStrategy,
      jupiterCpi,
      nativeRoute,
      npiOpportunity,
      multiSourceQuotes,
      usedMultiSourceFallback: false,
      timestamp: Date.now(),
    };

    trackServerEvent("Quote API Success", {
      distinctId: analyticsId,
      latencyMs: Date.now() - requestStartedAt,
      routingStrategy,
      priceImpactPct: routeInfo.priceImpactPct ?? null,
      routePlanLength: routeInfo.totalSteps,
      nativeProvider: (nativeRoute as any)?.provider ?? null,
      hasNpiOpportunity: Boolean(npiOpportunity?.available),
      hasJupiterCpi: Boolean(jupiterCpi),
      multiSourceCandidates: multiSourceQuotes.length,
    });

    return NextResponse.json(responsePayload, withNoStore());
  } catch (error) {
    console.error("❌ Error in /api/swap/quote:", error);

    trackServerEvent("Quote API Error", {
      distinctId: analyticsId,
      latencyMs: Date.now() - requestStartedAt,
      message: error instanceof Error ? error.message : "Unknown",
    });

    return NextResponse.json(
      {
        error: "Failed to fetch quote",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      withNoStore({ status: 500 })
    );
  }
}

function summarizeQuoteResults(results?: QuoteResult[]) {
  if (!results?.length) return [];

  return results.map((result) => ({
    source: result.source,
    latencyMs: result.latencyMs,
    ok: Boolean(result.quote),
    outAmount: result.quote?.outAmount ?? null,
    error: result.error ?? null,
  }));
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
