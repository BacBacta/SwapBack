/**
 * Multi-Source Quote Aggregator
 * Réduit la dépendance à Jupiter en agrégeant plusieurs sources
 */

import type { JupiterQuoteResponse } from "@/types/router";
import { getQuoteCache } from "../cache/quoteCache";
import { retryWithBackoff, CircuitBreaker } from "../resilience/circuitBreaker";

// === Circuit Breakers par source ===
const sourceCircuitBreakers = new Map<string, CircuitBreaker>();

function getCircuitBreaker(sourceName: string): CircuitBreaker {
  if (!sourceCircuitBreakers.has(sourceName)) {
    sourceCircuitBreakers.set(sourceName, new CircuitBreaker(sourceName, {
      failureThreshold: 3,
      resetTimeoutMs: 30000,
      successThreshold: 2,
    }));
  }
  return sourceCircuitBreakers.get(sourceName)!;
}

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
  /** Amélioration en bps par rapport à Jupiter */
  improvementBps?: number;
  /** 
   * Valeur nette en sortie après déduction des frais et ajout des rebates SwapBack
   * Formule: outAmount - fees + rebates
   */
  netOutAmount?: string;
  /** Estimation des frais de transaction */
  fees?: FeeEstimate;
  /** Rebate SwapBack estimé (en lamports) */
  rebateAmount?: string;
}

/** Estimation détaillée des frais */
export interface FeeEstimate {
  /** Frais de base Solana (lamports) */
  baseFee: number;
  /** Priority fee estimé (lamports) */
  priorityFee: number;
  /** Frais DEX (en bps de l'output) */
  dexFeeBps: number;
  /** Frais plateforme SwapBack (0.2% = 20 bps) */
  platformFeeBps: number;
  /** Tip Jito estimé (lamports) */
  jitoTip: number;
  /** Total des frais en lamports équivalent output */
  totalFeeLamports: number;
}

/** Constantes du programme on-chain */
const SWAPBACK_CONSTANTS = {
  PLATFORM_FEE_BPS: 20,      // 0.2%
  DEFAULT_REBATE_BPS: 7000,  // 70% du NPI
  JITO_TIP_LAMPORTS: 10000,  // 0.00001 SOL tip par défaut
  BASE_TX_FEE: 5000,         // 5000 lamports
  PRIORITY_FEE: 50000,       // Priority fee moyen
};

/** Frais DEX par source (en bps) */
const DEX_FEES_BPS: Record<string, number> = {
  jupiter: 0,       // Jupiter ne prend pas de frais supplémentaires
  raydium: 25,      // 0.25%
  "raydium-clmm": 25,
  orca: 30,         // 0.30%
  phoenix: 10,      // Variable, ~0.1% taker fee
  meteora: 20,      // 0.2% DLMM
  lifinity: 30,     // 0.3%
  sanctum: 10,      // LST swaps low fee
  saber: 4,         // Stableswap ~0.04%
};

/**
 * Calcule le netOutAmount pour un quote donné
 * @param quote Le quote de la source
 * @param source Le nom de la source DEX
 * @param outputDecimals Decimals du token de sortie
 * @param isNativeRoute Si true, applique les rebates SwapBack
 */
