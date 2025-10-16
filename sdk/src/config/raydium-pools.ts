/**
 * Raydium AMM Configuration
 *
 * Provides mainnet pool addresses and helper functions for Raydium AMM integration.
 * Raydium uses constant product AMM (xy=k) similar to Uniswap V2.
 *
 * @module raydium-pools
 */

import { PublicKey } from '@solana/web3.js';

/**
 * Raydium AMM pool configuration for a trading pair
 */
export interface RaydiumPoolConfig {
  /** Trading pair symbol (e.g., 'SOL/USDC') */
  symbol: string;
  /** AMM account address */
  ammAddress: PublicKey;
  /** AMM authority address */
  ammAuthority: PublicKey;
  /** AMM open orders address */
  ammOpenOrders: PublicKey;
  /** AMM target orders address */
  ammTargetOrders: PublicKey;
  /** Pool coin token account (token A vault) */
  poolCoinTokenAccount: PublicKey;
  /** Pool pc token account (token B vault) */
  poolPcTokenAccount: PublicKey;
  /** Pool withdraw queue */
  poolWithdrawQueue: PublicKey;
  /** Pool temp lp token account */
  poolTempLpTokenAccount: PublicKey;
  /** Serum program id */
  serumProgramId: PublicKey;
  /** Serum market address */
  serumMarket: PublicKey;
  /** Input token mint (base) */
  tokenMintA: PublicKey;
  /** Output token mint (quote) */
  tokenMintB: PublicKey;
  /** Fee rate in basis points */
  feeBps: number;
  /** Minimum liquidity depth for routing */
  minLiquidityUsd: number;
}

/**
 * Raydium AMM mainnet pool addresses
 *
 * Major pools with deep liquidity:
 * - SOL/USDC
 * - SOL/USDT
 * - RAY/SOL
 * - RAY/USDC
 */
export const RAYDIUM_POOLS: Record<string, RaydiumPoolConfig> = {
  'SOL/USDC': {
    symbol: 'SOL/USDC',
    ammAddress: new PublicKey('8HoQnePLqPj4M7PUDzfw8e3Ymdwgc7NLGnaTUapubyvu'),
    ammAuthority: new PublicKey('5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1'),
    ammOpenOrders: new PublicKey('HRk9CMrpq7Jn9sh7mzxE8CChHGvjHfbv56NXJbNCb9Z'),
    ammTargetOrders: new PublicKey('CuieVDEDtLo7FypA9SbLM9saXFdb1dsshEkyErMqkRQq'),
    poolCoinTokenAccount: new PublicKey('DQyrAcCrDXQ7NeoqGgDCZwBvWDcYmFCjSb9JtteuvPpz'),
    poolPcTokenAccount: new PublicKey('HLmqeL62xR1QoZ1HKKbXRrdN1p3phKpxRMb2VVopvBB'),
    poolWithdrawQueue: new PublicKey('G7xeGGLevkRwB5f44QNgQtrPKBdMfkT6ZZwpS9xcC97n'),
    poolTempLpTokenAccount: new PublicKey('Awpt6N7ZYPBa4vG4BQNFhFxDj7FbH2PqAaro6rKEceMj'),
    serumProgramId: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
    serumMarket: new PublicKey('9wFFyRfZBsuAha4YcuxcXLKwMxJR43S7fPfQLusDBzvT'),
    tokenMintA: new PublicKey('So11111111111111111111111111111111111111112'), // Wrapped SOL
    tokenMintB: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), // USDC
    feeBps: 25, // 0.25%
    minLiquidityUsd: 500_000,
  },
};

/**
 * Get Raydium pool configuration for a token pair
 *
 * @param inputMint - Input token mint address
 * @param outputMint - Output token mint address
 * @returns Raydium pool configuration or null if not found
 */
export function getRaydiumPool(
  inputMint: PublicKey,
  outputMint: PublicKey
): RaydiumPoolConfig | null {
  // Check both directions (tokenA/tokenB and tokenB/tokenA)
  for (const pool of Object.values(RAYDIUM_POOLS)) {
    if (
      (pool.tokenMintA.equals(inputMint) && pool.tokenMintB.equals(outputMint)) ||
      (pool.tokenMintA.equals(outputMint) && pool.tokenMintB.equals(inputMint))
    ) {
      return pool;
    }
  }

  return null;
}

/**
 * Get all Raydium pools
 *
 * @returns Array of all Raydium pool configurations
 */
export function getAllRaydiumPools(): RaydiumPoolConfig[] {
  return Object.values(RAYDIUM_POOLS);
}