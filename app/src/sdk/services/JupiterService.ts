import axios, { AxiosInstance } from "axios";
import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";

/**
 * Jupiter Quote Response from V6 API
 */
export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: null | {
    amount: string;
    feeBps: number;
  };
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  contextSlot?: number;
  timeTaken?: number;
}

/**
 * Jupiter Swap Response
 */
export interface JupiterSwapResponse {
  swapTransaction: string; // Base64 encoded transaction
  lastValidBlockHeight: number;
  prioritizationFeeLamports?: number;
}

/**
 * Route information for display
 */
export interface RouteInfo {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: number;
  marketInfos: Array<{
    id: string;
    label: string;
    inputMint: string;
    outputMint: string;
    feeAmount: string;
  }>;
}

/**
 * Jupiter API Service
 * Provides real integration with Jupiter V6 API for quotes and swaps
 */
export class JupiterService {
  private client: AxiosInstance;
  private connection: Connection;
  private baseUrl: string;

  constructor(
    connection: Connection,
    baseUrl: string = "https://quote-api.jup.ag/v6"
  ) {
    this.connection = connection;
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000, // 30s timeout
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Get a quote for swapping tokens
   *
   * @param inputMint - Input token mint address
   * @param outputMint - Output token mint address
   * @param amount - Amount in smallest units (lamports)
   * @param slippageBps - Slippage tolerance in basis points (50 = 0.5%)
   * @param onlyDirectRoutes - Only use direct routes (faster but potentially worse price)
   * @returns Jupiter quote with route information
   */
  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number | string,
    slippageBps: number = 50,
    onlyDirectRoutes: boolean = false
  ): Promise<JupiterQuote> {
    try {
      const response = await this.client.get<JupiterQuote>("/quote", {
        params: {
          inputMint,
          outputMint,
          amount: amount.toString(),
          slippageBps,
          onlyDirectRoutes,
          // Additional recommended params
          platformFeeBps: 0, // No platform fee for now
          asLegacyTransaction: false, // Use versioned transactions
        },
      });

      console.log("✅ Jupiter quote received:", {
        inputMint: response.data.inputMint,
        outputMint: response.data.outputMint,
        inAmount: response.data.inAmount,
        outAmount: response.data.outAmount,
        priceImpact: response.data.priceImpactPct,
        routes: response.data.routePlan.length,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("❌ Jupiter quote error:", {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        throw new Error(
          `Jupiter quote failed: ${error.response?.data?.error || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Get swap transaction from Jupiter
   *
   * @param quote - Quote from getQuote()
   * @param userPublicKey - User's wallet public key
   * @param wrapUnwrapSOL - Auto wrap/unwrap SOL (recommended: true)
   * @param priorityFee - Priority fee in micro-lamports (for faster execution)
   * @returns Serialized transaction ready to sign
   */
  async getSwapTransaction(
    quote: JupiterQuote,
    userPublicKey: PublicKey,
    wrapUnwrapSOL: boolean = true,
    priorityFee?: number
  ): Promise<JupiterSwapResponse> {
    try {
      const response = await this.client.post<JupiterSwapResponse>("/swap", {
        quoteResponse: quote,
        userPublicKey: userPublicKey.toBase58(),
        wrapAndUnwrapSol: wrapUnwrapSOL,
        computeUnitPriceMicroLamports: priorityFee,
        // Use versioned transactions (required for many routes)
        asLegacyTransaction: false,
      });

      console.log("✅ Jupiter swap transaction created:", {
        user: userPublicKey.toBase58(),
        lastValidBlockHeight: response.data.lastValidBlockHeight,
        priorityFee: response.data.prioritizationFeeLamports,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("❌ Jupiter swap transaction error:", {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        throw new Error(
          `Jupiter swap failed: ${error.response?.data?.error || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Execute a complete swap (quote + transaction + send)
   *
   * @param inputMint - Input token mint
   * @param outputMint - Output token mint
   * @param amount - Amount in smallest units
   * @param userPublicKey - User's wallet
   * @param signTransaction - Function to sign the transaction
   * @param slippageBps - Slippage tolerance in bps
   * @param priorityFee - Priority fee in micro-lamports
   * @returns Transaction signature
   */
  async executeSwap(
    inputMint: string,
    outputMint: string,
    amount: number | string,
    userPublicKey: PublicKey,
    signTransaction: (
      transaction: VersionedTransaction
    ) => Promise<VersionedTransaction>,
    slippageBps: number = 50,
    priorityFee?: number
  ): Promise<string> {
    console.log("🔄 Starting Jupiter swap:", {
      inputMint,
      outputMint,
      amount: amount.toString(),
      user: userPublicKey.toBase58(),
      slippageBps,
    });

    // Step 1: Get quote
    const quote = await this.getQuote(
      inputMint,
      outputMint,
      amount,
      slippageBps
    );

    console.log("📊 Quote received:", {
      expectedOutput: quote.outAmount,
      priceImpact: quote.priceImpactPct,
      routes: quote.routePlan.length,
    });

    // Step 2: Get swap transaction
    const swapResponse = await this.getSwapTransaction(
      quote,
      userPublicKey,
      true,
      priorityFee
    );

    // Step 3: Deserialize transaction
    const swapTransactionBuf = Buffer.from(
      swapResponse.swapTransaction,
      "base64"
    );
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    console.log("📝 Transaction deserialized, requesting signature...");

    // Step 4: Sign transaction
    const signedTransaction = await signTransaction(transaction);

    // Step 5: Send transaction
    const rawTransaction = signedTransaction.serialize();
    const txid = await this.connection.sendRawTransaction(rawTransaction, {
      skipPreflight: false,
      maxRetries: 3,
    });

    console.log("✅ Transaction sent:", txid);
    console.log("⏳ Confirming...");

    // Step 6: Confirm transaction
    const confirmation = await this.connection.confirmTransaction(
      txid,
      "confirmed"
    );

    if (confirmation.value.err) {
      throw new Error(
        `Transaction failed: ${JSON.stringify(confirmation.value.err)}`
      );
    }

    console.log("🎉 Swap completed successfully!", txid);

    return txid;
  }

  /**
   * Parse route information from quote for display
   */
  parseRouteInfo(quote: JupiterQuote): RouteInfo {
    return {
      inputMint: quote.inputMint,
      outputMint: quote.outputMint,
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      priceImpactPct: parseFloat(quote.priceImpactPct),
      marketInfos: quote.routePlan.map((route) => ({
        id: route.swapInfo.ammKey,
        label: route.swapInfo.label,
        inputMint: route.swapInfo.inputMint,
        outputMint: route.swapInfo.outputMint,
        feeAmount: route.swapInfo.feeAmount,
      })),
    };
  }

  /**
   * Get all supported tokens from Jupiter
   */
  async getSupportedTokens(): Promise<
    Array<{
      address: string;
      chainId: number;
      decimals: number;
      name: string;
      symbol: string;
      logoURI?: string;
      tags?: string[];
    }>
  > {
    try {
      const response = await axios.get("https://token.jup.ag/all");
      return response.data;
    } catch (error) {
      console.error("❌ Failed to fetch supported tokens:", error);
      throw new Error("Failed to fetch Jupiter token list");
    }
  }

  /**
   * Calculate effective price (output per unit of input)
   */
  calculateEffectivePrice(
    quote: JupiterQuote,
    inputDecimals: number,
    outputDecimals: number
  ): number {
    const inAmount = parseInt(quote.inAmount) / Math.pow(10, inputDecimals);
    const outAmount = parseInt(quote.outAmount) / Math.pow(10, outputDecimals);
    return outAmount / inAmount;
  }
}
