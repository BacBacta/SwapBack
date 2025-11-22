/**
 * Phoenix CLOB Market Configuration
 * 
 * Phoenix is a Central Limit Order Book (CLOB) DEX on Solana
 * Provides best execution for limit orders with minimal slippage
 * 
 * @see https://docs.phoenix.trade/
 */

import { PublicKey } from '@solana/web3.js';

export interface PhoenixMarketConfig {
  symbol: string;
  marketAddress: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseDecimals: number;
  quoteDecimals: number;
  lotSize: number;
  tickSize: number;
  makerFeeBps: number;
  takerFeeBps: number;
}

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

type PhoenixMarketMap = Record<string, PhoenixMarketConfig>;

const DEFAULT_PHOENIX_MARKETS: PhoenixMarketConfig[] = [
  {
    symbol: 'SOL/USDC',
    marketAddress: new PublicKey('4DoNfFBfF7UokCC2FQzriy7yHK6DY6NVdYpuekQ5pRgg'),
    baseMint: new PublicKey(SOL_MINT),
    quoteMint: new PublicKey(USDC_MINT),
    baseDecimals: 9,
    quoteDecimals: 6,
    lotSize: 0.01,
    tickSize: 0.0001,
    makerFeeBps: -1, // Phoenix rebates makers
    takerFeeBps: 5,
  },
  {
    symbol: 'SOL/USDT',
    marketAddress: new PublicKey('5Dy6cZqy7ZTPJZ7pfPzKMFMUKKVpPxaM6dVB8FRkD2mT'),
    baseMint: new PublicKey(SOL_MINT),
    quoteMint: new PublicKey(USDT_MINT),
    baseDecimals: 9,
    quoteDecimals: 6,
    lotSize: 0.01,
    tickSize: 0.0001,
    makerFeeBps: -1,
    takerFeeBps: 5,
  },
];

let phoenixMarketMap: PhoenixMarketMap | null = null;

function loadPhoenixMarkets(): PhoenixMarketMap {
  if (phoenixMarketMap) {
    return phoenixMarketMap;
  }

  const map: PhoenixMarketMap = {};
  for (const config of DEFAULT_PHOENIX_MARKETS) {
    const key = pairKey(config.baseMint.toBase58(), config.quoteMint.toBase58());
    map[key] = config;
  }

  const override = process.env.NEXT_PUBLIC_PHOENIX_MARKETS_JSON;
  if (override) {
    try {
      const parsed = JSON.parse(override) as Array<{
        symbol: string;
        marketAddress: string;
        baseMint: string;
        quoteMint: string;
        baseDecimals?: number;
        quoteDecimals?: number;
        lotSize?: number;
        tickSize?: number;
        makerFeeBps?: number;
        takerFeeBps?: number;
      }>;

      for (const entry of parsed) {
        if (!entry.marketAddress || !entry.baseMint || !entry.quoteMint) {
          continue;
        }
        const config: PhoenixMarketConfig = {
          symbol: entry.symbol || `${entry.baseMint}/${entry.quoteMint}`,
          marketAddress: new PublicKey(entry.marketAddress),
          baseMint: new PublicKey(entry.baseMint),
          quoteMint: new PublicKey(entry.quoteMint),
          baseDecimals: entry.baseDecimals ?? 9,
          quoteDecimals: entry.quoteDecimals ?? 6,
          lotSize: entry.lotSize ?? 0.01,
          tickSize: entry.tickSize ?? 0.0001,
          makerFeeBps: entry.makerFeeBps ?? -1,
          takerFeeBps: entry.takerFeeBps ?? 5,
        };
        map[pairKey(entry.baseMint, entry.quoteMint)] = config;
      }
    } catch (error) {
      console.warn('[phoenix-config] Failed to parse override JSON', error);
    }
  }

  phoenixMarketMap = map;
  return map;
}

function pairKey(baseMint: string, quoteMint: string): string {
  return `${baseMint}:${quoteMint}`;
}

export function isPhoenixEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_ENABLE_PHOENIX;
  if (!flag) return true;
  return !['0', 'false', 'FALSE'].includes(flag);
}

/**
 * Phoenix market addresses on Solana Mainnet
 * Backwards compatible export (symbol -> PublicKey)
 */
export const PHOENIX_MARKETS: Record<string, PublicKey> = Object.fromEntries(
  DEFAULT_PHOENIX_MARKETS.map((cfg) => [cfg.symbol, cfg.marketAddress])
);

/**
 * Token pair to Phoenix market mapping
 */
export type PhoenixMarketPair = keyof typeof PHOENIX_MARKETS;

/**
 * Get Phoenix market address for a token pair
 */
export function getPhoenixMarketConfig(
  inputMint: string,
  outputMint: string
): { config: PhoenixMarketConfig; inverted: boolean } | null {
  const markets = loadPhoenixMarkets();
  const direct = markets[pairKey(inputMint, outputMint)];
  if (direct) {
    return { config: direct, inverted: false };
  }
  const reverse = markets[pairKey(outputMint, inputMint)];
  if (reverse) {
    return { config: reverse, inverted: true };
  }
  return null;
}

export function getPhoenixMarket(inputMint: string, outputMint: string): PublicKey | null {
  const match = getPhoenixMarketConfig(inputMint, outputMint);
  return match ? match.config.marketAddress : null;
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
