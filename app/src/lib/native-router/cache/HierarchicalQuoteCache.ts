/**
 * 📦 Hierarchical Quote Cache
 * 
 * Cache multi-niveau pour les quotes de swap:
 * - L1: Cache mémoire ultra-rapide (100ms TTL) pour requêtes répétées
 * - L2: Cache de session (5s TTL) pour rafraîchissements fréquents
 * - L3: Cache persistant (30s TTL) pour fallback
 * 
 * Stratégie de récupération:
 * 1. Vérifier le cache (instantané)
 * 2. Récupérer en parallèle depuis toutes les venues
 * 3. Mettre en cache le résultat
 * 
 * @author SwapBack Team
 * @date January 2025
 */

import { VenueQuote, NativeRouteQuote } from "../headless/router";

// ============================================================================
// TYPES
// ============================================================================

export interface CachedQuote {
  quote: VenueQuote;
  timestamp: number;
  source: 'api' | 'estimated' | 'cached';
  ttl: number;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hitCount: number;
}

export interface QuoteCacheStats {
  l1Hits: number;
  l1Misses: number;
  l2Hits: number;
  l2Misses: number;
  l3Hits: number;
  l3Misses: number;
  totalRequests: number;
  avgLatencyMs: number;
}

export interface QuoteFetchResult {
  quotes: VenueQuote[];
  fromCache: boolean;
  cacheLevel: 'L1' | 'L2' | 'L3' | 'MISS';
  latencyMs: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// TTLs par niveau de cache
const L1_TTL_MS = 100;   // 100ms - pour requêtes répétées rapides
const L2_TTL_MS = 5000;  // 5s - pour rafraîchissements utilisateur
const L3_TTL_MS = 30000; // 30s - fallback en cas d'erreur API

// Taille max des caches
const L1_MAX_SIZE = 50;
const L2_MAX_SIZE = 200;
const L3_MAX_SIZE = 500;

// Refresh en arrière-plan si cache à X% de son TTL
const STALE_WHILE_REVALIDATE_THRESHOLD = 0.7;

// ============================================================================
// LRU CACHE IMPLEMENTATION
// ============================================================================

class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private readonly maxSize: number;
  
  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }
  
  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }
  
  set(key: K, value: V): void {
    // Delete if exists (to update position)
    this.cache.delete(key);
    
    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, value);
  }
  
  delete(key: K): boolean {
    return this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  get size(): number {
    return this.cache.size;
  }
  
  keys(): IterableIterator<K> {
    return this.cache.keys();
  }
}

// ============================================================================
// HIERARCHICAL CACHE
// ============================================================================

export class HierarchicalQuoteCache {
  private l1Cache: LRUCache<string, CacheEntry<VenueQuote[]>>;
  private l2Cache: LRUCache<string, CacheEntry<VenueQuote[]>>;
  private l3Cache: LRUCache<string, CacheEntry<VenueQuote[]>>;
  private routeCache: LRUCache<string, CacheEntry<NativeRouteQuote>>;
  
  private stats: QuoteCacheStats = {
    l1Hits: 0,
    l1Misses: 0,
    l2Hits: 0,
    l2Misses: 0,
    l3Hits: 0,
    l3Misses: 0,
    totalRequests: 0,
    avgLatencyMs: 0,
  };
  
  private pendingFetches: Map<string, Promise<VenueQuote[]>> = new Map();
  private totalLatency = 0;
  
  constructor() {
    this.l1Cache = new LRUCache(L1_MAX_SIZE);
    this.l2Cache = new LRUCache(L2_MAX_SIZE);
    this.l3Cache = new LRUCache(L3_MAX_SIZE);
    this.routeCache = new LRUCache(L2_MAX_SIZE);
  }
  
  /**
   * Génère une clé de cache pour une paire + montant
   */
  private getCacheKey(inputMint: string, outputMint: string, amount: number): string {
    // Bucket par montant (même quote pour montants proches)
    const amountBucket = Math.floor(amount / 1_000_000) * 1_000_000;
    return `${inputMint}:${outputMint}:${amountBucket}`;
  }
  
