/**
 * Mapping des oracles Pyth (primaire) + Switchboard (fallback) utilisés par le router.
 * 
 * Sources officielles:
 * - Pyth: https://pyth.network/developers/price-feed-ids
 * - Switchboard: https://switchboard.xyz/explorer
 * 
 * IMPORTANT: Toujours utiliser Pyth en primaire sur mainnet (plus fiable et fréquent)
 */

import { PublicKey } from "@solana/web3.js";

export interface OracleFeedConfig {
  primary: PublicKey;
  fallback?: PublicKey;
}

type OraclePair = `${string}/${string}`;

// Token Mints (mainnet)
const MINTS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  RAY: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
  ORCA: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  WIF: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  JTO: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
  PYTH: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
};

// Pyth Price Feeds (mainnet) - https://pyth.network/developers/price-feed-ids
const PYTH_FEEDS = {
  SOL_USD: "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG",
  USDC_USD: "Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD",
  USDT_USD: "3vxLXJqLqF3JG5TCbYycbKWRBbCJQLxQmBGCkyqEEefL",
  JUP_USD: "g6eRCbboSwK4tSWngn773RCMexr1APQr4uA9bGZBYfo",
  RAY_USD: "AnLf8tVYCM816gmBjiy8n53eXKKEDydT5piYjjQDPgTB",
  ORCA_USD: "4ivThkX8uRxBpHsdWSqyXYihzKF3zpRGAUCqyuagnLoV",
  BONK_USD: "8ihFLu5FimgTQ1Unh4dVyEHUGodJ5gJQCrQf4KUVB9bN",
  WIF_USD: "6x6KfE7nY4QW8vPZVbhTwKmJFgxKQqJnXPvWHQaHgMQy",
  JTO_USD: "7yyaeuJ1GGtVBLT2z2xub5ZWYKaNhF28mj1RdV4VDFVk",
  PYTH_USD: "nrYkQQQur7z8rYTST3G9GqATviK5SxTDkrqd21MW6Ue",
};

// Switchboard Feeds (mainnet) - https://switchboard.xyz/explorer
const SWITCHBOARD_FEEDS = {
  SOL_USD: "GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR",
  USDC_USD: "BjUgj6YCnFBZ49wF54ddBVA9qu8TeqkFtkbqmZcee8uW",
  USDT_USD: "5mp8kbkTYwWWCsKSte8rURjTuyinsqBpJ3xQKf8mF7cc",
  JUP_USD: "4gDDVmJXfhKx4z4uJzKJy8qVRPfrDi8ue5oM7FdEp8s8", // Switchboard JUP/USD
  RAY_USD: "FmKSBNL6kLxLvGM5rJHTbP8D1F2gU8VNYg5VvH5f8wVa",
  ORCA_USD: "4ivThkX8uRxBpHsdWSqyXYihzKF3zpRGAUCqyuagnLoV",
};

// Helper pour générer les paires bidirectionnelles
function createBidirectionalPairs(
  mintA: string,
  mintB: string,
  primaryFeed: string,
  fallbackFeed?: string
): Record<OraclePair, { primary: string; fallback?: string }> {
  const config = { primary: primaryFeed, fallback: fallbackFeed };
  return {
    [`${mintA}/${mintB}` as OraclePair]: config,
    [`${mintB}/${mintA}` as OraclePair]: config,
  };
}

