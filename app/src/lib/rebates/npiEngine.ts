import { lamportsToTokens } from "@/lib/routing/nativeRouteInsights";
import type { JupiterQuoteResponse } from "@/types/router";

export interface NpiOpportunity {
  available: boolean;
  source: string;
  improvementBps: number;
  baseOutAmount: string;
  improvedOutAmount: string;
  deltaLamports: string;
  deltaTokens: number;
  shareLamports: string;
  shareTokens: number;
  shareBps: number;
  explanation: string;
}

interface CalculateNpiParams {
  primary: JupiterQuoteResponse;
  alternative: JupiterQuoteResponse;
  source: string;
  outputDecimals: number;
  shareBps?: number;
  minImprovementBps?: number;
}

const DEFAULT_SHARE_BPS = 7000; // 70%
const DEFAULT_MIN_IMPROVEMENT_BPS = 5; // 0.05%

export function calculateNpiOpportunity(params: CalculateNpiParams): NpiOpportunity {
  const {
    primary,
    alternative,
    source,
    outputDecimals,
    shareBps = DEFAULT_SHARE_BPS,
    minImprovementBps = DEFAULT_MIN_IMPROVEMENT_BPS,
  } = params;

  if (!primary?.outAmount || !alternative?.outAmount) {
    return createUnavailableOpportunity("Quotes incomplets");
  }

  const primaryOut = BigInt(primary.outAmount);
  const alternativeOut = BigInt(alternative.outAmount);

  if (alternativeOut <= primaryOut) {
    return createUnavailableOpportunity("Alternative <= Jupiter");
  }

  const delta = alternativeOut - primaryOut;
  const improvementBps = Number((delta * BigInt(10_000)) / primaryOut);

  if (improvementBps < minImprovementBps) {
    return createUnavailableOpportunity("Gain trop faible");
  }

  const shareLamports = (delta * BigInt(shareBps)) / BigInt(10_000);
  const shareTokens = lamportsToTokens(shareLamports, outputDecimals) ?? 0;
  const deltaTokens = lamportsToTokens(delta, outputDecimals) ?? 0;

  return {
    available: true,
    source,
    improvementBps,
    baseOutAmount: primary.outAmount,
    improvedOutAmount: alternative.outAmount,
    deltaLamports: delta.toString(),
    deltaTokens,
    shareLamports: shareLamports.toString(),
    shareTokens,
    shareBps,
    explanation: `${shareBps / 100}% du gain (${source}) distribué en NPI`,
  };
}

function createUnavailableOpportunity(reason: string): NpiOpportunity {
  return {
    available: false,
    source: "",
    improvementBps: 0,
    baseOutAmount: "0",
    improvedOutAmount: "0",
    deltaLamports: "0",
    deltaTokens: 0,
    shareLamports: "0",
    shareTokens: 0,
    shareBps: DEFAULT_SHARE_BPS,
    explanation: reason,
  };
}
