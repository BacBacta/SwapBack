/**
 * 🚀 RPC Cache System - Optimisation des requêtes blockchain
 *
 * Système de cache intelligent pour:
 * - Réduire les requêtes RPC
 * - Améliorer les performances
 * - Gestion TTL et invalidation
 * - Support WebSocket pour real-time updates
 *
 * @author SwapBack Team
 * @date October 26, 2025
 */

import { Connection, PublicKey, AccountInfo } from "@solana/web3.js";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface CacheConfig {
  defaultTTL?: number;
  maxSize?: number;
  enableWebSocket?: boolean;
}

type CacheKey = string;

export class RPCCache {
  private cache: Map<CacheKey, CacheEntry<unknown>>;
  private connection: Connection;
  private config: Required<CacheConfig>;
  private subscriptions: Map<string, number>;

  constructor(connection: Connection, config: CacheConfig = {}) {
    this.connection = connection;
    this.cache = new Map();
    this.subscriptions = new Map();
    this.config = {
      defaultTTL: config.defaultTTL || 30_000, // 30 seconds par défaut
      maxSize: config.maxSize || 1000,
      enableWebSocket: config.enableWebSocket ?? true,
    };

    // Nettoyage périodique du cache
    setInterval(() => this.cleanup(), 60_000); // Chaque minute
  }

  /**
   * Génère une clé de cache unique
   */
  private generateKey(method: string, ...args: unknown[]): CacheKey {
    return `${method}:${JSON.stringify(args)}`;
  }

