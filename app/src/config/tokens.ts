import { DEFAULT_BACK_MINT, DEFAULT_SOLANA_NETWORK, DEFAULT_SOLANA_RPC_URL } from './constants';

// Constantes pour le token $BACK (multi-réseau)
// Note: Ces adresses sont pour référence, utilisez process.env.NEXT_PUBLIC_* pour la configuration actuelle

export const BACK_TOKEN_DEVNET = {
  name: "SwapBack Token",
  symbol: "BACK",
  decimals: 9,
  mint: DEFAULT_BACK_MINT,
  program: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", // Token-2022
  network: "devnet",
  logo: "/logo-back.png",
} as const;

// IDs des programmes SwapBack sur Devnet (pour référence)
export const PROGRAM_IDS_DEVNET = {
  router: "H3LLiKAvjPWk9Br14m7bjiWkaJFzeMVB9qvMsFaA14k5",
  buyback: "746EPwDbanWC32AmuH6aqSzgWmLvAYfUYz7ER1LNAvc6",
  cnft: "VOTRE_NOUVEAU_PROGRAM_ID",
} as const;

// Configuration du cluster - utilise les variables d'environnement
// Lazy load to avoid module-level env access
export function getSolanaCluster(): string {
  return process.env.NEXT_PUBLIC_SOLANA_NETWORK || DEFAULT_SOLANA_NETWORK;
}

export function getSolanaRpcUrl(): string {
  return process.env.NEXT_PUBLIC_SOLANA_RPC_URL || DEFAULT_SOLANA_RPC_URL;
}

export const SOLANA_CLUSTER = getSolanaCluster();
export const SOLANA_RPC_URL = getSolanaRpcUrl();
