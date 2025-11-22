import { describe, expect, it } from 'vitest';
import { simulateClobFill } from '../ClobMath';

const BASE_BIDS = [
  { price: 100, size: 5 },
  { price: 99, size: 10 },
];

const BASE_ASKS = [
  { price: 101, size: 4 },
  { price: 102, size: 6 },
];

describe('simulateClobFill', () => {
  it('fills sell-base orders against bids', () => {
    const result = simulateClobFill({
      direction: 'sellBase',
      inputAmount: 8,
      takerFeeBps: 5,
      bids: BASE_BIDS,
      asks: BASE_ASKS,
    });

    expect(result).not.toBeNull();
    if (!result) return;

    // Gross quote = (5 * 100) + (3 * 99) = 797
    // Fee = 0.0005 * 797 ≈ 0.3985
    // Net output ≈ 796.6015
    expect(result.outputAmount).toBeGreaterThan(796.5);
    expect(result.feeAmount).toBeGreaterThan(0.39);
    expect(result.exhausted).toBe(false);
  });

  it('fills sell-quote orders against asks', () => {
    const result = simulateClobFill({
      direction: 'sellQuote',
      inputAmount: 500,
      takerFeeBps: 5,
      bids: BASE_BIDS,
      asks: BASE_ASKS,
    });

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.outputAmount).toBeGreaterThan(4.9);
    expect(result.feeAmount).toBeCloseTo(0.25, 2);
    expect(result.exhausted).toBe(false);
  });

  it('marks insufficient liquidity as exhausted', () => {
    const result = simulateClobFill({
      direction: 'sellBase',
      inputAmount: 20,
      takerFeeBps: 5,
      bids: BASE_BIDS,
      asks: BASE_ASKS,
    });

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.exhausted).toBe(true);
  });
});