  /**
   * Récupère une entrée du cache
   */
  private get<T>(key: CacheKey): T | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    const now = Date.now();
    const isExpired = now - entry.timestamp > entry.ttl;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Ajoute une entrée au cache
   */
  private set<T>(key: CacheKey, data: T, ttl?: number): void {
    // Si le cache est plein, supprimer les plus anciennes entrées
    if (this.cache.size >= this.config.maxSize) {
      const oldestKeys = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, 100)
        .map(([key]) => key);

      oldestKeys.forEach((key) => this.cache.delete(key));
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
    });
  }

  /**
   * Invalide les entrées du cache par pattern
   */
  public invalidate(pattern: string): void {
    const keysToDelete: CacheKey[] = [];

    Array.from(this.cache.keys()).forEach((key) => {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Nettoie les entrées expirées
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: CacheKey[] = [];

    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));

    console.log(`[RPCCache] Cleanup: ${keysToDelete.length} expired entries removed`);
  }

  /**
   * Récupère un compte avec cache
   */
  async getAccountInfo(
    publicKey: PublicKey,
    ttl?: number
  ): Promise<AccountInfo<Buffer> | null> {
    const key = this.generateKey("getAccountInfo", publicKey.toString());
    const cached = this.get<AccountInfo<Buffer> | null>(key);

    if (cached !== null) {
      console.log(`[RPCCache] HIT: getAccountInfo(${publicKey.toString()})`);
      return cached;
    }

    console.log(`[RPCCache] MISS: getAccountInfo(${publicKey.toString()})`);
    const accountInfo = await this.connection.getAccountInfo(publicKey);
    this.set(key, accountInfo, ttl);

    // Subscribe to account changes if WebSocket enabled
    if (this.config.enableWebSocket && !this.subscriptions.has(key)) {
      this.subscribeToAccount(publicKey, key);
    }

    return accountInfo;
  }

  /**
   * Récupère plusieurs comptes avec cache
   */
  async getMultipleAccountsInfo(
    publicKeys: PublicKey[],
    ttl?: number
  ): Promise<(AccountInfo<Buffer> | null)[]> {
    const results: (AccountInfo<Buffer> | null)[] = [];
    const toFetch: { index: number; pubkey: PublicKey }[] = [];

    // Check cache first
    publicKeys.forEach((pubkey, index) => {
      const key = this.generateKey("getAccountInfo", pubkey.toString());
      const cached = this.get<AccountInfo<Buffer> | null>(key);

      if (cached !== null) {
        results[index] = cached;
        console.log(`[RPCCache] HIT: getAccountInfo(${pubkey.toString()})`);
      } else {
        toFetch.push({ index, pubkey });
      }
    });

    // Fetch missing accounts
    if (toFetch.length > 0) {
      console.log(`[RPCCache] MISS: ${toFetch.length} accounts`);
      const fetchedAccounts = await this.connection.getMultipleAccountsInfo(
        toFetch.map((item) => item.pubkey)
      );

      fetchedAccounts.forEach((account, i) => {
        const { index, pubkey } = toFetch[i];
        results[index] = account;

        const key = this.generateKey("getAccountInfo", pubkey.toString());
        this.set(key, account, ttl);

        // Subscribe if WebSocket enabled
        if (this.config.enableWebSocket && !this.subscriptions.has(key)) {
          this.subscribeToAccount(pubkey, key);
        }
      });
    }

    return results;
  }

  /**
   * Récupère le solde avec cache
   */
  async getBalance(publicKey: PublicKey, ttl: number = 10_000): Promise<number> {
    const key = this.generateKey("getBalance", publicKey.toString());
    const cached = this.get<number>(key);

    if (cached !== null) {
      console.log(`[RPCCache] HIT: getBalance(${publicKey.toString()})`);
      return cached;
    }

    console.log(`[RPCCache] MISS: getBalance(${publicKey.toString()})`);
    const balance = await this.connection.getBalance(publicKey);
    this.set(key, balance, ttl);

    return balance;
  }

  /**
   * Récupère le token balance avec cache
   */
  async getTokenAccountBalance(
    publicKey: PublicKey,
    ttl: number = 10_000
  ): Promise<{ value: { amount: string; decimals: number; uiAmount: number | null; uiAmountString: string } }> {
    const key = this.generateKey("getTokenAccountBalance", publicKey.toString());
    const cached = this.get<{ value: { amount: string; decimals: number; uiAmount: number | null; uiAmountString: string } }>(key);

    if (cached !== null) {
      console.log(`[RPCCache] HIT: getTokenAccountBalance(${publicKey.toString()})`);
      return cached;
    }

    console.log(`[RPCCache] MISS: getTokenAccountBalance(${publicKey.toString()})`);
    const balance = await this.connection.getTokenAccountBalance(publicKey);
    this.set(key, balance, ttl);

    return balance;
  }

  /**
   * Subscribe to account changes via WebSocket
   */
  private subscribeToAccount(publicKey: PublicKey, cacheKey: string): void {
    try {
      const subscriptionId = this.connection.onAccountChange(
        publicKey,
        (accountInfo) => {
          console.log(`[RPCCache] WebSocket update: ${publicKey.toString()}`);
          this.set(cacheKey, accountInfo, this.config.defaultTTL);
        }
      );

      this.subscriptions.set(cacheKey, subscriptionId);
    } catch (err) {
      console.error("[RPCCache] Failed to subscribe to account:", err);
    }
  }

  /**
   * Unsubscribe from account changes
   */
  public async unsubscribeAll(): Promise<void> {
    const unsubscribePromises: Promise<void>[] = [];

    Array.from(this.subscriptions.values()).forEach((subscriptionId) => {
      unsubscribePromises.push(
        this.connection.removeAccountChangeListener(subscriptionId)
      );
    });

    await Promise.all(unsubscribePromises);
    this.subscriptions.clear();
    console.log("[RPCCache] All WebSocket subscriptions removed");
  }

  /**
   * Obtenir les statistiques du cache
   */
  public getStats() {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      subscriptions: this.subscriptions.size,
      defaultTTL: this.config.defaultTTL,
    };
  }

  /**
   * Vider tout le cache
   */
  public clear(): void {
    this.cache.clear();
    console.log("[RPCCache] Cache cleared");
  }
}

/**
 * Hook React pour utiliser le cache RPC
 */
import { useConnection } from "@solana/wallet-adapter-react";
import { useMemo } from "react";

export function useRPCCache(config?: CacheConfig): RPCCache {
  const { connection } = useConnection();

  const cache = useMemo(() => {
    return new RPCCache(connection, config);
  }, [connection, config]);

  return cache;
}

/**
 * Exemple d'utilisation:
 *
 * ```typescript
 * const cache = useRPCCache({ defaultTTL: 30_000 });
 *
 * // Récupérer un compte avec cache
 * const accountInfo = await cache.getAccountInfo(publicKey);
 *
 * // Invalider le cache pour un compte spécifique
 * cache.invalidate(publicKey.toString());
 *
 * // Obtenir les stats
 * console.log(cache.getStats());
 * ```
 */
