/**
 * Multi-Source Quote Aggregator
 * Réduit la dépendance à Jupiter en agrégeant plusieurs sources
 */

import type { JupiterQuoteResponse } from "@/types/router";
import { getQuoteCache } from "../cache/quoteCache";
import { retryWithBackoff } from "../resilience/circuitBreaker";

export interface QuoteSource {
  name: string;
  priority: number;
  enabled: boolean;
  fetchQuote: (params: QuoteParams) => Promise<QuoteResult>;
}

export interface QuoteParams {
  inputMint: string;
  outputMint: string;
  /** Amount expressed in human readable units (e.g. SOL, USDC) */
  amountTokens: number;
  /** Amount in smallest units (lamports) */
  amountLamports: number;
  inputDecimals: number;
  outputDecimals: number;
  slippageBps: number;
  userPublicKey?: string;
}

export interface QuoteResult {
  source: string;
  quote: JupiterQuoteResponse | null;
  latencyMs: number;
  error?: string;
  improvementBps?: number;
}

export interface AggregatedQuote {
  bestQuote: JupiterQuoteResponse;
  source: string;
  alternativeQuotes: QuoteResult[];
  totalLatencyMs: number;
  fromCache: boolean;
}

// === Sources de quotes ===

const JUPITER_ENDPOINTS = [
  "https://quote-api.jup.ag/v6",
  "https://quote-api.jup.ag/v6", // backup identique, mais avec retry
];

