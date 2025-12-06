/**
 * Configuration du Quote Cache
 * 
 * Ce fichier centralise la configuration du cache de quotes
 * pour faciliter les ajustements de performance.
 */

export interface QuoteCacheConfig {
  /** TTL en ms pour les quotes (défaut: 2000ms) */
  ttlMs: number;
  /** Taille maximale du cache en entrées */
  maxSize: number;
  /** Seuil de hits pour déclencher le pré-chargement prédictif */
  predictionThreshold: number;
  /** Intervalle de refresh prédictif en ms */
  predictionRefreshMs: number;
  /** Durée max de persistance des quotes chauds en ms */
  hotQuoteMaxAgeMs: number;
  /** Nombre max de quotes chauds à persister */
  maxHotQuotes: number;
  /** Nombre max de paires à persister */
  maxPairStats: number;
  /** Intervalle de persistance en ms */
  persistIntervalMs: number;
}

/**
 * Configuration par défaut optimisée pour la performance
 */
export const DEFAULT_QUOTE_CACHE_CONFIG: QuoteCacheConfig = {
  // TTL court pour quotes frais (important pour les prix volatils)
  ttlMs: 2000,
  
  // Taille suffisante pour les paires populaires
  maxSize: 100,
  
  // Seuil bas pour prédiction rapide
  predictionThreshold: 3,
  
  // Refresh rapide pour quotes toujours frais
  predictionRefreshMs: 1500,
  
  // Quotes chauds valides 30s après refresh page
  hotQuoteMaxAgeMs: 30000,
  
  // Limites de persistance
  maxHotQuotes: 20,
  maxPairStats: 50,
  persistIntervalMs: 10000,
};

/**
 * Paires les plus tradées sur Solana (pour pré-chauffage)
 * Classées par volume estimé
 */
export const HOT_PAIRS = [
  // SOL <-> Stablecoins (volume majeur)
  { 
    input: "So11111111111111111111111111111111111111112", 
    output: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    name: "SOL/USDC"
  },
  { 
    input: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", 
    output: "So11111111111111111111111111111111111111112",
    name: "USDC/SOL"
  },
  { 
    input: "So11111111111111111111111111111111111111112", 
    output: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    name: "SOL/USDT"
  },
  { 
    input: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", 
    output: "So11111111111111111111111111111111111111112",
    name: "USDT/SOL"
  },
  
  // Tokens populaires
  { 
    input: "So11111111111111111111111111111111111111112", 
    output: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    name: "SOL/JUP"
  },
  { 
    input: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", 
    output: "So11111111111111111111111111111111111111112",
    name: "JUP/SOL"
  },
  
  // LST (Liquid Staking Tokens)
  { 
    input: "So11111111111111111111111111111111111111112", 
    output: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
    name: "SOL/mSOL"
  },
  { 
    input: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", 
    output: "So11111111111111111111111111111111111111112",
    name: "mSOL/SOL"
  },
  
  // Stablecoin swaps
  { 
    input: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", 
    output: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    name: "USDC/USDT"
  },
  { 
    input: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", 
    output: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    name: "USDT/USDC"
  },
];

/**
 * Montants typiques pour le pré-chauffage (en unités du token)
 */
export const PRELOAD_AMOUNTS = [0.1, 1, 10, 100, 1000];

/**
 * Mints des tokens internes SwapBack (pour pool interne)
 */
export const INTERNAL_LIQUIDITY_MINTS = new Set([
  "So11111111111111111111111111111111111111112", // SOL
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
]);
