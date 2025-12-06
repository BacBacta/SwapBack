/**
 * Tests pour le Hybrid Routing avec allocation dynamique
 */

import { describe, it, expect } from "vitest";
import { 
  buildHybridIntents, 
  type RoutingStrategy,
  type HybridRouteIntent 
} from "../hybridRouting";
import type { QuoteResult } from "@/lib/quotes/multiSourceAggregator";

// Mock quote Jupiter
const mockJupiterQuote = {
  inputMint: "So11111111111111111111111111111111111111112",
  outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  inAmount: "1000000000",
  outAmount: "150000000",
  otherAmountThreshold: "148500000",
  priceImpactPct: "0.5",
  routePlan: [],
  contextSlot: 123456,
  timeTaken: 100,
};

describe("buildHybridIntents", () => {
  describe("Stratégie Smart (par défaut)", () => {
    it("devrait créer un intent Jupiter principal", () => {
      const intents = buildHybridIntents({
        quote: mockJupiterQuote,
        strategy: "smart",
        amountLamports: 1_000_000_000,
        slippageBps: 50,
        priceImpactPct: 0.5,
      });

      const jupiterIntent = intents.find(i => i.type === "jupiter_best");
      expect(jupiterIntent).toBeDefined();
      expect(jupiterIntent?.label).toBe("Jupiter Smart Route");
    });

    it("devrait ajouter le pool interne pour SOL/USDC", () => {
      const intents = buildHybridIntents({
        quote: mockJupiterQuote,
        strategy: "smart",
        amountLamports: 1_000_000_000,
        slippageBps: 50,
        priceImpactPct: 0.5,
      });

      const internalIntent = intents.find(i => i.type === "internal_liquidity");
      expect(internalIntent).toBeDefined();
      expect(internalIntent?.channel).toBe("private-rpc");
    });

    it("devrait normaliser les pourcentages à 100%", () => {
      const intents = buildHybridIntents({
        quote: mockJupiterQuote,
        strategy: "smart",
        amountLamports: 1_000_000_000,
        slippageBps: 50,
        priceImpactPct: 0.5,
      });

      const total = intents.reduce((sum, i) => sum + i.percentage, 0);
      expect(total).toBeCloseTo(1.0, 1);
    });
  });

  describe("Stratégie Aggressive", () => {
    it("devrait concentrer sur Jupiter", () => {
      const intents = buildHybridIntents({
        quote: mockJupiterQuote,
        strategy: "aggressive",
        amountLamports: 1_000_000_000,
        slippageBps: 50,
        priceImpactPct: 0.5,
      });

      const jupiterIntent = intents.find(i => i.type === "jupiter_best");
      expect(jupiterIntent?.percentage).toBeGreaterThan(0.8);
    });

    it("ne devrait pas ajouter de TWAP", () => {
      const intents = buildHybridIntents({
        quote: mockJupiterQuote,
        strategy: "aggressive",
        amountLamports: 5_000_000_000,
        slippageBps: 50,
        priceImpactPct: 2.0,
      });

      const twapIntent = intents.find(i => i.type === "twap_plan");
      expect(twapIntent).toBeUndefined();
    });
  });

  describe("Stratégie Defensive", () => {
    it("devrait ajouter TWAP pour les gros ordres", () => {
      const intents = buildHybridIntents({
        quote: mockJupiterQuote,
        strategy: "defensive",
        amountLamports: 5_000_000_000, // Gros ordre
        slippageBps: 50,
        priceImpactPct: 1.5,
      });

      const twapIntent = intents.find(i => i.type === "twap_plan");
      expect(twapIntent).toBeDefined();
      expect(twapIntent?.slices).toBe(6); // Defensive = 6 tranches
    });

    it("devrait utiliser Jito pour le TWAP", () => {
      const intents = buildHybridIntents({
        quote: mockJupiterQuote,
        strategy: "defensive",
        amountLamports: 5_000_000_000,
        slippageBps: 50,
        priceImpactPct: 1.5,
      });

      const twapIntent = intents.find(i => i.type === "twap_plan");
      expect(twapIntent?.channel).toBe("jito");
    });
  });

  describe("Allocation dynamique avec quotes alternatifs", () => {
    const alternativeQuotes: QuoteResult[] = [
      {
        source: "jupiter",
        quote: mockJupiterQuote,
        latencyMs: 100,
        improvementBps: 0,
        netOutAmount: "150000000",
      },
      {
        source: "raydium",
        quote: { ...mockJupiterQuote, outAmount: "151500000" },
        latencyMs: 80,
        improvementBps: 100, // +1% vs Jupiter
        netOutAmount: "151400000",
      },
      {
        source: "orca",
        quote: { ...mockJupiterQuote, outAmount: "149500000" },
        latencyMs: 120,
        improvementBps: -33, // -0.33% vs Jupiter
        netOutAmount: "149400000",
      },
    ];

    it("devrait ajouter un DEX direct si meilleur que Jupiter", () => {
      const intents = buildHybridIntents({
        quote: mockJupiterQuote,
        strategy: "smart",
        amountLamports: 1_000_000_000,
        slippageBps: 50,
        priceImpactPct: 0.5,
        alternativeQuotes,
      });

      const dexIntent = intents.find(i => i.type === "dex_direct");
      expect(dexIntent).toBeDefined();
      expect(dexIntent?.dexSource).toBe("raydium");
      expect(dexIntent?.improvementBps).toBe(100);
    });

    it("devrait afficher l'amélioration dans la description", () => {
      const intents = buildHybridIntents({
        quote: mockJupiterQuote,
        strategy: "smart",
        amountLamports: 1_000_000_000,
        slippageBps: 50,
        priceImpactPct: 0.5,
        alternativeQuotes,
      });

      const dexIntent = intents.find(i => i.type === "dex_direct");
      expect(dexIntent?.description).toContain("+100 bps");
    });

    it("ne devrait pas ajouter de DEX si amélioration < 5 bps", () => {
      const lowImprovementQuotes: QuoteResult[] = [
        {
          source: "jupiter",
          quote: mockJupiterQuote,
          latencyMs: 100,
          improvementBps: 0,
        },
        {
          source: "raydium",
          quote: { ...mockJupiterQuote, outAmount: "150050000" },
          latencyMs: 80,
          improvementBps: 3, // Seulement +0.03%
        },
      ];

      const intents = buildHybridIntents({
        quote: mockJupiterQuote,
        strategy: "smart",
        amountLamports: 1_000_000_000,
        slippageBps: 50,
        priceImpactPct: 0.5,
        alternativeQuotes: lowImprovementQuotes,
      });

      const dexIntent = intents.find(i => i.type === "dex_direct");
      expect(dexIntent).toBeUndefined();
    });
  });

  describe("Types d'intents", () => {
    it("devrait supporter tous les types d'intent", () => {
      const types = ["jupiter_best", "twap_plan", "internal_liquidity", "dex_direct"];
      
      // Créer un scénario qui génère tous les types
      const alternativeQuotes: QuoteResult[] = [
        {
          source: "jupiter",
          quote: mockJupiterQuote,
          latencyMs: 100,
          improvementBps: 0,
        },
        {
          source: "meteora",
          quote: { ...mockJupiterQuote, outAmount: "152000000" },
          latencyMs: 90,
          improvementBps: 133,
        },
      ];

      const intents = buildHybridIntents({
        quote: mockJupiterQuote,
        strategy: "defensive",
        amountLamports: 5_000_000_000,
        slippageBps: 50,
        priceImpactPct: 2.0,
        alternativeQuotes,
      });

      const foundTypes = intents.map(i => i.type);
      expect(foundTypes).toContain("jupiter_best");
      expect(foundTypes).toContain("twap_plan");
      expect(foundTypes).toContain("internal_liquidity");
      expect(foundTypes).toContain("dex_direct");
    });
  });

  describe("IDs uniques", () => {
    it("devrait générer des IDs uniques pour chaque intent", () => {
      const intents = buildHybridIntents({
        quote: mockJupiterQuote,
        strategy: "smart",
        amountLamports: 1_000_000_000,
        slippageBps: 50,
        priceImpactPct: 0.5,
      });

      const ids = intents.map(i => i.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("ETA et canaux", () => {
    it("devrait avoir des ETA raisonnables", () => {
      const intents = buildHybridIntents({
        quote: mockJupiterQuote,
        strategy: "smart",
        amountLamports: 1_000_000_000,
        slippageBps: 50,
        priceImpactPct: 0.5,
      });

      for (const intent of intents) {
        expect(intent.etaSeconds).toBeGreaterThan(0);
        expect(intent.etaSeconds).toBeLessThan(300); // Max 5 minutes
      }
    });

    it("devrait utiliser les bons canaux", () => {
      const intents = buildHybridIntents({
        quote: mockJupiterQuote,
        strategy: "defensive",
        amountLamports: 5_000_000_000,
        slippageBps: 50,
        priceImpactPct: 2.0,
      });

      const channels = intents.map(i => i.channel);
      expect(channels).toContain("public");
      expect(channels).toContain("jito");
      expect(channels).toContain("private-rpc");
    });
  });
});
