/**
 * 🚀 Hook Amélioré pour Swaps Natifs SwapBack (niveau Jupiter Ultra)
 *
 * Ce hook étend useNativeSwap avec:
 * - Slippage dynamique avancé (EMA + volatilité + liquidité)
 * - Simulation pré-exécution
 * - Cache hiérarchique des quotes
 *
 * @author SwapBack Team
 */

"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { 
  getNativeRouter, 
  type VenueQuote,
} from "@/lib/native-router";
import { 
  RealTimeSlippageEstimator,
  TransactionSimulator,
  HierarchicalQuoteCache,
  initSession,
  type SlippageEstimate,
  type SimulationResult,
} from "@/lib/native-router/enhanced";
import { 
  decideSwapRoute, 
  getUIMessageForReason,
} from "@/lib/swap-routing";
import { useBoostCalculations } from "./useBoostCalculations";
import { logger } from "@/lib/logger";

// ============================================================================
// TYPES
// ============================================================================

export type SwapMode = 'simple' | 'advanced';

export interface EnhancedSwapParams {
  inputMint: PublicKey;
  outputMint: PublicKey;
  amount: number;
  slippageBps?: number;
  useMevProtection?: boolean;
  forceRefresh?: boolean;
  simulateFirst?: boolean;
  onProgress?: (status: SwapProgressStatus) => void;
}

export type SwapProgressStatus = 
  | 'fetching-quote'
  | 'estimating-slippage'
  | 'simulating'
  | 'preparing'
  | 'signing'
  | 'sending'
  | 'confirming'
  | 'confirmed'
  | 'failed';

export interface EnhancedQuote {
  inputAmount: number;
  outputAmount: number;
  netOutputAmount: number;
  venues: VenueQuote[];
  bestVenue: string;
  priceImpactBps: number;
  estimatedRebate: number;
  estimatedNpi: number;
  slippageEstimate: SlippageEstimate;
  recommendedSlippageBps: number;
  slippageConfidence: number;
  simulationResult?: SimulationResult;
  simulationPassed: boolean;
  baseRebate: number;
  boostedRebate: number;
  boostBps: number;
  fromCache: boolean;
  cacheLevel?: 'L1' | 'L2' | 'L3';
  timestamp: number;
  expiresAt: number;
  quoteId: string;
}

export interface SwapAnalytics {
  totalSwaps: number;
  successfulSwaps: number;
  cacheHitRate: number;
}

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

let sharedSlippageEstimator: RealTimeSlippageEstimator | null = null;
let sharedQuoteCache: HierarchicalQuoteCache | null = null;
const swapCount = { total: 0, successful: 0 };

function getSharedInstances() {
  if (!sharedSlippageEstimator) {
    sharedSlippageEstimator = new RealTimeSlippageEstimator({
      emaAlpha: 0.3,
      minSampleSize: 3,
      maxHistorySize: 50,
      volatilityWeight: 0.4,
      liquidityWeight: 0.3,
    });
  }
  
  if (!sharedQuoteCache) {
    sharedQuoteCache = new HierarchicalQuoteCache({
      l1: { maxSize: 50, ttlMs: 100 },
      l2: { maxSize: 100, ttlMs: 5000 },
      l3: { maxSize: 200, ttlMs: 30000 },
    });
  }
  
  return {
    slippageEstimator: sharedSlippageEstimator,
    quoteCache: sharedQuoteCache,
  };
}

// ============================================================================
// HOOK
// ============================================================================

