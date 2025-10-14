/**
 * Phoenix CLOB Market Configuration
 * 
 * Phoenix is a Central Limit Order Book (CLOB) DEX on Solana
 * Provides best execution for limit orders with minimal slippage
 * 
 * @see https://docs.phoenix.trade/
 */

import { PublicKey } from '@solana/web3.js';

/**
 * Phoenix market addresses on Solana Mainnet
 * These are the official Phoenix markets with highest liquidity
 */
export const PHOENIX_MARKETS = {
  // Major trading pairs
  'SOL/USDC': new PublicKey('4DoNfFBfF7UokCC2FQzriy7yHK6DY6NVdYpuekQ5pRgg'),
  'SOL/USDT': new PublicKey('5Dy6cZqy7ZTPJZ7pfPzKMFMUKKVpPxaM6dVB8FRkD2mT'),
  
  // Other popular pairs (if available)
  // Note: Phoenix markets are more limited than AMMs
  // Check https://app.phoenix.trade/ for current markets
} as const;

/**
 * Token pair to Phoenix market mapping
 */
export type PhoenixMarketPair = keyof typeof PHOENIX_MARKETS;

/**
 * Get Phoenix market address for a token pair
 */
export function getPhoenixMarket(inputMint: string, outputMint: string): PublicKey | null {
  // Common mint addresses
  const MINT_SYMBOLS: Record<string, string> = {
    'So11111111111111111111111111111111111111112': 'SOL',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
  };
  
  const inputSymbol = MINT_SYMBOLS[inputMint];
  const outputSymbol = MINT_SYMBOLS[outputMint];
  
  if (!inputSymbol || !outputSymbol) {
    return null;
  }
  
  // Try direct pair
  const directPair = `${inputSymbol}/${outputSymbol}` as PhoenixMarketPair;
  if (PHOENIX_MARKETS[directPair]) {
    return PHOENIX_MARKETS[directPair];
  }
  
  // Try reverse pair
  const reversePair = `${outputSymbol}/${inputSymbol}` as PhoenixMarketPair;
  if (PHOENIX_MARKETS[reversePair]) {
    return PHOENIX_MARKETS[reversePair];
  }
  
  return null;
}

/**
 * Check if a token pair has a Phoenix market
 */
export function hasPhoenixMarket(inputMint: string, outputMint: string): boolean {
  return getPhoenixMarket(inputMint, outputMint) !== null;
}

/**
 * Phoenix program ID on Solana Mainnet
 */
export const PHOENIX_PROGRAM_ID = new PublicKey('PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY');

/**
 * Phoenix configuration
 */
export const PHOENIX_CONFIG = {
  programId: PHOENIX_PROGRAM_ID,
  cluster: 'mainnet-beta' as const,
  // Phoenix has very tight spreads, minimal slippage on CLOB
  defaultSlippageBps: 10, // 0.1%
  // Orderbook refresh rate
  refreshIntervalMs: 1000, // 1 second
};
