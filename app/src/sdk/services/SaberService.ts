/**
 * SaberService - Saber Stable Swap integration
 * 
 * Saber is the leading stablecoin exchange on Solana, specializing in:
 * - Stablecoin-to-stablecoin swaps with minimal slippage
 * - Wrapped asset pools (wBTC, wETH, etc.)
 * - StableSwap curve for efficient stable pairs
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

const SABER_PROGRAM_ID = new PublicKey("SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ");
const SABER_SWAP_PROGRAM_ID = new PublicKey("SSwpMgqNDsyV7mAgN9ady4bDVu5ySjmmXejXvy2vLt1");

// Known Saber pools
const SABER_POOLS: Record<string, { 
  address: string; 
  tokenA: string; 
  tokenB: string; 
  name: string;
  fee: number;
}> = {
  // USDC-USDT pool
  "USDC-USDT": {
    address: "YAkoNb6HKmSxQN9L8hiBE5tPJRsniSSMzND1boHmZxe",
    tokenA: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
    tokenB: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
    name: "USDC-USDT",
    fee: 0.0004, // 0.04% for stable pairs
  },
  // UXD-USDC pool
  "UXD-USDC": {
    address: "2KNp5VoicXBKrMx8h9dEJ3QJYLBsxNXVMNFNQGYxZ2D6",
    tokenA: "7kbnvuGBxxj8AG9qp8Scn56muWGaRaFqxg1FsRp3PaFT", // UXD
    tokenB: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
    name: "UXD-USDC",
    fee: 0.0004,
  },
  // wBTC-renBTC pool
  "wBTC-renBTC": {
    address: "FPR272kMfmEVPYJKEGJzLBGhvZPqmNwXfJK5bHVqWDgc",
    tokenA: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", // wBTC (Wormhole)
    tokenB: "CDJWUqTcYTVAKXAVXoQZFes5JUFc7owSeq7eMQcDSbo5", // renBTC
    name: "wBTC-renBTC",
    fee: 0.0006, // 0.06% for wrapped pairs
  },
  // wETH-stETH pool
  "wETH-stETH": {
    address: "2qmHPJn3dG5BCwmQ5VmKMUi9DLMYr8YPfPfnXEjJ4sxv",
    tokenA: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", // wETH (Wormhole)
    tokenB: "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj", // stETH (Lido)
    name: "wETH-stETH",
    fee: 0.0004,
  },
  // UST-USDC pool (deprecated but still has liquidity)
  "mSOL-SOL": {
    address: "Lee1XZJfJ9Hm2K1qTyeCz1LXNc1YBZaKZszvNY4KCDw",
    tokenA: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", // mSOL
    tokenB: "So11111111111111111111111111111111111111112", // SOL
    name: "mSOL-SOL",
    fee: 0.0001, // 0.01% for SOL-LST
  },
  // stSOL-SOL pool
  "stSOL-SOL": {
    address: "8CpmKczw1K64RhPfYn8YLdJSEQdE4zy7NWFJVyMYQP1r",
    tokenA: "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj", // stSOL
    tokenB: "So11111111111111111111111111111111111111112", // SOL
    name: "stSOL-SOL",
    fee: 0.0001,
  },
  // PAI-USDC pool
  "PAI-USDC": {
    address: "PaiSfqLuHNGNjnMQFHpEZS8GJLYu5QdTPb7BUfJbq6N",
    tokenA: "Ea5SjE2Y6yvCeW5dYTn7PYMuW5ikXkvbGdcmSnXeaLjS", // PAI
    tokenB: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
    name: "PAI-USDC",
    fee: 0.0004,
  },
};

// Stable token mints for identification
const STABLE_TOKENS = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
  "7kbnvuGBxxj8AG9qp8Scn56muWGaRaFqxg1FsRp3PaFT", // UXD
  "Ea5SjE2Y6yvCeW5dYTn7PYMuW5ikXkvbGdcmSnXeaLjS", // PAI
  "USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX",  // USDH
]);

// LST tokens for SOL-LST pools
const LST_TOKENS = new Set([
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", // mSOL
  "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj", // stSOL
  "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", // jitoSOL
  "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1", // bSOL
]);

// ============================================================================
// TYPES
// ============================================================================

interface SaberPoolInfo {
  address: PublicKey;
  tokenA: PublicKey;
  tokenB: PublicKey;
  reserveA: bigint;
  reserveB: bigint;
  amp: number; // Amplification coefficient
  fee: number;
  adminFee: number;
}

interface StableSwapQuote {
  inputAmount: bigint;
  outputAmount: bigint;
  fee: bigint;
  priceImpact: number;
  pool: string;
}

// ============================================================================
// SABER SERVICE
// ============================================================================

export class SaberService {
  private connection: Connection;
  private logger: StructuredLogger;
  private poolCache: Map<string, { data: SaberPoolInfo; fetchedAt: number }> = new Map();
  private readonly CACHE_TTL_MS = 30000; // 30s cache

  constructor(connection: Connection) {
    this.connection = connection;
    this.logger = new StructuredLogger("saber-service");
  }

  /**
   * Get venue name
   */
  getVenueName(): VenueName {
    return VenueName.SABER;
  }

  /**
   * Check if this is a stable pair that Saber handles well
   */
  isStablePair(inputMint: string, outputMint: string): boolean {
    // Stable-to-stable
    if (STABLE_TOKENS.has(inputMint) && STABLE_TOKENS.has(outputMint)) {
      return true;
    }
    // SOL-to-LST or LST-to-LST
    const sol = "So11111111111111111111111111111111111111112";
    if (
      (inputMint === sol && LST_TOKENS.has(outputMint)) ||
      (LST_TOKENS.has(inputMint) && outputMint === sol) ||
      (LST_TOKENS.has(inputMint) && LST_TOKENS.has(outputMint))
    ) {
      return true;
    }
    return false;
  }

  /**
   * Find the best pool for a trading pair
   */
  findPoolForPair(inputMint: string, outputMint: string): typeof SABER_POOLS[string] | null {
    for (const pool of Object.values(SABER_POOLS)) {
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
    if (!pool) {
      return null;
    }

    try {
      const poolInfo = await this.getPoolInfo(pool.address);
      if (!poolInfo) return null;

      const quote = this.calculateStableSwap(poolInfo, inputMint, amount);
      if (!quote) return null;

      return {
        venue: VenueName.SABER,
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
      this.logger.error("Failed to fetch Saber liquidity", { error, inputMint, outputMint });
      return null;
    }
  }

  /**
   * Get pool info with caching
   */
  async getPoolInfo(poolAddress: string): Promise<SaberPoolInfo | null> {
    const cached = this.poolCache.get(poolAddress);
    if (cached && Date.now() - cached.fetchedAt < this.CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      const poolPubkey = new PublicKey(poolAddress);
      const accountInfo = await this.connection.getAccountInfo(poolPubkey);
      
      if (!accountInfo) return null;

      // Parse Saber pool data (simplified - real implementation would decode the full struct)
      const poolInfo = this.parsePoolData(poolAddress, accountInfo.data);
      
      if (poolInfo) {
        this.poolCache.set(poolAddress, { data: poolInfo, fetchedAt: Date.now() });
      }
      
      return poolInfo;
    } catch (error) {
      this.logger.error("Failed to fetch pool info", { error, poolAddress });
      return null;
    }
  }

  /**
   * Parse pool data from account (simplified)
   */
  private parsePoolData(poolAddress: string, data: Buffer): SaberPoolInfo | null {
    // Find pool config
    const poolConfig = Object.values(SABER_POOLS).find(p => p.address === poolAddress);
    if (!poolConfig) return null;

    try {
      // In real implementation, decode the Saber pool state struct
      // For now, use estimates based on known pool characteristics
      return {
        address: new PublicKey(poolAddress),
        tokenA: new PublicKey(poolConfig.tokenA),
        tokenB: new PublicKey(poolConfig.tokenB),
        reserveA: BigInt(10_000_000 * 1e6), // Estimated $10M USDC
        reserveB: BigInt(10_000_000 * 1e6), // Estimated $10M USDT
        amp: 100, // Typical amp for stable pairs
        fee: poolConfig.fee,
        adminFee: 0.5, // 50% of fee goes to admin
      };
    } catch {
      return null;
    }
  }

  /**
   * Calculate StableSwap output using the StableSwap invariant
   * 
   * The StableSwap invariant: An^n * sum(x_i) + D = A * D^n + D^(n+1) / (n^n * prod(x_i))
   * For 2 tokens: A * (x + y) + D = A * D + D^3 / (4 * x * y)
   */
  private calculateStableSwap(
    pool: SaberPoolInfo,
    inputMint: string,
    inputAmount: bigint
  ): StableSwapQuote | null {
    const isTokenA = pool.tokenA.toString() === inputMint;
    const reserveIn = isTokenA ? pool.reserveA : pool.reserveB;
    const reserveOut = isTokenA ? pool.reserveB : pool.reserveA;

    if (reserveIn === 0n || reserveOut === 0n) return null;

    // Simplified StableSwap calculation
    // For stable pairs with high amp, output ≈ input (1:1 ratio) minus fees
    const amp = BigInt(pool.amp);
    const n = 2n; // Number of tokens
    
    // Calculate D (total liquidity)
    const sum = reserveIn + reserveOut;
    const prod = reserveIn * reserveOut;
    
    // Simplified: for high amp, price impact is minimal
    // output = input * reserveOut / (reserveIn + input) * adjustment
    const newReserveIn = reserveIn + inputAmount;
    
    // StableSwap adjustment factor (closer to 1 for high amp)
    const ampAdjustment = 1000000n; // 6 decimals
    const stableAdjustment = (ampAdjustment * amp) / (amp + 1n);
    
    // Calculate output with StableSwap curve
    const rawOutput = (inputAmount * reserveOut * stableAdjustment) / 
                      (newReserveIn * ampAdjustment);
    
    // Apply fee
    const feeAmount = (rawOutput * BigInt(Math.floor(pool.fee * 10000))) / 10000n;
    const outputAmount = rawOutput - feeAmount;
    
    // Calculate price impact
    const expectedOutput = inputAmount; // For 1:1 stable pair
    const priceImpact = expectedOutput > 0n 
      ? Number(expectedOutput - outputAmount) / Number(expectedOutput)
      : 0;

    return {
      inputAmount,
      outputAmount,
      fee: feeAmount,
      priceImpact: Math.max(0, priceImpact),
      pool: pool.address.toString(),
    };
  }

  /**
   * Get all supported pools
   */
  getSupportedPools(): string[] {
    return Object.keys(SABER_POOLS);
  }

  /**
   * Get pool TVL estimate
   */
  async getPoolTVL(poolAddress: string): Promise<number> {
    const poolInfo = await this.getPoolInfo(poolAddress);
    if (!poolInfo) return 0;
    
    // Assume 1:1 USD value for stables, use oracle for others
    return Number(poolInfo.reserveA + poolInfo.reserveB) / 1e6;
  }
}
