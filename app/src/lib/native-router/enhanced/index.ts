/**
 * 🔀 SwapBack Native Router - Enhanced Module Exports
 * 
 * Ce fichier centralise tous les exports des modules améliorés
 * du RouterSwap natif SwapBack.
 * 
 * @author SwapBack Team
 * @date January 2025
 */

// ============================================================================
// CORE ROUTER
// ============================================================================

export {
  NativeRouterService,
  calculateDynamicSlippage,
  ROUTER_PROGRAM_ID,
  DEX_PROGRAMS,
  SOL_MINT,
  USDC_MINT,
  SLIPPAGE_CONFIG,
  JITO_TIP_ACCOUNTS,
  DEFAULT_JITO_TIP_LAMPORTS,
} from '../headless/router';

export type {
  VenueQuote,
  NativeRouteQuote,
  NativeSwapParams,
  NativeSwapResult,
  VenueScoreData,
  VenueType,
  DynamicSlippageInputs,
  SlippageResult,
  OracleObservation,
} from '../headless/router';

// ============================================================================
// SLIPPAGE ESTIMATION
// ============================================================================

export {
  RealTimeSlippageEstimator,
  getSlippageEstimator,
} from '../slippage/RealTimeSlippageEstimator';

export type {
  SlippageObservation,
  SlippageEstimate,
  VolatilityData,
  PoolLiquidityData,
} from '../slippage/RealTimeSlippageEstimator';

// ============================================================================
// TRANSACTION SIMULATION
// ============================================================================

export {
  TransactionSimulator,
  getTransactionSimulator,
} from '../simulation/TransactionSimulator';

export type {
  SimulationResult,
  SimulationError,
  KnownErrorInfo,
  BalanceChange,
} from '../simulation/TransactionSimulator';

// ============================================================================
// QUOTE CACHE
// ============================================================================

export {
  HierarchicalQuoteCache,
  getQuoteCache,
} from '../cache/HierarchicalQuoteCache';

export type {
  CachedQuote,
  CacheEntry,
  QuoteCacheStats,
  QuoteFetchResult,
} from '../cache/HierarchicalQuoteCache';

// ============================================================================
// DEX ACCOUNT RESOLVERS
// ============================================================================

export {
  getOrcaWhirlpoolAccounts,
  getMeteoraAccounts,
  getPhoenixAccounts,
  getRaydiumAccounts,
  getDEXAccounts,
  getAllDEXAccounts,
} from '../dex/DEXAccountResolvers';

export type {
  DEXAccounts,
  PoolInfo,
  SupportedVenue,
} from '../dex/DEXAccountResolvers';

// ============================================================================
// STRUCTURED LOGGING
// ============================================================================

export {
  createLogger,
  createSwapTracker,
  trackEvent,
  flushAnalytics,
  setLogLevel,
  initSession,
  getSessionId,
  routerLogger,
  quoteLogger,
  simulationLogger,
  transactionLogger,
  cacheLogger,
  oracleLogger,
  StructuredLogger,
  SwapMetricsTracker,
} from '../logging/StructuredLogger';

export type {
  LogLevel,
  LogContext,
  LogEntry,
  SwapMetrics,
  AnalyticsEvent,
} from '../logging/StructuredLogger';

// ============================================================================
// CONVENIENCE FACTORY
// ============================================================================

import { Connection } from '@solana/web3.js';
import { NativeRouterService } from '../headless/router';
import { getSlippageEstimator } from '../slippage/RealTimeSlippageEstimator';
import { getTransactionSimulator } from '../simulation/TransactionSimulator';
import { getQuoteCache } from '../cache/HierarchicalQuoteCache';
import { initSession, createLogger } from '../logging/StructuredLogger';

/**
 * Crée une instance complète du router avec tous les services
 */
export function createEnhancedRouter(connection: Connection) {
  // Initialiser la session de logging
  initSession();
  
  const logger = createLogger('EnhancedRouter');
  logger.info('Initializing enhanced router', {
    rpcEndpoint: connection.rpcEndpoint,
  });
  
  return {
    /** Service de routing principal */
    router: new NativeRouterService(connection),
    /** Estimateur de slippage avec EMA */
    slippageEstimator: getSlippageEstimator(connection),
    /** Simulateur de transactions */
    simulator: getTransactionSimulator(connection),
    /** Cache hiérarchique de quotes */
    cache: getQuoteCache(),
    /** Logger structuré */
    logger,
  };
}

export default createEnhancedRouter;