  /**
   * Récupère les quotes depuis le cache
   */
  get(inputMint: string, outputMint: string, amount: number): QuoteFetchResult | null {
    const key = this.getCacheKey(inputMint, outputMint, amount);
    const now = Date.now();
    this.stats.totalRequests++;
    
    // Vérifier L1 (ultra-rapide)
    const l1Entry = this.l1Cache.get(key);
    if (l1Entry && now - l1Entry.timestamp < l1Entry.ttl) {
      this.stats.l1Hits++;
      l1Entry.hitCount++;
      return {
        quotes: l1Entry.data,
        fromCache: true,
        cacheLevel: 'L1',
        latencyMs: 0,
      };
    }
    this.stats.l1Misses++;
    
    // Vérifier L2 (session)
    const l2Entry = this.l2Cache.get(key);
    if (l2Entry && now - l2Entry.timestamp < l2Entry.ttl) {
      this.stats.l2Hits++;
      l2Entry.hitCount++;
      
      // Promouvoir vers L1
      this.l1Cache.set(key, {
        data: l2Entry.data,
        timestamp: now,
        ttl: L1_TTL_MS,
        hitCount: 0,
      });
      
      return {
        quotes: l2Entry.data,
        fromCache: true,
        cacheLevel: 'L2',
        latencyMs: 0,
      };
    }
    this.stats.l2Misses++;
    
    // Vérifier L3 (fallback)
    const l3Entry = this.l3Cache.get(key);
    if (l3Entry && now - l3Entry.timestamp < l3Entry.ttl) {
      this.stats.l3Hits++;
      l3Entry.hitCount++;
      
      // Promouvoir vers L2 et L1
      this.l2Cache.set(key, {
        data: l3Entry.data,
        timestamp: now,
        ttl: L2_TTL_MS,
        hitCount: 0,
      });
      
      return {
        quotes: l3Entry.data,
        fromCache: true,
        cacheLevel: 'L3',
        latencyMs: 0,
      };
    }
    this.stats.l3Misses++;
    
    return null;
  }
  
  /**
   * Stocke les quotes dans tous les niveaux de cache
   */
  set(inputMint: string, outputMint: string, amount: number, quotes: VenueQuote[]): void {
    const key = this.getCacheKey(inputMint, outputMint, amount);
    const now = Date.now();
    
    // Stocker dans tous les niveaux
    this.l1Cache.set(key, {
      data: quotes,
      timestamp: now,
      ttl: L1_TTL_MS,
      hitCount: 0,
    });
    
    this.l2Cache.set(key, {
      data: quotes,
      timestamp: now,
      ttl: L2_TTL_MS,
      hitCount: 0,
    });
    
    this.l3Cache.set(key, {
      data: quotes,
      timestamp: now,
      ttl: L3_TTL_MS,
      hitCount: 0,
    });
  }
  
  /**
   * Récupère une route complète depuis le cache
   */
  getRoute(inputMint: string, outputMint: string, amount: number): NativeRouteQuote | null {
    const key = this.getCacheKey(inputMint, outputMint, amount);
    const now = Date.now();
    
    const entry = this.routeCache.get(key);
    if (entry && now - entry.timestamp < entry.ttl) {
      entry.hitCount++;
      return entry.data;
    }
    
    return null;
  }
  
  /**
   * Stocke une route dans le cache
   */
  setRoute(inputMint: string, outputMint: string, amount: number, route: NativeRouteQuote): void {
    const key = this.getCacheKey(inputMint, outputMint, amount);
    this.routeCache.set(key, {
      data: route,
      timestamp: Date.now(),
      ttl: L2_TTL_MS,
      hitCount: 0,
    });
  }
  
  /**
   * Vérifie si une entrée doit être rafraîchie en arrière-plan
   */
  shouldRevalidate(inputMint: string, outputMint: string, amount: number): boolean {
    const key = this.getCacheKey(inputMint, outputMint, amount);
    const now = Date.now();
    
    const l2Entry = this.l2Cache.get(key);
    if (!l2Entry) return true;
    
    const age = now - l2Entry.timestamp;
    const threshold = l2Entry.ttl * STALE_WHILE_REVALIDATE_THRESHOLD;
    
    return age > threshold;
  }
  