const ORACLE_FEED_CONFIGS: Record<OraclePair, { primary: string; fallback?: string }> = {
  // ==========================================
  // SOL pairs (utiliser SOL/USD oracle)
  // ==========================================
  ...createBidirectionalPairs(MINTS.SOL, MINTS.USDC, PYTH_FEEDS.SOL_USD, SWITCHBOARD_FEEDS.SOL_USD),
  ...createBidirectionalPairs(MINTS.SOL, MINTS.USDT, PYTH_FEEDS.SOL_USD, SWITCHBOARD_FEEDS.SOL_USD),
  ...createBidirectionalPairs(MINTS.SOL, MINTS.JUP, PYTH_FEEDS.SOL_USD, SWITCHBOARD_FEEDS.SOL_USD),
  ...createBidirectionalPairs(MINTS.SOL, MINTS.RAY, PYTH_FEEDS.SOL_USD, SWITCHBOARD_FEEDS.SOL_USD),
  ...createBidirectionalPairs(MINTS.SOL, MINTS.ORCA, PYTH_FEEDS.SOL_USD, SWITCHBOARD_FEEDS.SOL_USD),
  ...createBidirectionalPairs(MINTS.SOL, MINTS.BONK, PYTH_FEEDS.SOL_USD, SWITCHBOARD_FEEDS.SOL_USD),
  ...createBidirectionalPairs(MINTS.SOL, MINTS.WIF, PYTH_FEEDS.SOL_USD, SWITCHBOARD_FEEDS.SOL_USD),
  ...createBidirectionalPairs(MINTS.SOL, MINTS.JTO, PYTH_FEEDS.SOL_USD, SWITCHBOARD_FEEDS.SOL_USD),
  ...createBidirectionalPairs(MINTS.SOL, MINTS.PYTH, PYTH_FEEDS.SOL_USD, SWITCHBOARD_FEEDS.SOL_USD),
  
  // ==========================================
  // USDC pairs (utiliser l'oracle du token de l'autre côté ou SOL/USD)
  // ==========================================
  ...createBidirectionalPairs(MINTS.USDC, MINTS.USDT, PYTH_FEEDS.USDC_USD, SWITCHBOARD_FEEDS.USDC_USD),
  ...createBidirectionalPairs(MINTS.USDC, MINTS.JUP, PYTH_FEEDS.JUP_USD),
  ...createBidirectionalPairs(MINTS.USDC, MINTS.RAY, PYTH_FEEDS.RAY_USD, SWITCHBOARD_FEEDS.RAY_USD),
  ...createBidirectionalPairs(MINTS.USDC, MINTS.ORCA, PYTH_FEEDS.ORCA_USD),
  ...createBidirectionalPairs(MINTS.USDC, MINTS.BONK, PYTH_FEEDS.BONK_USD),
  ...createBidirectionalPairs(MINTS.USDC, MINTS.WIF, PYTH_FEEDS.WIF_USD),
  ...createBidirectionalPairs(MINTS.USDC, MINTS.JTO, PYTH_FEEDS.JTO_USD),
  ...createBidirectionalPairs(MINTS.USDC, MINTS.PYTH, PYTH_FEEDS.PYTH_USD),
  
  // ==========================================
  // USDT pairs
  // ==========================================
  ...createBidirectionalPairs(MINTS.USDT, MINTS.JUP, PYTH_FEEDS.JUP_USD),
  ...createBidirectionalPairs(MINTS.USDT, MINTS.RAY, PYTH_FEEDS.RAY_USD),
  ...createBidirectionalPairs(MINTS.USDT, MINTS.BONK, PYTH_FEEDS.BONK_USD),
  ...createBidirectionalPairs(MINTS.USDT, MINTS.WIF, PYTH_FEEDS.WIF_USD),
};

const ORACLE_CACHE = new Map<OraclePair, OracleFeedConfig>();

/**
 * Oracle SOL/USD par défaut - utilisé comme fallback ultime
 * ATTENTION: Ne devrait être utilisé que si aucun mapping n'existe
 */
export const DEFAULT_SOL_USD_ORACLE = new PublicKey(PYTH_FEEDS.SOL_USD);

/**
 * Récupère les oracles pour une paire de tokens.
 * @throws Error si aucun oracle n'est configuré pour la paire
 */
export function getOracleFeedsForPair(inputMint: string, outputMint: string): OracleFeedConfig {
  const key = `${inputMint}/${outputMint}` as OraclePair;

  if (ORACLE_CACHE.has(key)) {
    return ORACLE_CACHE.get(key)!;
  }

  const config = ORACLE_FEED_CONFIGS[key];
  if (!config) {
    // Ne PAS fallback silencieusement - renvoyer une erreur explicite
    throw new Error(
      `Aucun oracle configuré pour la paire ${inputMint.slice(0,8)}.../${outputMint.slice(0,8)}... ` +
      `Veuillez ajouter cette paire dans ORACLE_FEED_CONFIGS.`
    );
  }

  const resolved: OracleFeedConfig = {
    primary: new PublicKey(config.primary),
    fallback: config.fallback ? new PublicKey(config.fallback) : undefined,
  };

  ORACLE_CACHE.set(key, resolved);
  return resolved;
}

/**
 * Vérifie si une paire a un oracle configuré
 */
export function hasOracleForPair(inputMint: string, outputMint: string): boolean {
  const key = `${inputMint}/${outputMint}` as OraclePair;
  return key in ORACLE_FEED_CONFIGS;
}

/**
 * Retro-compatibilité (retourne l'oracle primaire uniquement)
 */
export function getOracleForPair(inputMint: string, outputMint: string): PublicKey {
  return getOracleFeedsForPair(inputMint, outputMint).primary;
}

/**
 * Liste toutes les paires supportées avec oracles
 */
export function listSupportedOraclePairs(): string[] {
  return Object.keys(ORACLE_FEED_CONFIGS);
}

/**
 * Exporte les mints pour usage externe
 */
export { MINTS as TOKEN_MINTS, PYTH_FEEDS, SWITCHBOARD_FEEDS };
