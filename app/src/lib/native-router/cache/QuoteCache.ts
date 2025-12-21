/**
 * 🔄 Quote Cache with Short TTL
 *
 * Implémente un cache de quotes avec TTL court (500ms par défaut)
 * pour améliorer la latence tout en gardant les quotes fraîches.
 *
 * Inspiré de Jupiter qui cache les quotes ~100-500ms.
 *
 * @see https://station.jup.ag/docs/apis/swap-api
 * @author SwapBack Team
 * @date December 21, 2025
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CachedQuote {
  /** Venue source */
  venue: string;
  /** Montant d'entrée */
  inputAmount: number;
  /** Montant de sortie */
  outputAmount: number;
  /** Price impact en bps */
  priceImpactBps: number;
  /** Source: api | sdk | estimated */
  source: 'api' | 'sdk' | 'estimated';
  /** Timestamp de création */
  timestamp: number;
  /** TTL en ms */
  ttlMs: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  currentSize: number;
  hitRate: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** TTL par défaut: 500ms (comme Jupiter) */
export const DEFAULT_TTL_MS = 500;

/** TTL court pour tokens volatils: 200ms */
export const VOLATILE_TTL_MS = 200;

/** TTL long pour stablecoins: 1000ms */
export const STABLE_TTL_MS = 1000;

/** Taille maximale du cache */
const MAX_CACHE_SIZE = 1000;

/** Intervalle de nettoyage (10 secondes) */
const CLEANUP_INTERVAL_MS = 10_000;

// ============================================================================
// STABLECOIN DETECTION
// ============================================================================

const STABLECOIN_MINTS = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  'USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX',  // USDH
  '7kbnvuGBxxj8AG9qp8Scn56muWGaRaFqxg1FsRp3PaFT', // UXD
]);

const VOLATILE_MINTS = new Set([
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
  'A8C3xuqscfmyLrQ3HXXJvTXjEkuiMnUk9Hs8kNnALN7e', // SAMO
]);

function isStablecoinPair(inputMint: string, outputMint: string): boolean {
  return STABLECOIN_MINTS.has(inputMint) && STABLECOIN_MINTS.has(outputMint);
}

function isVolatilePair(inputMint: string, outputMint: string): boolean {
  return VOLATILE_MINTS.has(inputMint) || VOLATILE_MINTS.has(outputMint);
}

function getTTLForPair(inputMint: string, outputMint: string): number {
  if (isStablecoinPair(inputMint, outputMint)) {
    return STABLE_TTL_MS;
  }
  if (isVolatilePair(inputMint, outputMint)) {
    return VOLATILE_TTL_MS;
  }
  return DEFAULT_TTL_MS;
}

// ============================================================================
// CACHE KEY GENERATION
// ============================================================================

function getCacheKey(
  venue: string,
  inputMint: string,
  outputMint: string,
  amount: number
): string {
  // Round amount to reduce cache fragmentation
  // Use 3 significant digits for amounts
  const roundedAmount = Math.round(amount / 1000) * 1000;
  return `${venue}:${inputMint}:${outputMint}:${roundedAmount}`;
}

// ============================================================================
// QUOTE CACHE CLASS
// ============================================================================

export class QuoteCache {
  private cache: Map<string, CachedQuote> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    currentSize: 0,
    hitRate: 0,
  };
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Récupère une quote du cache si elle est encore valide
   */
  get(
    venue: string,
    inputMint: string,
    outputMint: string,
    amount: number
  ): CachedQuote | null {
    const key = getCacheKey(venue, inputMint, outputMint, amount);
    const cached = this.cache.get(key);

    if (!cached) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - cached.timestamp > cached.ttlMs) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      this.updateStats();
      return null;
    }

    this.stats.hits++;
    this.updateHitRate();
    return cached;
  }

  /**
   * Stocke une quote dans le cache
   */
  set(
    venue: string,
    inputMint: string,
    outputMint: string,
    amount: number,
    outputAmount: number,
    priceImpactBps: number,
    source: 'api' | 'sdk' | 'estimated'
  ): void {
    const key = getCacheKey(venue, inputMint, outputMint, amount);
    const ttlMs = getTTLForPair(inputMint, outputMint);

    // Evict oldest entries if cache is full
    if (this.cache.size >= MAX_CACHE_SIZE) {
      this.evictOldest();
    }

    const quote: CachedQuote = {
      venue,
      inputAmount: amount,
      outputAmount,
      priceImpactBps,
      source,
      timestamp: Date.now(),
      ttlMs,
    };

    this.cache.set(key, quote);
    this.updateStats();
  }

  /**
   * Récupère une quote du cache ou exécute le fetcher si absente/expirée
   */
  async getOrFetch(
    venue: string,
    inputMint: string,
    outputMint: string,
    amount: number,
    fetcher: () => Promise<{ outputAmount: number; priceImpactBps: number; source: 'api' | 'sdk' | 'estimated' } | null>
  ): Promise<CachedQuote | null> {
    // Try cache first
    const cached = this.get(venue, inputMint, outputMint, amount);
    if (cached) {
      return cached;
    }

    // Fetch fresh quote
    try {
      const result = await fetcher();
      if (result && result.outputAmount > 0) {
        this.set(
          venue,
          inputMint,
          outputMint,
          amount,
          result.outputAmount,
          result.priceImpactBps,
          result.source
        );
        return this.get(venue, inputMint, outputMint, amount);
      }
    } catch (error) {
      console.error(`[QuoteCache] Fetch error for ${venue}:`, error);
    }

    return null;
  }

  /**
   * Invalide toutes les quotes pour une paire
   */
  invalidatePair(inputMint: string, outputMint: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.includes(inputMint) && key.includes(outputMint)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.stats.evictions++;
    }

    this.updateStats();
  }

  /**
   * Vide le cache
   */
  clear(): void {
    this.cache.clear();
    this.stats.evictions += this.stats.currentSize;
    this.updateStats();
  }

  /**
   * Retourne les statistiques du cache
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Arrête le timer de nettoyage
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, CLEANUP_INTERVAL_MS);
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, quote] of this.cache.entries()) {
      if (now - quote.timestamp > quote.ttlMs) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.stats.evictions++;
    }

    this.updateStats();
  }

  private evictOldest(): void {
    // Find oldest entry
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, quote] of this.cache.entries()) {
      if (quote.timestamp < oldestTime) {
        oldestTime = quote.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  private updateStats(): void {
    this.stats.currentSize = this.cache.size;
    this.updateHitRate();
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalQuoteCache: QuoteCache | null = null;

/**
 * Récupère l'instance singleton du cache
 */
export function getQuoteCache(): QuoteCache {
  if (!globalQuoteCache) {
    globalQuoteCache = new QuoteCache();
  }
  return globalQuoteCache;
}

/**
 * Réinitialise le cache (pour les tests)
 */
export function resetQuoteCache(): void {
  if (globalQuoteCache) {
    globalQuoteCache.destroy();
    globalQuoteCache = null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  QuoteCache,
  getQuoteCache,
  resetQuoteCache,
  DEFAULT_TTL_MS,
  VOLATILE_TTL_MS,
  STABLE_TTL_MS,
};
