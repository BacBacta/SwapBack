/**
 * Quote Cache avec Prédiction
 * Réduit la latence en pré-cachant les quotes populaires
 */

import type { JupiterQuoteResponse } from "@/types/router";

interface CachedQuote {
  quote: JupiterQuoteResponse;
  timestamp: number;
  hits: number;
}

interface QuoteCacheConfig {
  /** TTL en ms (défaut: 2000ms pour quotes volatiles) */
  ttlMs: number;
  /** Taille max du cache */
  maxSize: number;
  /** Seuil de hits pour prédiction */
  predictionThreshold: number;
  /** Intervalle de refresh prédictif */
  predictionRefreshMs: number;
}

const DEFAULT_CONFIG: QuoteCacheConfig = {
  ttlMs: 2000, // 2 secondes - quotes très frais
  maxSize: 100,
  predictionThreshold: 3,
  predictionRefreshMs: 1500,
};

// Paires les plus tradées sur Solana
const HOT_PAIRS = [
  { input: "So11111111111111111111111111111111111111112", output: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" }, // SOL/USDC
  { input: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", output: "So11111111111111111111111111111111111111112" }, // USDC/SOL
  { input: "So11111111111111111111111111111111111111112", output: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" }, // SOL/USDT
  { input: "So11111111111111111111111111111111111111112", output: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" }, // SOL/JUP
];

type QuoteFetcher = (inputMint: string, outputMint: string, amount: number) => Promise<JupiterQuoteResponse>;

export class QuoteCache {
  private cache = new Map<string, CachedQuote>();
  private config: QuoteCacheConfig;
  private fetcher: QuoteFetcher | null = null;
  private predictionInterval: NodeJS.Timeout | null = null;
  private pairStats = new Map<string, { hits: number; lastAmount: number }>();

  constructor(config: Partial<QuoteCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private makeKey(inputMint: string, outputMint: string, amount: number): string {
    // Bucket amounts pour améliorer hit rate (±5%)
    const bucketedAmount = Math.round(amount / 0.05) * 0.05;
    return `${inputMint}:${outputMint}:${bucketedAmount.toFixed(2)}`;
  }

  private makePairKey(inputMint: string, outputMint: string): string {
    return `${inputMint}:${outputMint}`;
  }

  /**
   * Configure le fetcher pour le refresh prédictif
   */
  setFetcher(fetcher: QuoteFetcher): void {
    this.fetcher = fetcher;
  }

  /**
   * Récupère un quote du cache si valide
   */
  get(inputMint: string, outputMint: string, amount: number): JupiterQuoteResponse | null {
    const key = this.makeKey(inputMint, outputMint, amount);
    const cached = this.cache.get(key);

    if (!cached) {
      this.recordMiss(inputMint, outputMint, amount);
      return null;
    }

    const age = Date.now() - cached.timestamp;
    if (age > this.config.ttlMs) {
      this.cache.delete(key);
      this.recordMiss(inputMint, outputMint, amount);
      return null;
    }

    cached.hits++;
    return cached.quote;
  }

  /**
   * Stocke un quote dans le cache
   */
  set(inputMint: string, outputMint: string, amount: number, quote: JupiterQuoteResponse): void {
    const key = this.makeKey(inputMint, outputMint, amount);

    // Éviction LRU si cache plein
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      quote,
      timestamp: Date.now(),
      hits: 1,
    });
  }

  private recordMiss(inputMint: string, outputMint: string, amount: number): void {
    const pairKey = this.makePairKey(inputMint, outputMint);
    const stats = this.pairStats.get(pairKey) || { hits: 0, lastAmount: 0 };
    stats.hits++;
    stats.lastAmount = amount;
    this.pairStats.set(pairKey, stats);
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, cached] of this.cache) {
      if (cached.timestamp < oldestTime) {
        oldestTime = cached.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Démarre le refresh prédictif des paires populaires
   */
  startPredictiveRefresh(): void {
    if (this.predictionInterval || !this.fetcher) return;

    this.predictionInterval = setInterval(async () => {
      await this.refreshHotPairs();
      await this.refreshPredictedPairs();
    }, this.config.predictionRefreshMs);

    // Refresh initial immédiat
    this.refreshHotPairs();
  }

  /**
   * Arrête le refresh prédictif
   */
  stopPredictiveRefresh(): void {
    if (this.predictionInterval) {
      clearInterval(this.predictionInterval);
      this.predictionInterval = null;
    }
  }

  private async refreshHotPairs(): Promise<void> {
    if (!this.fetcher) return;

    const amounts = [0.1, 1, 10, 100]; // Montants typiques

    for (const pair of HOT_PAIRS) {
      for (const amount of amounts) {
        try {
          const quote = await this.fetcher(pair.input, pair.output, amount);
          this.set(pair.input, pair.output, amount, quote);
        } catch {
          // Ignore les erreurs de prefetch
        }
      }
    }
  }

  private async refreshPredictedPairs(): Promise<void> {
    if (!this.fetcher) return;

    // Refresh les paires avec beaucoup de hits
    for (const [pairKey, stats] of this.pairStats) {
      if (stats.hits >= this.config.predictionThreshold) {
        const [inputMint, outputMint] = pairKey.split(":");
        try {
          const quote = await this.fetcher(inputMint, outputMint, stats.lastAmount);
          this.set(inputMint, outputMint, stats.lastAmount, quote);
        } catch {
          // Ignore
        }
      }
    }
  }

  /**
   * Statistiques du cache
   */
  getStats(): { size: number; hitRate: number; hotPairs: string[] } {
    let totalHits = 0;
    for (const cached of this.cache.values()) {
      totalHits += cached.hits;
    }

    const hotPairs = Array.from(this.pairStats.entries())
      .filter(([, stats]) => stats.hits >= this.config.predictionThreshold)
      .map(([pair]) => pair);

    return {
      size: this.cache.size,
      hitRate: this.cache.size > 0 ? totalHits / this.cache.size : 0,
      hotPairs,
    };
  }

  /**
   * Vide le cache
   */
  clear(): void {
    this.cache.clear();
    this.pairStats.clear();
    this.clearPersistentStorage();
  }

  /**
   * Persiste les statistiques des paires dans localStorage
   * (pour reprendre le warm-up après refresh)
   */
  persistPairStats(): void {
    if (typeof window === "undefined") return;
    try {
      const stats = Array.from(this.pairStats.entries()).slice(0, 50); // Max 50 paires
      localStorage.setItem("swapback_pair_stats", JSON.stringify(stats));
    } catch {
      // localStorage plein ou non disponible
    }
  }

  /**
   * Restaure les statistiques des paires depuis localStorage
   */
  restorePairStats(): void {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("swapback_pair_stats");
      if (stored) {
        const stats = JSON.parse(stored) as Array<[string, { hits: number; lastAmount: number }]>;
        for (const [key, value] of stats) {
          this.pairStats.set(key, value);
        }
      }
    } catch {
      // Ignore les erreurs de parsing
    }
  }

  /**
   * Efface le stockage persistant
   */
  private clearPersistentStorage(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem("swapback_pair_stats");
    } catch {
      // Ignore
    }
  }

  /**
   * Persiste les quotes chauds pour un démarrage rapide
   */
  persistHotQuotes(): void {
    if (typeof window === "undefined") return;
    try {
      const hotQuotes: Array<[string, CachedQuote]> = [];
      for (const [key, cached] of this.cache) {
        if (cached.hits >= 2) {
          hotQuotes.push([key, cached]);
        }
      }
      // Limiter à 20 quotes max
      const limited = hotQuotes.slice(0, 20);
      localStorage.setItem("swapback_hot_quotes", JSON.stringify(limited));
    } catch {
      // localStorage plein
    }
  }

  /**
   * Restaure les quotes chauds depuis localStorage
   * (utile pour le premier chargement)
   */
  restoreHotQuotes(): void {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("swapback_hot_quotes");
      if (stored) {
        const quotes = JSON.parse(stored) as Array<[string, CachedQuote]>;
        const now = Date.now();
        for (const [key, cached] of quotes) {
          // Ne restaurer que si moins de 30 secondes (quotes stale OK pour affichage initial)
          if (now - cached.timestamp < 30000) {
            this.cache.set(key, { ...cached, timestamp: now - 1500 }); // Marqué comme proche expiration
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Initialise le cache avec persistance
   */
  initWithPersistence(): void {
    this.restorePairStats();
    this.restoreHotQuotes();
    
    // Persister périodiquement
    if (typeof window !== "undefined") {
      setInterval(() => {
        this.persistPairStats();
        this.persistHotQuotes();
      }, 10000); // Toutes les 10 secondes
    }
  }
}

// Singleton global
let globalQuoteCache: QuoteCache | null = null;

export function getQuoteCache(): QuoteCache {
  if (!globalQuoteCache) {
    globalQuoteCache = new QuoteCache();
    globalQuoteCache.initWithPersistence();
  }
  return globalQuoteCache;
}
