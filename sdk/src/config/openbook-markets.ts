import { PublicKey } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';

export interface OpenBookMarketConfig {
  symbol: string;
  marketAddress: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseDecimals: number;
  quoteDecimals: number;
  makerFeeBps: number;
  takerFeeBps: number;
}

type OpenBookMarketMap = Record<string, OpenBookMarketConfig>;

const DEFAULT_OPENBOOK_MARKETS: OpenBookMarketConfig[] = [
  {
    symbol: 'SOL/USDC',
    marketAddress: new PublicKey('9wFFBENy5n1z2WMSr8d4223WXGmywHLvyDMvDaTLwSqB'),
    baseMint: new PublicKey('So11111111111111111111111111111111111111112'),
    quoteMint: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    baseDecimals: 9,
    quoteDecimals: 6,
    makerFeeBps: -2,
    takerFeeBps: 5,
  },
];

let openBookMarketMap: OpenBookMarketMap | null = null;
let openBookProgramId: PublicKey | null = null;

const DEFAULT_PROGRAM_ID = '9xQeWvG816bUx9EPfDdQzWo1UzVXwQ2Yq89c4iG1QLLf';

function pairKey(baseMint: string, quoteMint: string): string {
  return `${baseMint}:${quoteMint}`;
}

function loadOpenBookMarkets(): OpenBookMarketMap {
  if (openBookMarketMap) {
    return openBookMarketMap;
  }

  const map: OpenBookMarketMap = {};
  for (const config of DEFAULT_OPENBOOK_MARKETS) {
    map[pairKey(config.baseMint.toBase58(), config.quoteMint.toBase58())] = config;
  }

  const override = process.env.NEXT_PUBLIC_OPENBOOK_MARKETS_JSON;
  if (override) {
    try {
      const parsed = JSON.parse(override) as Array<{
        symbol: string;
        marketAddress: string;
        baseMint: string;
        quoteMint: string;
        baseDecimals?: number;
        quoteDecimals?: number;
        makerFeeBps?: number;
        takerFeeBps?: number;
      }>;

      for (const entry of parsed) {
        if (!entry.marketAddress || !entry.baseMint || !entry.quoteMint) {
          continue;
        }

        const config: OpenBookMarketConfig = {
          symbol: entry.symbol || `${entry.baseMint}/${entry.quoteMint}`,
          marketAddress: new PublicKey(entry.marketAddress),
          baseMint: new PublicKey(entry.baseMint),
          quoteMint: new PublicKey(entry.quoteMint),
          baseDecimals: entry.baseDecimals ?? 9,
          quoteDecimals: entry.quoteDecimals ?? 6,
          makerFeeBps: entry.makerFeeBps ?? -2,
          takerFeeBps: entry.takerFeeBps ?? 5,
        };
        map[pairKey(entry.baseMint, entry.quoteMint)] = config;
      }
    } catch (error) {
      console.warn('[openbook-config] Failed to parse override JSON', error);
    }
  }

  openBookMarketMap = map;
  return map;
}

export function isOpenBookEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_ENABLE_OPENBOOK;
  if (!flag) return true;
  return !['0', 'false', 'FALSE'].includes(flag);
}

export function getOpenBookProgramId(): PublicKey {
  if (openBookProgramId) {
    return openBookProgramId;
  }

  const override = process.env.NEXT_PUBLIC_OPENBOOK_PROGRAM_ID;
  openBookProgramId = new PublicKey(override || DEFAULT_PROGRAM_ID);
  return openBookProgramId;
}

export function getOpenBookMarketConfig(
  inputMint: string,
  outputMint: string
): { config: OpenBookMarketConfig; inverted: boolean } | null {
  const markets = loadOpenBookMarkets();
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

export const OPENBOOK_MARKETS: Record<string, PublicKey> = Object.fromEntries(
  DEFAULT_OPENBOOK_MARKETS.map((cfg) => [cfg.symbol, cfg.marketAddress])
);

export function getOpenBookMarket(inputMint: string, outputMint: string): PublicKey | null {
  const match = getOpenBookMarketConfig(inputMint, outputMint);
  return match ? match.config.marketAddress : null;
}

export function hasOpenBookMarket(inputMint: string, outputMint: string): boolean {
  return getOpenBookMarket(inputMint, outputMint) !== null;
}
