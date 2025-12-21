/**
 * 🔀 SwapBack Routing Configuration
 *
 * Configuration centralisée pour le routing natif SwapBack.
 * Ce fichier contrôle les venues, le split-route, le slippage dynamique,
 * et les paramètres de benchmark.
 *
 * @see https://dev.jup.ag/docs/routing - Jupiter routing architecture reference
 * @see docs/ai/solana-native-router-a2z.md - Documentation interne obligatoire
 *
 * @author SwapBack Team
 * @date December 20, 2025
 */

import { PublicKey } from "@solana/web3.js";

// ============================================================================
// TYPES
// ============================================================================

export type SupportedVenue =
  | "ORCA_WHIRLPOOL"
  | "METEORA_DLMM"
  | "RAYDIUM_AMM"
  | "RAYDIUM_CLMM"
  | "PHOENIX"
  | "LIFINITY"
  | "SANCTUM"
  | "SABER";

export interface VenueConfig {
  /** Identifiant unique de la venue */
  id: SupportedVenue;
  /** Nom d'affichage */
  displayName: string;
  /** Program ID on-chain */
  programId: PublicKey;
  /** La venue est-elle active pour le routing? */
  enabled: boolean;
  /** La venue supporte-t-elle les quotes API? */
  hasQuoteAPI: boolean;
  /** Frais de la venue en basis points (ex: 30 = 0.3%) */
  feeBps: number;
  /** Priorité de quote (plus bas = plus prioritaire) */
  quotePriority: number;
  /** Notes/limitations connues */
  notes?: string;
}

export interface SplitRouteConfig {
  /** Activer le split-route (répartir le volume entre venues) */
  enabled: boolean;
  /** Nombre maximum de splits (venues différentes dans un swap) */
  maxSplits: number;
  /** Pourcentage minimum par split (évite les poussières) */
  minSplitPercent: number;
  /** Montant minimum en USD pour activer le split (petits swaps = single venue) */
  minAmountUsdForSplit: number;
  /** Fractions à tester pour l'optimisation */
  testFractions: number[];
}

export interface DynamicSlippageConfig {
  /** Activer le slippage dynamique */
  enabled: boolean;
  /** Slippage de base en bps */
  baseSlippageBps: number;
  /** Slippage maximum en bps */
  maxSlippageBps: number;
  /** Seuil de taille (% du TVL pool) au-delà duquel on augmente le slippage */
  sizeThresholdBps: number;
  /** Facteur d'impact de la volatilité */
  volatilityFactor: number;
  /** Diviseur pour la composante volatilité */
  volatilityDivisor: number;
}

export interface JupiterBenchmarkConfig {
  /** Activer le benchmark contre Jupiter */
  enabled: boolean;
  /** Afficher la comparaison dans l'UI */
  showComparison: boolean;
  /** Endpoint Jupiter pour les quotes */
  quoteEndpoint: string;
  /** Timeout pour les requêtes benchmark (ms) */
  timeoutMs: number;
  /** Seuil d'alerte: si on est pire que Jupiter de X bps, afficher warning */
  alertThresholdBps: number;
}

export interface MultiHopConfig {
  /** Activer les routes multi-hop (A→B→C) */
  enabled: boolean;
  /** Nombre maximum de hops */
  maxHops: number;
  /** Tokens intermédiaires autorisés */
  intermediateTokens: string[];
}

export interface RoutingConfig {
  venues: VenueConfig[];
  splitRoute: SplitRouteConfig;
  dynamicSlippage: DynamicSlippageConfig;
  jupiterBenchmark: JupiterBenchmarkConfig;
  multiHop: MultiHopConfig;
  /** Timeout global pour les quotes (ms) */
  quoteTimeoutMs: number;
  /** Concurrence maximale pour les requêtes de quote */
  quoteConcurrency: number;
  /** Staleness maximum des oracles (secondes) */
  maxOracleStalenessSecs: number;
}

// ============================================================================
// DEX PROGRAM IDs (Mainnet)
// ============================================================================

export const DEX_PROGRAM_IDS = {
  RAYDIUM_AMM: new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"),
  RAYDIUM_CLMM: new PublicKey("CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK"),
  ORCA_WHIRLPOOL: new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"),
  METEORA_DLMM: new PublicKey("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo"),
  PHOENIX: new PublicKey("PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY"),
  LIFINITY: new PublicKey("EewxydAPCCVuNEyrVN68PuSYdQ7wKn27V9Gjeoi8dy3S"),
  SANCTUM: new PublicKey("5ocnV1qiCgaQR8Jb8xWnVbApfaygJ8tNoZfgPwsgx9kx"),
  SABER: new PublicKey("SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ"),
} as const;

// ============================================================================
// VENUE CONFIGURATIONS
// ============================================================================

