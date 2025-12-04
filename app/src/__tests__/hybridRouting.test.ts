/**
 * Tests: Hybrid Routing
 */
import { describe, it, expect } from "vitest";
import { buildHybridIntents, type RoutingStrategy } from "@/lib/routing/hybridRouting";

const mockQuote = {
  inputMint: "So11111111111111111111111111111111111111112",
  outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  inAmount: "1000000000",
  outAmount: "50000000",
  otherAmountThreshold: "49500000",
  swapMode: "ExactIn",
  priceImpactPct: "0.5",
  routePlan: [],
};

describe("buildHybridIntents", () => {
  it("returns at least one jupiter intent", () => {
    const intents = buildHybridIntents({
      quote: mockQuote as any,
      strategy: "smart",
      amountLamports: 1_000_000_000,
      slippageBps: 50,
      priceImpactPct: 0.5,
    });
    expect(intents.length).toBeGreaterThanOrEqual(1);
    expect(intents.some((i) => i.type === "jupiter_best")).toBe(true);
  });

  it("adds twap plan when impact > 1%", () => {
    const intents = buildHybridIntents({
      quote: mockQuote as any,
      strategy: "smart",
      amountLamports: 1_000_000_000,
      slippageBps: 50,
      priceImpactPct: 1.5,
    });
    expect(intents.some((i) => i.type === "twap_plan")).toBe(true);
  });

  it("aggressive strategy uses 100% jupiter", () => {
    const intents = buildHybridIntents({
      quote: mockQuote as any,
      strategy: "aggressive",
      amountLamports: 500_000_000,
      slippageBps: 100,
      priceImpactPct: 0.2,
    });
    const jupIntent = intents.find((i) => i.type === "jupiter_best");
    expect(jupIntent).toBeDefined();
    expect(jupIntent!.percentage).toBe(1);
  });

  it("defensive strategy adds more twap slices", () => {
    const intents = buildHybridIntents({
      quote: mockQuote as any,
      strategy: "defensive",
      amountLamports: 3_000_000_000,
      slippageBps: 50,
      priceImpactPct: 2,
    });
    const twapIntent = intents.find((i) => i.type === "twap_plan");
    expect(twapIntent).toBeDefined();
    expect(twapIntent!.slices).toBeGreaterThanOrEqual(5);
  });

  it("percentages sum to 1", () => {
    const intents = buildHybridIntents({
      quote: mockQuote as any,
      strategy: "smart",
      amountLamports: 2_500_000_000,
      slippageBps: 50,
      priceImpactPct: 1.2,
    });
    const sum = intents.reduce((acc, i) => acc + i.percentage, 0);
    expect(sum).toBeCloseTo(1, 1);
  });
});
