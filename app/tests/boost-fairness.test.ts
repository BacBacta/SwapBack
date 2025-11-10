/**
 * Tests pour vérifier l'équité de la formule de boost
 */

import { describe, it, expect } from 'vitest';
import { calculateBoost } from '@/lib/cnft';

describe('Boost Fairness Formula', () => {
  describe('Amount-based boost (logarithmic)', () => {
    it('should give 0% boost for minimum amount (100k)', () => {
      const boost = calculateBoost(100000, 30);
      // 0% (amount) + ~0.82% (30 days) = ~0.82%
      expect(boost).toBeCloseTo(0.82, 1);
    });

    it('should give ~5% boost for 10x amount (1M)', () => {
      const boost = calculateBoost(1000000, 30);
      // ~5% (amount) + ~0.82% (30 days) = ~5.82%
      expect(boost).toBeCloseTo(5.82, 1);
    });

    it('should give ~10% boost for 100x amount (10M)', () => {
      const boost = calculateBoost(10000000, 30);
      // 10% (amount max) + ~0.82% (30 days) = ~10.82%
      expect(boost).toBeCloseTo(10.82, 1);
    });

    it('should cap amount boost at 10% for very large amounts', () => {
      const boost = calculateBoost(100000000, 30);
      // 10% (capped) + ~0.82% (30 days) = ~10.82%
      expect(boost).toBeCloseTo(10.82, 1);
    });
  });

  describe('Duration-based boost (linear)', () => {
    it('should scale linearly with duration', () => {
      const boost7 = calculateBoost(100000, 7);
      const boost30 = calculateBoost(100000, 30);
      const boost90 = calculateBoost(100000, 90);
      const boost365 = calculateBoost(100000, 365);

      expect(boost7).toBeCloseTo(0.19, 1); // ~0.19% duration
      expect(boost30).toBeCloseTo(0.82, 1); // ~0.82% duration
      expect(boost90).toBeCloseTo(2.47, 1); // ~2.47% duration
      expect(boost365).toBeCloseTo(10, 1); // 10% duration (max)
    });
  });

  describe('Proportionality (fairness check)', () => {
    it('should reward proportionally: 10x tokens should give significant boost increase', () => {
      const boost100k = calculateBoost(100000, 30);
      const boost1M = calculateBoost(1000000, 30);
      
      // 10x les tokens devrait donner ~7x le boost (approximatif avec log)
      const ratio = boost1M / boost100k;
      expect(ratio).toBeGreaterThan(5); // Au moins 5x
      expect(ratio).toBeLessThan(10); // Mais pas 10x (logarithmique)
    });

    it('should reward proportionally: 100x tokens should give ~13x boost increase', () => {
      const boost100k = calculateBoost(100000, 30);
      const boost10M = calculateBoost(10000000, 30);
      
      // 100x les tokens devrait donner ~13x le boost
      const ratio = boost10M / boost100k;
      expect(ratio).toBeGreaterThan(10);
      expect(ratio).toBeLessThan(15);
    });
  });

  describe('Maximum boost cap', () => {
    it('should cap total boost at 20%', () => {
      const boost = calculateBoost(100000000, 365);
      expect(boost).toBe(20);
    });

    it('should never exceed 20% regardless of amount or duration', () => {
      const boost1 = calculateBoost(1000000000, 365);
      const boost2 = calculateBoost(10000000, 1000);
      const boost3 = calculateBoost(1000000000, 10000);

      expect(boost1).toBeLessThanOrEqual(20);
      expect(boost2).toBeLessThanOrEqual(20);
      expect(boost3).toBeLessThanOrEqual(20);
    });
  });

  describe('Real-world examples', () => {
    it('Example 1: 100k BACK for 30 days', () => {
      const boost = calculateBoost(100000, 30);
      expect(boost).toBeCloseTo(0.82, 1);
      console.log(`100k BACK, 30 days: ${boost}% boost`);
    });

    it('Example 2: 1M BACK for 30 days', () => {
      const boost = calculateBoost(1000000, 30);
      expect(boost).toBeCloseTo(5.82, 1);
      console.log(`1M BACK, 30 days: ${boost}% boost`);
    });

    it('Example 3: 5M BACK for 30 days', () => {
      const boost = calculateBoost(5000000, 30);
      expect(boost).toBeCloseTo(9.32, 1);
      console.log(`5M BACK, 30 days: ${boost}% boost`);
    });

    it('Example 4: 10M BACK for 30 days', () => {
      const boost = calculateBoost(10000000, 30);
      expect(boost).toBeCloseTo(10.82, 1);
      console.log(`10M BACK, 30 days: ${boost}% boost`);
    });

    it('Example 5: 100k BACK for 365 days', () => {
      const boost = calculateBoost(100000, 365);
      expect(boost).toBeCloseTo(10, 1);
      console.log(`100k BACK, 365 days: ${boost}% boost`);
    });

    it('Example 6: 10M BACK for 365 days (max)', () => {
      const boost = calculateBoost(10000000, 365);
      expect(boost).toBe(20);
      console.log(`10M BACK, 365 days: ${boost}% boost (max)`);
    });
  });

  describe('Fairness comparison table', () => {
    it('should demonstrate fair boost distribution', () => {
      console.log('\n📊 Tableau de Comparaison des Boosts (Nouvelle Formule Équitable)\n');
      console.log('Amount      | 7 days | 30 days | 90 days | 365 days');
      console.log('------------|--------|---------|---------|----------');
      
      const amounts = [100000, 1000000, 5000000, 10000000];
      const durations = [7, 30, 90, 365];
      
      amounts.forEach(amount => {
        const amountStr = `${(amount / 1000000).toFixed(1)}M BACK`.padEnd(11);
        const boosts = durations.map(days => {
          const boost = calculateBoost(amount, days);
          return `${boost.toFixed(2)}%`.padEnd(7);
        });
        console.log(`${amountStr} | ${boosts.join(' | ')}`);
      });

      console.log('\n✅ Formule logarithmique garantit une progression équitable');
      console.log('📈 Plus vous lockez, plus le boost augmente proportionnellement');
    });
  });
});
