/**
 * 🔄 Hook pour Swaps avec Boost
 *
 * Intègre le système de boost au processus de swap pour appliquer
 * automatiquement les rebates boostés.
 *
 * @author SwapBack Team
 * @date October 26, 2025
 * @updated November 29, 2025 - Intégration Jupiter V6 API pour swaps réels
 */

"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { useBoostCalculations } from "./useBoostCalculations";
import { getJupiterService } from "@/lib/jupiter";
import { logger } from "@/lib/logger";

export interface SwapParams {
  inputMint: PublicKey;
  outputMint: PublicKey;
  amount: number;
  slippage?: number; // Default 0.5%
}

export interface SwapResult {
  signature: string;
  inputAmount: number;
  outputAmount: number;
  baseRebate: number;
  boostedRebate: number;
  boostApplied: number;
  extraGain: number;
}

export interface SwapQuote {
  inputAmount: number;
  outputAmount: number;
  baseRebate: number;
  boostedRebate: number;
  boostBP: number;
  estimatedGas: number;
  priceImpact: number;
}

export function useSwapWithBoost() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { calculateBoostedRebate } = useBoostCalculations();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSwapResult, setLastSwapResult] = useState<SwapResult | null>(null);

  /**
   * Obtenir une quote de swap avec boost via Jupiter V6 API
   */
  const getSwapQuote = useCallback(
    async (
      params: SwapParams,
      userBoostBP: number = 0
    ): Promise<SwapQuote | null> => {
      try {
        setError(null);

        // Utiliser Jupiter V6 API pour obtenir une vraie quote
        const jupiterService = getJupiterService(connection);
        
        const quote = await jupiterService.getQuote({
          inputMint: params.inputMint.toString(),
          outputMint: params.outputMint.toString(),
          amount: params.amount,
          slippageBps: Math.floor((params.slippage ?? 0.5) * 100), // Convert % to bps
        });

        // Calculer les rebates
        const inputAmountNum = parseInt(quote.inAmount);
        const outputAmountNum = parseInt(quote.outAmount);
        const baseRebateRate = 0.003; // 0.3% - sera configuré depuis le programme router
        const baseRebate = inputAmountNum * baseRebateRate;

        // Appliquer le boost
        const rebateCalc = calculateBoostedRebate(baseRebate, userBoostBP);

        logger.info('useSwapWithBoost', 'Quote received with boost', {
          inAmount: inputAmountNum,
          outAmount: outputAmountNum,
          boostBP: userBoostBP,
          baseRebate,
          boostedRebate: rebateCalc.boostedRebate,
        });

        return {
          inputAmount: inputAmountNum,
          outputAmount: outputAmountNum,
          baseRebate,
          boostedRebate: rebateCalc.boostedRebate,
          boostBP: userBoostBP,
          estimatedGas: 0.000005, // ~5000 lamports
          priceImpact: parseFloat(quote.priceImpactPct),
        };
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erreur lors de la récupération de la quote";
        logger.error('useSwapWithBoost', 'Quote error', { error: message });
        setError(message);
        return null;
      }
    },
    [connection, calculateBoostedRebate]
  );

  /**
   * Exécuter un swap avec boost appliqué via Jupiter V6 API
   */
  const executeSwap = useCallback(
    async (
      params: SwapParams,
      userBoostBP: number = 0
    ): Promise<SwapResult | null> => {
      if (!publicKey || !signTransaction) {
        setError("Veuillez connecter votre wallet");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        // 1. Obtenir la quote
        const quote = await getSwapQuote(params, userBoostBP);
        if (!quote) {
          throw new Error("Impossible d'obtenir une quote");
        }

        logger.info('useSwapWithBoost', 'Executing swap with boost', {
          inputAmount: quote.inputAmount,
          outputAmount: quote.outputAmount,
          boostBP: userBoostBP,
        });

        // 2. Exécuter le swap via Jupiter V6 API
        const jupiterService = getJupiterService(connection);
        
        const swapResult = await jupiterService.executeSwap(
          params.inputMint.toString(),
          params.outputMint.toString(),
          params.amount,
          publicKey.toString(),
          async (tx: VersionedTransaction) => {
            // Signer la transaction versionnée
            return await signTransaction(tx);
          },
          {
            slippageBps: Math.floor((params.slippage ?? 0.5) * 100),
            priorityFee: 'auto',
          }
        );

        logger.info('useSwapWithBoost', 'Swap executed successfully', {
          signature: swapResult.signature,
          inputAmount: swapResult.inputAmount,
          outputAmount: swapResult.outputAmount,
          boostApplied: userBoostBP,
        });

        const result: SwapResult = {
          signature: swapResult.signature,
          inputAmount: swapResult.inputAmount,
          outputAmount: swapResult.outputAmount,
          baseRebate: quote.baseRebate,
          boostedRebate: quote.boostedRebate,
          boostApplied: userBoostBP,
          extraGain: quote.boostedRebate - quote.baseRebate,
        };

        setLastSwapResult(result);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erreur lors du swap";
        logger.error('useSwapWithBoost', 'Swap error', { error: message });
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, signTransaction, connection, getSwapQuote]
  );

  /**
   * Comparer plusieurs routes de swap via Jupiter
   */
  const compareRoutes = useCallback(
    async (
      params: SwapParams,
      userBoostBP: number = 0
    ): Promise<Array<SwapQuote & { routeName: string }> | null> => {
      try {
        setError(null);

        // Obtenir la quote principale via Jupiter
        const baseQuote = await getSwapQuote(params, userBoostBP);
        if (!baseQuote) return null;

        // Jupiter agrège déjà les meilleures routes
        // On retourne la meilleure route avec des estimations basées sur le prix réel
        // Le ratio 0.997 représente les frais AMM typiques (0.3%)
        const directAmmFeeMultiplier = 0.997;
        
        return [
          { ...baseQuote, routeName: "Jupiter (Best)" },
          {
            ...baseQuote,
            outputAmount: Math.floor(baseQuote.outputAmount * directAmmFeeMultiplier),
            routeName: "Direct AMM",
          },
        ];
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erreur lors de la comparaison";
        setError(message);
        return null;
      }
    },
    [getSwapQuote]
  );

  /**
   * Estimer les gains sur une période avec boost
   */
  const estimateBoostGains = useCallback(
    (
      monthlySwapVolume: number,
      boostBP: number,
      baseRebateRate: number = 0.003
    ) => {
      const baseMonthlyRebate = monthlySwapVolume * baseRebateRate;
      const rebateCalc = calculateBoostedRebate(baseMonthlyRebate, boostBP);

      const daily = rebateCalc.extraGain / 30;
      const monthly = rebateCalc.extraGain;
      const yearly = rebateCalc.extraGain * 12;

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
          daily: Math.round(daily * 100) / 100,
          monthly: Math.round(monthly * 100) / 100,
          yearly: Math.round(yearly * 100) / 100,
        },
        boostMultiplier: rebateCalc.multiplier,
      };
    },
    [calculateBoostedRebate]
  );

  return {
    // État
    loading,
    error,
    lastSwapResult,

    // Actions
    getSwapQuote,
    executeSwap,
    compareRoutes,

    // Utilitaires
    estimateBoostGains,
  };
}

