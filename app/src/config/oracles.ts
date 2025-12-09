/**
 * Mapping des oracles Pyth utilisés par le router.
 * 
 * ⚠️ SITUATION ACTUELLE (Décembre 2025) :
 * - Pyth V1 (Push) sur Solana est DÉPRÉCIÉ - les comptes ne sont plus mis à jour
 * - Le programme on-chain swapback_router utilise pyth_sdk_solana::load_price_account (V1)
 * - Pyth V2 (Pull) utilise PriceUpdateV2, un format INCOMPATIBLE avec le programme actuel
 * - Switchboard V2 est EOL (fin de vie) depuis novembre 2024
 * 
 * CONSÉQUENCE :
 * - Les swaps natifs sont DÉSACTIVÉS pour toutes les paires
 * - Tous les swaps sont routés vers Jupiter comme fallback
 * - Un redeploy du programme est nécessaire pour supporter Pyth V2
 * 
 * TODO: Mettre à jour le programme pour utiliser pyth-solana-receiver-sdk
 * 
 * Sources officielles (pour référence future):
 * - Pyth V2 Push Feeds: https://docs.pyth.network/price-feeds/core/push-feeds/solana
 * - Pyth SDK: https://docs.pyth.network/price-feeds/use-real-time-data/solana
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

// Pyth Price Feeds (mainnet) - NEW V2 Push Feeds (sponsored by Pyth Data Association)
// https://docs.pyth.network/price-feeds/core/push-feeds/solana
// These are PriceUpdateV2 accounts that are automatically updated
const PYTH_FEEDS = {
  // Major tokens - from push feeds list
  SOL_USD: "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE",
  USDC_USD: "Dpw1EAVrSB1ibxiDQyTLW6U4FU3tVFs28jVkLfKQqeFb",
  USDT_USD: "HT2PLQBcG5EiCcNSaMHAjSgd9F98ecpATbk4Sk5oYuM",
  JUP_USD: "7dbob1psH1iZBS7qPsm3Kvnfa5zZHxvDrqpRpk54zcH5",
  BONK_USD: "DBE3N8hDV6xwBY7sSjLHQ1EWPFMCT8YWygoAVPewBBiX",
  WIF_USD: "6B23K3tkb51vLZA14jcEQVCA1pfHptzEHFA93V5dYwbT",
  ORCA_USD: "4CBshVeNBEXz24GDNQVmkzwf3CAkMFNTgPw3W3rbnPiF",
  PYTH_USD: "8vjchtMuJNY4oFQdTi8yCe6mhCaNBFaUbktT482TpLPS",
  ETH_USD: "42amVS4KgzR71aw6z3LCrKdNZr1skmnfJfm81y2uX6XC",
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
 * Vérifie si une paire a un oracle configuré
 * 
 * ⚠️ IMPORTANT: Retourne toujours FALSE actuellement car les oracles Pyth V1 sont morts.
 * Cette fonction est utilisée par le NativeRouter pour décider si le swap natif est possible.
 */
export function hasOracleForPair(inputMint: string, outputMint: string): boolean {
  // DÉSACTIVÉ: Pyth V1 (Push) est déprécié, les comptes ne sont plus mis à jour
  // Tous les swaps doivent passer par Jupiter jusqu'au redeploy du programme
  // avec support Pyth V2 (Pull Oracle)
  return false;
  
  // Code original (commenté pour référence):
  // const key = `${inputMint}/${outputMint}` as OraclePair;
  // return key in ORACLE_FEED_CONFIGS;
}

/**
 * Vérifie si les swaps natifs sont disponibles
 * 
 * @returns false - Les swaps natifs sont actuellement désactivés
 */
export function isNativeSwapAvailable(): boolean {
  // Pyth V1 est mort, Switchboard V2 est EOL
  // Le programme on-chain doit être mis à jour pour supporter Pyth V2
  return false;
}

/**
 * Message d'erreur à afficher à l'utilisateur
 */
export const NATIVE_SWAP_UNAVAILABLE_MESSAGE = 
  "Les swaps natifs sont temporairement indisponibles. " +
  "Votre transaction sera routée via Jupiter pour garantir l'exécution.";

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
