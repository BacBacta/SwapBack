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
import { getCircuit, retryWithBackoff, CircuitOpenError, isTransientNetworkError } from "@/lib/resilience";
import { getQuoteAggregator } from "@/lib/quotes/multiSourceAggregator";
import type { QuoteResult } from "@/lib/quotes/multiSourceAggregator";
import { calculateNpiOpportunity } from "@/lib/rebates/npiEngine";
import { getTokenByMint } from "@/constants/tokens";
import type { JupiterQuoteResponse, JupiterRoutePlanStep } from "@/types/router";
import { trackServerEvent } from "@/lib/serverAnalytics";

const PRIMARY_JUPITER_API = process.env.JUPITER_API_URL || "https://public.jupiterapi.com";

// RPC endpoint for ALT resolution (must be mainnet for production)
const DEFAULT_RPC_ENDPOINT =
  process.env.SWAPBACK_RPC_ENDPOINT ??
  process.env.ANCHOR_PROVIDER_URL ??
  "https://api.mainnet-beta.solana.com";

// Jupiter API endpoints (primary + fallbacks) - public.jupiterapi.com resolves better
const JUPITER_ENDPOINTS = [
  "https://public.jupiterapi.com",
  PRIMARY_JUPITER_API,
  "https://api.jup.ag/v6",
  "https://quote-api.jup.ag/v6",
].filter((url, index, arr) => arr.indexOf(url) === index);

// ========================================
// Rate Limiting & Caching
// ========================================

// Simple in-memory rate limiter (per IP)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute per IP

// Simple quote cache (5 second TTL)
const quoteCache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 5_000; // 5 seconds

function getCacheKey(params: { inputMint: string; outputMint: string; amount: number; slippageBps: number }): string {
  return `${params.inputMint}-${params.outputMint}-${params.amount}-${params.slippageBps}`;
}

function getFromCache(key: string): unknown | null {
  const cached = quoteCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  quoteCache.delete(key);
  return null;
}

function setCache(key: string, data: unknown): void {
  // Clean old entries periodically
  if (quoteCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of quoteCache.entries()) {
      if (v.expiresAt < now) quoteCache.delete(k);
    }
  }
  quoteCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  let record = rateLimitMap.get(ip);
  
  // Clean old entries
  if (record && record.resetAt < now) {
    rateLimitMap.delete(ip);
    record = undefined;
  }
  
  if (!record) {
    record = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, record);
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }
  
  record.count++;
  const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - record.count);
  const resetIn = Math.max(0, record.resetAt - now);
  
  return { allowed: record.count <= RATE_LIMIT_MAX_REQUESTS, remaining, resetIn };
}

// Program IDs Jupiter v6 (mainnet/devnet)
const JUPITER_PROGRAM_IDS = new Set([
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", // Jupiter V6 mainnet
  "JUP6LkbZBMd1McqTgnmMSpZ88LdKgmhyaXtCXnVQ1Nm", // Legacy (keep for compatibility)
]);

/**
 * Résout les Address Lookup Tables pour obtenir toutes les adresses.
 * Utilisé pour reconstruire la liste complète des comptes Jupiter dans le bon ordre.
 */
async function resolveAddressLookupTables(
  connection: Connection,
  addressTableLookups: { accountKey: PublicKey; writableIndexes: number[]; readonlyIndexes: number[] }[]
): Promise<Map<string, PublicKey[]>> {
  const altAccountsMap = new Map<string, PublicKey[]>();
  
  if (!addressTableLookups || addressTableLookups.length === 0) {
    return altAccountsMap;
  }
  
  try {
    const altAddresses = addressTableLookups.map(l => l.accountKey);
    const altInfos = await connection.getMultipleAccountsInfo(altAddresses);
    
    const HEADER_SIZE = 56;
    
    for (let i = 0; i < altAddresses.length; i++) {
      const altInfo = altInfos[i];
      if (!altInfo || !altInfo.data) continue;
      
      const data = altInfo.data;
      const addressCount = (data.length - HEADER_SIZE) / 32;
      const addresses: PublicKey[] = [];
      
      for (let j = 0; j < addressCount; j++) {
        const start = HEADER_SIZE + j * 32;
        addresses.push(new PublicKey(data.subarray(start, start + 32)));
      }
      
      altAccountsMap.set(altAddresses[i].toBase58(), addresses);
    }
    
    console.log(`📍 Resolved ${altAccountsMap.size} ALTs with ${[...altAccountsMap.values()].reduce((sum, arr) => sum + arr.length, 0)} total addresses`);
  } catch (error) {
    console.error("❌ Error resolving ALTs:", error);
  }
  
  return altAccountsMap;
}

