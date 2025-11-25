/**
 * Metis API Service
 * Integration with Metis aggregator for private RFQ quotes
 * @see https://docs.metis.ag/ (documentation à vérifier)
 */

import { Connection } from "@solana/web3.js";

export interface MetisQuoteRequest {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number;
  userPublicKey?: string;
}

export interface MetisMarketMaker {
  name: string;
  reputation: number; // 0-100
  avgResponseTime: number; // ms
}

export interface MetisQuoteResponse {
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  outputAmount: string;
  priceImpact: number;
  marketMaker: string; // Nom du market maker qui fournit la quote
  marketMakerAddress?: string;
  expiresAt: number; // Timestamp d'expiration de la quote (Unix ms)
  route?: string[]; // Route si multi-hop
  fees: {
    total: number;
    breakdown: Array<{
      type: string;
      amount: number;
    }>;
  };
  metadata?: {
    quotedAt: number;
    validFor: number; // Duration in ms
    minAmountOut: string;
    slippageBps: number;
  };
}

export interface MetisSwapRequest {
  quote: MetisQuoteResponse;
  userPublicKey: string;
  wrapUnwrapSOL?: boolean;
  computeUnitPriceMicroLamports?: number;
}

export interface MetisSwapResponse {
  swapTransaction: string; // Base64 encoded transaction
  lastValidBlockHeight: number;
}

/**
 * Metis Service for RFQ private quotes
 */
export class MetisService {
  private connection: Connection;
  private baseUrl: string;
  private timeout: number;
  private apiKey?: string;

  constructor(
    connection: Connection,
    config?: {
      baseUrl?: string;
      timeout?: number;
      apiKey?: string;
    }
  ) {
    this.connection = connection;
    this.baseUrl = config?.baseUrl || "https://api.metis.ag/v1";
    this.timeout = config?.timeout || 3000; // 3s default timeout
    this.apiKey = config?.apiKey || process.env.METIS_API_KEY;
  }

  /**
   * Get a quote from Metis aggregator
   * Metis queries multiple market makers and returns the best quote
   */
  async getQuote(
    request: MetisQuoteRequest
  ): Promise<MetisQuoteResponse | null> {
    try {
      const url = new URL(`${this.baseUrl}/quote`);
      url.searchParams.set("inputMint", request.inputMint);
      url.searchParams.set("outputMint", request.outputMint);
      url.searchParams.set("amount", request.amount.toString());
      url.searchParams.set("slippageBps", String(request.slippageBps ?? 50));

      if (request.userPublicKey) {
        url.searchParams.set("userPublicKey", request.userPublicKey);
      }

      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };

      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(
          `Metis API returned ${response.status}: ${response.statusText}`
        );
        return null;
      }

      const data = await response.json();

      // Validate response
      if (!data || !data.outputAmount) {
        console.warn("Invalid Metis quote response:", data);
        return null;
      }

      return data as MetisQuoteResponse;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          console.warn("Metis API timeout after", this.timeout, "ms");
        } else {
          console.error("Metis API error:", error.message);
        }
      }
      return null;
    }
  }

  /**
   * Get list of available market makers on Metis
   */
  async getMarketMakers(): Promise<MetisMarketMaker[]> {
    try {
      const url = `${this.baseUrl}/market-makers`;
      const headers: Record<string, string> = {
        Accept: "application/json",
      };

      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(
          `Metis market makers API returned ${response.status}: ${response.statusText}`
        );
        return [];
      }

      const data = await response.json();
      return data.marketMakers || [];
    } catch (error) {
      if (error instanceof Error) {
        console.error("Metis market makers error:", error.message);
      }
      return [];
    }
  }

  /**
   * Build swap transaction from quote
   */
  async buildSwapTransaction(
    request: MetisSwapRequest
  ): Promise<MetisSwapResponse | null> {
    try {
      const url = `${this.baseUrl}/swap`;
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };

      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(
          `Metis swap API error ${response.status}:`,
          errorData
        );
        return null;
      }

      const data = await response.json();
      return data as MetisSwapResponse;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          console.warn("Metis swap API timeout after", this.timeout, "ms");
        } else {
          console.error("Metis swap API error:", error.message);
        }
      }
      return null;
    }
  }

  /**
   * Check if quote is still valid
   */
  isQuoteValid(quote: MetisQuoteResponse): boolean {
    const now = Date.now();
    return now < quote.expiresAt;
  }

  /**
   * Get remaining validity time in seconds
   */
  getQuoteValidityRemaining(quote: MetisQuoteResponse): number {
    const now = Date.now();
    const remaining = Math.max(0, quote.expiresAt - now);
    return Math.floor(remaining / 1000);
  }

  /**
   * Update timeout configuration
   */
  setTimeout(timeoutMs: number): void {
    this.timeout = timeoutMs;
  }

  /**
   * Update API key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }
}
