/**
 * 🚀 EnhancedSwapCard - Interface Swap niveau Jupiter Ultra
 * 
 * Intègre:
 * - Mode Simple/Avancé
 * - Visualisation des routes
 * - Équivalents fiat
 * - Slippage dynamique
 * - Simulation pré-exécution
 */

"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { 
  ArrowDownIcon,
  Cog6ToothIcon,
  BoltIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { useEnhancedNativeSwap, type SwapMode, type SwapProgressStatus } from "@/hooks/useEnhancedNativeSwap";
import { SwapModeSelector, type SwapModeConfig } from "./SwapModeSelector";
import { RouteVisualization, type RouteInfo } from "./RouteVisualization";
import { FiatEquivalent, type FiatDisplayProps } from "./FiatEquivalent";
import { TOKEN_MINTS } from "@/config/tokens";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUri?: string;
}

export interface EnhancedSwapCardProps {
  className?: string;
  defaultInputToken?: TokenInfo;
  defaultOutputToken?: TokenInfo;
  onSwapComplete?: (signature: string) => void;
  onError?: (error: string) => void;
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export function EnhancedSwapCard({
  className,
  defaultInputToken,
  defaultOutputToken,
  onSwapComplete,
  onError,
}: EnhancedSwapCardProps) {
  const { publicKey, connected } = useWallet();
  
  const {
    loading,
    quoteLoading,
    error,
    currentQuote,
    mode,
    progressStatus,
    getEnhancedQuote,
    executeEnhancedSwap,
    setSwapMode,
    getAnalytics,
  } = useEnhancedNativeSwap();

  // États locaux
  const [inputToken, setInputToken] = useState<TokenInfo | null>(defaultInputToken ?? null);
  const [outputToken, setOutputToken] = useState<TokenInfo | null>(defaultOutputToken ?? null);
  const [inputAmount, setInputAmount] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [customSlippage, setCustomSlippage] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showRoute, setShowRoute] = useState(false);
  
  // Conversion du mode
  const modeConfig: SwapModeConfig = useMemo(() => ({
    mode,
    showPriceImpact: true,
    showRoute: mode === 'advanced',
    showSlippageDetails: mode === 'advanced',
    showRebateDetails: true,
    autoRefreshQuote: autoRefresh,
  }), [mode, autoRefresh]);

  // Préparer les données de route pour la visualisation
  const routeInfo: RouteInfo | null = useMemo(() => {
    if (!currentQuote) return null;
    
    return {
      venues: currentQuote.venues.map(v => ({
        name: v.venue,
        percentage: (v.outputAmount / currentQuote.outputAmount) * 100,
        outputAmount: v.outputAmount,
        priceImpactBps: v.priceImpactBps,
      })),
      totalOutput: currentQuote.outputAmount,
      jupiterComparison: currentQuote.estimatedNpi > 0 ? {
        swapbackBetter: true,
        differencePercent: currentQuote.estimatedNpi / 100,
        jupiterOutput: currentQuote.outputAmount - currentQuote.estimatedNpi,
      } : undefined,
    };
  }, [currentQuote]);

  // Gérer la quote
  const handleGetQuote = useCallback(async () => {
    if (!inputToken || !outputToken || !inputAmount) return;
    
    const amountLamports = parseFloat(inputAmount) * Math.pow(10, inputToken.decimals);
    
    await getEnhancedQuote({
      inputMint: new PublicKey(inputToken.mint),
      outputMint: new PublicKey(outputToken.mint),
      amount: amountLamports,
      slippageBps: customSlippage ?? undefined,
    });
  }, [inputToken, outputToken, inputAmount, customSlippage, getEnhancedQuote]);

