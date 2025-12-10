/**
 * Switchboard Oracle Configuration
 * 
 * Switchboard aggregator feeds on Solana Mainnet-beta
 * Used as fallback when Pyth feeds are unavailable
 * Updated: October 2025
 * 
 * @see https://switchboard.xyz/explorer
 */

import { PublicKey } from '@solana/web3.js';

/**
 * Switchboard aggregator feed addresses on Solana Mainnet
 * These are backup oracles when Pyth is unavailable
 */
export const SWITCHBOARD_FEEDS = {
  // Major tokens
  'SOL/USD': new PublicKey('GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR'),
  'USDC/USD': new PublicKey('BjUgj6YCnFBZ49wF54ddBVA9qu8TeqkFtkbqmZcee8uW'),
  'USDT/USD': new PublicKey('5mp8kbkTYwWWCsKSte8rURjTuyinsqBpJ3xQKf8mF7cc'),
  'BTC/USD': new PublicKey('8SXvChNYFhRq4EZuZvnhjrB3jJRQCv4k3P4W6hesH3Ee'),
  'ETH/USD': new PublicKey('JBu1AL4obBcCMqKBBxhpWCNUt136ijcuMZLFvTP7iWdB'),
  
  // Solana ecosystem
  'RAY/USD': new PublicKey('FmKSBNL6kLxLvGM5rJHTbP8D1F2gU8VNYg5VvH5f8wVa'),
  'SRM/USD': new PublicKey('3Mnn2fX6rQyUsyELYms1sBJyChWofzSNRoqYzvgMVz5E'),
  'ORCA/USD': new PublicKey('4ivThkX8uRxBpHsdWSqyXYihzKF3zpRGAUCqyuagnLoV'),
  
  // Stablecoins
  'DAI/USD': new PublicKey('5SSkXsEKQepHHAewytPVwdej4epN1nxgLVM84L4KXgy7'),
} as const;

/**
 * Token symbol to Switchboard feed mapping
 */
export type SwitchboardTokenSymbol = keyof typeof SWITCHBOARD_FEEDS;

/**
 * Get Switchboard aggregator account for a token symbol
 */
export function getSwitchboardFeedAccount(symbol: string): PublicKey | null {
  const normalizedSymbol = symbol.toUpperCase();
  
  // Try direct match (e.g., "SOL" -> "SOL/USD")
  const usdPair = `${normalizedSymbol}/USD` as SwitchboardTokenSymbol;
  if (SWITCHBOARD_FEEDS[usdPair]) {
    return SWITCHBOARD_FEEDS[usdPair];
  }
  
  return null;
}

/**
 * Mint address to Switchboard feed mapping
 */
export const SWITCHBOARD_FEEDS_BY_MINT: Record<string, PublicKey> = {
  // SOL (native)
  'So11111111111111111111111111111111111111112': SWITCHBOARD_FEEDS['SOL/USD'],
  
  // USDC (Circle)
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': SWITCHBOARD_FEEDS['USDC/USD'],
  
  // USDT (Tether)
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': SWITCHBOARD_FEEDS['USDT/USD'],
  
  // RAY (Raydium)
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': SWITCHBOARD_FEEDS['RAY/USD'],
  
  // SRM (Serum)
  'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt': SWITCHBOARD_FEEDS['SRM/USD'],
  
  // ORCA
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE': SWITCHBOARD_FEEDS['ORCA/USD'],
};

/**
 * Get Switchboard feed by token mint address
 */
export function getSwitchboardFeedByMint(mint: string): PublicKey | null {
  return SWITCHBOARD_FEEDS_BY_MINT[mint] || null;
}

/**
 * Switchboard program ID on Solana Mainnet
 */
export const SWITCHBOARD_PROGRAM_ID = new PublicKey('SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f');

/**
 * Maximum staleness for Switchboard data (in seconds)
 * Switchboard updates vary by feed, allow 60s
 */
export const SWITCHBOARD_MAX_STALENESS_SECONDS = 60;

/**
 * Maximum variance threshold for Switchboard (as decimal)
 * Reject if variance > 5% of value
 */
export const SWITCHBOARD_MAX_VARIANCE_THRESHOLD = 0.05;

/**
 * Switchboard configuration
 */
export const SWITCHBOARD_CONFIG = {
  programId: SWITCHBOARD_PROGRAM_ID,
  maxStaleness: SWITCHBOARD_MAX_STALENESS_SECONDS,
  maxVariance: SWITCHBOARD_MAX_VARIANCE_THRESHOLD,
  cluster: 'mainnet-beta' as const,
};
