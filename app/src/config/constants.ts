import { PublicKey } from '@solana/web3.js';

// Devnet defaults remain in effect until mainnet launch
export const DEFAULT_SOLANA_NETWORK = 'devnet';
export const DEFAULT_SOLANA_RPC_URL = 'https://api.devnet.solana.com';
export const DEFAULT_BACK_MINT = '862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux';

/**
 * Configuration centralisée pour SwapBack
 * Toutes les constantes importantes du projet
 */

// ============================================
// PROGRAM IDs (Devnet - Updated Oct 31, 2025)
// ============================================

// Lazy load to avoid module-level access to process.env (causes client-side errors)
let _routerProgramId: PublicKey | null = null;
export function getRouterProgramId(): PublicKey {
  if (!_routerProgramId) {
    _routerProgramId = new PublicKey(
      process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID || 'H3LLiKAvjPWk9Br14m7bjiWkaJFzeMVB9qvMsFaA14k5'
    );
  }
  return _routerProgramId;
}

// DO NOT export module-level constants - use lazy loading functions instead
// Removed ROUTER_PROGRAM_ID, BUYBACK_PROGRAM_ID, CNFT_PROGRAM_ID to prevent module-level access

// Lazy load buyback program ID
let _buybackProgramId: PublicKey | null = null;
export function getBuybackProgramId(): PublicKey {
  if (!_buybackProgramId) {
    _buybackProgramId = new PublicKey(
      process.env.NEXT_PUBLIC_BUYBACK_PROGRAM_ID || '746EPwDbanWC32AmuH6aqSzgWmLvAYfUYz7ER1LNAvc6'
    );
  }
  return _buybackProgramId;
}

// Lazy load CNFT program ID
let _cnftProgramId: PublicKey | null = null;
export function getCnftProgramId(): PublicKey {
  if (!_cnftProgramId) {
    _cnftProgramId = new PublicKey(
      process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID || 'DGDipfpHGVAnWXj7yPEBc3JYFWghQN76tEBzuK2Nojw3'
    );
  }
  return _cnftProgramId;
}

// ============================================
// TOKEN MINTS (Devnet - Created Oct 31, 2025)
// ============================================

// Lazy load BACK token mint
let _backTokenMint: PublicKey | null = null;
export function getBackTokenMint(): PublicKey {
  if (!_backTokenMint) {
    _backTokenMint = new PublicKey(
      process.env.NEXT_PUBLIC_BACK_MINT || DEFAULT_BACK_MINT
    );
  }
  return _backTokenMint;
}

// Tokens communs sur Solana (hardcoded, safe to export)
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
// Note: Ces valeurs sont indicatives. Le boost réel est calculé dynamiquement
// basé sur le montant et la durée de lock (max 20%)
export const LEVEL_BOOSTS: Record<CNFTLevel, number> = {
  [CNFTLevel.Bronze]: 3,   // Référence pour locks courts/petits montants
  [CNFTLevel.Silver]: 8,   // Référence pour locks moyens
  [CNFTLevel.Gold]: 15,    // Référence pour locks importants (le max est 20%)
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

// Lazy load to avoid module-level env access
export function getSolanaNetwork(): string {
  return process.env.NEXT_PUBLIC_SOLANA_NETWORK || DEFAULT_SOLANA_NETWORK;
}

// DO NOT export SOLANA_NETWORK at module level - use getSolanaNetwork() instead

export const SOLANA_RPC_ENDPOINTS = {
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
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
export const TOKEN_DECIMALS = 9; // $BACK Token-2022 mint uses 9 decimals

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
  network?: string
): string {
  const networkToUse = network || getSolanaNetwork();
  return `${SOLANA_EXPLORER_BASE_URL}/${type}/${value}?cluster=${networkToUse}`;
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
