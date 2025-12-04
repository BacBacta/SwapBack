/**
 * Quote module
 */

export interface QuoteParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number;
  routingStrategy?: "smart" | "aggressive" | "defensive";
}

export interface QuoteResult {
  inAmount: string;
  outAmount: string;
  priceImpactPct: number;
  route: {
    label: string;
    percentage: number;
  }[];
  raw: unknown;
}

const DEFAULT_API_BASE = "https://swapback.io/api";

export async function getQuote(
  params: QuoteParams,
  options?: { apiBase?: string }
): Promise<QuoteResult> {
  const base = options?.apiBase ?? DEFAULT_API_BASE;

  const response = await fetch(`${base}/swap/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount,
      slippageBps: params.slippageBps ?? 50,
      routingStrategy: params.routingStrategy ?? "smart",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Quote failed: ${response.status} ${text}`);
  }

  const data = await response.json();

  if (!data.success || !data.quote) {
    throw new Error(data.error ?? "Invalid quote response");
  }

  const quote = data.quote;
  const intents = data.intents ?? [];

  return {
    inAmount: quote.inAmount,
    outAmount: quote.outAmount,
    priceImpactPct:
      typeof quote.priceImpactPct === "string"
        ? parseFloat(quote.priceImpactPct)
        : quote.priceImpactPct ?? 0,
    route: intents.map((i: { label: string; percentage: number }) => ({
      label: i.label,
      percentage: i.percentage,
    })),
    raw: quote,
  };
}
