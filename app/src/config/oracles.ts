/**
 * Mapping des oracles Switchboard (primaire) + Pyth (fallback) utilisés par le router.
 */

import { PublicKey } from "@solana/web3.js";

export interface OracleFeedConfig {
  primary: PublicKey;
  fallback?: PublicKey;
}

type OraclePair = `${string}/${string}`;

const ORACLE_FEED_CONFIGS: Record<OraclePair, { primary: string; fallback?: string }> = {
  // SOL ⇄ USDC - Utiliser Pyth en primaire (plus fiable sur mainnet)
  "So11111111111111111111111111111111111111112/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": {
    primary: "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG", // Pyth SOL/USD mainnet
    fallback: "GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR", // Switchboard SOL/USD
  },
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/So11111111111111111111111111111111111111112": {
    primary: "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG", // Pyth SOL/USD mainnet
    fallback: "GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR", // Switchboard SOL/USD
  },

  // USDT ⇄ USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": {
    primary: "5mp8kbkTYwWWCsKSte8rURjTuyinsqBpJ3xQKf8mF7cc", // Switchboard USDT/USD
    fallback: "Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD", // Pyth USDT/USD
  },
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": {
    primary: "5mp8kbkTYwWWCsKSte8rURjTuyinsqBpJ3xQKf8mF7cc",
    fallback: "Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD",
  },
};

const ORACLE_CACHE = new Map<OraclePair, OracleFeedConfig>();

export function getOracleFeedsForPair(inputMint: string, outputMint: string): OracleFeedConfig {
  const key = `${inputMint}/${outputMint}` as OraclePair;

  if (ORACLE_CACHE.has(key)) {
    return ORACLE_CACHE.get(key)!;
  }

  const config = ORACLE_FEED_CONFIGS[key];
  if (!config) {
    throw new Error(`Aucun oracle configuré pour ${key}`);
  }

  const resolved: OracleFeedConfig = {
    primary: new PublicKey(config.primary),
    fallback: config.fallback ? new PublicKey(config.fallback) : undefined,
  };

  ORACLE_CACHE.set(key, resolved);
  return resolved;
}

// Retro-compatibilité (retourne l'oracle primaire uniquement)
export function getOracleForPair(inputMint: string, outputMint: string): PublicKey {
  return getOracleFeedsForPair(inputMint, outputMint).primary;
}

export function listSupportedOraclePairs(): string[] {
  return Object.keys(ORACLE_FEED_CONFIGS);
}
