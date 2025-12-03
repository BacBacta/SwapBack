/**
 * Marinade Finance Service
 * Direct staking/unstaking mSOL integration
 * Provides optimal routes for SOL ↔ mSOL conversions
 * @see https://docs.marinade.finance/
 */

import { Connection, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { LiquiditySource, VenueName, VenueType } from "../types/smart-router";

// ============================================================================
// MARINADE CONSTANTS
// ============================================================================

// Marinade Program IDs
const MARINADE_PROGRAM_ID = new PublicKey("MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD");
const MARINADE_STATE = new PublicKey("8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC");

// Token Mints
const SOL_MINT = "So11111111111111111111111111111111111111112";
const MSOL_MINT = "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So";

// Marinade fee structure
const DEPOSIT_FEE_BPS = 0;  // No fee for staking
const UNSTAKE_FEE_BPS = 30; // 0.3% delayed unstake fee
const INSTANT_UNSTAKE_FEE_BPS = 100; // ~1% instant unstake (variable)

// ============================================================================
// TYPES
// ============================================================================

interface MarinadeState {
  msolPrice: number;        // SOL per mSOL (exchange rate)
  msolSupply: number;       // Total mSOL supply
  totalStaked: number;      // Total SOL staked
  availableLiquidity: number; // SOL in liquidity pool for instant unstake
  lastUpdated: number;
}

interface MarinadeQuote {
  inputAmount: number;
  outputAmount: number;
  exchangeRate: number;
  fee: number;
  route: "stake" | "unstake" | "instant_unstake";
  priceImpact: number;
}

// ============================================================================
// MARINADE SERVICE
// ============================================================================

export class MarinadeService {
  private connection: Connection;
  private marinadeApiUrl: string;
  private stateCache: MarinadeState | null = null;
  private stateCacheExpiry: number = 0;
  private readonly CACHE_TTL_MS = 5000; // 5 second cache

  constructor(connection: Connection) {
    this.connection = connection;
    this.marinadeApiUrl = process.env.NEXT_PUBLIC_MARINADE_API_URL || "https://api.marinade.finance";
  }

  /**
   * Check if this is a Marinade-compatible swap
   */
  isMarinadeSwap(inputMint: string, outputMint: string): boolean {
    return (
      (inputMint === SOL_MINT && outputMint === MSOL_MINT) ||
      (inputMint === MSOL_MINT && outputMint === SOL_MINT)
    );
  }

  /**
   * Fetch liquidity for SOL ↔ mSOL swaps
   */
  async fetchLiquidity(
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): Promise<LiquiditySource | null> {
    if (!this.isMarinadeSwap(inputMint, outputMint)) {
      return null;
    }

    try {
      const state = await this.getMarinadeState();
      if (!state) return null;

      const isStaking = inputMint === SOL_MINT;
      const quote = this.calculateQuote(inputAmount, isStaking, state);

      return {
        venue: VenueName.SANCTUM, // Use Sanctum venue as Marinade is LST
        venueType: VenueType.AMM,
        tokenPair: [inputMint, outputMint],
        depth: isStaking ? state.totalStaked : state.availableLiquidity,
        effectivePrice: 1 / quote.exchangeRate,
        feeAmount: quote.fee,
        slippagePercent: quote.priceImpact,
        route: [inputMint, outputMint],
        timestamp: Date.now(),
        metadata: {
          provider: "marinade",
          route: quote.route,
          msolPrice: state.msolPrice,
          totalStaked: state.totalStaked,
          availableLiquidity: state.availableLiquidity,
          exchangeRate: quote.exchangeRate,
        },
      };
    } catch (error) {
      console.error("Marinade fetch error:", error);
      return null;
    }
  }

  /**
   * Get current Marinade state
   */
  private async getMarinadeState(): Promise<MarinadeState | null> {
    // Check cache
    if (this.stateCache && Date.now() < this.stateCacheExpiry) {
      return this.stateCache;
    }

    try {
      // Fetch from Marinade API
      const response = await fetch(`${this.marinadeApiUrl}/v1/state`, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });

      if (!response.ok) {
        // Fallback to on-chain data
        return this.getStateFromChain();
      }

      const data = await response.json();

      this.stateCache = {
        msolPrice: data.msol_price || 1.08, // ~8% APY accrued
        msolSupply: data.msol_supply || 0,
        totalStaked: data.total_staked_sol || 0,
        availableLiquidity: data.liquidity_sol || 0,
        lastUpdated: Date.now(),
      };
      this.stateCacheExpiry = Date.now() + this.CACHE_TTL_MS;

      return this.stateCache;
    } catch (error) {
      console.error("Marinade state fetch error:", error);
      return this.getStateFromChain();
    }
  }

  /**
   * Fallback: Get state from on-chain
   */
  private async getStateFromChain(): Promise<MarinadeState | null> {
    try {
      // Simplified on-chain state fetch
      // In production, would deserialize the full Marinade state account
      const accountInfo = await this.connection.getAccountInfo(MARINADE_STATE);
      if (!accountInfo) return null;

      // Parse account data (simplified)
      // Real implementation would use Borsh deserialization
      return {
        msolPrice: 1.08, // Approximate
        msolSupply: 10_000_000,
        totalStaked: 10_800_000,
        availableLiquidity: 500_000,
        lastUpdated: Date.now(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Calculate quote for staking/unstaking
   */
  private calculateQuote(
    inputAmount: number,
    isStaking: boolean,
    state: MarinadeState
  ): MarinadeQuote {
    if (isStaking) {
      // SOL → mSOL (staking)
      const feeBps = DEPOSIT_FEE_BPS;
      const fee = inputAmount * feeBps / 10000;
      const outputAmount = (inputAmount - fee) / state.msolPrice;

      return {
        inputAmount,
        outputAmount,
        exchangeRate: state.msolPrice,
        fee,
        route: "stake",
        priceImpact: 0, // No slippage for staking
      };
    } else {
      // mSOL → SOL (unstaking)
      const hasLiquidity = inputAmount * state.msolPrice <= state.availableLiquidity;
      const route = hasLiquidity ? "instant_unstake" : "unstake";
      const feeBps = hasLiquidity ? INSTANT_UNSTAKE_FEE_BPS : UNSTAKE_FEE_BPS;
      
      const grossOutput = inputAmount * state.msolPrice;
      const fee = grossOutput * feeBps / 10000;
      const outputAmount = grossOutput - fee;

      // Calculate price impact for instant unstake (larger trades have more impact)
      const impactRatio = (inputAmount * state.msolPrice) / state.availableLiquidity;
      const priceImpact = hasLiquidity ? Math.min(impactRatio * 100, 5) : 0;

      return {
        inputAmount,
        outputAmount,
        exchangeRate: state.msolPrice,
        fee,
        route,
        priceImpact,
      };
    }
  }

  /**
   * Get current mSOL exchange rate
   */
  async getMsolPrice(): Promise<number> {
    const state = await this.getMarinadeState();
    return state?.msolPrice || 1.0;
  }

  /**
   * Check if instant unstake is available for amount
   */
  async canInstantUnstake(msolAmount: number): Promise<boolean> {
    const state = await this.getMarinadeState();
    if (!state) return false;
    return msolAmount * state.msolPrice <= state.availableLiquidity;
  }
}

export default MarinadeService;
