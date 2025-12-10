/**
 * Swap Routing Module
 * 
 * Exports pour la logique de décision de routing swap.
 */

export {
  decideSwapRoute,
  isNativeSwapFeatureEnabled,
  formatRouteDecisionForLog,
  getUIMessageForReason,
  type SwapRouteDecision,
  type SwapRouteParams,
  type SwapRouteReason,
} from "./decideSwapRoute";
