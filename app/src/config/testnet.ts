/**
 * Configuration des tokens pour Testnet
 * Déploiement du 28 octobre 2025
 */

import { PublicKey } from "@solana/web3.js";

export const TESTNET_TOKENS = {
  BACK: {
    mint: new PublicKey(
      process.env.NEXT_PUBLIC_BACK_MINT || "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux"
    ),
    symbol: "BACK",
    name: "SwapBack Token",
    decimals: 9,
    logoURI: "/tokens/back.png",
  },
  USDC: {
    mint: new PublicKey(
      process.env.NEXT_PUBLIC_USDC_MINT || "BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR"
    ),
    symbol: "USDC",
    name: "USD Coin (Testnet)",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  },
  SOL: {
    mint: new PublicKey("So11111111111111111111111111111111111111112"),
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  },
};

export const TESTNET_PROGRAM_IDS = {
  CNFT: new PublicKey(
    process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID || "EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP"
  ),
  ROUTER: new PublicKey(
    process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID || "9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh"
  ),
  BUYBACK: new PublicKey(
    process.env.NEXT_PUBLIC_BUYBACK_PROGRAM_ID || "746EPwDbanWC32AmuH6aqSzgWmLvAYfUYz7ER1LNAvc6"
  ),
};

export const TESTNET_INFRASTRUCTURE = {
  MERKLE_TREE: new PublicKey(
    process.env.NEXT_PUBLIC_MERKLE_TREE || "93Tzc7btocwzDSbscW9EfL9dBzWLx85FHE6zeWrwHbNT"
  ),
  COLLECTION_CONFIG: new PublicKey(
    process.env.NEXT_PUBLIC_COLLECTION_CONFIG || "5Lz4eHdqAgVsXu3Antp3TVqncuoCdUj2WEnc6PQuVzMT"
  ),
};

/**
 * Récupère la configuration selon l'environnement
 */
export function getNetworkConfig() {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "testnet";
  
  if (network === "testnet") {
    return {
      tokens: TESTNET_TOKENS,
      programIds: TESTNET_PROGRAM_IDS,
      infrastructure: TESTNET_INFRASTRUCTURE,
    };
  }
  
  // Fallback vers devnet si autre réseau
  return null;
}
