import type { JupiterQuoteResponse } from "@/types/router";

export type RoutingStrategy = "smart" | "aggressive" | "defensive";

export type HybridIntentType = "jupiter_best" | "twap_plan" | "internal_liquidity";

export interface HybridRouteIntent {
  id: string;
  type: HybridIntentType;
  label: string;
  percentage: number;
  etaSeconds: number;
  channel: "public" | "jito" | "private-rpc";
  description: string;
  slices?: number;
}

const INTERNAL_LIQUIDITY_MINTS = new Set([
  "So11111111111111111111111111111111111111112", // SOL
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
]);

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 6)}`;
}

interface BuildIntentParams {
  quote: JupiterQuoteResponse;
  strategy: RoutingStrategy;
  amountLamports: number;
  slippageBps: number;
  priceImpactPct: number;
}

export function buildHybridIntents(params: BuildIntentParams): HybridRouteIntent[] {
  const { quote, strategy, amountLamports, slippageBps, priceImpactPct } = params;
  const intents: HybridRouteIntent[] = [];
  const isLargeOrder = amountLamports > 2_000_000_000; // ~2000 units for 9 decimals

  // Base Jupiter route
  intents.push({
    id: createId("jup"),
    type: "jupiter_best",
    label: "Jupiter Smart Route",
    percentage: strategy === "aggressive" ? 1 : isLargeOrder ? 0.55 : 0.8,
    etaSeconds: 5,
    channel: "public",
    description: "Route agrégée via Jupiter avec meilleur prix temps réel.",
  });

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
      description: "Execution fractionnee (" + slices + " tranches) pour reduire l'impact prix.",
      slices,
    });
  }

  const involvesInternal =
    INTERNAL_LIQUIDITY_MINTS.has(quote.inputMint ?? "") ||
    INTERNAL_LIQUIDITY_MINTS.has(quote.outputMint ?? "");
  if (involvesInternal) {
    intents.push({
      id: createId("vault"),
      type: "internal_liquidity",
      label: "Pool interne SwapBack",
      percentage: strategy === "aggressive" ? 0 : 0.15,
      etaSeconds: 12,
      channel: "private-rpc",
      description: "Requêtes directes vers les vaults SwapBack pour capter les rebates.",
    });
  }

  // Normalize percentages to sum 1
  const total = intents.reduce((sum, intent) => sum + intent.percentage, 0);
  if (total > 0) {
    intents.forEach((intent) => {
      intent.percentage = Number((intent.percentage / total).toFixed(2));
    });
  }

  return intents;
}
