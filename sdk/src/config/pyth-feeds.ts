/**
 * Pyth Network Price Feed Configuration
 * 
 * Official Pyth price feed accounts on Solana Mainnet-beta
 * Updated: October 2025
 * 
 * @see https://pyth.network/developers/price-feed-ids
 */

import { PublicKey } from '@solana/web3.js';

/**
 * Pyth price feed account addresses on Solana Mainnet
 */
export const PYTH_PRICE_FEEDS = {
  // Major tokens
  'SOL/USD': new PublicKey('H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG'),
  'USDC/USD': new PublicKey('Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD'),
  'USDT/USD': new PublicKey('3vxLXJqLqF3JG5TCbYycbKWRBbCJQLxQmBGCkyqEEefL'),
  'BTC/USD': new PublicKey('GVXRSBjFk6e6J3NbVPXohDJetcTjaeeuykUpbQF8UoMU'),
  'ETH/USD': new PublicKey('JBu1AL4obBcCMqKBBxhpWCNUt136ijcuMZLFvTP7iWdB'),
  
  // Solana ecosystem tokens
  'RAY/USD': new PublicKey('AnLf8tVYCM816gmBjiy8n53eXKKEDydT5piYjjQDPgTB'),
  'SRM/USD': new PublicKey('3NBReDRTLKMQEKiLD5tGcx4kXbTf88b7f2xLS9UuGjym'),
  'MNGO/USD': new PublicKey('79wm3jjcPr6RaNQ4DGvP5KxG1mNd3gEBsg6FsNVFezK4'),
  'ORCA/USD': new PublicKey('4ivThkX8uRxBpHsdWSqyXYihzKF3zpRGAUCqyuagnLoV'),
  'JUP/USD': new PublicKey('g6eRCbboSwK4tSWngn773RCMexr1APQr4uA9bGZBYfo'),
  
  // Stablecoins
  'DAI/USD': new PublicKey('CtJ8EkqLmeYyGB8s4jevpeNUj6VdHxPB9rvd1nPJcUUY'),
  'BUSD/USD': new PublicKey('5SSkXsEKQepHHAewytPVwdej4epN1nxgLVM84L4KXgy7'),
  'FRAX/USD': new PublicKey('G1f5s9LcfDB9JwjpBtjRF4u8mY7sSPMJBKNpBaY3vBp8'),
  
  // Memecoins & trending
  'WIF/USD': new PublicKey('6x6KfE7nY4QW8vPZVbhTwKmJFgxKQqJnXPvWHQaHgMQy'),
  'BONK/USD': new PublicKey('8ihFLu5FimgTQ1Unh4dVyEHUGodJ5gJQCrQf4KUVB9bN'),
  'POPCAT/USD': new PublicKey('4KmQjqFzYRJFSGNYQqNiNjYKJBHhxwYJfMjJ1kJHSFqW'),
} as const;

/**
 * Token symbol to Pyth feed mapping
 */
export type PythTokenSymbol = keyof typeof PYTH_PRICE_FEEDS;

/**
 * Get Pyth price feed account for a token symbol
 */
export function getPythFeedAccount(symbol: string): PublicKey | null {
  const normalizedSymbol = symbol.toUpperCase();
  
  // Try direct match (e.g., "SOL" -> "SOL/USD")
  const usdPair = `${normalizedSymbol}/USD` as PythTokenSymbol;
  if (PYTH_PRICE_FEEDS[usdPair]) {
    return PYTH_PRICE_FEEDS[usdPair];
  }
  
  // Try with common suffixes removed
  const baseSymbol = normalizedSymbol
    .replace('USDC', '')
    .replace('USDT', '')
    .replace('SOL', '');
  
  if (baseSymbol && baseSymbol !== normalizedSymbol) {
    const basePair = `${baseSymbol}/USD` as PythTokenSymbol;
    if (PYTH_PRICE_FEEDS[basePair]) {
      return PYTH_PRICE_FEEDS[basePair];
    }
  }
  
  return null;
}

/**
 * Get Pyth feed account by mint address
 * Maps common Solana token mints to their Pyth feeds
 */
export const PYTH_FEEDS_BY_MINT: Record<string, PublicKey> = {
  // SOL (native)
  'So11111111111111111111111111111111111111112': PYTH_PRICE_FEEDS['SOL/USD'],
  
  // USDC (Circle)
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': PYTH_PRICE_FEEDS['USDC/USD'],
  
  // USDT (Tether)
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': PYTH_PRICE_FEEDS['USDT/USD'],
  
  // RAY (Raydium)
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': PYTH_PRICE_FEEDS['RAY/USD'],
  
  // SRM (Serum)
  'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt': PYTH_PRICE_FEEDS['SRM/USD'],
  
  // ORCA
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE': PYTH_PRICE_FEEDS['ORCA/USD'],
  
  // JUP (Jupiter)
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': PYTH_PRICE_FEEDS['JUP/USD'],
};

/**
 * Get Pyth feed account by token mint address
 */
export function getPythFeedByMint(mint: string): PublicKey | null {
  return PYTH_FEEDS_BY_MINT[mint] || null;
}

/**
 * Pyth program ID on Solana Mainnet
 */
export const PYTH_PROGRAM_ID = new PublicKey('FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH');

/**
 * Pyth pull oracle program (newer model)
 */
export const PYTH_PULL_ORACLE_PROGRAM_ID = new PublicKey('rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ');

/**
 * Maximum age for price data (in seconds)
 * Pyth updates every ~400ms, we allow 10s staleness
 */
export const MAX_PRICE_AGE_SECONDS = 10;

/**
 * Maximum confidence interval as percentage of price
 * Reject prices with confidence > 2% of price
 */
export const MAX_CONFIDENCE_INTERVAL_PERCENT = 2.0;

/**
 * Pyth Network configuration
 */
export const PYTH_CONFIG = {
  programId: PYTH_PROGRAM_ID,
  pullOracleProgramId: PYTH_PULL_ORACLE_PROGRAM_ID,
  maxPriceAge: MAX_PRICE_AGE_SECONDS,
  maxConfidencePercent: MAX_CONFIDENCE_INTERVAL_PERCENT,
  cluster: 'mainnet-beta' as const,
};
