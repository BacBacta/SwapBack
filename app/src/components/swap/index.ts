/**
 * 🎨 Swap UI Components - Enhanced Exports
 * 
 * Composants UI améliorés pour le swap:
 * - SwapModeSelector: Sélecteur mode simple/avancé
 * - RouteVisualization: Visualisation des routes
 * - FiatEquivalent: Équivalents fiat
 * - QuoteCountdown: Countdown de validité quote
 * - FeeEstimate: Estimation des frais
 * - TransactionProgress: Progression transaction
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
// QUOTE COUNTDOWN
// ============================================================================

export {
  QuoteCountdown,
  useQuoteCountdown,
} from './QuoteCountdown';

// ============================================================================
// FEE ESTIMATE
// ============================================================================

export {
  FeeEstimate,
  useSolPrice,
} from './FeeEstimate';

export type {
  PriorityLevel,
} from './FeeEstimate';

// ============================================================================
// TRANSACTION PROGRESS
// ============================================================================

export {
  TransactionProgress,
} from './TransactionProgress';

export type {
  TransactionStep,
  TransactionProgressProps,
} from './TransactionProgress';

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
