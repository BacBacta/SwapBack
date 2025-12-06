import type { JupiterQuoteResponse } from "@/types/router";
import type { QuoteResult } from "@/lib/quotes/multiSourceAggregator";

export type RoutingStrategy = "smart" | "aggressive" | "defensive";

export type HybridIntentType = "jupiter_best" | "twap_plan" | "internal_liquidity" | "dex_direct";

export interface HybridRouteIntent {
  id: string;
  type: HybridIntentType;
  label: string;
  percentage: number;
  etaSeconds: number;
  channel: "public" | "jito" | "private-rpc";
  description: string;
  slices?: number;
  dexSource?: string;
  improvementBps?: number;
}

/** Poids calculés pour chaque source */
export interface DynamicWeights {
  [sourceName: string]: number;
}

const INTERNAL_LIQUIDITY_MINTS = new Set([
  "So11111111111111111111111111111111111111112", // SOL
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
]);

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Calcule les poids dynamiques pour l'allocation des volumes
 * basé sur le netOutAmount et l'amélioration par rapport à Jupiter
 * 
 * @param alternativeQuotes Les quotes de toutes les sources
 * @param jupiterQuote Le quote Jupiter de référence
 * @returns Un dictionnaire avec les poids pour chaque source (total = 1)
 */
export function calculateDynamicWeights(
  alternativeQuotes: QuoteResult[],
  jupiterQuote: JupiterQuoteResponse
): DynamicWeights {
  const weights: DynamicWeights = {};
  
  // Filtrer les quotes valides avec netOutAmount
  const validQuotes = alternativeQuotes.filter(q => 
    q.quote !== null && 
    q.netOutAmount !== undefined
  );
  
  if (validQuotes.length === 0) {
    weights["jupiter"] = 1.0;
    return weights;
  }
  
  // Référence Jupiter
  const jupiterNetAmount = BigInt(jupiterQuote.outAmount);
  
  // Calculer les scores pour chaque source
  const scores: { source: string; score: number; improvementBps: number }[] = [];
  
  for (const quote of validQuotes) {
    const netAmount = BigInt(quote.netOutAmount!);
    const improvementBps = quote.improvementBps ?? 0;
    
    // Score basé sur:
    // 1. Amélioration vs Jupiter (poids fort si > 5 bps)
    // 2. Profondeur estimée (via price impact)
    let score = 0;
    
    if (improvementBps > 5) {
      // Bonus fort pour amélioration significative
      score = 100 + improvementBps * 2;
    } else if (improvementBps >= 0) {
      // Score neutre
      score = 50 + improvementBps;
    } else {
      // Pénalité pour sources moins bonnes
      score = Math.max(10, 50 + improvementBps);
    }
    
    // Bonus pour les sources à faible price impact (estimé via la différence net/out)
    if (quote.quote) {
      const priceImpact = parseFloat(quote.quote.priceImpactPct || "0");
      if (priceImpact < 0.1) {
        score *= 1.2; // Bonus 20% pour faible impact
      } else if (priceImpact > 1) {
        score *= 0.7; // Pénalité pour fort impact
      }
    }
    
    scores.push({ source: quote.source, score, improvementBps });
  }
  
  // Normaliser les scores en poids
  const totalScore = scores.reduce((sum, s) => sum + Math.max(s.score, 0), 0);
  
  if (totalScore <= 0) {
    weights["jupiter"] = 1.0;
    return weights;
  }
  
  for (const { source, score, improvementBps } of scores) {
    let weight = score / totalScore;
    
    // Appliquer les contraintes:
    // - Max 30% pour un DEX qui améliore > 5 bps
    // - Max 15% pour un DEX qui n'améliore pas significativement
    if (source !== "jupiter") {
      if (improvementBps > 5) {
        weight = Math.min(weight, 0.30);
      } else {
        weight = Math.min(weight, 0.15);
      }
    }
    
    weights[source] = weight;
  }
  
  // Re-normaliser pour que le total = 1
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (totalWeight > 0 && totalWeight !== 1) {
    for (const source of Object.keys(weights)) {
      weights[source] = Number((weights[source] / totalWeight).toFixed(4));
    }
  }
  
  // Correction finale pour garantir sum = 1
  const finalSum = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (finalSum !== 1 && Object.keys(weights).includes("jupiter")) {
    weights["jupiter"] += (1 - finalSum);
  }
  
  return weights;
}

