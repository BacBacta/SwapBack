/**
 * SwapRoute Decision Function
 *
 * Fonction pure et testable qui détermine si un swap doit être exécuté
 * via le routage natif SwapBack (direct DEX CPI) ou non.
 *
 * IMPORTANT:
 * - Le routage natif V1 sélectionne une venue off-chain puis exécute un swap
 *   direct vers le DEX via CPI (sans dépendance obligatoire à un routeur tiers).
 * - Les paires sans oracle configuré doivent être bloquées côté client.
 *
 * Conditions pour route=native:
 * 1. Flag global activé (NEXT_PUBLIC_NATIVE_SWAP_ENABLED=true)
 * 2. Paire supportée (oracle configuré dans ORACLE_FEED_CONFIGS)
 *
 * Référence: docs/ai/solana-native-router-a2z.md
 *
 * @author SwapBack Team
 * @date December 10, 2025
 */

import { hasOracleForPair, listSupportedOraclePairs } from "@/config/oracles";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Reason codes pour la décision de routing
 */
export type SwapRouteReason =
  | "FLAG_DISABLED"           // Feature flag NEXT_PUBLIC_NATIVE_SWAP_ENABLED=false
  | "PAIR_UNSUPPORTED"        // Paire non dans ORACLE_FEED_CONFIGS
  | "ORACLE_CONFIG_MISSING"   // Oracle introuvable (legacy, équivalent PAIR_UNSUPPORTED)
  | "JUPITER_CPI_UNAVAILABLE" // Legacy reason (ne doit pas être utilisé pour le routage natif V1)
  | "NATIVE_ELIGIBLE"         // Toutes conditions remplies → route native
  | "FALLBACK_JUPITER";       // Legacy reason (ne doit pas être utilisé pour le routage natif V1)

/**
 * Résultat de la décision de routing
 */
export interface SwapRouteDecision {
  /** Route choisie: native (via SwapBack router) ou jupiter (direct) */
  route: "native" | "jupiter";
  /** Code de la raison */
  reason: SwapRouteReason;
  /** Message humain (pour logs/UI) */
  message: string;
  /** Détails supplémentaires pour debug */
  details?: Record<string, unknown>;
}

/**
 * Paramètres d'entrée pour la décision
 */
export interface SwapRouteParams {
  /** Mint du token d'entrée */
  inputMint: string;
  /** Mint du token de sortie */
  outputMint: string;
  /** Legacy (non requis pour le routage natif V1) */
  hasJupiterCpi: boolean;
  /** Override du feature flag (pour tests) */
  featureFlagOverride?: boolean;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Vérifie si le feature flag native swap est activé
 */
export function isNativeSwapFeatureEnabled(override?: boolean): boolean {
  if (typeof override === "boolean") {
    return override;
  }
  
  // Lire depuis env var (côté client: NEXT_PUBLIC_*)
  const envValue = typeof window !== "undefined" 
    ? process.env.NEXT_PUBLIC_NATIVE_SWAP_ENABLED
    : process.env.NATIVE_SWAP_ENABLED;
  
  // Par défaut: activé (true) si non défini ou "true"
  // Désactivé explicitement si "false"
  if (envValue === "false" || envValue === "0") {
    return false;
  }
  
  return true;
}

// ============================================================================
// DECISION FUNCTION
// ============================================================================

/**
 * Décide si un swap doit utiliser le router natif ou Jupiter direct.
 * 
 * Cette fonction est PURE (pas d'effets de bord) et TESTABLE.
 * 
 * @param params - Paramètres de la décision
 * @returns SwapRouteDecision avec route, reason et message
 */
export function decideSwapRoute(params: SwapRouteParams): SwapRouteDecision {
  const { inputMint, outputMint, featureFlagOverride } = params;
  
  // 1. Vérifier le feature flag global
  if (!isNativeSwapFeatureEnabled(featureFlagOverride)) {
    return {
      route: "jupiter",
      reason: "FLAG_DISABLED",
      message: "Swap natif désactivé par configuration.",
      details: {
        featureFlag: "NEXT_PUBLIC_NATIVE_SWAP_ENABLED",
        value: "false",
      },
    };
  }
  
  // 2. Vérifier si la paire est supportée (a un oracle configuré)
  const pairKey = `${inputMint.slice(0, 8)}.../${outputMint.slice(0, 8)}...`;
  
  if (!hasOracleForPair(inputMint, outputMint)) {
    return {
      route: "jupiter",
      reason: "PAIR_UNSUPPORTED",
      message: `Paire ${pairKey} non supportée par le swap natif.`,
      details: {
        inputMint,
        outputMint,
        supportedPairs: listSupportedOraclePairs().length,
      },
    };
  }
  
  // 4. Toutes les conditions sont remplies → route native
  return {
    route: "native",
    reason: "NATIVE_ELIGIBLE",
    message: `Swap natif disponible pour ${pairKey}.`,
    details: {
      inputMint,
      outputMint,
    },
  };
}

// ============================================================================
// LOGGING HELPERS
// ============================================================================

/**
 * Formatte la décision pour les logs structurés
 */
export function formatRouteDecisionForLog(decision: SwapRouteDecision): Record<string, unknown> {
  return {
    route: decision.route,
    reason: decision.reason,
    message: decision.message,
    ...decision.details,
  };
}

/**
 * Retourne un message UI-friendly basé sur la raison
 */
export function getUIMessageForReason(reason: SwapRouteReason): string {
  switch (reason) {
    case "FLAG_DISABLED":
      return "Le swap natif est temporairement désactivé.";
    case "PAIR_UNSUPPORTED":
      return "Cette paire n'est pas supportée par le swap natif.";
    case "ORACLE_CONFIG_MISSING":
      return "Configuration oracle manquante pour cette paire.";
    case "JUPITER_CPI_UNAVAILABLE":
      return "Préparation du swap natif indisponible.";
    case "NATIVE_ELIGIBLE":
      return "Swap via le router SwapBack avec rebates activés.";
    case "FALLBACK_JUPITER":
    default:
      return "Swap natif indisponible.";
  }
}