export function useEnhancedNativeSwap() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { calculateBoostedRebate } = useBoostCalculations();

  // États
  const [loading, setLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentQuote, setCurrentQuote] = useState<EnhancedQuote | null>(null);
  const [mode, setMode] = useState<SwapMode>('simple');
  const [progressStatus, setProgressStatus] = useState<SwapProgressStatus | null>(null);
  
  // Instances partagées
  const { slippageEstimator, quoteCache } = useMemo(
    () => getSharedInstances(),
    []
  );
  
  // Simulateur
  const simulator = useMemo(() => {
    return new TransactionSimulator(connection, {
      maxRetries: 2,
      retryDelayMs: 500,
    });
  }, [connection]);
  
  // Router natif
  const nativeRouter = useMemo(() => {
    return getNativeRouter(connection);
  }, [connection]);
  
  // Session init
  useEffect(() => {
    initSession();
  }, []);

  // ============================================================================
  // QUOTE AMÉLIORÉE
  // ============================================================================
  
  const getEnhancedQuote = useCallback(
    async (
      params: EnhancedSwapParams,
      userBoostBps: number = 0
    ): Promise<EnhancedQuote | null> => {
      if (!publicKey) {
        setError("Veuillez connecter votre wallet");
        return null;
      }

      setQuoteLoading(true);
      setError(null);
      setProgressStatus('fetching-quote');

      const quoteId = `Q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      try {
        const inputMintStr = params.inputMint.toString();
        const outputMintStr = params.outputMint.toString();
        const cacheKey = `${inputMintStr}-${outputMintStr}-${params.amount}`;
        
        // Vérifier le cache
        if (!params.forceRefresh) {
          const cached = quoteCache.get(cacheKey);
          if (cached) {
            logger.debug("useEnhancedNativeSwap", "Quote cache hit", { cacheKey });
            
            const cachedQuote: EnhancedQuote = {
              ...cached.data,
              fromCache: true,
              cacheLevel: cached.level as 'L1' | 'L2' | 'L3',
              quoteId,
            };
            
            setCurrentQuote(cachedQuote);
            setProgressStatus(null);
            return cachedQuote;
          }
        }
        
        // Décision de routing
        const routeDecision = decideSwapRoute({
          inputMint: inputMintStr,
          outputMint: outputMintStr,
          hasJupiterCpi: true,
        });
        
        if (routeDecision.route !== "native") {
          const uiMessage = getUIMessageForReason(routeDecision.reason);
          setError(uiMessage);
          setProgressStatus('failed');
          return null;
        }

        // Récupérer la route native
        const route = await nativeRouter.buildNativeRoute(
          params.inputMint,
          params.outputMint,
          params.amount,
          params.slippageBps ?? 50
        );

        if (!route || route.venues.length === 0) {
          throw new Error("Aucune venue native disponible pour cette paire");
        }

        // Estimation du slippage
        setProgressStatus('estimating-slippage');
        
        const slippageEstimate = slippageEstimator.estimateSlippage(
          inputMintStr,
          outputMintStr,
          params.amount,
          route.venues[0]?.tvl ?? 10_000_000_000_000
        );

        // Calcul des rebates
        const baseRebate = route.estimatedRebate;
        const rebateCalc = calculateBoostedRebate(baseRebate, userBoostBps);

        const quote: EnhancedQuote = {
          inputAmount: route.totalInputAmount,
          outputAmount: route.totalOutputAmount,
          netOutputAmount: route.netOutputAmount,
          venues: route.venues,
          bestVenue: route.bestVenue,
          priceImpactBps: route.totalPriceImpactBps,
          estimatedRebate: route.estimatedRebate,
          estimatedNpi: route.estimatedNpi,
          slippageEstimate,
          recommendedSlippageBps: slippageEstimate.recommendedBps,
          slippageConfidence: slippageEstimate.confidence,
          simulationPassed: true,
          baseRebate,
          boostedRebate: rebateCalc.boostedRebate,
          boostBps: userBoostBps,
          fromCache: false,
          timestamp: Date.now(),
          expiresAt: Date.now() + 30000,
          quoteId,
        };

        // Stocker dans le cache
        quoteCache.set(cacheKey, quote);
        
        setCurrentQuote(quote);
        setProgressStatus(null);

        return quote;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur lors de la quote";
        logger.error("useEnhancedNativeSwap", "Quote error", { error: message });
        setError(message);
        setProgressStatus('failed');
        return null;
      } finally {
        setQuoteLoading(false);
      }
    },
    [publicKey, nativeRouter, calculateBoostedRebate, quoteCache, slippageEstimator]
  );

  // ============================================================================
  // EXÉCUTION
  // ============================================================================
  
  const executeEnhancedSwap = useCallback(
    async (
      params: EnhancedSwapParams,
      userBoostBps: number = 0
    ): Promise<{ success: boolean; signature?: string; error?: string }> => {
      if (!publicKey || !signTransaction) {
        setError("Veuillez connecter votre wallet");
        return { success: false, error: "Wallet non connecté" };
      }

      setLoading(true);
      setError(null);
      swapCount.total++;

      try {
        // 1. Quote fraîche
        let quote = currentQuote;
        if (!quote || quote.expiresAt < Date.now() || params.forceRefresh) {
          quote = await getEnhancedQuote(params, userBoostBps);
        }

        if (!quote) {
          throw new Error("Impossible d'obtenir une quote");
        }

        // 2. Simulation pré-exécution (mode avancé)
        if (mode === 'advanced' || params.simulateFirst) {
          setProgressStatus('simulating');
          params.onProgress?.('simulating');
          
          const slippageBps = params.slippageBps ?? quote.recommendedSlippageBps;
          const minAmountOut = Math.floor(quote.outputAmount * (10000 - slippageBps) / 10000);
          
          const txResult = await nativeRouter.buildSwapTransaction(
            publicKey,
            params.inputMint,
            params.outputMint,
            params.amount,
            minAmountOut,
            quote.venues[0]?.venue ?? 'raydium'
          );
          
          if (!txResult) {
            throw new Error("Impossible de construire la transaction");
          }
          
          const simResult = await simulator.simulateTransaction(txResult.transaction);
          
          if (!simResult.success) {
            throw new Error(
              simResult.parsedError?.userMessage ?? 
              simResult.errorMessage ?? 
              "La simulation a échoué"
            );
          }
        }

        // 3. Exécution réelle
        setProgressStatus('preparing');
        params.onProgress?.('preparing');
        
        const slippageBps = params.slippageBps ?? quote.recommendedSlippageBps;
        const minAmountOut = Math.floor(quote.outputAmount * (10000 - slippageBps) / 10000);

        const txResult = await nativeRouter.buildSwapTransaction(
          publicKey,
          params.inputMint,
          params.outputMint,
          params.amount,
          minAmountOut,
          quote.venues[0]?.venue ?? 'raydium'
        );
        
        if (!txResult) {
          throw new Error("Impossible de construire la transaction");
        }

        setProgressStatus('signing');
        params.onProgress?.('signing');
        
        const signedTx = await signTransaction(txResult.transaction);
        
        setProgressStatus('sending');
        params.onProgress?.('sending');
        
        const signature = await connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: params.useMevProtection,
          maxRetries: 3,
        });
        
        setProgressStatus('confirming');
        params.onProgress?.('confirming');
        
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        
        if (confirmation.value.err) {
          throw new Error(`Transaction échouée: ${JSON.stringify(confirmation.value.err)}`);
        }

        setProgressStatus('confirmed');
        params.onProgress?.('confirmed');
        
        swapCount.successful++;

        return { success: true, signature };
        
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur lors du swap";
        logger.error("useEnhancedNativeSwap", "Swap error", { error: message });
        setError(message);
        setProgressStatus('failed');
        params.onProgress?.('failed');
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [publicKey, signTransaction, connection, nativeRouter, currentQuote, getEnhancedQuote, simulator, mode]
  );

  // ============================================================================
  // ANALYTICS
  // ============================================================================
  
  const getAnalytics = useCallback((): SwapAnalytics => {
    const cacheStats = quoteCache.getStats();
    
    return {
      totalSwaps: swapCount.total,
      successfulSwaps: swapCount.successful,
      cacheHitRate: cacheStats.totalHits / Math.max(1, cacheStats.totalHits + cacheStats.totalMisses),
    };
  }, [quoteCache]);

  // ============================================================================
  // UTILITAIRES
  // ============================================================================
  
  const clearCache = useCallback(() => {
    quoteCache.clear();
  }, [quoteCache]);
  
  const setSwapMode = useCallback((newMode: SwapMode) => {
    setMode(newMode);
  }, []);

  // ============================================================================
  // RETURN
  // ============================================================================
  
  return {
    loading,
    quoteLoading,
    error,
    currentQuote,
    mode,
    progressStatus,
    getEnhancedQuote,
    executeEnhancedSwap,
    setSwapMode,
    clearCache,
    getAnalytics,
    slippageEstimator,
    quoteCache,
  };
}

export default useEnhancedNativeSwap;
