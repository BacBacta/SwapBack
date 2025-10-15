/**
 * Configuration des tokens pour Devnet
 * Généré automatiquement le 14 octobre 2025
 */

import { PublicKey } from "@solana/web3.js";

export const DEVNET_TOKENS = {
  BACK: {
    mint: new PublicKey("BH8thpWca6kpN2pKwWTaKv2F5s4MEkbML18LtJ8eFypU"),
    symbol: "BACK",
    name: "SwapBack Token",
    decimals: 9,
    logoURI: "/tokens/back.png",
  },
  USDC: {
    mint: new PublicKey("3y4dCqwWuYx1B97YEDmgq9qjuNE1eyEwGx2eLgz6Rc6G"),
    symbol: "USDC",
    name: "USD Coin (Test)",
    decimals: 6,
    logoURI: "/tokens/usdc.png",
  },
  SOL: {
    mint: new PublicKey("So11111111111111111111111111111111111111112"),
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    logoURI: "/tokens/sol.png",
  },
  // Autres tokens devnet populaires pour les tests
  BONK: {
    mint: new PublicKey("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"),
    symbol: "BONK",
    name: "Bonk",
    decimals: 5,
    logoURI: "/tokens/bonk.png",
  },
};

export const DEVNET_PROGRAMS = {
  BUYBACK: new PublicKey("71vALqj3cmQWDmq9bi9GYYDPQqpoRstej3snUbikpCHW"),
  CNFT: new PublicKey("HAtZ7hJt2YFZSYnAaVwRg3jGTAbr8u6nze3KkSHfwFrf"),
};

export const DEVNET_CONFIG = {
  rpcUrl: "https://api.devnet.solana.com",
  tokens: DEVNET_TOKENS,
  programs: DEVNET_PROGRAMS,
};

// Liste des tokens pour les dropdowns
export const DEVNET_TOKEN_LIST = [
  DEVNET_TOKENS.BACK,
  DEVNET_TOKENS.USDC,
  DEVNET_TOKENS.SOL,
  DEVNET_TOKENS.BONK,
];

// Mapping pour récupérer facilement les infos par symbol
export const getTokenBySymbol = (symbol: string) => {
  return DEVNET_TOKEN_LIST.find((token) => token.symbol === symbol);
};

// Mapping pour récupérer facilement les infos par mint
export const getTokenByMint = (mint: string) => {
  return DEVNET_TOKEN_LIST.find((token) => token.mint.toBase58() === mint);
};
