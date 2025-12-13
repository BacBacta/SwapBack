/**
 * 🎨 Swap UI Components - Enhanced Exports
 * 
 * Composants UI améliorés pour le swap:
 * - SwapModeSelector: Sélecteur mode simple/avancé
 * - RouteVisualization: Visualisation des routes
 * - FiatEquivalent: Équivalents fiat
 * 
 * @author SwapBack Team
 * @date January 2025
 */

// ============================================================================
// MODE SELECTOR
// ============================================================================

export {
  SwapModeSelector,
  useSwapMode,
  SIMPLE_MODE_CONFIG,
  ADVANCED_MODE_CONFIG,
} from './SwapModeSelector';

export type {
  SwapMode,
  SwapModeConfig,
  SwapModeSelectorProps,
} from './SwapModeSelector';

// ============================================================================
// ROUTE VISUALIZATION
// ============================================================================

export {
  RouteVisualization,
} from './RouteVisualization';

export type {
  RouteVenue,
  RouteVisualizationProps,
} from './RouteVisualization';

// ============================================================================
// FIAT EQUIVALENT
// ============================================================================

export {
  FiatEquivalent,
  SingleTokenFiat,
} from './FiatEquivalent';

export type {
  FiatCurrency,
  TokenAmount,
  FiatEquivalentProps,
  PriceData,
  SingleTokenFiatProps,
} from './FiatEquivalent';

// ============================================================================
// ENHANCED SWAP CARD
// ============================================================================

export {
  EnhancedSwapCard,
} from './EnhancedSwapCard';

export type {
  TokenInfo,
  EnhancedSwapCardProps,
} from './EnhancedSwapCard';