export function calculateNetOutAmount(
  quote: JupiterQuoteResponse,
  source: string,
  outputDecimals: number,
  isNativeRoute: boolean = false
): { netOutAmount: string; fees: FeeEstimate; rebateAmount: string } {
  const outAmount = BigInt(quote.outAmount);
  
  // 1. Calculer les frais DEX
  const dexFeeBps = DEX_FEES_BPS[source] ?? 30;
  const dexFeeAmount = (outAmount * BigInt(dexFeeBps)) / 10000n;
  
  // 2. Frais plateforme SwapBack
  const platformFeeAmount = (outAmount * BigInt(SWAPBACK_CONSTANTS.PLATFORM_FEE_BPS)) / 10000n;
  
  // 3. Convertir les frais de transaction en équivalent output token
  // Approximation: 1 SOL ≈ $150, donc 1 lamport ≈ 0.00000015 USDC
  const txFeesLamports = SWAPBACK_CONSTANTS.BASE_TX_FEE + 
                         SWAPBACK_CONSTANTS.PRIORITY_FEE + 
                         SWAPBACK_CONSTANTS.JITO_TIP_LAMPORTS;
  
  // Pour simplifier, on convertit en équivalent du token de sortie
  // On suppose que les frais TX sont négligeables pour les gros montants
  const txFeeEquivalent = outputDecimals === 6 
    ? BigInt(Math.floor(txFeesLamports * 0.00015)) // ~0.01 USDC pour 65000 lamports
    : BigInt(0);
  
  // 4. Total des frais
  const totalFees = dexFeeAmount + platformFeeAmount + txFeeEquivalent;
  
  // 5. Calculer les rebates pour les routes natives SwapBack
  let rebateAmount = 0n;
  if (isNativeRoute && source !== "jupiter") {
    // NPI = amélioration par rapport au marché (simplifié: on prend 1% du montant)
    // Rebate = 70% du NPI
    const estimatedNPI = outAmount / 100n; // 1% d'amélioration estimée
    rebateAmount = (estimatedNPI * BigInt(SWAPBACK_CONSTANTS.DEFAULT_REBATE_BPS)) / 10000n;
  }
  
  // 6. Net = Out - Fees + Rebates
  const netOutAmount = outAmount - totalFees + rebateAmount;
  
  const fees: FeeEstimate = {
    baseFee: SWAPBACK_CONSTANTS.BASE_TX_FEE,
    priorityFee: SWAPBACK_CONSTANTS.PRIORITY_FEE,
    dexFeeBps,
    platformFeeBps: SWAPBACK_CONSTANTS.PLATFORM_FEE_BPS,
    jitoTip: SWAPBACK_CONSTANTS.JITO_TIP_LAMPORTS,
    totalFeeLamports: Number(totalFees),
  };
  
  return {
    netOutAmount: netOutAmount.toString(),
    fees,
    rebateAmount: rebateAmount.toString(),
  };
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
  "https://public.jupiterapi.com",  // Primary: resolves better
  "https://api.jup.ag/v6",          // Fallback
  "https://quote-api.jup.ag/v6",    // May have DNS issues in some environments
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

/**
 * Fetch quote depuis Phoenix CLOB
 * Utilise l'API Phoenix pour simuler un fill sur le carnet d'ordres
 */
async function fetchPhoenixQuote(params: QuoteParams): Promise<JupiterQuoteResponse | null> {
  try {
    // Phoenix API endpoint
    const url = `https://api.phoenix.trade/v1/quote?inputMint=${params.inputMint}&outputMint=${params.outputMint}&amount=${params.amountLamports}&slippageBps=${params.slippageBps}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.outAmount) return null;

    return {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      inAmount: params.amountLamports.toString(),
      outAmount: data.outAmount.toString(),
      otherAmountThreshold: Math.floor(Number(data.outAmount) * 0.99).toString(),
      priceImpactPct: data.priceImpact?.toString() || "0.05",
      routePlan: [{
        swapInfo: {
          ammKey: "phoenix-clob",
          label: "Phoenix",
          inputMint: params.inputMint,
          outputMint: params.outputMint,
          inAmount: params.amountLamports.toString(),
          outAmount: data.outAmount.toString(),
          feeAmount: data.fee?.toString() || "0",
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

/**
 * Fetch quote depuis Lifinity (Oracle-based AMM)
 */
async function fetchLifinityQuote(params: QuoteParams): Promise<JupiterQuoteResponse | null> {
  try {
    // Lifinity utilise un oracle pour le pricing - simulation via leur API
    const url = `https://lifinity.io/api/v1/quote?inputMint=${params.inputMint}&outputMint=${params.outputMint}&amount=${params.amountLamports}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.amountOut) return null;

    return {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      inAmount: params.amountLamports.toString(),
      outAmount: data.amountOut.toString(),
      otherAmountThreshold: Math.floor(Number(data.amountOut) * 0.99).toString(),
      priceImpactPct: data.priceImpact?.toString() || "0.1",
      routePlan: [{
        swapInfo: {
          ammKey: "lifinity-oracle",
          label: "Lifinity",
          inputMint: params.inputMint,
          outputMint: params.outputMint,
          inAmount: params.amountLamports.toString(),
          outAmount: data.amountOut.toString(),
          feeAmount: data.fee?.toString() || "0",
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

/**
 * Fetch quote depuis Meteora DLMM (Dynamic Liquidity Market Maker)
 */
async function fetchMeteoraQuote(params: QuoteParams): Promise<JupiterQuoteResponse | null> {
  try {
    const url = `https://dlmm-api.meteora.ag/pair/quote?inputMint=${params.inputMint}&outputMint=${params.outputMint}&amount=${params.amountLamports}&slippageBps=${params.slippageBps}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.outAmount) return null;

    return {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      inAmount: params.amountLamports.toString(),
      outAmount: data.outAmount.toString(),
      otherAmountThreshold: Math.floor(Number(data.outAmount) * 0.99).toString(),
      priceImpactPct: data.priceImpact?.toString() || "0.1",
      routePlan: [{
        swapInfo: {
          ammKey: "meteora-dlmm",
          label: "Meteora",
          inputMint: params.inputMint,
          outputMint: params.outputMint,
          inAmount: params.amountLamports.toString(),
          outAmount: data.outAmount.toString(),
          feeAmount: data.fee?.toString() || "0",
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

/**
 * Fetch quote depuis Sanctum (LST swaps)
 */
async function fetchSanctumQuote(params: QuoteParams): Promise<JupiterQuoteResponse | null> {
  try {
    const url = `https://api.sanctum.so/v1/quote?inputMint=${params.inputMint}&outputMint=${params.outputMint}&amount=${params.amountLamports}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.outAmount) return null;

    return {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      inAmount: params.amountLamports.toString(),
      outAmount: data.outAmount.toString(),
      otherAmountThreshold: Math.floor(Number(data.outAmount) * 0.99).toString(),
      priceImpactPct: data.priceImpact?.toString() || "0.05",
      routePlan: [{
        swapInfo: {
          ammKey: "sanctum-lst",
          label: "Sanctum",
          inputMint: params.inputMint,
          outputMint: params.outputMint,
          inAmount: params.amountLamports.toString(),
          outAmount: data.outAmount.toString(),
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

    // Phoenix CLOB (très efficace pour les paires majeures)
    this.sources.push({
      name: "phoenix",
      priority: 4,
      enabled: true,
      fetchQuote: async (params) => {
        const start = Date.now();
        const quote = await fetchPhoenixQuote(params);
        return { source: "phoenix", quote, latencyMs: Date.now() - start };
      },
    });

    // Lifinity (Oracle-based AMM)
    this.sources.push({
      name: "lifinity",
      priority: 5,
      enabled: true,
      fetchQuote: async (params) => {
        const start = Date.now();
        const quote = await fetchLifinityQuote(params);
        return { source: "lifinity", quote, latencyMs: Date.now() - start };
      },
    });

    // Meteora DLMM
    this.sources.push({
      name: "meteora",
      priority: 6,
      enabled: true,
      fetchQuote: async (params) => {
        const start = Date.now();
        const quote = await fetchMeteoraQuote(params);
        return { source: "meteora", quote, latencyMs: Date.now() - start };
      },
    });

    // Sanctum (LST swaps)
    this.sources.push({
      name: "sanctum",
      priority: 7,
      enabled: true,
      fetchQuote: async (params) => {
        const start = Date.now();
        const quote = await fetchSanctumQuote(params);
        return { source: "sanctum", quote, latencyMs: Date.now() - start };
      },
    });
  }

  /**
   * Retourne la liste des sources configurées
   */
  getSources(): QuoteSource[] {
    return [...this.sources];
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
   * Intègre circuit breaker par source pour la résilience
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

    // 2. Filtrer les sources activées ET dont le circuit breaker est fermé
    const enabledSources = this.sources.filter(s => {
      if (!s.enabled) return false;
      const cb = getCircuitBreaker(s.name);
      return cb.canExecute();
    });

    if (enabledSources.length === 0) {
      throw new Error("Toutes les sources sont désactivées ou en circuit ouvert");
    }

    // 3. Fetch en parallèle avec gestion du circuit breaker
    const results = await Promise.all(
      enabledSources.map(async source => {
        const cb = getCircuitBreaker(source.name);
        try {
          const result = await source.fetchQuote(params);
          if (result.quote) {
            cb.recordSuccess();
          } else {
            cb.recordFailure();
          }
          return result;
        } catch (error) {
          cb.recordFailure();
          return {
            source: source.name,
            quote: null,
            latencyMs: Date.now() - startTime,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      })
    );

    // 4. Filtrer les quotes valides et calculer netOutAmount
    const validResults = results.filter(r => r.quote !== null);

    if (validResults.length === 0) {
      throw new Error("Aucune source de quote disponible");
    }

    // 5. Calculer netOutAmount pour chaque quote valide
    for (const result of validResults) {
      if (result.quote) {
        const isNativeRoute = result.source !== "jupiter";
        const netCalc = calculateNetOutAmount(
          result.quote,
          result.source,
          params.outputDecimals,
          isNativeRoute
        );
        result.netOutAmount = netCalc.netOutAmount;
        result.fees = netCalc.fees;
        result.rebateAmount = netCalc.rebateAmount;
      }
    }

    // 6. Trouver le quote Jupiter comme référence pour l'amélioration
    const jupiterResult = validResults.find(r => r.source === "jupiter");
    const jupiterNetAmount = jupiterResult?.netOutAmount 
      ? BigInt(jupiterResult.netOutAmount) 
      : jupiterResult?.quote 
        ? BigInt(jupiterResult.quote.outAmount) 
        : 0n;

    // 7. Calculer l'improvement par rapport à Jupiter (basé sur netOutAmount)
    for (const result of validResults) {
      if (result.netOutAmount && jupiterNetAmount > 0n) {
        const netAmount = BigInt(result.netOutAmount);
        if (netAmount > jupiterNetAmount) {
          result.improvementBps = Number((netAmount - jupiterNetAmount) * 10000n / jupiterNetAmount);
        } else {
          result.improvementBps = -Number((jupiterNetAmount - netAmount) * 10000n / jupiterNetAmount);
        }
      }
    }

    // 7. Trier par netOutAmount (si disponible) sinon outAmount
    validResults.sort((a, b) => {
      // Préférer netOutAmount pour un classement après frais
      const netA = a.netOutAmount ? BigInt(a.netOutAmount) : BigInt(a.quote!.outAmount);
      const netB = b.netOutAmount ? BigInt(b.netOutAmount) : BigInt(b.quote!.outAmount);
      return netB > netA ? 1 : netB < netA ? -1 : 0;
    });

    const best = validResults[0];

    // 8. Mettre en cache
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
