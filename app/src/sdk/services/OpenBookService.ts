import { Connection, PublicKey } from '@solana/web3.js';
import { Market, Orderbook } from '@project-serum/serum';
import {
  getOpenBookMarketConfig,
  getOpenBookProgramId,
  isOpenBookEnabled,
} from '../config/openbook-markets';
import { LiquiditySource, VenueName, VenueType } from '../types/smart-router';
import {
  buildOrderbookSnapshot,
  simulateClobFill,
  OrderbookLevel,
  OrderbookLevels,
} from './ClobMath';

interface MarketCacheEntry {
  market: Market;
}

interface LadderCacheEntry {
  levels: OrderbookLevels;
  lastUpdated: number;
  latencyMs: number;
}

const DEFAULT_CACHE_TTL_MS = 1000;
const DEFAULT_LADDER_DEPTH = (() => {
  const raw = process.env.NEXT_PUBLIC_OPENBOOK_LADDER_DEPTH;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
})();

export class OpenBookService {
  private connection: Connection;
  private cacheTtlMs: number;
  private ladderDepth: number;
  private marketCache: Map<string, MarketCacheEntry>;
  private ladderCache: Map<string, LadderCacheEntry>;

  constructor(
    connection: Connection,
    options?: { cacheTtlMs?: number; ladderDepth?: number }
  ) {
    this.connection = connection;
    const cacheOverride = options && typeof options.cacheTtlMs === 'number' ? options.cacheTtlMs : undefined;
    const depthOverride = options && typeof options.ladderDepth === 'number' ? options.ladderDepth : undefined;
    this.cacheTtlMs = cacheOverride && cacheOverride > 0 ? cacheOverride : DEFAULT_CACHE_TTL_MS;
    this.ladderDepth = depthOverride && depthOverride > 0 ? depthOverride : DEFAULT_LADDER_DEPTH;
    this.marketCache = new Map();
    this.ladderCache = new Map();
  }

  async fetchLiquidity(
    inputMint: string,
    outputMint: string,
    inputAmount: number
  ): Promise<LiquiditySource | null> {
    if (!isOpenBookEnabled()) {
      return null;
    }

    const match = getOpenBookMarketConfig(inputMint, outputMint);
    if (!match) {
      return null;
    }

    const ladder = await this.getOrderbookLevels(match.config.marketAddress);
    if (!ladder) {
      return null;
    }

    const snapshot = buildOrderbookSnapshot(
      ladder.levels,
      ladder.latencyMs,
      ladder.lastUpdated
    );

    const direction = match.inverted ? 'sellQuote' : 'sellBase';
    const fill = simulateClobFill({
      direction,
      inputAmount,
      takerFeeBps: match.config.takerFeeBps,
      bids: ladder.levels.bids,
      asks: ladder.levels.asks,
    });

    if (!fill) {
      return null;
    }

    return {
      venue: VenueName.OPENBOOK,
      venueType: VenueType.CLOB,
      tokenPair: [inputMint, outputMint],
      depth: snapshot.depthUsd,
      topOfBook: {
        bidPrice: snapshot.bestBid,
        askPrice: snapshot.bestAsk,
        bidSize: ladder.levels.bids.length > 0 ? ladder.levels.bids[0].size : 0,
        askSize: ladder.levels.asks.length > 0 ? ladder.levels.asks[0].size : 0,
      },
      orderbook: snapshot,
      effectivePrice: fill.effectivePrice,
      feeAmount: fill.feeAmount,
      slippagePercent: fill.slippagePercent,
      venueFeeBps: match.config.takerFeeBps,
      route: [inputMint, outputMint],
      timestamp: snapshot.lastUpdated,
      dataFreshnessMs: Date.now() - snapshot.lastUpdated,
      metadata: {
        marketAddress: match.config.marketAddress.toBase58(),
        inverted: match.inverted,
        direction,
        exhausted: fill.exhausted,
        makerFeeBps: match.config.makerFeeBps,
        takerFeeBps: match.config.takerFeeBps,
        latencyMs: ladder.latencyMs,
        fill: {
          filledInput: fill.filledInput,
          outputAmount: fill.outputAmount,
          notionalQuote: fill.notionalQuote,
          effectivePrice: fill.effectivePrice,
        },
      },
    };
  }

  private async getOrderbookLevels(
    marketAddress: PublicKey
  ): Promise<LadderCacheEntry | null> {
    const cacheKey = `${marketAddress.toBase58()}-${this.ladderDepth}`;
    const cached = this.ladderCache.get(cacheKey);
    if (cached && Date.now() - cached.lastUpdated < this.cacheTtlMs) {
      return cached;
    }

    try {
      const market = await this.loadMarket(marketAddress);
      const start = Date.now();
      const [bids, asks] = await Promise.all([
        market.loadBids(this.connection),
        market.loadAsks(this.connection),
      ]);
      const latencyMs = Date.now() - start;
      const levels = this.orderbookToLevels(bids, asks);
      const entry: LadderCacheEntry = {
        levels,
        lastUpdated: Date.now(),
        latencyMs,
      };
      this.ladderCache.set(cacheKey, entry);
      return entry;
    } catch (error) {
      console.error('[openbook] orderbook fetch failed', error);
      return null;
    }
  }

  private async loadMarket(marketAddress: PublicKey): Promise<Market> {
    const key = marketAddress.toBase58();
    const cached = this.marketCache.get(key);
    if (cached) {
      return cached.market;
    }

    const programId = getOpenBookProgramId();
    const market = await Market.load(
      this.connection,
      marketAddress,
      {},
      programId
    );
    this.marketCache.set(key, { market });
    return market;
  }

  private orderbookToLevels(bids: Orderbook, asks: Orderbook): OrderbookLevels {
    const mapSide = (levels: Array<[number, number]>): OrderbookLevel[] =>
      levels.slice(0, this.ladderDepth).map(([price, size]) => ({
        price: Number(price),
        size: Number(size),
      }));

    return {
      bids: mapSide(bids.getL2(this.ladderDepth)),
      asks: mapSide(asks.getL2(this.ladderDepth)),
    };
  }
}