/**
 * Hook pour obtenir l'historique des swaps de l'utilisateur
 */
export function useSwapHistory() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [history, setHistory] = useState<SwapResult[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!publicKey) return;

    setLoading(true);
    try {
      // Récupérer l'historique depuis les transactions on-chain
      // Note: Pour une implémentation complète, filtrer par le programme SwapBack
      const signatures = await connection.getSignaturesForAddress(
        publicKey,
        { limit: 50 }
      );
      
      // Pour l'instant, utiliser localStorage comme cache combiné avec on-chain
      const cached = localStorage.getItem(
        `swap_history_${publicKey.toBase58()}`
      );
      if (cached) {
        setHistory(JSON.parse(cached));
      }
      
      logger.info('useSwapHistory', 'Fetched history', {
        onChainCount: signatures.length,
        cachedCount: history.length,
      });
    } catch (err) {
      logger.error('useSwapHistory', 'Error fetching history', { error: err });
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection, history.length]);

  const saveSwap = useCallback(
    (swap: SwapResult) => {
      if (!publicKey) return;

      const newHistory = [swap, ...history].slice(0, 50); // Keep last 50
      setHistory(newHistory);
      localStorage.setItem(
        `swap_history_${publicKey.toBase58()}`,
        JSON.stringify(newHistory)
      );
    },
    [publicKey, history]
  );

  const clearHistory = useCallback(() => {
    if (!publicKey) return;

    setHistory([]);
    localStorage.removeItem(`swap_history_${publicKey.toBase58()}`);
  }, [publicKey]);

  const getTotalStats = useCallback(() => {
    if (history.length === 0) {
      return {
        totalSwaps: 0,
        totalVolume: 0,
        totalRebates: 0,
        totalBoostedRebates: 0,
        totalExtraGains: 0,
        avgBoost: 0,
      };
    }

    const totalVolume = history.reduce((sum, s) => sum + s.inputAmount, 0);
    const totalRebates = history.reduce((sum, s) => sum + s.baseRebate, 0);
    const totalBoostedRebates = history.reduce(
      (sum, s) => sum + s.boostedRebate,
      0
    );
    const totalExtraGains = history.reduce((sum, s) => sum + s.extraGain, 0);
    const avgBoost =
      history.reduce((sum, s) => sum + s.boostApplied, 0) / history.length;

    return {
      totalSwaps: history.length,
      totalVolume: Math.round(totalVolume * 100) / 100,
      totalRebates: Math.round(totalRebates * 100) / 100,
      totalBoostedRebates: Math.round(totalBoostedRebates * 100) / 100,
      totalExtraGains: Math.round(totalExtraGains * 100) / 100,
      avgBoost: Math.round(avgBoost),
    };
  }, [history]);

  return {
    history,
    loading,
    fetchHistory,
    saveSwap,
    clearHistory,
    getTotalStats,
  };
}
