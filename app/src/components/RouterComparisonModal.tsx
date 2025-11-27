/**
 * Router Comparison Modal
 * Compare SwapBack vs Jupiter side-by-side
 */

"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  XMarkIcon,
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  SparklesIcon,
  ChartBarIcon,
  BanknotesIcon
} from "@heroicons/react/24/outline";
import { formatNumberWithCommas, formatCurrency } from "@/utils/formatNumber";

interface RouterComparisonProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRouter: (router: 'swapback' | 'jupiter') => void;
  currentRouter: 'swapback' | 'jupiter';
  swapbackData: {
    outputAmount: number;
    priceImpact: number;
    networkFee: number;
    platformFee: number;
    rebateAmount: number;
    burnAmount: number;
    totalSavings: number;
    route: string[];
  };
  jupiterData: {
    outputAmount: number;
    priceImpact: number;
    networkFee: number;
    platformFee: number;
    route: string[];
  };
  inputToken: { symbol: string; amount: string };
  outputToken: { symbol: string };
}

export function RouterComparisonModal({
  isOpen,
  onClose,
  onSelectRouter,
  currentRouter,
  swapbackData,
  jupiterData,
  inputToken,
  outputToken
}: RouterComparisonProps) {
  if (!isOpen) return null;

  const difference = swapbackData.outputAmount - jupiterData.outputAmount;
  const percentDiff = ((difference / jupiterData.outputAmount) * 100).toFixed(2);
  const isBetter = difference > 0;

  const FEATURES = [
    {
      name: "BACK Token Rebates",
      swapback: true,
      jupiter: false,
      tooltip: "70% of fees returned as BACK tokens"
    },
    {
      name: "Auto-Burn Mechanism",
      swapback: true,
      jupiter: false,
      tooltip: "30% of fees burned to reduce supply"
    },
    {
      name: "Price Impact Optimization",
      swapback: true,
      jupiter: true,
      tooltip: "Smart routing to minimize slippage"
    },
    {
      name: "Multi-DEX Aggregation",
      swapback: true,
      jupiter: true,
      tooltip: "Routes across Orca, Raydium, etc."
    },
    {
      name: "Transaction Batching",
      swapback: false,
      jupiter: true,
      tooltip: "Combine multiple swaps in one tx"
    }
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative max-w-4xl w-full bg-gradient-to-br from-gray-900 to-gray-800 
                   rounded-2xl border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-gray-900/95 backdrop-blur-lg border-b border-white/10 p-6 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ArrowsRightLeftIcon className="w-6 h-6 text-emerald-400" />
                <div>
                  <h2 className="text-2xl font-bold text-white">Router Comparison</h2>
                  <p className="text-sm text-gray-400">
                    {inputToken.amount} {inputToken.symbol} → {outputToken.symbol}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors active:scale-95"
              >
                <XMarkIcon className="w-6 h-6 text-gray-400" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Output Comparison Cards */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* SwapBack Card */}
              <motion.button
                onClick={() => onSelectRouter('swapback')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative p-6 rounded-2xl border-2 transition-all ${
                  currentRouter === 'swapback'
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-white/10 bg-white/5 hover:border-emerald-500/50'
                }`}
              >
                {currentRouter === 'swapback' && (
                  <div className="absolute top-4 right-4">
                    <CheckCircleIcon className="w-6 h-6 text-emerald-400" />
                  </div>
                )}
                
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">⚡</span>
                  <h3 className="text-xl font-bold text-white">SwapBack</h3>
                  {isBetter && (
                    <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full">
                      BEST
                    </span>
                  )}
                </div>

                <div className="space-y-3 text-left">
                  <div>
                    <div className="text-sm text-gray-400 mb-1">You receive</div>
                    <div className="text-3xl font-bold text-white">
                      {formatNumberWithCommas(swapbackData.outputAmount.toFixed(6))}
                    </div>
                    <div className="text-sm text-gray-500">{outputToken.symbol}</div>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-white/10">
                    <SparklesIcon className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm text-emerald-400 font-medium">
                      +{formatNumberWithCommas(swapbackData.totalSavings.toFixed(6))} {outputToken.symbol} saved
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-gray-400">
                      <span>Price Impact</span>
                      <span className={swapbackData.priceImpact < 1 ? 'text-emerald-400' : 'text-yellow-400'}>
                        {swapbackData.priceImpact.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Network Fee</span>
                      <span>{swapbackData.networkFee} SOL</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Platform Fee</span>
                      <span>{swapbackData.platformFee}%</span>
                    </div>
                    <div className="flex justify-between text-emerald-400">
                      <span>BACK Rebate</span>
                      <span>+{formatNumberWithCommas(swapbackData.rebateAmount.toFixed(6))}</span>
                    </div>
                  </div>
                </div>
              </motion.button>

              {/* Jupiter Card */}
              <motion.button
                onClick={() => onSelectRouter('jupiter')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative p-6 rounded-2xl border-2 transition-all ${
                  currentRouter === 'jupiter'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-white/10 bg-white/5 hover:border-blue-500/50'
                }`}
              >
                {currentRouter === 'jupiter' && (
                  <div className="absolute top-4 right-4">
                    <CheckCircleIcon className="w-6 h-6 text-blue-400" />
                  </div>
                )}
                
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">🪐</span>
                  <h3 className="text-xl font-bold text-white">Jupiter</h3>
                </div>

                <div className="space-y-3 text-left">
                  <div>
                    <div className="text-sm text-gray-400 mb-1">You receive</div>
                    <div className="text-3xl font-bold text-white">
                      {formatNumberWithCommas(jupiterData.outputAmount.toFixed(6))}
                    </div>
                    <div className="text-sm text-gray-500">{outputToken.symbol}</div>
                  </div>

                  {!isBetter && difference !== 0 && (
                    <div className="flex items-center gap-2 pt-3 border-t border-white/10">
                      <ChartBarIcon className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-blue-400 font-medium">
                        Market standard pricing
                      </span>
                    </div>
                  )}

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-gray-400">
                      <span>Price Impact</span>
                      <span className={jupiterData.priceImpact < 1 ? 'text-emerald-400' : 'text-yellow-400'}>
                        {jupiterData.priceImpact.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Network Fee</span>
                      <span>{jupiterData.networkFee} SOL</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Platform Fee</span>
                      <span>{jupiterData.platformFee}%</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Rebate</span>
                      <span>None</span>
                    </div>
                  </div>
                </div>
              </motion.button>
            </div>

            {/* Difference Highlight */}
            {difference !== 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-xl border ${
                  isBetter
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-blue-500/10 border-blue-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BanknotesIcon className={`w-5 h-5 ${isBetter ? 'text-emerald-400' : 'text-blue-400'}`} />
                    <div>
                      <div className="font-semibold text-white">
                        {isBetter ? 'SwapBack saves you' : 'Jupiter offers'}
                      </div>
                      <div className="text-sm text-gray-400">
                        Compared to {isBetter ? 'Jupiter' : 'SwapBack'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${isBetter ? 'text-emerald-400' : 'text-blue-400'}`}>
                      {isBetter ? '+' : ''}{formatNumberWithCommas(Math.abs(difference).toFixed(6))}
                    </div>
                    <div className="text-sm text-gray-500">
                      ({isBetter ? '+' : ''}{percentDiff}%)
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Features Comparison Table */}
            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              <div className="p-4 border-b border-white/10">
                <h4 className="font-semibold text-white">Features Comparison</h4>
              </div>
              <div className="divide-y divide-white/10">
                {FEATURES.map((feature, index) => (
                  <motion.div
                    key={feature.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="grid grid-cols-3 gap-4 p-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-300">{feature.name}</span>
                      <div className="group relative">
                        <span className="text-xs text-gray-500 cursor-help">ℹ️</span>
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 
                                      bg-gray-900 rounded-lg text-xs text-gray-300 border border-white/10 z-20">
                          {feature.tooltip}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      {feature.swapback ? (
                        <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <XMarkIcon className="w-5 h-5 text-gray-600" />
                      )}
                    </div>
                    <div className="flex justify-center">
                      {feature.jupiter ? (
                        <CheckCircleIcon className="w-5 h-5 text-blue-400" />
                      ) : (
                        <XMarkIcon className="w-5 h-5 text-gray-600" />
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  onSelectRouter('swapback');
                  onClose();
                }}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 
                         hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold 
                         rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
              >
                Use SwapBack
              </button>
              <button
                onClick={() => {
                  onSelectRouter('jupiter');
                  onClose();
                }}
                className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-blue-600 
                         hover:from-blue-600 hover:to-blue-700 text-white font-semibold 
                         rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-500/20"
              >
                Use Jupiter
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
