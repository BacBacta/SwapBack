import { PublicKey } from "@solana/web3.js";

// Mapping des tokens connus
export const tokenAddresses: { [key: string]: string } = {
  SOL: "So11111111111111111111111111111111111111112",
  BACK: process.env.NEXT_PUBLIC_BACK_MINT || "6tFCrUr3mZpL3BzNV2cLjYDkoL7toYA74TpMCSxFg45E",
  USDC: process.env.NEXT_PUBLIC_USDC_MINT || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  JTO: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
  mSOL: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
};

/**
 * Convertit un nom de token ou adresse en PublicKey
 * @param token - Nom du token (ex: "SOL", "BACK") ou adresse directe
 * @returns PublicKey du token mint
 */
export const getTokenMint = (token: string): PublicKey => {
  // Si c'est déjà une adresse valide Solana (32-44 chars base58)
  if (token.length >= 32 && token.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(token)) {
    return new PublicKey(token);
  }
  
  // Sinon chercher dans notre mapping
  const address = tokenAddresses[token] || token;
  return new PublicKey(address);
};

/**
 * Convertit une fréquence DCA en secondes
 */
export const frequencyToSeconds = (frequency: "hourly" | "daily" | "weekly" | "monthly"): number => {
  const secondsMap = {
    hourly: 3600,
    daily: 86400,
    weekly: 604800,
    monthly: 2592000,
  };
  return secondsMap[frequency];
};

/**
 * Convertit un intervalle en secondes vers une fréquence
 */
export const secondsToFrequency = (seconds: number): "hourly" | "daily" | "weekly" | "monthly" => {
  if (seconds <= 3600) return "hourly";
  if (seconds <= 86400) return "daily";
  if (seconds <= 604800) return "weekly";
  return "monthly";
};