async function fetchJupiterQuote(params: QuoteParams, endpoint: string): Promise<JupiterQuoteResponse> {
  const url = new URL(`${endpoint}/quote`);
  url.searchParams.set("inputMint", params.inputMint);
  url.searchParams.set("outputMint", params.outputMint);
  url.searchParams.set("amount", Math.floor(params.amountLamports).toString());
  url.searchParams.set("slippageBps", params.slippageBps.toString());
  url.searchParams.set("onlyDirectRoutes", "false");
  url.searchParams.set("asLegacyTransaction", "false");

  const response = await fetch(url.toString(), {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Jupiter error: ${response.status}`);
  }

  return response.json();
}

// Raydium SDK (fallback)
async function fetchRaydiumQuote(params: QuoteParams): Promise<JupiterQuoteResponse | null> {
  try {
    // Raydium API pour les paires AMM
    const url = `https://api.raydium.io/v2/main/price?tokens=${params.inputMint},${params.outputMint}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    
    if (!response.ok) return null;

    const data = await response.json();
    const inputPrice = data[params.inputMint]?.price || 0;
    const outputPrice = data[params.outputMint]?.price || 0;

    if (!inputPrice || !outputPrice) return null;

    // Estimation simple basée sur le prix
    const amountInTokens = params.amountTokens;
    const rate = inputPrice / outputPrice;
    const outputAmountTokens = amountInTokens * rate * 0.997; // 0.3% fee estimation
    const outputLamports = Math.floor(outputAmountTokens * Math.pow(10, params.outputDecimals));
    const inputLamports = Math.floor(amountInTokens * Math.pow(10, params.inputDecimals));

    // Format compatible Jupiter
    return {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      inAmount: inputLamports.toString(),
      outAmount: outputLamports.toString(),
      otherAmountThreshold: Math.floor(outputLamports * 0.99).toString(),
      priceImpactPct: "0.1",
      routePlan: [{
        swapInfo: {
          ammKey: "raydium-amm",
          label: "Raydium",
          inputMint: params.inputMint,
          outputMint: params.outputMint,
          inAmount: inputLamports.toString(),
          outAmount: outputLamports.toString(),
          feeAmount: Math.floor(amountInTokens * 0.003 * Math.pow(10, params.inputDecimals)).toString(),
          feeMint: params.inputMint,
        },
        percent: 100,
      }],
      contextSlot: 0,
      timeTaken: 0,
    };
  } catch {
    return null;
  }
}

// Orca Whirlpool (fallback)
async function fetchOrcaQuote(params: QuoteParams): Promise<JupiterQuoteResponse | null> {
  try {
    // Orca Whirlpool API
    const url = `https://api.orca.so/v2/quote?inputMint=${params.inputMint}&outputMint=${params.outputMint}&amount=${params.amountLamports}&slippage=${params.slippageBps / 10000}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.outAmount) return null;

    // Format compatible Jupiter
    return {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      inAmount: data.inAmount || params.amountLamports.toString(),
      outAmount: data.outAmount,
      otherAmountThreshold: Math.floor(Number(data.outAmount) * 0.99).toString(),
      priceImpactPct: data.priceImpact || "0.1",
      routePlan: [{
        swapInfo: {
          ammKey: "orca-whirlpool",
          label: "Orca",
          inputMint: params.inputMint,
          outputMint: params.outputMint,
          inAmount: data.inAmount || params.amountLamports.toString(),
          outAmount: data.outAmount,
          feeAmount: "0",
          feeMint: params.inputMint,
        },
        percent: 100,
      }],
      contextSlot: 0,
      timeTaken: 0,
    };
  } catch {
    return null;
  }
}

// === Aggregateur ===

export class MultiSourceQuoteAggregator {
  private sources: QuoteSource[] = [];
  private cache = getQuoteCache();

  constructor() {
    this.initDefaultSources();
  }

  private initDefaultSources(): void {
    // Jupiter (priorité max)
    this.sources.push({
      name: "jupiter",
      priority: 1,
      enabled: true,
      fetchQuote: async (params) => {
        const start = Date.now();
        try {
          const quote = await retryWithBackoff(
            () => fetchJupiterQuote(params, JUPITER_ENDPOINTS[0]),
            { maxRetries: 2, initialDelayMs: 500, backoffMultiplier: 1.5, maxDelayMs: 2000, jitter: true }
          );
          return { source: "jupiter", quote, latencyMs: Date.now() - start };
        } catch (error) {
          return { 
            source: "jupiter", 
            quote: null, 
            latencyMs: Date.now() - start,
            error: error instanceof Error ? error.message : "Unknown error"
          };
        }
      },
    });

    // Raydium (fallback)
    this.sources.push({
      name: "raydium",
      priority: 2,
      enabled: true,
      fetchQuote: async (params) => {
        const start = Date.now();
        const quote = await fetchRaydiumQuote(params);
        return { source: "raydium", quote, latencyMs: Date.now() - start };
      },
    });

    // Orca (fallback)
    this.sources.push({
      name: "orca",
      priority: 3,
      enabled: true,
      fetchQuote: async (params) => {
        const start = Date.now();
        const quote = await fetchOrcaQuote(params);
        return { source: "orca", quote, latencyMs: Date.now() - start };
      },
    });
  }

  /**
   * Active/désactive une source
   */
  setSourceEnabled(name: string, enabled: boolean): void {
    const source = this.sources.find(s => s.name === name);
    if (source) {
      source.enabled = enabled;
    }
  }

  /**
   * Récupère le meilleur quote de toutes les sources
   */
  async getBestQuote(params: QuoteParams): Promise<AggregatedQuote> {
    const startTime = Date.now();

    // 1. Vérifier le cache d'abord
    const cached = this.cache.get(params.inputMint, params.outputMint, params.amountTokens);
    if (cached) {
      return {
        bestQuote: cached,
        source: "cache",
        alternativeQuotes: [],
        totalLatencyMs: Date.now() - startTime,
        fromCache: true,
      };
    }

    // 2. Fetch en parallèle de toutes les sources activées
    const enabledSources = this.sources.filter(s => s.enabled);
    const results = await Promise.all(
      enabledSources.map(source => source.fetchQuote(params))
    );

    // 3. Filtrer les quotes valides
    const validResults = results.filter(r => r.quote !== null);

    if (validResults.length === 0) {
      throw new Error("Aucune source de quote disponible");
    }

    // 4. Trouver le meilleur quote (output le plus élevé)
    validResults.sort((a, b) => {
      const outA = BigInt(a.quote!.outAmount);
      const outB = BigInt(b.quote!.outAmount);
      return outB > outA ? 1 : outB < outA ? -1 : 0;
    });

    const best = validResults[0];

    // 5. Mettre en cache
    this.cache.set(params.inputMint, params.outputMint, params.amountTokens, best.quote!);

    return {
      bestQuote: best.quote!,
      source: best.source,
      alternativeQuotes: results,
      totalLatencyMs: Date.now() - startTime,
      fromCache: false,
    };
  }

  /**
   * Récupère le quote le plus rapide (first response wins)
   */
  async getFastestQuote(params: QuoteParams): Promise<AggregatedQuote> {
    const startTime = Date.now();

    // Cache check
    const cached = this.cache.get(params.inputMint, params.outputMint, params.amountTokens);
    if (cached) {
      return {
        bestQuote: cached,
        source: "cache",
        alternativeQuotes: [],
        totalLatencyMs: Date.now() - startTime,
        fromCache: true,
      };
    }

    // Race pour le premier résultat valide
    const enabledSources = this.sources.filter(s => s.enabled);
    
    const result = await Promise.any(
      enabledSources.map(async source => {
        const result = await source.fetchQuote(params);
        if (!result.quote) throw new Error("No quote");
        return result;
      })
    ).catch(() => null);

    if (!result) {
      throw new Error("Aucune source de quote disponible");
    }

    this.cache.set(params.inputMint, params.outputMint, params.amountTokens, result.quote!);

    return {
      bestQuote: result.quote!,
      source: result.source,
      alternativeQuotes: [result],
      totalLatencyMs: Date.now() - startTime,
      fromCache: false,
    };
  }

  /**
   * Statistiques des sources
   */
  getSourceStats(): { name: string; enabled: boolean; priority: number }[] {
    return this.sources.map(s => ({
      name: s.name,
      enabled: s.enabled,
      priority: s.priority,
    }));
  }
}

// Singleton
let globalAggregator: MultiSourceQuoteAggregator | null = null;

export function getQuoteAggregator(): MultiSourceQuoteAggregator {
  if (!globalAggregator) {
    globalAggregator = new MultiSourceQuoteAggregator();
  }
  return globalAggregator;
}