/**
 * Extrait les comptes Jupiter dans l'ORDRE EXACT requis pour le CPI.
 * 
 * IMPORTANT: L'ordre des comptes est CRUCIAL. Jupiter attend ses comptes
 * dans l'ordre précis de accountKeyIndexes. On doit résoudre les indices
 * ALT vers les vraies adresses et maintenir l'ordre.
 * 
 * @param swapTxBase64 - Transaction Jupiter sérialisée en base64
 * @param connection - Connexion RPC pour résoudre les ALT (optionnel)
 * @returns Comptes dans l'ordre EXACT + données d'instruction
 */
async function extractJupiterAccountsWithALTResolution(
  swapTxBase64: string,
  connection?: Connection
): Promise<{
  accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  programId: string;
  addressTableLookups?: { accountKey: string; writableIndexes: number[]; readonlyIndexes: number[] }[];
  instructionData?: string;
  accountsInOrder: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  jupiterProgramIndex: number;
}> {
  const emptyResult = {
    accounts: [],
    programId: "",
    addressTableLookups: undefined,
    instructionData: undefined,
    accountsInOrder: [],
    jupiterProgramIndex: -1,
  };

  try {
    const buf = Buffer.from(swapTxBase64, "base64");
    const vtx = VersionedTransaction.deserialize(buf);
    const msg = vtx.message;
    
    const staticKeys = msg.staticAccountKeys || [];
    
    if (staticKeys.length === 0) {
      console.warn("⚠️ No static account keys in transaction");
      return emptyResult;
    }

    const instructions = [...msg.compiledInstructions];
    
    if (!instructions || instructions.length === 0) {
      console.warn("⚠️ No instructions found in transaction");
      return emptyResult;
    }
    
    // Chercher l'instruction Jupiter
    const jupIx = [...instructions].reverse().find((ix) => {
      if (ix.programIdIndex >= staticKeys.length) return false;
      const pid = staticKeys[ix.programIdIndex]?.toBase58();
      if (!pid) return false;
      if (pid === "ComputeBudget111111111111111111111111111111") return false;
      return JUPITER_PROGRAM_IDS.has(pid);
    });
    
    const fallbackIx = jupIx ?? [...instructions].reverse().find((ix) => {
      if (ix.programIdIndex >= staticKeys.length) return true;
      const pid = staticKeys[ix.programIdIndex]?.toBase58();
      return pid !== "ComputeBudget111111111111111111111111111111";
    }) ?? instructions[instructions.length - 1];

    if (!fallbackIx) {
      console.warn("⚠️ No suitable instruction found in transaction");
      return emptyResult;
    }

    const programId = fallbackIx.programIdIndex < staticKeys.length 
      ? staticKeys[fallbackIx.programIdIndex]?.toBase58() ?? ""
      : "";
    
    const instructionData = Buffer.from(fallbackIx.data).toString('base64');
    
    if (!fallbackIx.accountKeyIndexes || fallbackIx.accountKeyIndexes.length === 0) {
      console.warn("⚠️ No account key indexes in instruction");
      return { ...emptyResult, programId, instructionData };
    }
    
    // Comptes statiques (ancienne méthode pour compatibilité)
    const accounts = fallbackIx.accountKeyIndexes
      .filter(idx => idx < staticKeys.length)
      .map((idx) => ({
        pubkey: staticKeys[idx]?.toBase58() ?? "",
        isSigner: msg.isAccountSigner(idx),
        isWritable: msg.isAccountWritable(idx),
      }))
      .filter(acc => acc.pubkey !== "");

    const addressTableLookups = msg.addressTableLookups?.map(lookup => ({
      accountKey: lookup.accountKey.toBase58(),
      writableIndexes: [...lookup.writableIndexes],
      readonlyIndexes: [...lookup.readonlyIndexes],
    }));

    // Si pas de connexion, retourner le résultat partiel (compatibilité)
    if (!connection || !msg.addressTableLookups || msg.addressTableLookups.length === 0) {
      console.log(`📊 Extracted ${accounts.length} static accounts (no ALT resolution)`);
      return {
        accounts,
        programId,
        addressTableLookups,
        instructionData,
        accountsInOrder: accounts, // Sans ALT, on retourne les comptes statiques
        jupiterProgramIndex: accounts.findIndex(a => JUPITER_PROGRAM_IDS.has(a.pubkey)),
      };
    }

    // Résoudre les ALT pour reconstruire l'ordre complet
    const altAccountsMap = await resolveAddressLookupTables(connection, msg.addressTableLookups);
    
    // Reconstruire la liste complète dans l'ordre EXACT de accountKeyIndexes
    const STATIC_ACCOUNT_COUNT = staticKeys.length;
    const accountsInOrder: { pubkey: string; isSigner: boolean; isWritable: boolean }[] = [];
    let jupiterProgramIndex = -1;
    
    console.log(`🔍 Rebuilding account order: ${fallbackIx.accountKeyIndexes.length} indexes, ${STATIC_ACCOUNT_COUNT} static keys`);
    
    // Log first few indices for debugging
    const firstIndices = fallbackIx.accountKeyIndexes.slice(0, 10);
    const maxIdx = Math.max(...fallbackIx.accountKeyIndexes);
    console.log(`🔍 First 10 indices: [${firstIndices.join(', ')}], max index: ${maxIdx}`);
    
    for (const idx of fallbackIx.accountKeyIndexes) {
      if (idx < STATIC_ACCOUNT_COUNT) {
        // Compte statique
        const pubkey = staticKeys[idx].toBase58();
        accountsInOrder.push({
          pubkey,
          isSigner: msg.isAccountSigner(idx),
          isWritable: msg.isAccountWritable(idx),
        });
        if (JUPITER_PROGRAM_IDS.has(pubkey) && jupiterProgramIndex === -1) {
          jupiterProgramIndex = accountsInOrder.length - 1;
        }
      } else {
        // Compte dans une ALT - calculer l'offset
        let altOffset = idx - STATIC_ACCOUNT_COUNT;
        let resolved = false;
        
        for (const lookup of msg.addressTableLookups) {
          const altKey = lookup.accountKey.toBase58();
          const altAddresses = altAccountsMap.get(altKey) || [];
          const writableCount = lookup.writableIndexes.length;
          const readonlyCount = lookup.readonlyIndexes.length;
          const totalInThisAlt = writableCount + readonlyCount;
          
          if (altOffset < totalInThisAlt) {
            let localIndex: number;
            let isWritable: boolean;
            
            if (altOffset < writableCount) {
              localIndex = lookup.writableIndexes[altOffset];
              isWritable = true;
            } else {
              localIndex = lookup.readonlyIndexes[altOffset - writableCount];
              isWritable = false;
            }
            
            if (localIndex < altAddresses.length) {
              const pubkey = altAddresses[localIndex].toBase58();
              accountsInOrder.push({
                pubkey,
                isSigner: false, // ALT accounts are never signers
                isWritable,
              });
              if (JUPITER_PROGRAM_IDS.has(pubkey) && jupiterProgramIndex === -1) {
                jupiterProgramIndex = accountsInOrder.length - 1;
              }
              resolved = true;
            }
            break;
          }
          altOffset -= totalInThisAlt;
        }
        
        if (!resolved) {
          console.warn(`⚠️ Could not resolve account at index ${idx}`);
        }
      }
    }
    
    console.log(`📊 Extracted ${accountsInOrder.length} accounts in exact order (Jupiter at index ${jupiterProgramIndex})`);
    
    return {
      accounts,
      programId,
      addressTableLookups,
      instructionData,
      accountsInOrder,
      jupiterProgramIndex,
    };
  } catch (error) {
    console.error("❌ Error extracting Jupiter accounts:", error);
    return emptyResult;
  }
}

