/**
 * 🔄 Hook pour Swaps avec Boost
 * 
 * Intègre le système de boost au processus de swap pour appliquer
 * automatiquement les rebates boostés.
 * 
 * @author SwapBack Team
 * @date October 26, 2025
 */

'use client';

import { useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { useBoostCalculations } from './useBoostCalculations';

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
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const { calculateBoostedRebate } = useBoostCalculations();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSwapResult, setLastSwapResult] = useState<SwapResult | null>(null);

  /**
   * Obtenir une quote de swap avec boost
   */
  const getSwapQuote = useCallback(async (
    params: SwapParams,
    userBoostBP: number = 0
  ): Promise<SwapQuote | null> => {
    try {
      setError(null);

      // TODO: Appeler votre API de routing Jupiter/autre
      // Pour l'instant, simulation
      const mockOutputAmount = params.amount * 0.998; // Mock: 0.2% slippage
      const baseRebateRate = 0.003; // 0.3%
      const baseRebate = params.amount * baseRebateRate;

      // Appliquer le boost
      const rebateCalc = calculateBoostedRebate(baseRebate, userBoostBP);

      return {
        inputAmount: params.amount,
        outputAmount: mockOutputAmount,
        baseRebate,
        boostedRebate: rebateCalc.boostedRebate,
        boostBP: userBoostBP,
        estimatedGas: 0.000005, // 5000 lamports
        priceImpact: 0.2,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la récupération de la quote';
      setError(message);
      return null;
    }
  }, [calculateBoostedRebate]);

  /**
   * Exécuter un swap avec boost appliqué
   */
  const executeSwap = useCallback(async (
    params: SwapParams,
    userBoostBP: number = 0
  ): Promise<SwapResult | null> => {
    if (!publicKey || !signTransaction) {
      setError('Veuillez connecter votre wallet');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Obtenir la quote
      const quote = await getSwapQuote(params, userBoostBP);
      if (!quote) {
        throw new Error('Impossible d\'obtenir une quote');
      }

      // 2. Construire la transaction via le router
      // TODO: Appeler votre programme router avec les paramètres boost
      // Pour l'instant, simulation
      
      console.log('📊 Swap Quote:', quote);
      console.log('🚀 Boost appliqué:', userBoostBP, 'BP');

      // Simulation d'une transaction
      const mockSignature = 'simulation_' + Date.now();
      
      const result: SwapResult = {
        signature: mockSignature,
        inputAmount: quote.inputAmount,
        outputAmount: quote.outputAmount,
        baseRebate: quote.baseRebate,
        boostedRebate: quote.boostedRebate,
        boostApplied: userBoostBP,
        extraGain: quote.boostedRebate - quote.baseRebate,
      };

      setLastSwapResult(result);
      return result;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du swap';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [publicKey, signTransaction, getSwapQuote]);

  /**
   * Comparer plusieurs routes de swap
   */
  const compareRoutes = useCallback(async (
    params: SwapParams,
    userBoostBP: number = 0
  ): Promise<Array<SwapQuote & { routeName: string }> | null> => {
    try {
      setError(null);

      // TODO: Interroger plusieurs DEX/routes
      // Pour l'instant, simulation avec différentes routes
      
      const baseQuote = await getSwapQuote(params, userBoostBP);
      if (!baseQuote) return null;

      return [
        { ...baseQuote, routeName: 'SwapBack Router' },
        { ...baseQuote, outputAmount: baseQuote.outputAmount * 0.995, routeName: 'Jupiter' },
        { ...baseQuote, outputAmount: baseQuote.outputAmount * 0.993, routeName: 'Raydium' },
      ];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la comparaison';
      setError(message);
      return null;
    }
  }, [getSwapQuote]);

  /**
   * Estimer les gains sur une période avec boost
   */
  const estimateBoostGains = useCallback((
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
  }, [calculateBoostedRebate]);

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
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [history, setHistory] = useState<SwapResult[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!publicKey) return;

    setLoading(true);
    try {
      // TODO: Interroger les transactions on-chain
      // Pour l'instant, utiliser localStorage comme cache
      const cached = localStorage.getItem(`swap_history_${publicKey.toBase58()}`);
      if (cached) {
        setHistory(JSON.parse(cached));
      }
    } catch (err) {
      console.error('Erreur lors du chargement de l\'historique:', err);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  const saveSwap = useCallback((swap: SwapResult) => {
    if (!publicKey) return;

    const newHistory = [swap, ...history].slice(0, 50); // Keep last 50
    setHistory(newHistory);
    localStorage.setItem(`swap_history_${publicKey.toBase58()}`, JSON.stringify(newHistory));
  }, [publicKey, history]);

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
    const totalBoostedRebates = history.reduce((sum, s) => sum + s.boostedRebate, 0);
    const totalExtraGains = history.reduce((sum, s) => sum + s.extraGain, 0);
    const avgBoost = history.reduce((sum, s) => sum + s.boostApplied, 0) / history.length;

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
