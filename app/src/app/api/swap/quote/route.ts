/**
 * API Route: Get Jupiter Quote
 * Returns real Jupiter API quote for token swap
 * Endpoint: GET /quote
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import { getTokenByMint } from "@/constants/tokens";
import { DEFAULT_SOLANA_RPC_URL } from "@/config/constants";

// ============================================================================
// ENVIRONMENT VARIABLES - Configurables sur Vercel
// ============================================================================

/**
 * Jupiter API Base URL
 * Working API: https://quote-api.jup.ag/v6 (stable, public)
 * Note: lite-api.jup.ag requires authentication token
 */
const JUPITER_API =
  process.env.JUPITER_API_URL || "https://quote-api.jup.ag/v6";
const USE_CORS_PROXY = process.env.USE_CORS_PROXY === "true"; // Default: false (direct call)
const CORS_PROXY = "https://corsproxy.io/?";

const JUPITER_TOKEN_INFO_URL =
  process.env.JUPITER_TOKEN_INFO_URL || "https://token.jup.ag/token";
const TOKEN_VALIDATION_TIMEOUT_MS = Number(
  process.env.JUPITER_TOKEN_INFO_TIMEOUT_MS || 3000
);

type TokenSupportStatus = "supported" | "unsupported" | "unknown";

const tokenValidationCache = new Map<string, TokenSupportStatus>();

const withNoStore = (init?: ResponseInit): ResponseInit => {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return { ...init, headers };
};

type JupiterRoutePlanStep = {
  swapInfo?: {
    ammKey?: string;
    label?: string;
    inputMint?: string;
    outputMint?: string;
    inAmount?: string;
    outAmount?: string;
    feeAmount?: string;
    feeMint?: string;
  };
  [key: string]: unknown;
};

type JupiterQuoteResponse = {
  inAmount?: string;
  outAmount?: string;
  priceImpactPct?: number | string;
  routePlan?: JupiterRoutePlanStep[];
  otherAmountThreshold?: string;
  swapMode?: string;
  [key: string]: unknown;
};

