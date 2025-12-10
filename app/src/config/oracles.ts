/**
 * Mapping des oracles Pyth utilisés par le router.
 * 
 * ✅ SITUATION ACTUELLE (9 Décembre 2025) :
 * - Programme redéployé avec support Pyth V2 Push Feeds
 * - Nouveau Program ID: APHj6L2b2bA2q62jwYZp38dqbTxQUqwatqdUum1trPnN
 * - Utilise les Pyth V2 Push Feeds (sponsorisés par Pyth Data Association)
 * - Désérialisation manuelle des PriceUpdateV2 (oracle_v2.rs)
 * 
 * Les swaps natifs sont ACTIVÉS pour les paires avec oracles sponsorisés.
 * 
 * Sources officielles:
 * - Pyth V2 Push Feeds: https://docs.pyth.network/price-feeds/core/push-feeds/solana
 * - Liste des feeds sponsorisés: https://docs.pyth.network/price-feeds/sponsored-feeds
 */

import { PublicKey } from "@solana/web3.js";

export interface OracleFeedConfig {
  primary: PublicKey;
  fallback?: PublicKey;
}

type OraclePair = `${string}/${string}`;

// Token Mints (mainnet) - Only tokens with sponsored Pyth Push Feeds
const MINTS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  ORCA: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  WIF: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  PYTH: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
  // Note: RAY and JTO removed - no sponsored push feeds available
};

// Pyth Price Feeds (mainnet) - V2 Push Feeds (sponsored by Pyth Data Association)
// https://docs.pyth.network/price-feeds/core/push-feeds/solana
// These are PriceUpdateV2 accounts that are automatically updated
// Addresses derived via scripts/derive-push-feed-addresses.ts on 2025-12-10
// Verified via oracle-audit.mainnet.ts - ALL 10 feeds OK
const PYTH_FEEDS = {
  // Major tokens - verified on mainnet 2025-12-10
  SOL_USD: "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE",
  USDC_USD: "Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX",
  USDT_USD: "HT2PLQBcG5EiCcNSaMHAjSgd9F98ecpATbk4Sk5oYuM",
  JUP_USD: "g6eRCbboSwK4tSWngn773RCMexr1APQr4uA9bGZBYfo",    // Updated from audit
  BONK_USD: "8ihFLu5FimgTQ1Unh4dVyEHUGodJ5gJQCrQf4KUVB9bN",  // Updated from audit
  WIF_USD: "6B23K3tkb51vLZA14jcEQVCA1pfHptzEHFA93V5dYwbT",
  ORCA_USD: "4CBshVeNBEXz24GAxNhnMdpLxBALHL8iAoYQf4VwS8GS",  // Updated from audit
  PYTH_USD: "nrYkQQQur7z8rYTST3HWceMziog46ZQU5vCa8iLvsY4",   // Updated from audit
  ETH_USD: "42amVS4KgzR9rA28tkVYqVXjq9Qa8dcZQMbH5EYFX6XC",
  BTC_USD: "4cSM2e6rvbGQUFiJbqytoVMi5GgghSMr8LwVrT9VPSPo",
};

// Switchboard V2 is EOL (End of Life) as of November 15, 2024
// We no longer use Switchboard as fallback - Pyth Push Feeds only
// https://app.switchboard.xyz/solana/mainnet - "Transition to Switchboard OnDemand"
// Keeping empty for reference
const SWITCHBOARD_FEEDS: Record<string, string> = {};

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
  // Les tokens sans push feed sponsorisé sont exclus
  // ==========================================
  ...createBidirectionalPairs(MINTS.SOL, MINTS.USDC, PYTH_FEEDS.SOL_USD),
  ...createBidirectionalPairs(MINTS.SOL, MINTS.USDT, PYTH_FEEDS.SOL_USD),
  ...createBidirectionalPairs(MINTS.SOL, MINTS.JUP, PYTH_FEEDS.SOL_USD),
  ...createBidirectionalPairs(MINTS.SOL, MINTS.ORCA, PYTH_FEEDS.SOL_USD),
  ...createBidirectionalPairs(MINTS.SOL, MINTS.BONK, PYTH_FEEDS.SOL_USD),
  ...createBidirectionalPairs(MINTS.SOL, MINTS.WIF, PYTH_FEEDS.SOL_USD),
  ...createBidirectionalPairs(MINTS.SOL, MINTS.PYTH, PYTH_FEEDS.SOL_USD),
  
  // ==========================================
  // USDC pairs (utiliser l'oracle du token contre USD)
  // ==========================================
  ...createBidirectionalPairs(MINTS.USDC, MINTS.USDT, PYTH_FEEDS.USDC_USD),
  ...createBidirectionalPairs(MINTS.USDC, MINTS.JUP, PYTH_FEEDS.JUP_USD),
  ...createBidirectionalPairs(MINTS.USDC, MINTS.ORCA, PYTH_FEEDS.ORCA_USD),
  ...createBidirectionalPairs(MINTS.USDC, MINTS.BONK, PYTH_FEEDS.BONK_USD),
  ...createBidirectionalPairs(MINTS.USDC, MINTS.WIF, PYTH_FEEDS.WIF_USD),
  ...createBidirectionalPairs(MINTS.USDC, MINTS.PYTH, PYTH_FEEDS.PYTH_USD),
  
  // ==========================================
  // USDT pairs
  // ==========================================
  ...createBidirectionalPairs(MINTS.USDT, MINTS.JUP, PYTH_FEEDS.JUP_USD),
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
 * Vérifie si une paire a un oracle configuré (Pyth V2 Push Feeds)
 * ✅ RÉACTIVÉ: Programme redéployé le 9 Dec 2025
 */
export function hasOracleForPair(inputMint: string, outputMint: string): boolean {
  const key = `${inputMint}/${outputMint}` as OraclePair;
  return key in ORACLE_FEED_CONFIGS;
}

/**
 * Vérifie si les swaps natifs sont disponibles (feature flag)
 * 
 * IMPORTANT: Cette fonction vérifie uniquement le feature flag.
 * La décision complète de routing doit utiliser `decideSwapRoute()`
 * qui vérifie aussi la paire supportée et la disponibilité de jupiterCpi.
 * 
 * Note technique:
 * Le programme on-chain `swapback_router` exige un `jupiter_route` valide.
 * Le native-router doit obtenir ces données via /api/swap/quote avant le swap.
 * 
 * @see lib/swap-routing/decideSwapRoute.ts
 */
export function isNativeSwapAvailable(): boolean {
  // Lire depuis le feature flag (activé par défaut)
  const envValue = typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_NATIVE_SWAP_ENABLED
    : process.env.NATIVE_SWAP_ENABLED;
  
  // Désactivé explicitement si "false" ou "0"
  if (envValue === "false" || envValue === "0") {
    return false;
  }
  
  // Activé par défaut
  return true;
}

/**
 * Message affiché quand un swap natif n'est pas disponible
 * 
 * Note: ce message est un fallback. Préférer `getUIMessageForReason()`
 * de `lib/swap-routing` pour des messages contextuels.
 */
export const NATIVE_SWAP_UNAVAILABLE_MESSAGE = 
  "Le swap natif n'est pas disponible pour cette transaction. " +
  "Votre transaction est routée via Jupiter.";

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
