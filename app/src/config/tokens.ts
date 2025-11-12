// Constantes pour le token $BACK (multi-réseau)
// Note: Ces adresses sont pour référence, utilisez process.env.NEXT_PUBLIC_* pour la configuration actuelle

export const BACK_TOKEN_DEVNET = {
  name: "SwapBack Token",
  symbol: "BACK",
  decimals: 9,
  mint: "3Y6RXZUBHCeUj6VsWuyBY2Zy1RixY6BHkM4tf3euDdrE",
  program: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", // Token-2022
  network: "devnet",
  logo: "/logo-back.png",
} as const;

// IDs des programmes SwapBack sur Devnet (pour référence)
export const PROGRAM_IDS_DEVNET = {
  router: "opPhGcth2dGQQ7njYmkAYwfxspJ1DjgP9LV2y1jygCx",
  buyback: "EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf",
  cnft: "26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru",
} as const;

// Configuration du cluster - utilise les variables d'environnement
// Lazy load to avoid module-level env access
export function getSolanaCluster(): string {
  return process.env.NEXT_PUBLIC_SOLANA_NETWORK || "mainnet-beta";
}

export function getSolanaRpcUrl(): string {
  return process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
}

export const SOLANA_CLUSTER = getSolanaCluster();
export const SOLANA_RPC_URL = getSolanaRpcUrl();
