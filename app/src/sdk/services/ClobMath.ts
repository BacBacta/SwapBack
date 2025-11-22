import { OrderbookSnapshot } from '../types/smart-router';

export type ClobTradeDirection = 'sellBase' | 'sellQuote';

export interface OrderbookLevel {
  price: number;
  size: number;
}

export interface OrderbookLevels {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
}

export interface FillSimulationInput {
  direction: ClobTradeDirection;
  inputAmount: number;
  takerFeeBps: number;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
}

export interface FillSimulationResult {
  filledInput: number;
  outputAmount: number;
  feeAmount: number;
  effectivePrice: number;
  slippagePercent: number;
  notionalQuote: number;
  exhausted: boolean;
}

const EPSILON = 1e-9;

export function buildOrderbookSnapshot(
  levels: OrderbookLevels,
  latencyMs: number,
  lastUpdated: number,
  depthLevels = 5
): OrderbookSnapshot {
  const firstBid = levels.bids.length > 0 ? levels.bids[0] : undefined;
  const firstAsk = levels.asks.length > 0 ? levels.asks[0] : undefined;
  const bestBid = firstBid ? firstBid.price : 0;
  const bestAsk = firstAsk ? firstAsk.price : 0;
  const spreadMid = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : 0;
  const spreadBps =
    bestBid && bestAsk && spreadMid > 0
      ? ((bestAsk - bestBid) / spreadMid) * 10000
      : 0;

  const depthUsd = computeDepthUsd(levels, depthLevels);

  return {
    bids: levels.bids,
    asks: levels.asks,
    bestBid,
    bestAsk,
    spreadBps,
    depthUsd,
    lastUpdated,
    latencyMs,
  };
}

export function computeDepthUsd(
  { bids, asks }: OrderbookLevels,
  depthLevels = 5
): number {
  const reducer = (side: OrderbookLevel[]) =>
    side
      .slice(0, depthLevels)
      .reduce((sum, level) => sum + level.price * level.size, 0);

  return reducer(bids) + reducer(asks);
}

export function simulateClobFill(
  params: FillSimulationInput
): FillSimulationResult | null {
  if (params.inputAmount <= 0) {
    return null;
  }

  const takerFeeRate = Math.max(params.takerFeeBps, 0) / 10000;

  if (params.direction === 'sellBase') {
    let remaining = params.inputAmount;
    let grossQuote = 0;

    for (const level of params.bids) {
      if (remaining <= EPSILON) break;
      const fillSize = Math.min(level.size, remaining);
      grossQuote += fillSize * level.price;
      remaining -= fillSize;
    }

    if (grossQuote <= 0) {
      return null;
    }

    const feeAmount = grossQuote * takerFeeRate;
    const netOutput = grossQuote - feeAmount;
    if (netOutput <= 0) {
      return null;
    }

    const bestPrice = params.bids.length > 0 ? params.bids[0].price : 0;
    const spotEffectivePrice = bestPrice > 0 ? 1 / bestPrice : 0;
    const effectivePrice = params.inputAmount / netOutput;
    const slippagePercent =
      spotEffectivePrice > 0
        ? (effectivePrice - spotEffectivePrice) / spotEffectivePrice
        : 0;

    return {
      filledInput: params.inputAmount - remaining,
      outputAmount: netOutput,
      feeAmount,
      effectivePrice,
      slippagePercent,
      notionalQuote: grossQuote,
      exhausted: remaining > EPSILON,
    };
  }

  // direction === 'sellQuote'
  let remainingQuote = params.inputAmount;
  let grossBase = 0;

  for (const level of params.asks) {
    if (remainingQuote <= EPSILON) break;
    const quoteNeeded = level.price * level.size;
    const quoteUsed = Math.min(quoteNeeded, remainingQuote);
    if (quoteUsed <= 0 || level.price <= 0) {
      continue;
    }
    const baseOut = quoteUsed / level.price;
    grossBase += baseOut;
    remainingQuote -= quoteUsed;
  }

  if (grossBase <= 0) {
    return null;
  }

  const feeAmount = params.inputAmount * takerFeeRate;
  const effectiveInput = params.inputAmount + feeAmount;
  const effectivePrice = effectiveInput / grossBase;
  const bestPrice = params.asks.length > 0 ? params.asks[0].price : 0;
  const spotEffectivePrice = bestPrice;
  const slippagePercent =
    spotEffectivePrice > 0
      ? (effectivePrice - spotEffectivePrice) / spotEffectivePrice
      : 0;

  return {
    filledInput: params.inputAmount - remainingQuote,
    outputAmount: grossBase,
    feeAmount,
    effectivePrice,
    slippagePercent,
    notionalQuote: params.inputAmount,
    exhausted: remainingQuote > EPSILON,
  };
}
