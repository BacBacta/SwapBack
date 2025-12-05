"use client";

import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon, ArrowRightIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { formatNumberWithCommas } from "@/utils/formatNumber";

interface NativeRouteInsights {
  provider?: string | null;
  quoteTokens?: number | null;
  baseTokens?: number | null;
  improvedTokens?: number | null;
  improvementBps?: number;
  userShareTokens?: number;
  totalGainTokens?: number;
  sharePercent?: number | null;
  explanation?: string | null;
  hasEconomics?: boolean;
  usedFallback?: boolean;
}

interface SwapPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  fromToken: { symbol: string; amount: string; logoURI?: string };
  toToken: { symbol: string; amount: string; logoURI?: string };
  rate: string;
  priceImpact: number;
  minReceived: string;
  slippage: number;
  networkFee: string;
  platformFee: string;
  route?: string[];
  nativeRouteInsights?: NativeRouteInsights | null;
}

export function SwapPreviewModal({
  isOpen,
  onClose,
  onConfirm,
  fromToken,
  toToken,
  rate,
  priceImpact,
  minReceived,
  slippage,
  networkFee,
  platformFee,
  route = [],
  nativeRouteInsights,
}: SwapPreviewModalProps) {
  if (!isOpen) return null;

  const isPriceImpactHigh = priceImpact > 5;
  const isPriceImpactVeryHigh = priceImpact > 10;
  const formatTokens = (value?: number | null, precision = 6) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "--";
    }
    return formatNumberWithCommas(value.toFixed(precision));
  };
  const showNativeCard = Boolean(
    nativeRouteInsights &&
      (
        nativeRouteInsights.quoteTokens !== null ||
        nativeRouteInsights.hasEconomics ||
        nativeRouteInsights.usedFallback
      )
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md backdrop-blur-xl bg-[#0C0C0C]/95 border border-cyan-500/30 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-[0_0_50px_rgba(6,182,212,0.3)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h3 className="text-lg sm:text-xl font-bold text-white">Review Swap</h3>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Token Flow */}
          <div className="flex items-center justify-between mb-4 sm:mb-6 p-3 sm:p-4 bg-white/5 rounded-xl">
            <div className="flex items-center space-x-2 sm:space-x-3">
              {fromToken.logoURI && (
                <img src={fromToken.logoURI} alt={fromToken.symbol} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full" />
              )}
              <div>
                <div className="text-xl sm:text-2xl font-bold text-white">{fromToken.amount}</div>
                <div className="text-xs sm:text-sm text-gray-400">{fromToken.symbol}</div>
              </div>
            </div>

            <ArrowRightIcon className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400 flex-shrink-0 mx-2 sm:mx-4" />

            <div className="flex items-center space-x-2 sm:space-x-3">
              {toToken.logoURI && (
                <img src={toToken.logoURI} alt={toToken.symbol} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full" />
              )}
              <div>
                <div className="text-xl sm:text-2xl font-bold text-white">{toToken.amount}</div>
                <div className="text-xs sm:text-sm text-gray-400">{toToken.symbol}</div>
              </div>
            </div>
          </div>

          {/* Route Visualization */}
          {route.length > 0 && (
            <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-white/5 rounded-lg">
              <div className="text-[10px] sm:text-xs text-gray-400 mb-1.5 sm:mb-2">Route</div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {route.map((dex, index) => (
                  <div key={index} className="flex items-center">
                    <span className="text-xs sm:text-sm text-cyan-400">{dex}</span>
                    {index < route.length - 1 && (
                      <ArrowRightIcon className="w-3 h-3 text-gray-600 mx-0.5 sm:mx-1" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {showNativeCard && nativeRouteInsights && (
            <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-emerald-300">Route native SwapBack</div>
                {nativeRouteInsights.usedFallback && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 uppercase tracking-wide">
                    Fallback
                  </span>
                )}
              </div>
              <div className="space-y-1 text-xs">
                {nativeRouteInsights.provider && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Provider</span>
                    <span className="text-white font-medium">{nativeRouteInsights.provider}</span>
                  </div>
                )}
                {nativeRouteInsights.quoteTokens !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Quote</span>
                    <span className="text-white font-medium">
                      {formatTokens(nativeRouteInsights.quoteTokens, 4)} {toToken.symbol}
                    </span>
                  </div>
                )}
                {nativeRouteInsights.baseTokens !== null && nativeRouteInsights.improvedTokens !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Comparatif</span>
                    <span className="text-white font-medium">
                      {formatTokens(nativeRouteInsights.baseTokens, 4)} → {formatTokens(nativeRouteInsights.improvedTokens, 4)} {toToken.symbol}
                    </span>
                  </div>
                )}
                {typeof nativeRouteInsights.improvementBps === "number" && nativeRouteInsights.improvementBps > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Amélioration</span>
                    <span className="text-emerald-400 font-semibold">+{nativeRouteInsights.improvementBps.toFixed(2)} bps</span>
                  </div>
                )}
                {nativeRouteInsights.hasEconomics ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-400">
                        Part utilisateur{nativeRouteInsights.sharePercent ? ` (${nativeRouteInsights.sharePercent.toFixed(1)}%)` : ""}
                      </span>
                      <span className="text-emerald-300 font-medium">
                        +{formatTokens(nativeRouteInsights.userShareTokens, 6)} {toToken.symbol}
                      </span>
                    </div>
                    {nativeRouteInsights.totalGainTokens !== undefined && nativeRouteInsights.totalGainTokens > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Gain total</span>
                        <span className="text-emerald-200 font-medium">
                          +{formatTokens(nativeRouteInsights.totalGainTokens, 6)} {toToken.symbol}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  nativeRouteInsights.explanation && (
                    <div className="text-[11px] text-gray-400">
                      {nativeRouteInsights.explanation}
                    </div>
                  )
                )}
                {nativeRouteInsights.explanation && nativeRouteInsights.hasEconomics && (
                  <div className="text-[11px] text-white/80 border-t border-white/10 pt-1 mt-1">
                    {nativeRouteInsights.explanation}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Details */}
          <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-gray-400">Rate</span>
              <span className="text-white font-medium">{rate}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-gray-400">Price Impact</span>
              <span className={`font-medium ${
                isPriceImpactVeryHigh ? 'text-red-400' : 
                isPriceImpactHigh ? 'text-yellow-400' : 
                'text-emerald-400'
              }`}>
                {priceImpact.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-gray-400">Minimum Received</span>
              <span className="text-white font-medium">{minReceived} {toToken.symbol}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-gray-400">Slippage Tolerance</span>
              <span className="text-white font-medium">{slippage}%</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-gray-400">Network Fee</span>
              <span className="text-white font-medium">~{networkFee} SOL</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-gray-400">Platform Fee</span>
              <span className="text-white font-medium">{platformFee}%</span>
            </div>
          </div>

          {/* Warning for high price impact */}
          {isPriceImpactHigh && (
            <div className={`mb-3 sm:mb-4 p-2.5 sm:p-3 rounded-lg border ${
              isPriceImpactVeryHigh 
                ? 'bg-red-500/10 border-red-500/30' 
                : 'bg-yellow-500/10 border-yellow-500/30'
            }`}>
              <div className="flex items-start space-x-1.5 sm:space-x-2">
                <ExclamationTriangleIcon className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5 ${
                  isPriceImpactVeryHigh ? 'text-red-400' : 'text-yellow-400'
                }`} />
                <div className="flex-1">
                  <div className={`text-xs sm:text-sm font-medium ${
                    isPriceImpactVeryHigh ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {isPriceImpactVeryHigh ? 'Very High Price Impact!' : 'High Price Impact'}
                  </div>
                  <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">
                    Consider reducing your swap amount to minimize slippage
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm sm:text-base font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-xl text-sm sm:text-base font-medium transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)]"
            >
              Confirm Swap
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
