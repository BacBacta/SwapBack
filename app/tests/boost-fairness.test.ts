import { describe, it, expect } from 'vitest';
import { calculateBoost } from '@/lib/cnft';

describe('Boost Fairness Formula', () => {
  describe('Tier-based boost', () => {
    it('should give correct boost for 100k BACK (Top Tier) for 30 days (Min Tier)', () => {
      const boost = calculateBoost(100000, 30);
      // Amount > 100k -> 500 bps
      // Duration > 30d -> 50 bps
      // Cross -> (500 * 50) / 10000 = 2.5 -> 2 bps
      // Total -> 552 bps = 5.52%
      expect(boost).toBe(5.52);
    });

    it('should give max boost for 100k BACK for 365 days', () => {
      const boost = calculateBoost(100000, 365);
      // Amount > 100k -> 500 bps
      // Duration > 365d -> 500 bps
      // Cross -> 25 bps
      // Total -> 1025 bps -> Capped at 1000 bps = 10.00%
      expect(boost).toBe(10.00);
    });

    it('should give same boost for 1M BACK as 100k BACK (capped tier)', () => {
      const boost100k = calculateBoost(100000, 30);
      const boost1M = calculateBoost(1000000, 30);
      expect(boost1M).toBe(boost100k);
    });
  });

  describe('Maximum boost cap', () => {
    it('should cap total boost at 10%', () => {
      const boost = calculateBoost(100000000, 365);
      expect(boost).toBe(10.00);
    });
  });

  describe('Real-world examples', () => {
    it('Example 1: 100k BACK for 30 days', () => {
      const boost = calculateBoost(100000, 30);
      expect(boost).toBe(5.52);
    });

    it('Example 2: 1M BACK for 30 days', () => {
      const boost = calculateBoost(1000000, 30);
      expect(boost).toBe(5.52);
    });

    it('Example 3: 5M BACK for 30 days', () => {
      const boost = calculateBoost(5000000, 30);
      expect(boost).toBe(5.52);
    });

    it('Example 4: 10M BACK for 30 days', () => {
      const boost = calculateBoost(10000000, 30);
      expect(boost).toBe(5.52);
    });

    it('Example 5: 100k BACK for 365 days', () => {
      const boost = calculateBoost(100000, 365);
      expect(boost).toBe(10.00);
    });

    it('Example 6: 10M BACK for 365 days (max)', () => {
      const boost = calculateBoost(10000000, 365);
      expect(boost).toBe(10.00);
    });
  });
});
