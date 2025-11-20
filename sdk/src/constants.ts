import { PublicKey } from "@solana/web3.js";

/**
 * Configuration du token $BACK sur différents réseaux
 */
export const BACK_TOKEN_CONFIG = {
  devnet: {
    name: "SwapBack Token",
    symbol: "BACK",
    decimals: 9,
    mint: new PublicKey("3Y6RXZUBHCeUj6VsWuyBY2Zy1RixY6BHkM4tf3euDdrE"),
    programId: new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"), // Token-2022
    network: "devnet" as const,
  },
  mainnet: {
    name: "SwapBack Token",
    symbol: "BACK",
    decimals: 9,
    mint: new PublicKey("11111111111111111111111111111111"), // À remplacer lors du lancement mainnet
    programId: new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"),
    network: "mainnet-beta" as const,
  },
} as const;

/**
 * IDs des programmes SwapBack déployés
 */
export const SWAPBACK_PROGRAM_IDS = {
  devnet: {
    router: new PublicKey("9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh"),
    buyback: new PublicKey("746EPwDbanWC32AmuH6aqSzgWmLvAYfUYz7ER1LNAvc6"),
    cnft: new PublicKey("DGDipfpHGVAnWXj7yPEBc3JYFWghQN76tEBzuK2Nojw3"),
  },
  mainnet: {
    router: new PublicKey("11111111111111111111111111111111"), // À déployer
    buyback: new PublicKey("11111111111111111111111111111111"), // À déployer
    cnft: new PublicKey("11111111111111111111111111111111"), // À déployer
  },
} as const;

/**
 * Configuration des clusters Solana
 */
export const CLUSTER_URLS = {
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  testnet: "https://api.testnet.solana.com",
  localhost: "http://localhost:8899",
} as const;

/**
 * Niveaux de boost pour le système de lock
 */
export const BOOST_LEVELS = {
  BRONZE: {
    name: "Bronze",
    minLock: 100,
    maxLock: 999,
    boostBps: 300, // +10% (300 basis points)
    color: "#CD7F32",
  },
  SILVER: {
    name: "Silver",
    minLock: 1000,
    maxLock: 9999,
    boostBps: 900, // +30% (900 basis points)
    color: "#C0C0C0",
  },
  GOLD: {
    name: "Gold",
    minLock: 10000,
    maxLock: Number.MAX_SAFE_INTEGER,
    boostBps: 1500, // +50% (1500 basis points)
    color: "#FFD700",
  },
} as const;

/**
 * Helper pour obtenir la config selon l'environnement
 */
export function getConfig(network: "devnet" | "mainnet-beta" = "devnet") {
  return {
    backToken: BACK_TOKEN_CONFIG[network === "mainnet-beta" ? "mainnet" : "devnet"],
    programs: SWAPBACK_PROGRAM_IDS[network === "mainnet-beta" ? "mainnet" : "devnet"],
    rpcUrl: CLUSTER_URLS[network],
  };
}