/**
 * Configuration des venues DEX
 *
 * IMPORTANT: Les venues sont maintenant configurables et peuvent être
 * activées/désactivées sans modifier le code.
 *
 * Notes sur les venues:
 * - ORCA_WHIRLPOOL: Venue principale, très fiable, quote via SDK ou API
 * - METEORA_DLMM: Excellent pour les paires stables, quote via SDK
 * - RAYDIUM_AMM: Large liquidité, RÉACTIVÉ avec validation stricte
 * - PHOENIX: CLOB, réactivé avec quote orderbook
 * - LIFINITY: Oracle-based AMM, bon pour certaines paires
 *
 * @see https://dev.orca.so/SDKs/Overview/
 * @see https://docs.meteora.ag/developer-guide/guides/dlmm/typescript-sdk/getting-started
 * @see https://docs.raydium.io/raydium/traders/trade-api
 */
export const VENUE_CONFIGS: VenueConfig[] = [
  {
    id: "ORCA_WHIRLPOOL",
    displayName: "Orca Whirlpool",
    programId: DEX_PROGRAM_IDS.ORCA_WHIRLPOOL,
    enabled: true,
    hasQuoteAPI: true,
    feeBps: 30, // 0.3%
    quotePriority: 1,
    notes: "Primary venue, very reliable",
  },
  {
    id: "METEORA_DLMM",
    displayName: "Meteora DLMM",
    programId: DEX_PROGRAM_IDS.METEORA_DLMM,
    enabled: true,
    hasQuoteAPI: true,
    feeBps: 20, // 0.2%
    quotePriority: 2,
    notes: "Excellent for concentrated liquidity",
  },
  {
    id: "RAYDIUM_AMM",
    displayName: "Raydium AMM",
    programId: DEX_PROGRAM_IDS.RAYDIUM_AMM,
    enabled: true, // RÉACTIVÉ - était désactivé
    hasQuoteAPI: true,
    feeBps: 25, // 0.25%
    quotePriority: 3,
    notes: "Large liquidity, re-enabled with strict pool validation",
  },
  {
    id: "PHOENIX",
    displayName: "Phoenix",
    programId: DEX_PROGRAM_IDS.PHOENIX,
    enabled: true, // RÉACTIVÉ - était désactivé
    hasQuoteAPI: false, // Requiert SDK on-chain
    feeBps: 10, // ~0.1% taker fee
    quotePriority: 4,
    notes: "CLOB orderbook, excellent for large orders",
  },
  {
    id: "LIFINITY",
    displayName: "Lifinity",
    programId: DEX_PROGRAM_IDS.LIFINITY,
    enabled: true,
    hasQuoteAPI: true,
    feeBps: 30, // 0.3%
    quotePriority: 5,
    notes: "Oracle-based AMM",
  },
  {
    id: "RAYDIUM_CLMM",
    displayName: "Raydium CLMM",
    programId: DEX_PROGRAM_IDS.RAYDIUM_CLMM,
    enabled: false, // Désactivé jusqu'à implémentation complète
    hasQuoteAPI: true,
    feeBps: 25, // 0.25%
    quotePriority: 6,
    notes: "Concentrated liquidity, requires CLMM-specific implementation",
  },
  {
    id: "SABER",
    displayName: "Saber",
    programId: DEX_PROGRAM_IDS.SABER,
    enabled: true,
    hasQuoteAPI: true,
    feeBps: 4, // 0.04% - stableswap
    quotePriority: 7,
    notes: "Stableswap, low fees for stable pairs",
  },
  {
    id: "SANCTUM",
    displayName: "Sanctum",
    programId: DEX_PROGRAM_IDS.SANCTUM,
    enabled: false, // LST specific
    hasQuoteAPI: false,
    feeBps: 10, // 0.1%
    quotePriority: 8,
    notes: "LST swaps only",
  },
];

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Configuration par défaut du routing
 *
 * Peut être surchargée via variables d'environnement:
 * - NEXT_PUBLIC_SPLIT_ROUTE_ENABLED=true
 * - NEXT_PUBLIC_DYNAMIC_SLIPPAGE_ENABLED=true
 * - NEXT_PUBLIC_JUPITER_BENCHMARK_ENABLED=true
 */