// Legacy function for compatibility
function extractJupiterAccounts(swapTxBase64: string): {
  accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  programId: string;
  addressTableLookups?: { accountKey: string; writableIndexes: number[]; readonlyIndexes: number[] }[];
  instructionData?: string;
} {
  // Use the new async version but return synchronously (without ALT resolution)
  try {
    const buf = Buffer.from(swapTxBase64, "base64");
    const vtx = VersionedTransaction.deserialize(buf);
    const msg = vtx.message;
    const staticKeys = msg.staticAccountKeys || [];

    if (staticKeys.length === 0) {
      return { accounts: [], programId: "" };
    }

    const instructions = [...msg.compiledInstructions];
    if (!instructions || instructions.length === 0) {
      return { accounts: [], programId: "" };
    }

    const jupIx = [...instructions].reverse().find((ix) => {
      if (ix.programIdIndex >= staticKeys.length) return false;
      const pid = staticKeys[ix.programIdIndex]?.toBase58();
      if (!pid) return false;
      if (pid === "ComputeBudget111111111111111111111111111111") return false;
      return JUPITER_PROGRAM_IDS.has(pid);
    });

    const fallbackIx = jupIx ?? [...instructions].reverse().find((ix) => {
      if (ix.programIdIndex >= staticKeys.length) return true;
      const pid = staticKeys[ix.programIdIndex]?.toBase58();
      return pid !== "ComputeBudget111111111111111111111111111111";
    }) ?? instructions[instructions.length - 1];

    if (!fallbackIx) {
      return { accounts: [], programId: "" };
    }

    const programId = fallbackIx.programIdIndex < staticKeys.length
      ? staticKeys[fallbackIx.programIdIndex]?.toBase58() ?? ""
      : "";

    const instructionData = Buffer.from(fallbackIx.data).toString('base64');

    if (!fallbackIx.accountKeyIndexes || fallbackIx.accountKeyIndexes.length === 0) {
      return { accounts: [], programId, instructionData };
    }

    const accounts = fallbackIx.accountKeyIndexes
      .filter(idx => idx < staticKeys.length)
      .map((idx) => ({
        pubkey: staticKeys[idx]?.toBase58() ?? "",
        isSigner: msg.isAccountSigner(idx),
        isWritable: msg.isAccountWritable(idx),
      }))
      .filter(acc => acc.pubkey !== "");

    const addressTableLookups = msg.addressTableLookups?.map(lookup => ({
      accountKey: lookup.accountKey.toBase58(),
      writableIndexes: [...lookup.writableIndexes],
      readonlyIndexes: [...lookup.readonlyIndexes],
    }));

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
        // Retry sur erreurs réseau/DNS transitoires, mais pas sur 4xx
        if (error.message.includes("responded 4")) {
          return false;
        }
        return isTransientNetworkError(error);
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
  
  // Get client IP for rate limiting
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
    ?? request.headers.get("x-real-ip") 
    ?? "unknown";
  
  // Check rate limit
  const rateLimit = checkRateLimit(clientIp);
  if (!rateLimit.allowed) {
    console.warn(`⚠️ Rate limit exceeded for IP: ${clientIp}`);
    return NextResponse.json(
      { 
        error: "Rate limit exceeded. Please slow down your requests.",
        retryAfter: Math.ceil(rateLimit.resetIn / 1000),
      },
      {
        status: 429,
        headers: {
          ...CORS_HEADERS,
          "Retry-After": String(Math.ceil(rateLimit.resetIn / 1000)),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetIn / 1000)),
        },
      }
    );
  }
  
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

    // Check cache first
    const cacheKey = getCacheKey({ inputMint, outputMint, amount: parsedAmount, slippageBps });
    const cachedResponse = getFromCache(cacheKey);
    if (cachedResponse) {
      console.log(`📦 Cache hit for ${inputMint.slice(0, 8)}...→${outputMint.slice(0, 8)}...`);
      return NextResponse.json(cachedResponse, {
        headers: {
          ...CORS_HEADERS,
          "X-Cache": "HIT",
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      });
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
    const diagnosticsTimestamp = Date.now();

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
            routerDiagnostics: null,
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

    const routerDiagnostics = {
      id: `jupiter-${diagnosticsTimestamp}-${Math.floor(Math.random() * 10_000)}`,
      inputMint,
      outputMint,
      amountLamports,
      slippageBps,
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      otherAmountThreshold: quote.otherAmountThreshold ?? null,
      timestamp: diagnosticsTimestamp,
    };

    console.log("🧪 Jupiter slippage diagnostics", {
      ...routerDiagnostics,
      previewQuote: {
        priceImpactPct: quote.priceImpactPct,
        contextSlot: (quote as any)?.contextSlot ?? null,
      },
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
        // NOUVEAU: Utiliser /swap-instructions au lieu de /swap pour obtenir les comptes
        // dans l'ordre exact requis pour le CPI, sans avoir à parser la transaction
        let swapInstructionsResponse: Response | null = null;
        try {
          swapInstructionsResponse = await fetchFromJupiter("/swap-instructions", {
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
              dynamicSlippage: { minBps: 100, maxBps: Math.max(slippageBps, 200) },
            }),
          });
        } catch (swapErr) {
          if (isNetworkResolutionError(swapErr)) {
            console.warn("🌐 Jupiter DNS lookup failed for /swap-instructions", swapErr);
            swapInstructionsResponse = null;
          } else {
            throw swapErr;
          }
        }

        if (swapInstructionsResponse?.ok) {
          const swapData = await swapInstructionsResponse.json();

          // /swap-instructions retourne directement swapInstruction avec accounts dans le bon ordre
          if (swapData.swapInstruction) {
            const swapIx = swapData.swapInstruction;
            
            // Les comptes sont DÉJÀ dans l'ordre exact pour le CPI !
            const accountsInOrder = (swapIx.accounts || []).map((acc: any) => ({
              pubkey: acc.pubkey,
              isSigner: acc.isSigner || false,
              isWritable: acc.isWritable || false,
            }));
            
            // Trouver l'index de Jupiter Program ID
            const JUPITER_PROGRAM_IDS = new Set([
              "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
              "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB",
            ]);
            const jupiterProgramIndex = accountsInOrder.findIndex(
              (a: any) => JUPITER_PROGRAM_IDS.has(a.pubkey)
            );
            
            jupiterCpi = {
              expectedInputAmount: quote.inAmount,
              swapInstruction: swapData.swapTransaction || "", // May not be present with /swap-instructions
              accounts: accountsInOrder, // Legacy field
              programId: swapIx.programId,
              addressTableLookups: swapData.addressLookupTableAddresses?.map((addr: string) => ({
                accountKey: addr,
                writableIndexes: [],
                readonlyIndexes: [],
              })) || [],
              // Données instruction pour CPI Router (bytes bruts base64)
              instructionData: swapIx.data,
              // Comptes dans l'ordre exact pour CPI (depuis /swap-instructions)
              accountsInOrder,
              jupiterProgramIndex,
              // Données additionnelles
              lastValidBlockHeight: swapData.lastValidBlockHeight,
              prioritizationFeeLamports: swapData.prioritizationFeeLamports,
              computeUnitLimit: swapData.computeUnitLimit,
              // Nouvelles données utiles
              setupInstructions: swapData.setupInstructions,
              cleanupInstruction: swapData.cleanupInstruction,
              computeBudgetInstructions: swapData.computeBudgetInstructions,
            };
            console.log(`✅ Swap instructions obtained from /swap-instructions (${accountsInOrder.length} accounts, Jupiter at index ${jupiterProgramIndex})`);
          }
        } else if (swapInstructionsResponse) {
          const swapError = await swapInstructionsResponse.text();
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
      routerDiagnostics,
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

    // Cache the successful response
    setCache(cacheKey, responsePayload);

    return NextResponse.json(responsePayload, {
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "no-store",
        "X-Cache": "MISS",
        "X-RateLimit-Remaining": String(rateLimit.remaining),
      },
    });
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
