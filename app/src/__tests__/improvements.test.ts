import { describe, it, expect, beforeEach, vi } from "vitest";
import { QuoteCache } from "@/lib/cache/quoteCache";
import { HealthMonitor } from "@/lib/monitoring/healthMonitor";
import { MultiSourceQuoteAggregator } from "@/lib/quotes/multiSourceAggregator";
// DEFERRED: InternalLiquidityPool sera développé plus tard
// import { InternalLiquidityPool } from "@/lib/liquidity/internalPool";

describe("QuoteCache", () => {
  let cache: QuoteCache;

  beforeEach(() => {
    cache = new QuoteCache({ ttlMs: 1000 });
  });

  it("devrait stocker et récupérer un quote", () => {
    const quote = {
      inputMint: "SOL",
      outputMint: "USDC",
      inAmount: "1000000000",
      outAmount: "180000000",
      otherAmountThreshold: "178000000",
      priceImpactPct: "0.1",
      routePlan: [],
      contextSlot: 0,
      timeTaken: 0,
    };

    cache.set("SOL", "USDC", 1, quote);
    const cached = cache.get("SOL", "USDC", 1);
    
    expect(cached).not.toBeNull();
    expect(cached?.outAmount).toBe("180000000");
  });

  it("devrait expirer après TTL", async () => {
    const quote = {
      inputMint: "SOL",
      outputMint: "USDC",
      inAmount: "1000000000",
      outAmount: "180000000",
      otherAmountThreshold: "178000000",
      priceImpactPct: "0.1",
      routePlan: [],
      contextSlot: 0,
      timeTaken: 0,
    };

    cache.set("SOL", "USDC", 1, quote);
    
    // Attendre expiration
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    const cached = cache.get("SOL", "USDC", 1);
    expect(cached).toBeNull();
  });

  it("devrait retourner des stats correctes", () => {
    const quote = {
      inputMint: "SOL",
      outputMint: "USDC",
      inAmount: "1000000000",
      outAmount: "180000000",
      otherAmountThreshold: "178000000",
      priceImpactPct: "0.1",
      routePlan: [],
      contextSlot: 0,
      timeTaken: 0,
    };

    cache.set("SOL", "USDC", 1, quote);
    cache.get("SOL", "USDC", 1);
    cache.get("SOL", "USDC", 1);
    
    const stats = cache.getStats();
    expect(stats.size).toBe(1);
    expect(stats.hitRate).toBeGreaterThan(0);
  });
});

describe("HealthMonitor", () => {
  let monitor: HealthMonitor;

  beforeEach(() => {
    monitor = new HealthMonitor({ checkIntervalMs: 60000 });
  });

  it("devrait enregistrer un service", () => {
    monitor.registerService("test-service", async () => ({
      ok: true,
      latencyMs: 50,
    }));

    // Service enregistré, pas encore de health
    const health = monitor.getLastHealth();
    expect(health).toBeNull();
  });

  it("devrait vérifier la santé d'un service", async () => {
    monitor.registerService("test-service", async () => ({
      ok: true,
      latencyMs: 50,
    }), { critical: true });

    const health = await monitor.checkAll();
    
    expect(health.overall).toBe("healthy");
    expect(health.services).toHaveLength(1);
    expect(health.services[0].status).toBe("healthy");
    // La latence mesurée peut être différente de celle retournée par le checker
    expect(health.services[0].latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("devrait détecter un service down", async () => {
    monitor.registerService("failing-service", async () => ({
      ok: false,
      latencyMs: 100,
      message: "Service error",
    }), { critical: true });

    const health = await monitor.checkAll();
    
    expect(health.overall).toBe("down");
    expect(health.services[0].status).toBe("down");
  });

  it("devrait détecter un service dégradé (latence)", async () => {
    // Créer un monitor avec un seuil très bas pour forcer la dégradation
    const strictMonitor = new HealthMonitor({ 
      checkIntervalMs: 60000,
      latencyThresholdMs: 1, // 1ms seuil très bas
    });
    
    strictMonitor.registerService("slow-service", async () => {
      // Simuler une latence en attendant
      await new Promise(resolve => setTimeout(resolve, 10));
      return { ok: true, latencyMs: 10 };
    });

    const health = await strictMonitor.checkAll();
    
    expect(health.services[0].status).toBe("degraded");
  });

  it("devrait notifier les listeners", async () => {
    const listener = vi.fn();
    monitor.onHealthChange(listener);

    monitor.registerService("test", async () => ({ ok: true, latencyMs: 10 }));
    await monitor.checkAll();

    expect(listener).toHaveBeenCalled();
  });
});

describe("MultiSourceQuoteAggregator", () => {
  it("devrait lister les sources", () => {
    const aggregator = new MultiSourceQuoteAggregator();
    const sources = aggregator.getSourceStats();
    
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.some(s => s.name === "jupiter")).toBe(true);
  });

  it("devrait permettre de désactiver une source", () => {
    const aggregator = new MultiSourceQuoteAggregator();
    aggregator.setSourceEnabled("raydium", false);
    
    const sources = aggregator.getSourceStats();
    const raydium = sources.find(s => s.name === "raydium");
    
    expect(raydium?.enabled).toBe(false);
  });
});

// ============================================================================
// DEFERRED: InternalLiquidityPool - Fonctionnalité mise en suspend
// Sera développée dans une version ultérieure
// ============================================================================
// describe("InternalLiquidityPool", () => { ... });

