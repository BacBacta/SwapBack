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
import { 
  TrueNativeSwap,
  type TrueNativeRoute,
  type TrueNativeSwapResult,
} from "@/lib/native-router/true-native-swap";
import { toPublicKey } from "@/lib/native-router/utils/publicKeyUtils";
import { 
  isNativeSwapAvailable, 
  hasOracleForPair,
  NATIVE_SWAP_UNAVAILABLE_MESSAGE 
} from "@/config/oracles";
import { 
  decideSwapRoute, 
  formatRouteDecisionForLog,
  getUIMessageForReason,
  type SwapRouteDecision,
} from "@/lib/swap-routing";
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
  /** Callback de progression pour UI */
  onProgress?: (status: 'preparing' | 'signing' | 'sending' | 'confirming' | 'confirmed') => void;
}

export interface NativeSwapQuote {
  // Montants
  inputAmount: number;
  outputAmount: number;
  netOutputAmount: number; // Après frais + rebates
  slippageBpsUsed: number;
  
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
  const [useTrueNativeRouting, setUseTrueNativeRouting] = useState(false);
  const [trueNativeRoute, setTrueNativeRoute] = useState<TrueNativeRoute | null>(null);
  
  // Vérifier si les swaps natifs sont disponibles
  const nativeSwapEnabled = useMemo(() => {
    return isNativeSwapAvailable();
  }, []);

  // Router natif (ancien, utilise Jupiter CPI)
  const nativeRouter = useMemo(() => {
    return getNativeRouter(connection);
  }, [connection]);

  // Vrai routeur natif (appelle directement les DEX)
  const trueNativeSwap = useMemo(() => {
    return new TrueNativeSwap(connection);
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
        const inputMintStr = params.inputMint.toString();
        const outputMintStr = params.outputMint.toString();
        
        // ============================================================
        // Décision de routing centralisée via decideSwapRoute
        // ============================================================
        // Note: hasJupiterCpi est true ici car on vérifie avant d'obtenir
        // la quote. Le vrai check jupiterCpi se fait au moment du swap.
        const routeDecision = decideSwapRoute({
          inputMint: inputMintStr,
          outputMint: outputMintStr,
          hasJupiterCpi: true, // Présumé disponible pour la quote
        });
        
        // Log structuré de la décision
        logger.debug("useNativeSwap", "Route decision", formatRouteDecisionForLog(routeDecision));
        
        // Si route != native, retourner null avec message approprié
        if (routeDecision.route !== "native") {
          const uiMessage = getUIMessageForReason(routeDecision.reason);
          logger.info("useNativeSwap", "Routing to Jupiter", {
            reason: routeDecision.reason,
            inputMint: inputMintStr.slice(0, 8),
            outputMint: outputMintStr.slice(0, 8),
          });
          setError(uiMessage);
          return null;
        }
        
        logger.info("useNativeSwap", "Fetching native quote", {
          inputMint: inputMintStr,
          outputMint: outputMintStr,
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
          bestVenue: route.bestVenue, // Utiliser directement bestVenue de la route
          
          // Économie
          priceImpactBps: route.totalPriceImpactBps,
          estimatedRebate: route.estimatedRebate,
          estimatedNpi: route.estimatedNpi,
          platformFeeBps: route.platformFeeBps,
          
          // Slippage dynamique
          slippageResult,
          dynamicSlippageBps,
          slippageBpsUsed: dynamicSlippageBps,
          
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

        // Rafraîchir si l'utilisateur a changé le slippage depuis la dernière quote
        if (
          typeof params.slippageBps === "number" &&
          typeof quote.slippageBpsUsed === "number" &&
          quote.slippageBpsUsed !== params.slippageBps
        ) {
          logger.info("useNativeSwap", "Slippage changed since last quote, refetching", {
            previousSlippageBps: quote.slippageBpsUsed,
            requestedSlippageBps: params.slippageBps,
          });
          quote = await getSwapQuote(params, userBoostBps);
          if (!quote) {
            throw new Error("Impossible d'obtenir une quote (slippage mismatch)");
          }
        }

        logger.info("useNativeSwap", "Executing native swap", {
          inputAmount: quote.inputAmount,
          outputAmount: quote.outputAmount,
          venues: quote.venues.map(v => v.venue),
          boostBps: userBoostBps,
          mevProtection: params.useMevProtection ?? useMevProtection,
        });

        // 2. Calculer le min output avec slippage (utiliser dynamique si disponible)
        const slippageBps =
          params.slippageBps ??
          quote.dynamicSlippageBps ??
          quote.slippageBpsUsed ??
          SLIPPAGE_CONFIG.BASE_SLIPPAGE_BPS;
        const minAmountOut = Math.floor(quote.outputAmount * (10000 - slippageBps) / 10000);

        logger.info("useNativeSwap", "Prepared slippage thresholds", {
          quoteTimestamp: quote.timestamp,
          quoteExpiresAt: quote.expiresAt,
          quoteOutputAmount: quote.outputAmount,
          appliedSlippageBps: slippageBps,
          quoteSlippageBpsUsed: quote.slippageBpsUsed,
          minAmountOut,
        });

        // Notifier: on va demander la signature
        params.onProgress?.('signing');
        console.log("[useNativeSwap] Calling nativeRouter.executeSwap...");

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
            // L'utilisateur est en train de signer dans son wallet
            console.log("[useNativeSwap] Waiting for wallet signature...");
            const signed = await signTransaction(tx);
            console.log("[useNativeSwap] Transaction signed, sending...");
            // Une fois signé, on passe à l'envoi
            params.onProgress?.('sending');
            return signed;
          }
        );

        console.log("[useNativeSwap] executeSwap returned:", result);

        // Notifier: confirmation en cours
        params.onProgress?.('confirming');

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
        
        // Notifier: confirmé!
        params.onProgress?.('confirmed');

        return finalResult;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur lors du swap";
        logger.error("useNativeSwap", "Swap error", { error: message });
        const normalized = message.toLowerCase();
        if (
          normalized.includes("too large") ||
          normalized.includes("1644") ||
          normalized.includes("1232") ||
          normalized.includes("trop volumineuse")
        ) {
          setError(
            "Transaction trop volumineuse pour le router natif. " +
            "Réduisez le montant ou utilisez Jupiter direct."
          );
        } else if (
          normalized.includes("0x177e") ||
          normalized.includes("slippage") ||
          normalized.includes("slippage exceeded")
        ) {
          setError(
            "Le prix a bougé pendant la simulation (slippage dépassé). " +
            "Actualisez la quote ou augmentez légèrement le slippage."
          );
        } else if (normalized.includes("native_slippage_gate")) {
          setError(
            "Le router natif ne peut pas respecter ce slippage avec Jupiter. " +
            "Relancez une quote fraîche ou passez via Jupiter directement."
          );
        } else {
          setError(message);
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, signTransaction, currentQuote, getSwapQuote, nativeRouter, calculateBoostedRebate]
  );

  /**
   * 🔥 Exécuter un swap via le VRAI routage natif (sans Jupiter)
   * Appelle directement les DEX (Orca, Raydium, Meteora) via le mode Dynamic Plan
   */
  const executeTrueNativeSwap = useCallback(
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
        // Normaliser les PublicKey en entrée
        const safeInputMint = toPublicKey(params.inputMint);
        const safeOutputMint = toPublicKey(params.outputMint);

        logger.info("useNativeSwap", "🔥 Executing TRUE native swap (no Jupiter)", {
          inputMint: safeInputMint.toBase58().slice(0, 8),
          outputMint: safeOutputMint.toBase58().slice(0, 8),
          amount: params.amount,
        });

        params.onProgress?.('preparing');

        // Calculer le min output avec slippage
        const slippageBps = params.slippageBps ?? SLIPPAGE_CONFIG.BASE_SLIPPAGE_BPS;
        
        // Obtenir la meilleure route native
        const route = await trueNativeSwap.getBestNativeRoute({
          inputMint: safeInputMint,
          outputMint: safeOutputMint,
          amountIn: params.amount,
          minAmountOut: 0, // Sera calculé après
          slippageBps,
          userPublicKey: publicKey,
        });

        if (!route) {
          throw new Error(
            "Aucune venue native disponible. Cette paire n'est pas supportée " +
            "par les DEX natifs (Orca, Raydium, Meteora). Utilisez Jupiter."
          );
        }

        setTrueNativeRoute(route);

        const minAmountOut = Math.floor(route.outputAmount * (10000 - slippageBps) / 10000);

        logger.info("useNativeSwap", "True native route found", {
          venue: route.venue,
          outputAmount: route.outputAmount,
          minAmountOut,
          priceImpactBps: route.priceImpactBps,
        });

        // Construire la transaction
        const result = await trueNativeSwap.buildNativeSwapTransaction({
          inputMint: safeInputMint,
          outputMint: safeOutputMint,
          amountIn: params.amount,
          minAmountOut,
          slippageBps,
          userPublicKey: publicKey,
        });

        if (!result) {
          throw new Error("Impossible de construire la transaction native");
        }

        // Signer
        params.onProgress?.('signing');
        const signedTx = await signTransaction(result.transaction);

        // Envoyer
        params.onProgress?.('sending');
        const signature = await connection.sendTransaction(signedTx, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });

        logger.info("useNativeSwap", "True native tx sent", { signature });

        // Confirmer
        params.onProgress?.('confirming');
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }

        // Succès !
        params.onProgress?.('confirmed');

        const swapResult: NativeSwapResult = {
          signature,
          inputAmount: params.amount,
          outputAmount: route.outputAmount,
          inputMint: safeInputMint.toBase58(),
          outputMint: safeOutputMint.toBase58(),
          venues: [route.venue],
          rebateAmount: calculateBoostedRebate(route.outputAmount * 0.001, userBoostBps).boostedRebate,
          boostApplied: userBoostBps,
          npiGenerated: route.outputAmount * 0.001,
          success: true,
        };

        setLastSwapResult(swapResult);

        logger.info("useNativeSwap", "🔥 TRUE native swap completed!", {
          signature,
          venue: route.venue,
          outputAmount: route.outputAmount,
        });

        return swapResult;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur lors du swap natif";
        logger.error("useNativeSwap", "True native swap error", { error: message });
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, signTransaction, connection, trueNativeSwap, calculateBoostedRebate]
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

  /**
   * Vérifie si une paire est supportée pour le swap natif
   * Utilise decideSwapRoute pour une décision cohérente
   */
  const isPairSupported = useCallback(
    (inputMint: PublicKey | string, outputMint: PublicKey | string): boolean => {
      const inputStr = typeof inputMint === "string" ? inputMint : inputMint.toString();
      const outputStr = typeof outputMint === "string" ? outputMint : outputMint.toString();
      
      const decision = decideSwapRoute({
        inputMint: inputStr,
        outputMint: outputStr,
        hasJupiterCpi: true, // Présumé pour le check UI
      });
      
      return decision.route === "native";
    },
    []
  );

  return {
    // État
    loading,
    quoteLoading,
    error,
    lastSwapResult,
    currentQuote,
    nativeSwapEnabled,
    
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
    isPairSupported,
    
    // 🔥 Vrai routage natif (sans Jupiter)
    useTrueNativeRouting,
    setUseTrueNativeRouting,
    executeTrueNativeSwap,
    trueNativeRoute,
    
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