  // Auto-refresh de la quote
  useEffect(() => {
    if (!autoRefresh || !currentQuote || loading) return;
    
    const interval = setInterval(() => {
      if (currentQuote.expiresAt < Date.now() + 5000) {
        handleGetQuote();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [autoRefresh, currentQuote, loading, handleGetQuote]);

  // Exécuter le swap
  const handleSwap = useCallback(async () => {
    if (!inputToken || !outputToken || !inputAmount || !currentQuote) return;
    
    const amountLamports = parseFloat(inputAmount) * Math.pow(10, inputToken.decimals);
    
    const result = await executeEnhancedSwap({
      inputMint: new PublicKey(inputToken.mint),
      outputMint: new PublicKey(outputToken.mint),
      amount: amountLamports,
      slippageBps: customSlippage ?? currentQuote.recommendedSlippageBps,
      simulateFirst: mode === 'advanced',
      onProgress: (status) => {
        console.log('Swap progress:', status);
      },
    });
    
    if (result.success && result.signature) {
      onSwapComplete?.(result.signature);
    } else if (result.error) {
      onError?.(result.error);
    }
  }, [inputToken, outputToken, inputAmount, currentQuote, customSlippage, mode, executeEnhancedSwap, onSwapComplete, onError]);

  // Inverser les tokens
  const handleSwapTokens = useCallback(() => {
    const temp = inputToken;
    setInputToken(outputToken);
    setOutputToken(temp);
    setInputAmount("");
  }, [inputToken, outputToken]);

  // Rendu du status de progression
  const progressLabel = useMemo(() => {
    const labels: Record<SwapProgressStatus, string> = {
      'fetching-quote': 'Récupération du prix...',
      'estimating-slippage': 'Estimation du slippage...',
      'simulating': 'Simulation en cours...',
      'preparing': 'Préparation...',
      'signing': 'En attente de signature...',
      'sending': 'Envoi de la transaction...',
      'confirming': 'Confirmation...',
      'confirmed': 'Confirmé ✓',
      'failed': 'Échec',
    };
    return progressStatus ? labels[progressStatus] : null;
  }, [progressStatus]);

  return (
    <div className={cn(
      "w-full max-w-md mx-auto",
      "bg-gradient-to-b from-slate-900 to-slate-950",
      "rounded-2xl border border-slate-700/50",
      "shadow-2xl shadow-purple-500/10",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <h2 className="text-lg font-semibold text-white">Swap</h2>
        <div className="flex items-center gap-2">
          {/* Mode Selector */}
          <SwapModeSelector
            config={modeConfig}
            onChange={(newConfig) => {
              setSwapMode(newConfig.mode);
              setAutoRefresh(newConfig.autoRefreshQuote ?? true);
            }}
            compact
          />
          
          {/* Settings */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              showSettings ? "bg-purple-500/20 text-purple-400" : "text-slate-400 hover:text-white"
            )}
          >
            <Cog6ToothIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-slate-700/50"
          >
            <div className="p-4 space-y-4">
              {/* Slippage */}
              <div>
                <label className="text-sm text-slate-400 mb-2 block">
                  Tolérance de Slippage
                </label>
                <div className="flex gap-2">
                  {[0.1, 0.5, 1.0].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setCustomSlippage(pct * 100)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                        customSlippage === pct * 100
                          ? "bg-purple-500 text-white"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      )}
                    >
                      {pct}%
                    </button>
                  ))}
                  <button
                    onClick={() => setCustomSlippage(null)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1",
                      customSlippage === null
                        ? "bg-purple-500 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    )}
                  >
                    <BoltIcon className="w-4 h-4" />
                    Auto
                  </button>
                </div>
                {currentQuote && customSlippage === null && (
                  <p className="mt-2 text-xs text-slate-500">
                    Slippage recommandé: {(currentQuote.recommendedSlippageBps / 100).toFixed(2)}%
                    (confiance: {Math.round(currentQuote.slippageConfidence * 100)}%)
                  </p>
                )}
              </div>
              
              {/* Mode avancé: simulation */}
              {mode === 'advanced' && (
                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <ShieldCheckIcon className="w-5 h-5 text-green-400" />
                    <span className="text-sm text-slate-300">Simulation pré-exécution</span>
                  </div>
                  <span className="text-xs text-green-400">Activée</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Token */}
      <div className="p-4">
        <div className="bg-slate-800/50 rounded-xl p-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-slate-400">Vous payez</span>
            {inputToken && (
              <FiatEquivalent
                tokenSymbol={inputToken.symbol}
                amount={parseFloat(inputAmount) || 0}
                className="text-sm"
                compact
              />
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              onBlur={handleGetQuote}
              placeholder="0.00"
              className="flex-1 bg-transparent text-2xl font-semibold text-white outline-none"
            />
            <button className="flex items-center gap-2 px-3 py-2 bg-slate-700 rounded-xl hover:bg-slate-600 transition-colors">
              {inputToken ? (
                <>
                  <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full" />
                  <span className="font-medium text-white">{inputToken.symbol}</span>
                </>
              ) : (
                <span className="text-slate-400">Sélectionner</span>
              )}
            </button>
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={handleSwapTokens}
            className="p-2 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors"
          >
            <ArrowDownIcon className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Output Token */}
        <div className="bg-slate-800/50 rounded-xl p-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-slate-400">Vous recevez</span>
            {currentQuote && outputToken && (
              <FiatEquivalent
                tokenSymbol={outputToken.symbol}
                amount={currentQuote.outputAmount / Math.pow(10, outputToken.decimals)}
                className="text-sm"
                compact
              />
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 text-2xl font-semibold text-white">
              {quoteLoading ? (
                <div className="flex items-center gap-2">
                  <ArrowPathIcon className="w-5 h-5 animate-spin text-purple-400" />
                  <span className="text-slate-500">...</span>
                </div>
              ) : currentQuote && outputToken ? (
                (currentQuote.outputAmount / Math.pow(10, outputToken.decimals)).toLocaleString(undefined, {
                  maximumFractionDigits: 6,
                })
              ) : (
                <span className="text-slate-500">0.00</span>
              )}
            </div>
            <button className="flex items-center gap-2 px-3 py-2 bg-slate-700 rounded-xl hover:bg-slate-600 transition-colors">
              {outputToken ? (
                <>
                  <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-teal-500 rounded-full" />
                  <span className="font-medium text-white">{outputToken.symbol}</span>
                </>
              ) : (
                <span className="text-slate-400">Sélectionner</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Quote Details */}
      {currentQuote && (
        <div className="px-4 pb-2 space-y-2">
          {/* Price Impact */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Impact sur le prix</span>
            <span className={cn(
              currentQuote.priceImpactBps > 100 ? "text-red-400" :
              currentQuote.priceImpactBps > 50 ? "text-yellow-400" :
              "text-green-400"
            )}>
              {(currentQuote.priceImpactBps / 100).toFixed(2)}%
            </span>
          </div>
          
          {/* Rebate */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400 flex items-center gap-1">
              Rebate estimé
              <InformationCircleIcon className="w-4 h-4" />
            </span>
            <span className="text-purple-400 font-medium">
              +{(currentQuote.boostedRebate / Math.pow(10, 9)).toFixed(4)} BACK
              {currentQuote.boostBps > 0 && (
                <span className="text-xs text-green-400 ml-1">
                  (+{(currentQuote.boostBps / 100).toFixed(0)}% boost)
                </span>
              )}
            </span>
          </div>
          
          {/* Cache indicator */}
          {currentQuote.fromCache && (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <span>⚡ Quote depuis cache {currentQuote.cacheLevel}</span>
            </div>
          )}
          
          {/* Route Toggle */}
          {mode === 'advanced' && (
            <button
              onClick={() => setShowRoute(!showRoute)}
              className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              <ChartBarIcon className="w-4 h-4" />
              {showRoute ? "Masquer la route" : "Voir la route"}
            </button>
          )}
        </div>
      )}

      {/* Route Visualization */}
      <AnimatePresence>
        {showRoute && routeInfo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-4 pb-4"
          >
            <RouteVisualization route={routeInfo} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Progress */}
      {progressLabel && progressStatus !== 'confirmed' && progressStatus !== 'failed' && (
        <div className="mx-4 mb-2 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
          <div className="flex items-center gap-2">
            <ArrowPathIcon className="w-4 h-4 animate-spin text-purple-400" />
            <p className="text-sm text-purple-300">{progressLabel}</p>
          </div>
        </div>
      )}

      {/* Swap Button */}
      <div className="p-4">
        <button
          onClick={handleSwap}
          disabled={!connected || !currentQuote || loading || quoteLoading}
          className={cn(
            "w-full py-4 rounded-xl font-semibold text-lg transition-all",
            "bg-gradient-to-r from-purple-500 to-blue-500",
            "hover:from-purple-600 hover:to-blue-600",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "shadow-lg shadow-purple-500/25"
          )}
        >
          {!connected ? (
            "Connecter le wallet"
          ) : loading ? (
            <span className="flex items-center justify-center gap-2">
              <ArrowPathIcon className="w-5 h-5 animate-spin" />
              {progressLabel || "Swap en cours..."}
            </span>
          ) : !currentQuote ? (
            "Entrez un montant"
          ) : (
            "Swap"
          )}
        </button>
      </div>

      {/* Footer - Analytics (mode avancé) */}
      {mode === 'advanced' && (
        <div className="px-4 pb-4">
          <div className="p-3 bg-slate-800/30 rounded-lg">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Session swaps: {getAnalytics().totalSwaps}</span>
              <span>Cache hit: {Math.round(getAnalytics().cacheHitRate * 100)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EnhancedSwapCard;
