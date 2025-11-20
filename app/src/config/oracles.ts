/**
 * Mapping des oracles Pyth/Switchboard utilisés par le router.
 */

import { PublicKey } from "@solana/web3.js";

const PYTH_FEEDS: Record<string, string> = {
  // Devnet feeds
  "So11111111111111111111111111111111111111112/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v":
    "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG", // SOL/USDC
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/So11111111111111111111111111111111111111112":
    "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v":
    "Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD", // USDT/USDC
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB":
    "Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD",
};

export function getOracleForPair(inputMint: string, outputMint: string): PublicKey {
  const key = `${inputMint}/${outputMint}`;
  const feed = PYTH_FEEDS[key];
  if (!feed) {
    throw new Error(`Aucun oracle configuré pour ${key}`);
  }
  return new PublicKey(feed);
}

export function listSupportedOraclePairs(): string[] {
  return Object.keys(PYTH_FEEDS);
}
