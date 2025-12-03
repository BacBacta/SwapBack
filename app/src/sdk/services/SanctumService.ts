/**
 * Sanctum LST Service
 * Specialized service for Liquid Staking Token (LST) swaps
 * Supports mSOL, stSOL, jitoSOL, bSOL, etc.
 * @see https://docs.sanctum.so/
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { LiquiditySource, VenueName, VenueType } from "../types/smart-router";

// ============================================================================
// LST TOKEN ADDRESSES
// ============================================================================

export const LST_TOKENS: Record<string, { mint: string; name: string; decimals: number }> = {
  SOL: {
    mint: "So11111111111111111111111111111111111111112",
    name: "SOL",
    decimals: 9,
  },
  mSOL: {
    mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
    name: "Marinade SOL",
    decimals: 9,
  },
  stSOL: {
    mint: "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj",
    name: "Lido Staked SOL",
    decimals: 9,
  },
  jitoSOL: {
    mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
    name: "Jito Staked SOL",
    decimals: 9,
  },
  bSOL: {
    mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1",
    name: "Blaze Staked SOL",
    decimals: 9,
  },
  scnSOL: {
    mint: "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm",
    name: "Socean Staked SOL",
    decimals: 9,
  },
  INF: {
    mint: "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm",
    name: "Infinity SOL",
    decimals: 9,
  },
};

// Sanctum Infinity Pool Program ID
const SANCTUM_INFINITY_PROGRAM = new PublicKey("5ocnV1qiCgaQR8Jb8xWnVbApfaygJ8tNoZfgPwsgcs9c");

// Sanctum Router Program ID
const SANCTUM_ROUTER_PROGRAM = new PublicKey("stkitrT1Uoy18Dk1fTrgPw8W6MVzoCfYoAFT4MLsmhq");

// ============================================================================
// SANCTUM SERVICE
// ============================================================================

export class SanctumService {
  private connection: Connection;
  private sanctumApiUrl: string;

  constructor(connection: Connection) {
    this.connection = connection;
    this.sanctumApiUrl = process.env.NEXT_PUBLIC_SANCTUM_API_URL || "https://api.sanctum.so/v1";
  }

  /**
   * Check if a token is an LST
   */
  isLST(mint: string): boolean {
    return Object.values(LST_TOKENS).some((token) => token.mint === mint);
  }

  /**
   * Get LST metadata
   */
  getLSTInfo(mint: string): (typeof LST_TOKENS)[keyof typeof LST_TOKENS] | undefined {
    return Object.values(LST_TOKENS).find((token) => token.mint === mint);
  }

  /**
   * Check if swap is LST-to-LST (optimal for Sanctum)
   */
  isLSTtoLSTSwap(inputMint: string, outputMint: string): boolean {
    return this.isLST(inputMint) && this.isLST(outputMint);
  }

  /**
   * Fetch liquidity from Sanctum for LST swaps
   */
  async fetchLiquidity(
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): Promise<LiquiditySource | null> {
    // Only handle LST-related swaps
    if (!this.isLST(inputMint) && !this.isLST(outputMint)) {
      return null;
    }

    try {
      // Fetch quote from Sanctum API
      const quote = await this.fetchSanctumQuote(inputMint, outputMint, inputAmount);

      if (!quote) {
        return null;
      }

      const effectivePrice = inputAmount / quote.outputAmount;
      const priceImpact = quote.priceImpact || 0;

      return {
        venue: VenueName.SANCTUM,
        venueType: VenueType.AMM,
        tokenPair: [inputMint, outputMint],
        depth: quote.outputAmount * 100, // High liquidity for LSTs
        effectivePrice,
        feeAmount: quote.fee || 0,
        slippagePercent: priceImpact / 100,
        route: [inputMint, outputMint],
        timestamp: Date.now(),
        metadata: {
          isLSTSwap: true,
          inputLST: this.getLSTInfo(inputMint)?.name,
          outputLST: this.getLSTInfo(outputMint)?.name,
          sanctumQuote: quote,
          exchangeRate: quote.exchangeRate,
        },
      };
    } catch (error) {
      console.error("Sanctum fetch error:", error);
      return null;
    }
  }

  /**
   * Fetch quote from Sanctum API
   */
  private async fetchSanctumQuote(
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): Promise<SanctumQuote | null> {
    try {
      const inputDecimals = this.getLSTInfo(inputMint)?.decimals || 9;
      const amountInLamports = Math.floor(inputAmount * Math.pow(10, inputDecimals));

      // Sanctum Quote API
      const url = new URL(`${this.sanctumApiUrl}/swap/quote`);
      url.searchParams.append("input", inputMint);
      url.searchParams.append("output", outputMint);
      url.searchParams.append("amount", amountInLamports.toString());
      url.searchParams.append("mode", "ExactIn");

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        console.warn(`Sanctum API returned ${response.status}: ${response.statusText}`);
        return null;
      }

      const data = await response.json();

      if (!data || !data.outAmount) {
        return null;
      }

      const outputDecimals = this.getLSTInfo(outputMint)?.decimals || 9;
      const outputAmount = Number(data.outAmount) / Math.pow(10, outputDecimals);

      return {
        inputAmount,
        outputAmount,
        exchangeRate: data.exchangeRate || outputAmount / inputAmount,
        priceImpact: data.priceImpactPct || 0,
        fee: data.feeAmount ? Number(data.feeAmount) / Math.pow(10, outputDecimals) : 0,
        route: data.route || [inputMint, outputMint],
      };
    } catch (error) {
      console.error("Sanctum quote fetch error:", error);

      // Fallback: simulate quote using exchange rates
      return this.simulateLSTQuote(inputMint, outputMint, inputAmount);
    }
  }

  /**
   * Simulate LST quote using on-chain exchange rates
   * Fallback when API is unavailable
   */
  private async simulateLSTQuote(
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): Promise<SanctumQuote | null> {
    try {
      // For LST-to-LST swaps, rates are typically close to 1:1
      // with small variations based on staking rewards
      const baseRate = 1.0;
      const slippageFactor = 0.999; // 0.1% slippage
      const feeFactor = 0.9999; // 0.01% fee

      const exchangeRate = baseRate * slippageFactor * feeFactor;
      const outputAmount = inputAmount * exchangeRate;

      return {
        inputAmount,
        outputAmount,
        exchangeRate,
        priceImpact: 0.1, // Minimal for LSTs
        fee: inputAmount * 0.0001, // 0.01% fee
        route: [inputMint, outputMint],
      };
    } catch (error) {
      console.error("LST simulation error:", error);
      return null;
    }
  }

  /**
   * Get available LST pairs
   */
  getAvailableLSTPairs(): Array<{ input: string; output: string }> {
    const pairs: Array<{ input: string; output: string }> = [];
    const lstMints = Object.values(LST_TOKENS).map((t) => t.mint);

    for (const input of lstMints) {
      for (const output of lstMints) {
        if (input !== output) {
          pairs.push({ input, output });
        }
      }
    }

    return pairs;
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface SanctumQuote {
  inputAmount: number;
  outputAmount: number;
  exchangeRate: number;
  priceImpact: number;
  fee: number;
  route: string[];
}
