export interface JupiterRoutePlanStep {
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
  percent?: number;
}

export interface JupiterQuoteResponse {
  inputMint?: string;
  outputMint?: string;
  inAmount?: string;
  outAmount?: string;
  priceImpactPct?: number | string;
  routePlan?: JupiterRoutePlanStep[];
  otherAmountThreshold?: string;
  swapMode?: string;
  slippageBps?: number;
}

export type RouterProvider = "swapback" | "jupiter" | "dex";

export interface RouterReliabilitySummary {
  sampleSize: number;
  successRate: number;
  errorRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  overallScore: "A" | "B" | "C" | "D";
  lastUpdated: number;
  topEndpoints: Array<{
    endpoint: string;
    successRate: number;
    avgLatencyMs: number;
  }>;
}

export interface RouterMetricEntry {
  id: string;
  provider: RouterProvider;
  endpoint: string;
  status: number;
  ok: boolean;
  latencyMs: number;
  timestamp: number;
}