interface BuildIntentParams {
  quote: JupiterQuoteResponse;
  strategy: RoutingStrategy;
  amountLamports: number;
  slippageBps: number;
  priceImpactPct: number;
  alternativeQuotes?: QuoteResult[];
}

export function buildHybridIntents(params: BuildIntentParams): HybridRouteIntent[] {
  const { quote, strategy, amountLamports, priceImpactPct, alternativeQuotes } = params;
  const intents: HybridRouteIntent[] = [];
  const isLargeOrder = amountLamports > 2_000_000_000;

  // Calculer les poids dynamiques si on a des quotes alternatifs
  let dynamicWeights: DynamicWeights = { jupiter: 1.0 };
  if (alternativeQuotes && alternativeQuotes.length > 0 && strategy !== "aggressive") {
    dynamicWeights = calculateDynamicWeights(alternativeQuotes, quote);
  }

  // Filtrer les DEX avec amélioration significative (> 5 bps)
  const improvingDexes = alternativeQuotes?.filter(q => 
    q.quote !== null && 
    q.source !== "jupiter" && 
    q.improvementBps !== undefined &&
    q.improvementBps > 5
  ) || [];

  // Jupiter route - utilise le poids dynamique
  const jupiterWeight = strategy === "aggressive" 
    ? 1.0 
    : dynamicWeights["jupiter"] ?? (isLargeOrder ? 0.55 : 0.8);
  
  intents.push({
    id: createId("jup"),
    type: "jupiter_best",
    label: "Jupiter Smart Route",
    percentage: jupiterWeight,
    etaSeconds: 5,
    channel: "public",
    description: "Route agrégée via Jupiter avec meilleur prix temps réel.",
  });

  // Ajouter les DEX qui améliorent vs Jupiter (avec poids dynamiques)
  if (strategy !== "aggressive") {
    for (const dex of improvingDexes) {
      const weight = dynamicWeights[dex.source] ?? 0.15;
      if (weight > 0.01) { // Seuil minimum de 1%
        intents.push({
          id: createId("dex"),
          type: "dex_direct",
          label: `${dex.source.charAt(0).toUpperCase() + dex.source.slice(1)} Direct`,
          percentage: weight,
          etaSeconds: 4,
          channel: "public",
          description: `Route directe ${dex.source} (+${dex.improvementBps} bps vs Jupiter).`,
          dexSource: dex.source,
          improvementBps: dex.improvementBps,
        });
      }
    }
  }

  // TWAP pour gros ordres ou fort price impact
  const shouldAddTwap = strategy !== "aggressive" && (isLargeOrder || priceImpactPct > 1);
  if (shouldAddTwap) {
    const slices = strategy === "defensive" ? 6 : 4;
    intents.push({
      id: createId("twap"),
      type: "twap_plan",
      label: "Plan TWAP sécurisé",
      percentage: strategy === "defensive" ? 0.35 : 0.2,
      etaSeconds: slices * 15,
      channel: "jito",
      description: `Execution fractionnée (${slices} tranches) pour réduire l'impact prix.`,
      slices,
    });
  }

  // Pool interne SwapBack pour les paires supportées
  const involvesInternal =
    INTERNAL_LIQUIDITY_MINTS.has(quote.inputMint ?? "") ||
    INTERNAL_LIQUIDITY_MINTS.has(quote.outputMint ?? "");
  if (involvesInternal && strategy !== "aggressive") {
    intents.push({
      id: createId("vault"),
      type: "internal_liquidity",
      label: "Pool interne SwapBack",
      percentage: 0.15,
      etaSeconds: 12,
      channel: "private-rpc",
      description: "Requêtes directes vers les vaults SwapBack pour capter les rebates.",
    });
  }

  // Normaliser les pourcentages pour que le total = 1
  const total = intents.reduce((sum, intent) => sum + intent.percentage, 0);
  if (total > 0) {
    intents.forEach((intent) => {
      intent.percentage = Number((intent.percentage / total).toFixed(2));
    });
  }

  // Correction finale pour garantir sum = 1.00
  const finalSum = intents.reduce((sum, intent) => sum + intent.percentage, 0);
  if (finalSum !== 1 && intents.length > 0) {
    intents[0].percentage += Number((1 - finalSum).toFixed(2));
  }

  return intents;
}
