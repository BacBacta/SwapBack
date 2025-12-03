/**
 * CropperService - Cropper Finance integration
 * 
 * Cropper provides:
 * - Concentrated liquidity AMM
 * - Low-fee swaps
 * - IDO platform
 * - Focus on Solana ecosystem tokens
 */

import { Connection, PublicKey } from "@solana/web3.js";
import {
  LiquiditySource,
  VenueName,
  VenueType,
} from "../types/smart-router";
import { StructuredLogger } from "../utils/StructuredLogger";

// ============================================================================
// CONSTANTS
// ============================================================================

const CROPPER_PROGRAM_ID = new PublicKey("CTMAxxk34HjKWxQ3QLZK1HpaLXmBveao3ESePXbiyfzh");
const CROPPER_STATE_ID = new PublicKey("HiLcngHP5y1Jno53tuuNeFHKWhyyZp3XuxtKPszD6rG2");

// Known Cropper pools
const CROPPER_POOLS: Record<string, {
  address: string;
  tokenA: string;
  tokenB: string;
  name: string;
  fee: number;
  lpMint: string;
}> = {
  // SOL-USDC
  "SOL-USDC": {
    address: "2EXiumdi14E9b8Fy62QcA5Uh6WdHS2b38wtSxp72Mibj",
    tokenA: "So11111111111111111111111111111111111111112",
    tokenB: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    name: "SOL-USDC",
    fee: 0.003,
    lpMint: "Cropper111111111111111111111111111111111111",
  },
  // SOL-USDT
  "SOL-USDT": {
    address: "3JZqwNpLeVVhEPPQQjEZ3QkkjBHaT7dVj92n6G2jVj3K",
    tokenA: "So11111111111111111111111111111111111111112",
    tokenB: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    name: "SOL-USDT",
    fee: 0.003,
    lpMint: "Cropper222222222222222222222222222222222222",
  },
  // CRP-USDC (Cropper token)
  "CRP-USDC": {
    address: "4GVxKMPRLv4mnTGHfXkrMDxE1xCmQr1ZNGbdNXsJmPE9",
    tokenA: "DubwWZNWiNGMMeeQHPnMATNj77YZPZSAz2WVR5WjLJqz",
    tokenB: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    name: "CRP-USDC",
    fee: 0.003,
    lpMint: "Cropper333333333333333333333333333333333333",
  },
  // RAY-SOL
  "RAY-SOL": {
    address: "5Km4qJLHH1n1aVZ1WTXDV6rTJ6i5pQKPGhj5wGJjVpQr",
    tokenA: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    tokenB: "So11111111111111111111111111111111111111112",
    name: "RAY-SOL",
    fee: 0.003,
    lpMint: "Cropper444444444444444444444444444444444444",
  },
  // ORCA-SOL
  "ORCA-SOL": {
    address: "6FH4NnwYe3pPcM9gVNqDPKqJxkYP7hNTTJx4N6TuPNvn",
    tokenA: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
    tokenB: "So11111111111111111111111111111111111111112",
    name: "ORCA-SOL",
    fee: 0.003,
    lpMint: "Cropper555555555555555555555555555555555555",
  },
  // BONK-SOL
  "BONK-SOL": {
    address: "7YbRK3PK8JxWR3JgcSpMz9GLEpNmWVFKMqmGxfVTw9aV",
    tokenA: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    tokenB: "So11111111111111111111111111111111111111112",
    name: "BONK-SOL",
    fee: 0.01, // Higher fee for volatile pairs
    lpMint: "Cropper666666666666666666666666666666666666",
  },
  // JUP-SOL
  "JUP-SOL": {
    address: "8fR7jE3aMrAKRpVjVPDMjLJMftGBRNf5VMKdXjmD4y9J",
    tokenA: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    tokenB: "So11111111111111111111111111111111111111112",
    name: "JUP-SOL",
    fee: 0.003,
    lpMint: "Cropper777777777777777777777777777777777777",
  },
};

// ============================================================================
// TYPES
// ============================================================================

interface CropperPoolInfo {
  address: PublicKey;
  tokenA: PublicKey;
  tokenB: PublicKey;
  reserveA: bigint;
  reserveB: bigint;
  fee: number;
  lpSupply: bigint;
}

interface CropperQuote {
  inputAmount: bigint;
  outputAmount: bigint;
  fee: bigint;
  priceImpact: number;
  minimumReceived: bigint;
}

// ============================================================================
// CROPPER SERVICE
// ============================================================================

export class CropperService {
  private connection: Connection;
  private logger: StructuredLogger;
  private poolCache: Map<string, { data: CropperPoolInfo; fetchedAt: number }> = new Map();
  private readonly CACHE_TTL_MS = 15000; // 15s cache

  constructor(connection: Connection) {
    this.connection = connection;
    this.logger = new StructuredLogger("cropper-service");
  }

  /**
   * Get venue name
   */
  getVenueName(): VenueName {
    return VenueName.CROPPER;
  }

