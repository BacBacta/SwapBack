/**
 * 🔄 Hook pour Swaps Natifs SwapBack
 *
 * Ce hook utilise EXCLUSIVEMENT les venues natives (Raydium, Orca, Meteora, Phoenix)
 * via le programme router on-chain SwapBack au lieu de passer par Jupiter.
 * 
 * Avantages:
 * - Génère du NPI (Native Price Improvement)
 * - Distribue des rebates aux utilisateurs
 * - Utilise le scoring des venues on-chain
 * - Supporte le boost cNFT
 *
 * @author SwapBack Team
 * @date December 8, 2025
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { 
  getNativeRouter, 
  type NativeRouteQuote, 
  type NativeSwapResult,
  type VenueQuote,
  type SlippageResult,
  calculateDynamicSlippage,
  checkOracleDivergence,
  SLIPPAGE_CONFIG,
  MIN_VENUE_SCORE,
  MAX_ORACLE_DIVERGENCE_BPS,
} from "@/lib/native-router";
import { useBoostCalculations } from "./useBoostCalculations";
import { logger } from "@/lib/logger";

// ============================================================================
// TYPES
// ============================================================================

export interface NativeSwapParams {
  inputMint: PublicKey;
  outputMint: PublicKey;
  amount: number; // En lamports
  slippageBps?: number; // Default: dynamique
  useMevProtection?: boolean; // Activer Jito bundle
}

export interface NativeSwapQuote {
  // Montants
  inputAmount: number;
  outputAmount: number;
  netOutputAmount: number; // Après frais + rebates
  
  // Route
  venues: VenueQuote[];
  bestVenue: string;
  
  // Économie
  priceImpactBps: number;
  estimatedRebate: number;
  estimatedNpi: number;
  platformFeeBps: number;
  
  // Slippage dynamique
  slippageResult?: SlippageResult;
  dynamicSlippageBps: number;
  
  // Boost
  baseRebate: number;
  boostedRebate: number;
  boostBps: number;
  extraGain: number;
  
  // Méta
  timestamp: number;
  expiresAt: number;
}

export interface SwapHistoryEntry {
  signature: string;
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount: number;
  venues: string[];
  rebateAmount: number;
  boostApplied: number;
  timestamp: number;
}

// ============================================================================
// HOOK
// ============================================================================

export function useNativeSwap() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { calculateBoostedRebate } = useBoostCalculations();

  const [loading, setLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSwapResult, setLastSwapResult] = useState<NativeSwapResult | null>(null);
  const [currentQuote, setCurrentQuote] = useState<NativeSwapQuote | null>(null);
  const [useMevProtection, setUseMevProtection] = useState(false);

  // Router natif
  const nativeRouter = useMemo(() => {
    return getNativeRouter(connection);
  }, [connection]);

  /**
   * Obtenir une quote de swap via les venues natives
   */
  const getSwapQuote = useCallback(
    async (
      params: NativeSwapParams,
      userBoostBps: number = 0
    ): Promise<NativeSwapQuote | null> => {
      if (!publicKey) {
        setError("Veuillez connecter votre wallet");
        return null;
      }

      setQuoteLoading(true);
      setError(null);

      try {
        logger.info("useNativeSwap", "Fetching native quote", {
          inputMint: params.inputMint.toString(),
          outputMint: params.outputMint.toString(),
          amount: params.amount,
          boostBps: userBoostBps,
        });

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

        // Calculer le slippage dynamique si non fourni
        let dynamicSlippageBps = params.slippageBps ?? SLIPPAGE_CONFIG.BASE_SLIPPAGE_BPS;
        let slippageResult: SlippageResult | undefined;
        
        if (!params.slippageBps) {
          // Estimer la volatilité
          const volatilityBps = 100; // 1% par défaut, pourrait venir de l'oracle
          const poolTvl = 10_000_000_000_000; // 10M par défaut
          
          slippageResult = calculateDynamicSlippage({
            swapAmount: params.amount,
            poolTvl,
            volatilityBps,
          });
          dynamicSlippageBps = slippageResult.slippageBps;
          
          logger.info("useNativeSwap", "Dynamic slippage", {
            base: slippageResult.baseComponent,
            size: slippageResult.sizeComponent,
            volatility: slippageResult.volatilityComponent,
            total: slippageResult.slippageBps,
          });
        }

        // Calculer les rebates avec boost
        const baseRebate = route.estimatedRebate;
        const rebateCalc = calculateBoostedRebate(baseRebate, userBoostBps);

        const quote: NativeSwapQuote = {
          // Montants
          inputAmount: route.totalInputAmount,
          outputAmount: route.totalOutputAmount,
          netOutputAmount: route.netOutputAmount,
          
          // Route
          venues: route.venues,
          bestVenue: route.venues[0].venue,
          
          // Économie
          priceImpactBps: route.totalPriceImpactBps,
          estimatedRebate: route.estimatedRebate,
          estimatedNpi: route.estimatedNpi,
          platformFeeBps: route.platformFeeBps,
          
          // Slippage dynamique
          slippageResult,
          dynamicSlippageBps,
          
          // Boost
          baseRebate,
          boostedRebate: rebateCalc.boostedRebate,
          boostBps: userBoostBps,
          extraGain: rebateCalc.extraGain,
          
          // Méta
          timestamp: Date.now(),
          expiresAt: Date.now() + 30000, // 30 secondes de validité
        };

        setCurrentQuote(quote);

        logger.info("useNativeSwap", "Native quote received", {
          bestVenue: quote.bestVenue,
          outputAmount: quote.outputAmount,
          netOutput: quote.netOutputAmount,
          rebate: quote.boostedRebate,
          venueCount: quote.venues.length,
        });

        return quote;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur lors de la quote";
        logger.error("useNativeSwap", "Quote error", { error: message });
        setError(message);
        return null;
      } finally {
        setQuoteLoading(false);
      }
    },
    [publicKey, nativeRouter, calculateBoostedRebate]
  );

  /**
   * Exécuter un swap via les venues natives
   */
  const executeSwap = useCallback(
    async (
      params: NativeSwapParams,
      userBoostBps: number = 0
    ): Promise<NativeSwapResult | null> => {
      if (!publicKey || !signTransaction) {
        setError("Veuillez connecter votre wallet");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        // 1. Obtenir une quote fraîche si nécessaire
        let quote = currentQuote;
        if (!quote || quote.expiresAt < Date.now()) {
          quote = await getSwapQuote(params, userBoostBps);
        }

        if (!quote) {
          throw new Error("Impossible d'obtenir une quote");
        }

        logger.info("useNativeSwap", "Executing native swap", {
          inputAmount: quote.inputAmount,
          outputAmount: quote.outputAmount,
          venues: quote.venues.map(v => v.venue),
          boostBps: userBoostBps,
          mevProtection: params.useMevProtection ?? useMevProtection,
        });

        // 2. Calculer le min output avec slippage (utiliser dynamique si disponible)
        const slippageBps = params.slippageBps ?? quote.dynamicSlippageBps ?? SLIPPAGE_CONFIG.BASE_SLIPPAGE_BPS;
        const minAmountOut = Math.floor(quote.outputAmount * (10000 - slippageBps) / 10000);

        // 3. Exécuter via le router natif (avec MEV protection si activée)
        const result = await nativeRouter.executeSwap(
          {
            inputMint: params.inputMint,
            outputMint: params.outputMint,
            amountIn: params.amount,
            minAmountOut,
            slippageBps,
            userPublicKey: publicKey,
            boostBps: userBoostBps,
            useJitoBundle: params.useMevProtection ?? useMevProtection,
          },
          async (tx: VersionedTransaction) => {
            return await signTransaction(tx);
          }
        );

        logger.info("useNativeSwap", "Native swap executed successfully", {
          signature: result.signature,
          venues: result.venues,
          outputAmount: result.outputAmount,
          rebate: result.rebateAmount,
        });

        // Calculer le rebate boosted final
        const rebateCalc = calculateBoostedRebate(result.rebateAmount, userBoostBps);

        const finalResult: NativeSwapResult = {
          ...result,
          rebateAmount: rebateCalc.boostedRebate,
        };

        setLastSwapResult(finalResult);
        setCurrentQuote(null); // Invalider la quote

        return finalResult;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur lors du swap";
        logger.error("useNativeSwap", "Swap error", { error: message });
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, signTransaction, currentQuote, getSwapQuote, nativeRouter, calculateBoostedRebate]
  );

  /**
   * Comparer les routes natives disponibles
   */
  const compareRoutes = useCallback(
    async (params: NativeSwapParams): Promise<VenueQuote[] | null> => {
      try {
        setError(null);

        const quotes = await nativeRouter.getMultiVenueQuotes(
          params.inputMint,
          params.outputMint,
          params.amount
        );

        if (quotes.length === 0) {
          throw new Error("Aucune route native disponible");
        }

        return quotes;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur lors de la comparaison";
        setError(message);
        return null;
      }
    },
    [nativeRouter]
  );

  /**
   * Estimer les gains de rebates sur une période
   */
  const estimateRebateGains = useCallback(
    (
      monthlySwapVolume: number,
      boostBps: number,
      averageNpiBps: number = 10 // 0.1% NPI moyen
    ) => {
      // NPI mensuel estimé
      const monthlyNpi = monthlySwapVolume * averageNpiBps / 10000;
      
      // Rebate = 70% du NPI
      const baseMonthlyRebate = monthlyNpi * 0.7;
      
      // Appliquer le boost
      const rebateCalc = calculateBoostedRebate(baseMonthlyRebate, boostBps);

      return {
        base: {
          daily: baseMonthlyRebate / 30,
          monthly: baseMonthlyRebate,
          yearly: baseMonthlyRebate * 12,
        },
        boosted: {
          daily: rebateCalc.boostedRebate / 30,
          monthly: rebateCalc.boostedRebate,
          yearly: rebateCalc.boostedRebate * 12,
        },
        extra: {
          daily: rebateCalc.extraGain / 30,
          monthly: rebateCalc.extraGain,
          yearly: rebateCalc.extraGain * 12,
        },
        boostMultiplier: rebateCalc.multiplier,
        estimatedNpi: {
          daily: monthlyNpi / 30,
          monthly: monthlyNpi,
          yearly: monthlyNpi * 12,
        },
      };
    },
    [calculateBoostedRebate]
  );

  /**
   * Obtenir les venues supportées
   */
  const getSupportedVenues = useCallback(() => {
    return [
      { name: "Raydium", type: "AMM", npiEstimate: 10, minScore: MIN_VENUE_SCORE },
      { name: "Raydium CLMM", type: "CLMM", npiEstimate: 12, minScore: MIN_VENUE_SCORE },
      { name: "Orca Whirlpool", type: "CLMM", npiEstimate: 12, minScore: MIN_VENUE_SCORE },
      { name: "Meteora DLMM", type: "DLMM", npiEstimate: 15, minScore: MIN_VENUE_SCORE },
      { name: "Phoenix", type: "CLOB", npiEstimate: 8, minScore: MIN_VENUE_SCORE },
      { name: "Lifinity", type: "Oracle AMM", npiEstimate: 10, minScore: MIN_VENUE_SCORE },
      { name: "Sanctum", type: "LST", npiEstimate: 5, minScore: MIN_VENUE_SCORE },
      { name: "Saber", type: "StableSwap", npiEstimate: 3, minScore: MIN_VENUE_SCORE },
    ];
  }, []);
  
  /**
   * Obtenir la configuration de slippage
   */
  const getSlippageConfig = useCallback(() => {
    return {
      ...SLIPPAGE_CONFIG,
      description: {
        base: "Slippage de base appliqué à tous les swaps",
        max: "Slippage maximum autorisé",
        sizeThreshold: "Seuil d'impact sur le pool avant ajustement",
        volatilityDivisor: "Facteur de division de la volatilité",
      },
    };
  }, []);
  
  /**
   * Valider la divergence oracle
   */
  const validateOraclePrices = useCallback((price1: number, price2: number) => {
    const result = checkOracleDivergence(price1, price2);
    
    if (!result.isValid) {
      logger.warn("useNativeSwap", "Oracle divergence too high", {
        price1,
        price2,
        divergenceBps: result.divergenceBps,
        maxAllowed: MAX_ORACLE_DIVERGENCE_BPS,
      });
    }
    
    return result;
  }, []);

  return {
    // État
    loading,
    quoteLoading,
    error,
    lastSwapResult,
    currentQuote,
    
    // MEV Protection
    useMevProtection,
    setUseMevProtection,

    // Actions principales
    getSwapQuote,
    executeSwap,
    
    // Utilitaires
    compareRoutes,
    estimateRebateGains,
    getSupportedVenues,
    getSlippageConfig,
    validateOraclePrices,
    
    // Configuration
    slippageConfig: SLIPPAGE_CONFIG,
    minVenueScore: MIN_VENUE_SCORE,
    maxOracleDivergence: MAX_ORACLE_DIVERGENCE_BPS,
    
    // Réinitialisation
    clearError: () => setError(null),
    clearQuote: () => setCurrentQuote(null),
  };
}

export default useNativeSwap;