  /**
   * Gère les requêtes concurrentes pour éviter les duplications
   */
  async getOrFetch(
    inputMint: string,
    outputMint: string,
    amount: number,
    fetchFn: () => Promise<VenueQuote[]>
  ): Promise<QuoteFetchResult> {
    const startTime = Date.now();
    
    // Vérifier le cache
    const cached = this.get(inputMint, outputMint, amount);
    if (cached) {
      // Revalider en arrière-plan si stale
      if (this.shouldRevalidate(inputMint, outputMint, amount)) {
        this.revalidateInBackground(inputMint, outputMint, amount, fetchFn);
      }
      return cached;
    }
    
    // Vérifier si une requête est déjà en cours
    const key = this.getCacheKey(inputMint, outputMint, amount);
    const pending = this.pendingFetches.get(key);
    if (pending) {
      const quotes = await pending;
      const latencyMs = Date.now() - startTime;
      return { quotes, fromCache: false, cacheLevel: 'MISS', latencyMs };
    }
    
    // Lancer la requête
    const fetchPromise = fetchFn();
    this.pendingFetches.set(key, fetchPromise);
    
    try {
      const quotes = await fetchPromise;
      const latencyMs = Date.now() - startTime;
      
      // Mettre en cache
      this.set(inputMint, outputMint, amount, quotes);
      
      // Mettre à jour les stats
      this.totalLatency += latencyMs;
      this.stats.avgLatencyMs = this.totalLatency / this.stats.totalRequests;
      
      return { quotes, fromCache: false, cacheLevel: 'MISS', latencyMs };
    } finally {
      this.pendingFetches.delete(key);
    }
  }
  
  /**
   * Revalide le cache en arrière-plan (stale-while-revalidate)
   */
  private async revalidateInBackground(
    inputMint: string,
    outputMint: string,
    amount: number,
    fetchFn: () => Promise<VenueQuote[]>
  ): Promise<void> {
    const key = `revalidate:${this.getCacheKey(inputMint, outputMint, amount)}`;
    
    // Éviter les revalidations multiples
    if (this.pendingFetches.has(key)) return;
    
    const fetchPromise = fetchFn();
    this.pendingFetches.set(key, fetchPromise);
    
    try {
      const quotes = await fetchPromise;
      this.set(inputMint, outputMint, amount, quotes);
    } catch {
      // Silencieux - le cache stale reste utilisable
    } finally {
      this.pendingFetches.delete(key);
    }
  }
  
  /**
   * Invalide le cache pour une paire
   */
  invalidate(inputMint: string, outputMint: string, amount?: number): void {
    if (amount !== undefined) {
      const key = this.getCacheKey(inputMint, outputMint, amount);
      this.l1Cache.delete(key);
      this.l2Cache.delete(key);
      this.l3Cache.delete(key);
      this.routeCache.delete(key);
    } else {
      // Invalider tous les montants pour cette paire
      const prefix = `${inputMint}:${outputMint}:`;
      for (const key of this.l1Cache.keys()) {
        if (key.startsWith(prefix)) {
          this.l1Cache.delete(key);
        }
      }
      for (const key of this.l2Cache.keys()) {
        if (key.startsWith(prefix)) {
          this.l2Cache.delete(key);
        }
      }
      for (const key of this.l3Cache.keys()) {
        if (key.startsWith(prefix)) {
          this.l3Cache.delete(key);
        }
      }
      for (const key of this.routeCache.keys()) {
        if (key.startsWith(prefix)) {
          this.routeCache.delete(key);
        }
      }
    }
  }
  
  /**
   * Retourne les statistiques du cache
   */
  getStats(): QuoteCacheStats {
    return { ...this.stats };
  }
  
  /**
   * Réinitialise les statistiques
   */
  resetStats(): void {
    this.stats = {
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
      l3Hits: 0,
      l3Misses: 0,
      totalRequests: 0,
      avgLatencyMs: 0,
    };
    this.totalLatency = 0;
  }
  
  /**
   * Vide tous les caches
   */
  clear(): void {
    this.l1Cache.clear();
    this.l2Cache.clear();
    this.l3Cache.clear();
    this.routeCache.clear();
    this.pendingFetches.clear();
    this.resetStats();
  }
  
  /**
   * Retourne les tailles des caches
   */
  getSizes(): { l1: number; l2: number; l3: number; routes: number } {
    return {
      l1: this.l1Cache.size,
      l2: this.l2Cache.size,
      l3: this.l3Cache.size,
      routes: this.routeCache.size,
    };
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let cacheInstance: HierarchicalQuoteCache | null = null;

export function getQuoteCache(): HierarchicalQuoteCache {
  if (!cacheInstance) {
    cacheInstance = new HierarchicalQuoteCache();
  }
  return cacheInstance;
}

export default HierarchicalQuoteCache;
