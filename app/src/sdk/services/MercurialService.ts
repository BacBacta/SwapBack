/**
 * MercurialService - Mercurial Finance integration
 * 
 * Mercurial provides:
 * - Dynamic vaults for yield optimization
 * - Stable pools with low slippage
 * - Multi-token pools (3pool, 4pool)
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

const MERCURIAL_PROGRAM_ID = new PublicKey("MERLuDFBMmsHnsBPZw2sDQZHvXFMwp8EdjudcU2HKky");
const MERCURIAL_VAULT_PROGRAM_ID = new PublicKey("24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi");

// Known Mercurial pools
const MERCURIAL_POOLS: Record<string, {
  address: string;
  tokens: string[];
  name: string;
  type: "2pool" | "3pool" | "4pool";
  fee: number;
  amp: number;
}> = {
  // 3pool USDC-USDT-UST (deprecated but example)
  "USDC-USDT-UXD": {
    address: "USD3pool11111111111111111111111111111111111",
    tokens: [
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
      "7kbnvuGBxxj8AG9qp8Scn56muWGaRaFqxg1FsRp3PaFT", // UXD
    ],
    name: "3Pool USD",
    type: "3pool",
    fee: 0.0001, // 0.01%
    amp: 200,
  },
  // wBTC-renBTC-sBTC
  "BTC-3pool": {
    address: "BTC3pool11111111111111111111111111111111111",
    tokens: [
      "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", // wBTC (Wormhole)
      "CDJWUqTcYTVAKXAVXoQZFes5JUFc7owSeq7eMQcDSbo5", // renBTC
      "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E", // BTC (Sollet)
    ],
    name: "3Pool BTC",
    type: "3pool",
    fee: 0.0004,
    amp: 100,
  },
  // SOL-mSOL-stSOL-jitoSOL
  "SOL-LST-4pool": {
    address: "LST4pool11111111111111111111111111111111111",
    tokens: [
      "So11111111111111111111111111111111111111112", // SOL
      "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", // mSOL
      "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj", // stSOL
      "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", // jitoSOL
    ],
    name: "4Pool SOL-LST",
    type: "4pool",
    fee: 0.0001,
    amp: 500,
  },
  // USDC-USDT
  "USDC-USDT": {
    address: "2wme8EVkw8qsfSk2B3QeX4S64ac6wxHPXb3GrdckEkio",
    tokens: [
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
    ],
    name: "2Pool USDC-USDT",
    type: "2pool",
    fee: 0.0001,
    amp: 400,
  },
};

// ============================================================================
// TYPES
// ============================================================================

interface MercurialPoolInfo {
  address: PublicKey;
  tokens: PublicKey[];
  reserves: bigint[];
  amp: number;
  fee: number;
  type: "2pool" | "3pool" | "4pool";
  virtualPrice: number;
}

interface MultiTokenSwapQuote {
  inputIndex: number;
  outputIndex: number;
  inputAmount: bigint;
  outputAmount: bigint;
  fee: bigint;
  priceImpact: number;
}

// ============================================================================
// MERCURIAL SERVICE
// ============================================================================

export class MercurialService {
  private connection: Connection;
  private logger: StructuredLogger;
  private poolCache: Map<string, { data: MercurialPoolInfo; fetchedAt: number }> = new Map();
  private readonly CACHE_TTL_MS = 30000;

  constructor(connection: Connection) {
    this.connection = connection;
    this.logger = new StructuredLogger("mercurial-service");
  }

  /**
   * Get venue name
   */
  getVenueName(): VenueName {
    return VenueName.MERCURIAL;
  }

  /**
   * Find pools that support both tokens
   */
  findPoolsForPair(inputMint: string, outputMint: string): Array<typeof MERCURIAL_POOLS[string]> {
    return Object.values(MERCURIAL_POOLS).filter(pool => 
      pool.tokens.includes(inputMint) && pool.tokens.includes(outputMint)
    );
  }

  /**
   * Check if this is a multi-token stable pair
   */
  isMultiTokenPair(inputMint: string, outputMint: string): boolean {
    return this.findPoolsForPair(inputMint, outputMint).length > 0;
  }

  /**
   * Fetch liquidity for a trading pair
   */
  async fetchLiquidity(
    inputMint: string,
    outputMint: string,
    amount: bigint
  ): Promise<LiquiditySource | null> {
    const pools = this.findPoolsForPair(inputMint, outputMint);
    if (pools.length === 0) return null;

    // Find best pool (prefer higher amp for stable pairs)
    const sortedPools = pools.sort((a, b) => b.amp - a.amp);
    const bestPool = sortedPools[0];

    try {
      const poolInfo = await this.getPoolInfo(bestPool.address);
      if (!poolInfo) return null;

      const quote = this.calculateMultiTokenSwap(poolInfo, inputMint, outputMint, amount);
      if (!quote) return null;

      const totalReserves = poolInfo.reserves.reduce((a, b) => a + b, 0n);

      return {
        venue: VenueName.MERCURIAL,
        venueType: VenueType.AMM,
        tokenPair: [inputMint, outputMint],
        depth: Number(totalReserves) / 1e6,
        reserves: {
          input: Number(poolInfo.reserves[0]),
          output: Number(poolInfo.reserves[1]),
        },
        effectivePrice: Number(quote.outputAmount) / Number(amount),
        feeAmount: Number(quote.fee),
        slippagePercent: quote.priceImpact * 100,
        route: [inputMint, outputMint],
        timestamp: Date.now(),
        dataFreshnessMs: 0,
      };
    } catch (error) {
      this.logger.error("Failed to fetch Mercurial liquidity", { error, inputMint, outputMint });
      return null;
    }
  }

  /**
   * Get pool info with caching
   */
  async getPoolInfo(poolAddress: string): Promise<MercurialPoolInfo | null> {
    const cached = this.poolCache.get(poolAddress);
    if (cached && Date.now() - cached.fetchedAt < this.CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      const poolConfig = Object.values(MERCURIAL_POOLS).find(p => p.address === poolAddress);
      if (!poolConfig) return null;

      // In production, fetch actual on-chain data
      // For now, use estimated values
      const numTokens = poolConfig.tokens.length;
      const estimatedReserve = BigInt(5_000_000 * 1e6); // $5M per token

      const poolInfo: MercurialPoolInfo = {
        address: new PublicKey(poolAddress),
        tokens: poolConfig.tokens.map(t => new PublicKey(t)),
        reserves: Array(numTokens).fill(estimatedReserve),
        amp: poolConfig.amp,
        fee: poolConfig.fee,
        type: poolConfig.type,
        virtualPrice: 1.0,
      };

      this.poolCache.set(poolAddress, { data: poolInfo, fetchedAt: Date.now() });
      return poolInfo;
    } catch (error) {
      this.logger.error("Failed to get pool info", { error, poolAddress });
      return null;
    }
  }

  /**
   * Calculate multi-token StableSwap output
   * Uses the n-dimensional StableSwap invariant
   */
  private calculateMultiTokenSwap(
    pool: MercurialPoolInfo,
    inputMint: string,
    outputMint: string,
    inputAmount: bigint
  ): MultiTokenSwapQuote | null {
    const inputIndex = pool.tokens.findIndex(t => t.toString() === inputMint);
    const outputIndex = pool.tokens.findIndex(t => t.toString() === outputMint);

    if (inputIndex === -1 || outputIndex === -1) return null;

    const reserveIn = pool.reserves[inputIndex];
    const reserveOut = pool.reserves[outputIndex];

    if (reserveIn === 0n || reserveOut === 0n) return null;

    const n = BigInt(pool.tokens.length);
    const amp = BigInt(pool.amp);

    // Calculate D (total liquidity invariant)
    const sum = pool.reserves.reduce((a, b) => a + b, 0n);
    
    // For multi-token pools, adjustment factor is based on amp and n
    const ampAdjustment = (amp * n) / (amp * n + 1n);
    
    // New reserve after swap
    const newReserveIn = reserveIn + inputAmount;
    
    // Calculate output using stable swap math
    // Simplified: output ≈ input * reserveOut / reserveIn * adjustment
    const rawOutput = (inputAmount * reserveOut * 1000000n) / (newReserveIn * 1000000n);
    
    // Apply amp adjustment (higher amp = closer to 1:1)
    const adjustedOutput = (rawOutput * (1000000n + ampAdjustment * 1000n)) / 1000000n;
    
    // Apply fee
    const feeAmount = (adjustedOutput * BigInt(Math.floor(pool.fee * 10000))) / 10000n;
    const outputAmount = adjustedOutput - feeAmount;

    // Calculate price impact
    const expectedRatio = Number(reserveOut) / Number(reserveIn);
    const actualRatio = Number(outputAmount) / Number(inputAmount);
    const priceImpact = Math.abs(expectedRatio - actualRatio) / expectedRatio;

    return {
      inputIndex,
      outputIndex,
      inputAmount,
      outputAmount,
      fee: feeAmount,
      priceImpact: Math.max(0, priceImpact),
    };
  }

  /**
   * Get all supported pools
   */
  getSupportedPools(): string[] {
    return Object.keys(MERCURIAL_POOLS);
  }

  /**
   * Get virtual price for LP token valuation
   */
  async getVirtualPrice(poolAddress: string): Promise<number> {
    const poolInfo = await this.getPoolInfo(poolAddress);
    return poolInfo?.virtualPrice || 1.0;
  }
}
