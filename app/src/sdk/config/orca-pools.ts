/**
 * Orca Whirlpools Configuration
 * 
 * Provides mainnet pool addresses and helper functions for Orca Whirlpools AMM integration.
 * Whirlpools use concentrated liquidity (similar to Uniswap V3) with tick-based pricing.
 * 
 * @module orca-pools
 */

import { PublicKey } from '@solana/web3.js';

/**
 * Orca Whirlpool configuration for a trading pair
 */
export interface OrcaWhirlpoolConfig {
  /** Trading pair symbol (e.g., 'SOL/USDC') */
  symbol: string;
  /** Whirlpool account address */
  address: PublicKey;
  /** Input token mint (base) */
  tokenMintA: PublicKey;
  /** Output token mint (quote) */
  tokenMintB: PublicKey;
  /** Tick spacing (determines fee tier: 64=0.05%, 128=0.3%, 256=1%) */
  tickSpacing: number;
  /** Fee rate in basis points */
  feeBps: number;
  /** Minimum liquidity depth for routing */
  minLiquidityUsd: number;
}

/**
 * Orca Whirlpools mainnet pool addresses
 * 
 * Major pools with deep liquidity:
 * - SOL/USDC (64 tick = 0.05% fee)
 * - SOL/USDT (64 tick = 0.05% fee)
 * - mSOL/SOL (64 tick = 0.05% fee)
 * - USDC/USDT (64 tick = 0.01% fee)
 */
export const ORCA_WHIRLPOOLS: Record<string, OrcaWhirlpoolConfig> = {
  'SOL/USDC': {
    symbol: 'SOL/USDC',
    address: new PublicKey('HJPjoWUrhoZzkNfRpHuieeFk9WcZWjwy6PBjZ81ngndJ'), // Mainnet SOL/USDC whirlpool
    tokenMintA: new PublicKey('So11111111111111111111111111111111111111112'), // Wrapped SOL
    tokenMintB: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), // USDC
    tickSpacing: 64,
    feeBps: 5, // 0.05%
    minLiquidityUsd: 100_000,
  },
  'SOL/USDT': {
    symbol: 'SOL/USDT',
    address: new PublicKey('4fuUiYxTQ6QCrdSq9ouBYcTM7bqSwYTSyLueGZLTy4T4'), // Mainnet SOL/USDT whirlpool
    tokenMintA: new PublicKey('So11111111111111111111111111111111111111112'), // Wrapped SOL
    tokenMintB: new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'), // USDT
    tickSpacing: 64,
    feeBps: 5, // 0.05%
    minLiquidityUsd: 50_000,
  },
  'mSOL/SOL': {
    symbol: 'mSOL/SOL',
    address: new PublicKey('9vqYJjDUFecLL2xPUC4Rc7hyCtZ6iJ4mDiVZX7aFXoAe'), // Mainnet mSOL/SOL whirlpool
    tokenMintA: new PublicKey('mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So'), // Marinade SOL
    tokenMintB: new PublicKey('So11111111111111111111111111111111111111112'), // Wrapped SOL
    tickSpacing: 64,
    feeBps: 5, // 0.05%
    minLiquidityUsd: 20_000,
  },
  'USDC/USDT': {
    symbol: 'USDC/USDT',
    address: new PublicKey('4GpUivZ8NqJqoz8x8sKRepbuoZDKJqz4KBJfZ7B5aK8v'), // Mainnet USDC/USDT whirlpool
    tokenMintA: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), // USDC
    tokenMintB: new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'), // USDT
    tickSpacing: 64,
    feeBps: 1, // 0.01% (stablecoin pair)
    minLiquidityUsd: 50_000,
  },
};

/**
 * Orca Whirlpools program ID (mainnet)
 */
export const ORCA_WHIRLPOOL_PROGRAM_ID = new PublicKey('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc');

/**
 * Get Orca whirlpool address for a token pair
 * 
 * @param inputMint - Input token mint address
 * @param outputMint - Output token mint address
 * @returns Whirlpool address or null if no pool exists
 * 
 * @example
 * ```ts
 * const pool = getOrcaWhirlpool(
 *   new PublicKey('So11111111111111111111111111111111111111112'), // SOL
 *   new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')  // USDC
 * );
 * // Returns SOL/USDC pool address
 * ```
 */
export function getOrcaWhirlpool(inputMint: PublicKey, outputMint: PublicKey): PublicKey | null {
  for (const config of Object.values(ORCA_WHIRLPOOLS)) {
    // Check both directions (A/B and B/A)
    if (
      (config.tokenMintA.equals(inputMint) && config.tokenMintB.equals(outputMint)) ||
      (config.tokenMintA.equals(outputMint) && config.tokenMintB.equals(inputMint))
    ) {
      return config.address;
    }
  }
  return null;
}

/**
 * Check if Orca whirlpool exists for token pair
 * 
 * @param inputMint - Input token mint address
 * @param outputMint - Output token mint address
 * @returns True if pool exists
 */
export function hasOrcaWhirlpool(inputMint: PublicKey, outputMint: PublicKey): boolean {
  return getOrcaWhirlpool(inputMint, outputMint) !== null;
}

/**
 * Get all Orca whirlpool configurations
 * 
 * @returns Array of all configured whirlpools
 */
export function getAllOrcaWhirlpools(): OrcaWhirlpoolConfig[] {
  return Object.values(ORCA_WHIRLPOOLS);
}