export const DEFAULT_ROUTING_CONFIG: RoutingConfig = {
  venues: VENUE_CONFIGS,

  splitRoute: {
    enabled: true,
    maxSplits: 4, // Increased from 3 for better routing
    minSplitPercent: 5, // Reduced from 10% for finer granularity
    minAmountUsdForSplit: 100, // Split seulement pour > $100
    // PHASE 2: 1% granularity (100 fractions) for Jupiter-competitive routing
    // @see https://dev.jup.ag/blog/metis-v7 - Jupiter uses fine-grained splits
    testFractions: Array.from({ length: 20 }, (_, i) => (i + 1) * 0.05), // 5%, 10%, 15%... 100%
  },

  dynamicSlippage: {
    enabled: true,
    baseSlippageBps: 100, // 1% base (augmenté pour tokens volatils comme JUP)
    maxSlippageBps: 500, // 5% max
    sizeThresholdBps: 50, // Impact si > 0.5% du pool
    volatilityFactor: 1.5,
    volatilityDivisor: 10,
  },

  jupiterBenchmark: {
    enabled: true,
    showComparison: true,
    quoteEndpoint: "https://public.jupiterapi.com/quote",
    timeoutMs: 5000,
    alertThresholdBps: 50, // Alerte si pire de 50bps vs Jupiter
  },

  multiHop: {
    enabled: true,
    maxHops: 2,
    intermediateTokens: [
      "So11111111111111111111111111111111111111112", // SOL
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
    ],
  },

  quoteTimeoutMs: 8000,
  quoteConcurrency: 4,
  maxOracleStalenessSecs: 120,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Récupère la configuration de routing (avec overrides env)
 */
export function getRoutingConfig(): RoutingConfig {
  const config = { ...DEFAULT_ROUTING_CONFIG };

  // Override via env variables
  if (typeof process !== "undefined" && process.env) {
    if (process.env.NEXT_PUBLIC_SPLIT_ROUTE_ENABLED === "false") {
      config.splitRoute.enabled = false;
    }
    if (process.env.NEXT_PUBLIC_DYNAMIC_SLIPPAGE_ENABLED === "false") {
      config.dynamicSlippage.enabled = false;
    }
    if (process.env.NEXT_PUBLIC_JUPITER_BENCHMARK_ENABLED === "false") {
      config.jupiterBenchmark.enabled = false;
    }
    if (process.env.NEXT_PUBLIC_MULTI_HOP_ENABLED === "false") {
      config.multiHop.enabled = false;
    }

    const timeout = Number(process.env.NEXT_PUBLIC_SWAPBACK_QUOTE_TIMEOUT_MS);
    if (Number.isFinite(timeout) && timeout > 0) {
      config.quoteTimeoutMs = timeout;
    }

    const concurrency = Number(process.env.NEXT_PUBLIC_SWAPBACK_QUOTE_CONCURRENCY);
    if (Number.isFinite(concurrency) && concurrency > 0) {
      config.quoteConcurrency = concurrency;
    }
  }

  return config;
}

/**
 * Récupère les venues actives
 */
export function getEnabledVenues(): VenueConfig[] {
  return getRoutingConfig().venues.filter((v) => v.enabled);
}

/**
 * Récupère les venues avec quote API
 */
export function getQuotableVenues(): VenueConfig[] {
  return getEnabledVenues().filter((v) => v.hasQuoteAPI);
}

/**
 * Récupère une venue par son ID
 */
export function getVenueConfig(venueId: SupportedVenue): VenueConfig | undefined {
  return getRoutingConfig().venues.find((v) => v.id === venueId);
}

/**
 * Vérifie si une venue est active
 */
export function isVenueEnabled(venueId: SupportedVenue): boolean {
  const venue = getVenueConfig(venueId);
  return venue?.enabled ?? false;
}

/**
 * Récupère les frais d'une venue en bps
 */
export function getVenueFeeBps(venueId: SupportedVenue): number {
  const venue = getVenueConfig(venueId);
  return venue?.feeBps ?? 30; // Default 0.3%
}

/**
 * Calcule le slippage dynamique basé sur le montant et le TVL
 */
export function calculateDynamicSlippage(
  amountIn: number,
  poolTvl: number,
  volatilityBps: number = 0
): number {
  const config = getRoutingConfig().dynamicSlippage;

  if (!config.enabled) {
    return config.baseSlippageBps;
  }

  let slippage = config.baseSlippageBps;

  // Composante taille: augmente si le swap représente une part importante du pool
  if (poolTvl > 0) {
    const sizeRatioBps = Math.floor((amountIn / poolTvl) * 10000);
    if (sizeRatioBps > config.sizeThresholdBps) {
      slippage += sizeRatioBps - config.sizeThresholdBps;
    }
  } else {
    // TVL inconnu: ajouter une marge de sécurité
    slippage += 50;
  }

  // Composante volatilité
  if (volatilityBps > 0 && config.volatilityDivisor > 0) {
    slippage += Math.floor((volatilityBps * config.volatilityFactor) / config.volatilityDivisor);
  }

  // Cap au maximum
  return Math.min(slippage, config.maxSlippageBps);
}

/**
 * Détermine si le split-route est applicable pour ce montant
 */
export function shouldUseSplitRoute(amountUsd: number): boolean {
  const config = getRoutingConfig().splitRoute;
  return config.enabled && amountUsd >= config.minAmountUsdForSplit;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  getRoutingConfig,
  getEnabledVenues,
  getQuotableVenues,
  getVenueConfig,
  isVenueEnabled,
  getVenueFeeBps,
  calculateDynamicSlippage,
  shouldUseSplitRoute,
  DEX_PROGRAM_IDS,
  VENUE_CONFIGS,
  DEFAULT_ROUTING_CONFIG,
};
