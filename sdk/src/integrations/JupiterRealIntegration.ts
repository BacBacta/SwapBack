import { BN } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

export interface JupiterQuoteRequest {
  inputMint: PublicKey;
  outputMint: PublicKey;
  amount: BN;
  slippageBps?: number;
  onlyDirectRoutes?: boolean;
  swapMode?: "ExactIn" | "ExactOut";
}

export interface JupiterRoutePlanStep {
  swapInfo: {
    ammKey: string;
    label: string;
    feeAmount: string;
    feeMint: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    priceImpactPct: number;
  };
  percent: number;
}

export interface JupiterQuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: "ExactIn" | "ExactOut";
  priceImpactPct: number;
  routePlan: JupiterRoutePlanStep[];
  contextSlot?: number;
}

export class JupiterRealIntegration {
  private readonly baseUrl = "https://quote-api.jup.ag/v6";

  constructor(private readonly connection: Connection, private readonly wallet: Keypair) {
    if (!connection) {
      throw new Error("Connection is required");
    }
    if (!wallet) {
      throw new Error("Wallet is required");
    }
  }

  async getQuote(request: JupiterQuoteRequest): Promise<JupiterQuoteResponse> {
    const url = new URL(`${this.baseUrl}/quote`);
    url.searchParams.set("inputMint", request.inputMint.toBase58());
    url.searchParams.set("outputMint", request.outputMint.toBase58());
    url.searchParams.set("amount", request.amount.toString());
    url.searchParams.set("slippageBps", String(request.slippageBps ?? 50));
    url.searchParams.set("swapMode", request.swapMode ?? "ExactIn");
    if (request.onlyDirectRoutes !== undefined) {
      url.searchParams.set("onlyDirectRoutes", String(request.onlyDirectRoutes));
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Jupiter quote request failed with status ${response.status}`);
    }

    const parsed = (await response.json()) as JupiterQuoteResponse;
    return parsed;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, { method: "GET" });
      return response.ok;
    } catch (error) {
      console.warn("Jupiter health check failed", error);
      return false;
    }
  }

  get connectedWallet(): Keypair {
    return this.wallet;
  }

  get currentConnection(): Connection {
    return this.connection;
  }
}
