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
  'JTO/USD': new PublicKey('7yyaeuJ1GGtVBLT2z2xub5ZWYKaNhF28mj1RdV4VDFVk'),
  'PYTH/USD': new PublicKey('nrYkQQQur7z8rYTST3G9GqATviK5SxTDkrqd21MW6Ue'),
  
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
 * Hex-encoded feed IDs for Hermes (pull oracle)
 */
export const PYTH_FEED_IDS = {
  'SOL/USD': 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  'USDC/USD': 'eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  'USDT/USD': '2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
  'JUP/USD': '0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996',
  'RAY/USD': '91568baa8beb53db23eb3fb7f22c6e8bd303d103919e19733f2bb642d3e7987a',
  'ORCA/USD': '37505261e557e251290b8c8899453064e8d760ed5c65a779726f2490980da74c',
  'BONK/USD': '72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419',
  'WIF/USD': '4ca4beeca86f0d164160323817a4e42b10010a724c2217c6ee41b54cd4cc61fc',
  'JTO/USD': 'b43660a5f790c69354b0729a5ef9d50d68f1df92107540210b9cccba1f947cc2',
  'PYTH/USD': '0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff',
  'POPCAT/USD': 'b9312a7ee50e189ef045aa3c7842e099b061bd9bdc99ac645956c3b660dc8cce',
} as const;

/**
 * Token symbol to Pyth feed mapping
 */
export type PythTokenSymbol = keyof typeof PYTH_PRICE_FEEDS;
export type PythFeedIdSymbol = keyof typeof PYTH_FEED_IDS;

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

  // BONK (Bonk)
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': PYTH_PRICE_FEEDS['BONK/USD'],

  // WIF (Dogwifhat)
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': PYTH_PRICE_FEEDS['WIF/USD'],

  // JTO (Jito)
  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL': PYTH_PRICE_FEEDS['JTO/USD'],

  // PYTH (Pyth Network)
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': PYTH_PRICE_FEEDS['PYTH/USD'],

  // POPCAT (Popcat)
  '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr': PYTH_PRICE_FEEDS['POPCAT/USD'],
};

/**
 * Get Pyth feed account by token mint address
 */
export function getPythFeedByMint(mint: string): PublicKey | null {
  return PYTH_FEEDS_BY_MINT[mint] || null;
}

/**
 * Pyth feed IDs by mint (Hermes)
 */
export const PYTH_FEED_IDS_BY_MINT: Record<string, string> = {
  'So11111111111111111111111111111111111111112': PYTH_FEED_IDS['SOL/USD'],
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': PYTH_FEED_IDS['USDC/USD'],
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': PYTH_FEED_IDS['USDT/USD'],
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': PYTH_FEED_IDS['RAY/USD'],
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE': PYTH_FEED_IDS['ORCA/USD'],
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': PYTH_FEED_IDS['JUP/USD'],
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': PYTH_FEED_IDS['BONK/USD'],
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': PYTH_FEED_IDS['WIF/USD'],
  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL': PYTH_FEED_IDS['JTO/USD'],
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': PYTH_FEED_IDS['PYTH/USD'],
  '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr': PYTH_FEED_IDS['POPCAT/USD'],
};

export function getPythFeedId(symbol: string): string | null {
  const normalizedSymbol = symbol.toUpperCase();
  const usdPair = `${normalizedSymbol}/USD` as PythFeedIdSymbol;
  if (PYTH_FEED_IDS[usdPair]) {
    return PYTH_FEED_IDS[usdPair];
  }

  const baseSymbol = normalizedSymbol
    .replace('USDC', '')
    .replace('USDT', '')
    .replace('SOL', '');

  if (baseSymbol && baseSymbol !== normalizedSymbol) {
    const basePair = `${baseSymbol}/USD` as PythFeedIdSymbol;
    if (PYTH_FEED_IDS[basePair]) {
      return PYTH_FEED_IDS[basePair];
    }
  }

  return null;
}

export function getPythFeedIdByMint(mint: string): string | null {
  return PYTH_FEED_IDS_BY_MINT[mint] || null;
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
