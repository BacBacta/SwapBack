import { PublicKey } from '@solana/web3.js';

/**
 * Configuration centralisée pour SwapBack
 * Toutes les constantes importantes du projet
 */

// ============================================
// PROGRAM IDs (Devnet - Updated Oct 31, 2025)
// ============================================

export const ROUTER_PROGRAM_ID = new PublicKey(
  'GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt'
);

export const BUYBACK_PROGRAM_ID = new PublicKey(
  'EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf'
);

export const CNFT_PROGRAM_ID = new PublicKey(
  '2VB6D8Qqdo1gxqYDAxEMYkV4GcarAMATKHcbroaFPz8G' // Fixed bump initialization
);

// ============================================
// TOKEN MINTS (Devnet - Created Oct 31, 2025)
// ============================================

export const BACK_TOKEN_MINT = new PublicKey(
  '3Y6RXZUBHCeUj6VsWuyBY2Zy1RixY6BHkM4tf3euDdrE' // Token-2022
);

// Tokens communs sur Solana (pour référence future)
export const SOL_MINT = new PublicKey(
  'So11111111111111111111111111111111111111112'
);

export const USDC_MINT = new PublicKey(
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
);

// ============================================
// cNFT LEVELS & BOOSTS
// ============================================

export enum CNFTLevel {
  Bronze = 0,
  Silver = 1,
  Gold = 2,
}

export const LEVEL_NAMES: Record<CNFTLevel, string> = {
  [CNFTLevel.Bronze]: 'Bronze',
  [CNFTLevel.Silver]: 'Silver',
  [CNFTLevel.Gold]: 'Gold',
};

// Durées minimales en jours pour chaque niveau
export const LEVEL_THRESHOLDS: Record<CNFTLevel, number> = {
  [CNFTLevel.Bronze]: 7,
  [CNFTLevel.Silver]: 30,
  [CNFTLevel.Gold]: 90,
};

// Boost de rebate en pourcentage pour chaque niveau
export const LEVEL_BOOSTS: Record<CNFTLevel, number> = {
  [CNFTLevel.Bronze]: 5,
  [CNFTLevel.Silver]: 10,
  [CNFTLevel.Gold]: 20,
};

// Couleurs Tailwind pour les badges de niveau
export const LEVEL_COLORS: Record<CNFTLevel, string> = {
  [CNFTLevel.Bronze]: 'text-orange-400 border-orange-400 bg-orange-400/10',
  [CNFTLevel.Silver]: 'text-gray-300 border-gray-300 bg-gray-300/10',
  [CNFTLevel.Gold]: 'text-yellow-400 border-yellow-400 bg-yellow-400/10',
};

// ============================================
// SOLANA NETWORK
// ============================================

export const SOLANA_NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'testnet';

export const SOLANA_RPC_ENDPOINTS = {
  mainnet: 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
  local: 'http://localhost:8899',
};

export const SOLANA_EXPLORER_BASE_URL = 'https://explorer.solana.com';

// ============================================
// WALLET & TRANSACTION
// ============================================

export const DEFAULT_COMMITMENT = 'confirmed';
export const TOKEN_DECIMALS = 9; // Pour $BACK token

// ============================================
// UI CONSTANTS
// ============================================

export const MIN_LOCK_DURATION_DAYS = 7;
export const MAX_LOCK_DURATION_DAYS = 365;
export const DEFAULT_LOCK_DURATION_DAYS = 30;

export const QUICK_LOCK_AMOUNTS = [100, 500, 1000, 5000];
export const QUICK_LOCK_DURATIONS = [7, 30, 90, 180];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convertit un montant UI en lamports (9 décimales)
 */
export function toLamports(amount: number): number {
  return Math.floor(amount * Math.pow(10, TOKEN_DECIMALS));
}

/**
 * Convertit des lamports en montant UI (9 décimales)
 */
export function fromLamports(lamports: number): number {
  return lamports / Math.pow(10, TOKEN_DECIMALS);
}

/**
 * Détermine le niveau cNFT basé sur la durée de verrouillage
 */
export function getLevelFromDuration(durationDays: number): CNFTLevel {
  if (durationDays >= LEVEL_THRESHOLDS[CNFTLevel.Gold]) {
    return CNFTLevel.Gold;
  }
  if (durationDays >= LEVEL_THRESHOLDS[CNFTLevel.Silver]) {
    return CNFTLevel.Silver;
  }
  return CNFTLevel.Bronze;
}

/**
 * Obtient le boost associé à un niveau
 */
export function getBoostForLevel(level: CNFTLevel): number {
  return LEVEL_BOOSTS[level];
}

/**
 * Obtient le nom d'un niveau
 */
export function getLevelName(level: CNFTLevel): string {
  return LEVEL_NAMES[level];
}

/**
 * Obtient la couleur Tailwind pour un niveau
 */
export function getLevelColor(level: CNFTLevel): string {
  return LEVEL_COLORS[level];
}

/**
 * Construit une URL vers Solana Explorer
 */
export function getExplorerUrl(
  type: 'address' | 'tx' | 'block',
  value: string,
  network: string = SOLANA_NETWORK
): string {
  return `${SOLANA_EXPLORER_BASE_URL}/${type}/${value}?cluster=${network}`;
}

/**
 * Formatte un montant de tokens avec séparateurs
 */
export function formatTokenAmount(amount: number, decimals: number = 2): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Tronque une adresse Solana pour l'affichage
 */
export function truncateAddress(address: string, chars: number = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