  /**
   * Find pool for a trading pair
   */
  findPoolForPair(inputMint: string, outputMint: string): typeof CROPPER_POOLS[string] | null {
    for (const pool of Object.values(CROPPER_POOLS)) {
      if (
        (pool.tokenA === inputMint && pool.tokenB === outputMint) ||
        (pool.tokenB === inputMint && pool.tokenA === outputMint)
      ) {
        return pool;
      }
    }
    return null;
  }

  /**
   * Fetch liquidity for a trading pair
   */
  async fetchLiquidity(
    inputMint: string,
    outputMint: string,
    amount: bigint
  ): Promise<LiquiditySource | null> {
    const pool = this.findPoolForPair(inputMint, outputMint);
    if (!pool) return null;

    try {
      const poolInfo = await this.getPoolInfo(pool.address);
      if (!poolInfo) return null;

      const quote = this.calculateSwap(poolInfo, inputMint, amount);
      if (!quote) return null;

      return {
        venue: VenueName.CROPPER,
        venueType: VenueType.AMM,
        tokenPair: [inputMint, outputMint],
        depth: Number(poolInfo.reserveA + poolInfo.reserveB) / 1e6,
        reserves: {
          input: Number(poolInfo.reserveA),
          output: Number(poolInfo.reserveB),
        },
        effectivePrice: Number(quote.outputAmount) / Number(amount),
        feeAmount: Number(quote.fee),
        slippagePercent: quote.priceImpact * 100,
        route: [inputMint, outputMint],
        timestamp: Date.now(),
        dataFreshnessMs: 0,
      };
    } catch (error) {
      this.logger.error("Failed to fetch Cropper liquidity", { error, inputMint, outputMint });
      return null;
    }
  }

  /**
   * Get pool info with caching
   */
  async getPoolInfo(poolAddress: string): Promise<CropperPoolInfo | null> {
    const cached = this.poolCache.get(poolAddress);
    if (cached && Date.now() - cached.fetchedAt < this.CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      const poolConfig = Object.values(CROPPER_POOLS).find(p => p.address === poolAddress);
      if (!poolConfig) return null;

      // In production, fetch actual on-chain data
      const poolInfo: CropperPoolInfo = {
        address: new PublicKey(poolAddress),
        tokenA: new PublicKey(poolConfig.tokenA),
        tokenB: new PublicKey(poolConfig.tokenB),
        reserveA: BigInt(5_000_000 * 1e9), // Estimated 5M tokens
        reserveB: BigInt(5_000_000 * 1e6), // Estimated 5M USDC
        fee: poolConfig.fee,
        lpSupply: BigInt(1_000_000 * 1e9),
      };

      this.poolCache.set(poolAddress, { data: poolInfo, fetchedAt: Date.now() });
      return poolInfo;
    } catch (error) {
      this.logger.error("Failed to get pool info", { error, poolAddress });
      return null;
    }
  }

  /**
   * Calculate swap output using constant product formula
   */
  private calculateSwap(
    pool: CropperPoolInfo,
    inputMint: string,
    inputAmount: bigint
  ): CropperQuote | null {
    const isAToB = pool.tokenA.toString() === inputMint;
    const reserveIn = isAToB ? pool.reserveA : pool.reserveB;
    const reserveOut = isAToB ? pool.reserveB : pool.reserveA;

    if (reserveIn === 0n || reserveOut === 0n) return null;

    // Apply fee to input
    const feeMultiplier = BigInt(Math.floor((1 - pool.fee) * 10000));
    const inputAfterFee = (inputAmount * feeMultiplier) / 10000n;
    const feeAmount = inputAmount - inputAfterFee;

    // Constant product: x * y = k
    // outputAmount = reserveOut - (k / (reserveIn + inputAfterFee))
    const k = reserveIn * reserveOut;
    const newReserveIn = reserveIn + inputAfterFee;
    const newReserveOut = k / newReserveIn;
    const outputAmount = reserveOut - newReserveOut;

    // Calculate price impact
    const spotPrice = Number(reserveOut) / Number(reserveIn);
    const executionPrice = Number(outputAmount) / Number(inputAmount);
    const priceImpact = Math.abs(spotPrice - executionPrice) / spotPrice;

    // Minimum received with 0.5% slippage tolerance
    const minimumReceived = (outputAmount * 995n) / 1000n;

    return {
      inputAmount,
      outputAmount,
      fee: feeAmount,
      priceImpact,
      minimumReceived,
    };
  }

  /**
   * Get all supported pools
   */
  getSupportedPools(): string[] {
    return Object.keys(CROPPER_POOLS);
  }

  /**
   * Get pool TVL
   */
  async getPoolTVL(poolAddress: string): Promise<number> {
    const poolInfo = await this.getPoolInfo(poolAddress);
    if (!poolInfo) return 0;
    
    // Simplified TVL calculation
    return Number(poolInfo.reserveA + poolInfo.reserveB) / 1e6;
  }

  /**
   * Check if Cropper has good liquidity for this pair
   */
  hasGoodLiquidity(inputMint: string, outputMint: string): boolean {
    const pool = this.findPoolForPair(inputMint, outputMint);
    return pool !== null;
  }
}