const validateTokenSupport = async (
  mint: string
): Promise<TokenSupportStatus> => {
  const normalizedMint = mint?.trim();

  if (!normalizedMint) {
    return "unsupported";
  }

  // First check local curated list
  const localToken = getTokenByMint(normalizedMint);
  if (localToken) {
    console.log("✅ Token validated from local list:", {
      mint: normalizedMint,
      symbol: localToken.symbol,
    });
    tokenValidationCache.set(normalizedMint, "supported");
    return "supported";
  }

  const cachedStatus = tokenValidationCache.get(normalizedMint);
  if (cachedStatus) {
    return cachedStatus;
  }

  // FALLBACK: Si la validation externe échoue, on accepte le token (permissive mode)
  // Cela permet de fonctionner même si token.jup.ag est inaccessible
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    TOKEN_VALIDATION_TIMEOUT_MS
  );

  try {
    const response = await fetch(
      `${JUPITER_TOKEN_INFO_URL}/${normalizedMint}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      tokenValidationCache.set(normalizedMint, "supported");
      return "supported";
    }

    if (response.status === 404) {
      console.warn("⚠️ Unsupported token mint detected:", normalizedMint);
      tokenValidationCache.set(normalizedMint, "unsupported");
      return "unsupported";
    }

    console.warn(
      "⚠️ Unexpected response while validating token mint:",
      normalizedMint,
      response.status,
      response.statusText
    );
    return "unknown";
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error)?.name === "AbortError") {
      console.error("⏱️ Token validation timed out:", normalizedMint);
    } else {
      console.error("❌ Token validation failed:", normalizedMint, error);
    }
    
    // FALLBACK: En cas d'erreur réseau (ENOTFOUND, timeout, etc.), 
    // on accepte le token par défaut (permissive mode pour Vercel)
    // Cela permet à l'app de fonctionner même si token.jup.ag est down
    console.warn("⚠️ Falling back to 'supported' due to network error");
    tokenValidationCache.set(normalizedMint, "supported");
    return "supported";
  }
};

// Construct final Jupiter URL
const getJupiterUrl = (endpoint: string) => {
  const baseUrl = `${JUPITER_API.replace(/\/$/, "")}${endpoint}`;
  return USE_CORS_PROXY
    ? `${CORS_PROXY}${encodeURIComponent(baseUrl)}`
    : baseUrl;
};

/**
 * Solana RPC Endpoint
 * Default: devnet
 * Vercel: Ajouter NEXT_PUBLIC_SOLANA_RPC_URL dans Environment Variables
 */
const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  DEFAULT_SOLANA_RPC_URL;

/**
 * Mock Mode (pour dev/test sans réseau)
 * Default: false
 * Vercel: Ajouter USE_MOCK_QUOTES=false (ou true pour staging)
 */
const USE_MOCK_DATA = process.env.USE_MOCK_QUOTES === "true";

export async function POST(request: NextRequest) {
  try {
    const {
      inputMint,
      outputMint,
      amount,
      slippageBps = 50, // 0.5% default
    } = await request.json();

    // Validate inputs
    if (!inputMint || !outputMint || !amount) {
      return NextResponse.json(
        {
          error: "Missing required fields: inputMint, outputMint, amount",
        },
        withNoStore({ status: 400 })
      );
    }

    // Validate amount
    const parsedAmount =
      typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount: must be a positive number" },
        withNoStore({ status: 400 })
      );
    }

    // Token validation désactivée en production
    // Jupiter API valide déjà les tokens - pas besoin de double validation
    // qui cause des erreurs réseau ENOTFOUND dans Vercel
    const SKIP_TOKEN_VALIDATION = process.env.SKIP_TOKEN_VALIDATION !== "false";
    
    if (!SKIP_TOKEN_VALIDATION) {
      // Validation optionnelle (activée uniquement si SKIP_TOKEN_VALIDATION=false)
      const [inputTokenStatus, outputTokenStatus] = await Promise.all([
        validateTokenSupport(inputMint),
        validateTokenSupport(outputMint),
      ]);

      if (inputTokenStatus !== "supported") {
        const statusCode = inputTokenStatus === "unknown" ? 503 : 400;
        const errorMessage =
          inputTokenStatus === "unknown"
            ? "Unable to validate input token support"
            : "Unsupported input token";

        return NextResponse.json(
          {
            error: errorMessage,
            mint: inputMint,
          },
          withNoStore({ status: statusCode })
        );
      }

      if (outputTokenStatus !== "supported") {
        const statusCode = outputTokenStatus === "unknown" ? 503 : 400;
        const errorMessage =
          outputTokenStatus === "unknown"
            ? "Unable to validate output token support"
            : "Unsupported output token";

        return NextResponse.json(
          {
            error: errorMessage,
            mint: outputMint,
          },
          withNoStore({ status: statusCode })
        );
      }
    }

    // Build Jupiter API URL
    // Supported params: inputMint, outputMint, amount, slippageBps, taker, referralAccount, excludeRouters, excludeDexes
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: Math.floor(parsedAmount).toString(),
      slippageBps: slippageBps.toString(),
    });

    console.log("🔍 Fetching Jupiter quote:", {
      inputMint: inputMint.slice(0, 8) + "...",
      outputMint: outputMint.slice(0, 8) + "...",
      amount: parsedAmount,
      slippageBps,
    });

    // MODE MOCK pour tests (si problème réseau)
    if (USE_MOCK_DATA) {
      console.log("🧪 Using MOCK data (network unavailable)");
      const mockQuote = generateMockQuote(
        inputMint,
        outputMint,
        parsedAmount,
        slippageBps
      );
      const mockRouteInfo = parseRouteInfo(mockQuote);

      return NextResponse.json(
        {
          success: true,
          quote: mockQuote,
          routeInfo: mockRouteInfo,
          timestamp: Date.now(),
        },
        withNoStore()
      );
    }

    // Fetch quote from Jupiter API
    const jupiterEndpoint = `/quote?${params.toString()}`;
    const quoteUrl = getJupiterUrl(jupiterEndpoint);

    console.log("🔄 Fetching Jupiter quote...");
    console.log("   URL:", quoteUrl);
    console.log("   Params:", {
      inputMint: inputMint.slice(0, 8) + "...",
      outputMint: outputMint.slice(0, 8) + "...",
      amount: parsedAmount,
      slippageBps,
    });

    const response = await fetch(quoteUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      // Ne pas spécifier 'cache' ET 'next.revalidate' en même temps
      // On utilise seulement next.revalidate pour Next.js
      next: { revalidate: 0 },
    });

    console.log("📡 Jupiter API Response:", {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Jupiter API error:");
      console.error("   Status:", response.status);
      console.error("   Response:", errorText);
      console.error("   URL called:", quoteUrl);

      return NextResponse.json(
        {
          error: "Jupiter API error",
          details: errorText,
          status: response.status,
        },
        withNoStore({ status: response.status })
      );
    }

    const quote = (await response.json()) as JupiterQuoteResponse;

    if (!quote || !quote.outAmount) {
      return NextResponse.json(
        { error: "Invalid quote response from Jupiter" },
        withNoStore({ status: 500 })
      );
    }

    console.log("✅ Quote received:", {
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      priceImpact: quote.priceImpactPct,
      routes: quote.routePlan?.length || 0,
    });

    // Parse and enhance the quote with route information
    const routeInfo = parseRouteInfo(quote);

    return NextResponse.json(
      {
        success: true,
        quote,
        routeInfo,
        timestamp: Date.now(),
      },
      withNoStore()
    );
  } catch (error) {
    console.error("❌ Error fetching quote:", error);

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
 * Parse Jupiter quote into readable route information
 */
function parseRouteInfo(quote: JupiterQuoteResponse) {
  const routes = quote.routePlan ?? [];

  const steps = routes.map((route: JupiterRoutePlanStep, index: number) => {
    const swapInfo = route.swapInfo;

    return {
      stepNumber: index + 1,
      ammKey: swapInfo?.ammKey ?? "Unknown",
      label: swapInfo?.label ?? `Step ${index + 1}`,
      inputMint: swapInfo?.inputMint ?? "",
      outputMint: swapInfo?.outputMint ?? "",
      inAmount: swapInfo?.inAmount ?? "0",
      outAmount: swapInfo?.outAmount ?? "0",
      feeAmount: swapInfo?.feeAmount ?? "0",
      feeMint: swapInfo?.feeMint ?? "",
    };
  });

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

/**
 * Generate mock quote data for testing (when network unavailable)
 */
function generateMockQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number
): JupiterQuoteResponse {
  // Simuler un taux de change SOL/USDC ~ 150 USDC par SOL
  const mockPrice =
    inputMint.startsWith("So11") && outputMint.startsWith("EPjF") ? 150 : 1.05; // Prix par défaut

  const outAmount = Math.floor(amount * mockPrice);
  const priceImpact = (amount / 1000000000) * 0.01; // 0.01% par SOL

  return {
    inputMint,
    outputMint,
    inAmount: amount.toString(),
    outAmount: outAmount.toString(),
    otherAmountThreshold: Math.floor(
      outAmount * (1 - slippageBps / 10000)
    ).toString(),
    swapMode: "ExactIn",
    slippageBps,
    priceImpactPct: priceImpact.toFixed(4),
    price: mockPrice.toString(),
    routePlan: [
      {
        swapInfo: {
          ammKey: "MOCK_ORCA",
          label: "Orca (MOCK)",
          inputMint,
          outputMint,
          inAmount: amount.toString(),
          outAmount: outAmount.toString(),
          feeAmount: Math.floor(amount * 0.003).toString(), // 0.3% fee
          feeMint: inputMint,
        },
        percent: 100,
      },
    ],
    contextSlot: 999999999,
    timeTaken: 0.123,
    _isMockData: true,
  };
}

/**
 * GET handler for health check
 */
export async function GET() {
  try {
    const connection = new Connection(RPC_ENDPOINT);
    const slot = await connection.getSlot();

    return NextResponse.json(
      {
        status: "ok",
        service: "Jupiter Quote API",
        jupiterApi: JUPITER_API,
        rpc: RPC_ENDPOINT,
        currentSlot: slot,
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
