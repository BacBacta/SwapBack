import type { NativeRouteMeta } from "@/store/swapStore";
import type { NpiOpportunity } from "@/lib/rebates/npiEngine";

export interface NativeRouteInsights {
  provider: string | null;
  quoteTokens: number | null;
  baseTokens: number | null;
  improvedTokens: number | null;
  improvementBps: number;
  userShareTokens: number;
  totalGainTokens: number;
  sharePercent: number | null;
  explanation: string | null;
  hasEconomics: boolean;
  usedFallback: boolean;
  fromCache: boolean;
}

export interface RouterComparisonPayload {
  swapback: {
    outputAmount: number;
    priceImpact: number;
    networkFee: number;
    platformFee: number;
    rebateAmount: number;
    burnAmount: number;
    totalSavings: number;
    route: string[];
  };
  jupiter: {
    outputAmount: number;
    priceImpact: number;
    networkFee: number;
    platformFee: number;
    route: string[];
  };
}

interface BuildInsightsParams {
  nativeRoute?: NativeRouteMeta | null;
  npiOpportunity?: NpiOpportunity | null;
  usedFallback?: boolean;
  outputDecimals: number;
  outputAmountTokens: number;
  priceImpact: number;
  selectedRouteVenues: string[];
}

const LAMPORT_BASE = 10n;

export function lamportsToTokens(
  lamports: string | bigint | null | undefined,
  decimals: number
): number | null {
  if (lamports === null || lamports === undefined) {
    return null;
  }
  try {
    const bigLamports = typeof lamports === "bigint" ? lamports : BigInt(lamports);
    const divider = LAMPORT_BASE ** BigInt(decimals);
    const integerPart = Number(bigLamports / divider);
    const fraction = Number(bigLamports % divider);
    return integerPart + fraction / Number(divider);
  } catch (error) {
    console.warn("[nativeRouteInsights] Failed to convert lamports", error);
    return null;
  }
}

export function buildNativeRouteInsights(params: BuildInsightsParams): {
  insights: NativeRouteInsights;
  comparison: RouterComparisonPayload | null;
} {
  const {
    nativeRoute,
    npiOpportunity,
    usedFallback = false,
    outputDecimals,
    outputAmountTokens,
    priceImpact,
    selectedRouteVenues,
  } = params;

  const provider = nativeRoute?.provider ?? npiOpportunity?.source ?? null;
  const quoteTokens = lamportsToTokens(nativeRoute?.outAmount, outputDecimals);
  const baseTokens = lamportsToTokens(npiOpportunity?.baseOutAmount, outputDecimals);
  const improvedTokens = lamportsToTokens(npiOpportunity?.improvedOutAmount, outputDecimals);
  const nativeImprovementBps = nativeRoute?.improvementBps ?? npiOpportunity?.improvementBps ?? 0;
  const sharePercent = npiOpportunity?.shareBps ? npiOpportunity.shareBps / 100 : nativeRoute?.npiShareTokens ? 70 : null;
  const shareTokens = npiOpportunity?.available ? npiOpportunity.shareTokens : nativeRoute?.npiShareTokens ?? 0;
  const totalGainTokens = npiOpportunity?.available ? npiOpportunity.deltaTokens : nativeRoute?.npiShareTokens ?? 0;
  const explanation = npiOpportunity?.available ? npiOpportunity.explanation : nativeRoute?.explanation ?? null;
  const hasEconomics = Boolean((npiOpportunity?.available && npiOpportunity.shareTokens > 0) || nativeRoute?.npiShareTokens);

  const insights: NativeRouteInsights = {
    provider,
    quoteTokens,
    baseTokens,
    improvedTokens,
    improvementBps: nativeImprovementBps,
    userShareTokens: hasEconomics ? shareTokens : 0,
    totalGainTokens: hasEconomics ? totalGainTokens : 0,
    sharePercent,
    explanation,
    hasEconomics,
    usedFallback,
    fromCache: nativeRoute?.fromCache === true,
  };

  const swapbackOutput = quoteTokens ?? outputAmountTokens;
  const jupiterOutput = outputAmountTokens;
  const burnAmount = Math.max(insights.totalGainTokens - insights.userShareTokens, 0);
  const comparison: RouterComparisonPayload | null =
    provider && quoteTokens !== null
      ? {
          swapback: {
            outputAmount: swapbackOutput,
            priceImpact,
            networkFee: 0.000005,
            platformFee: 0,
            rebateAmount: insights.userShareTokens,
            burnAmount,
            totalSavings: Math.max(swapbackOutput - jupiterOutput, 0),
            route: provider ? [provider] : ["SwapBack"],
          },
          jupiter: {
            outputAmount: jupiterOutput,
            priceImpact,
            networkFee: 0.000005,
            platformFee: 0,
            route: selectedRouteVenues,
          },
        }
      : null;

  return { insights, comparison };
}

export function formatTokenAmount(value?: number | null, precision = 6): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return Number(value).toFixed(precision);
}