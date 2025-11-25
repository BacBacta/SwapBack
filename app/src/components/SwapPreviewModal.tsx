"use client";

import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon, ArrowRightIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

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
  route = []
}: SwapPreviewModalProps) {
  if (!isOpen) return null;

  const isPriceImpactHigh = priceImpact > 5;
  const isPriceImpactVeryHigh = priceImpact > 10;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
          className="relative w-full max-w-md backdrop-blur-xl bg-[#0C0C0C]/95 border border-cyan-500/30 rounded-2xl p-6 shadow-[0_0_50px_rgba(6,182,212,0.3)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">Review Swap</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Token Flow */}
          <div className="flex items-center justify-between mb-6 p-4 bg-white/5 rounded-xl">
            <div className="flex items-center space-x-3">
              {fromToken.logoURI && (
                <img src={fromToken.logoURI} alt={fromToken.symbol} className="w-10 h-10 rounded-full" />
              )}
              <div>
                <div className="text-2xl font-bold text-white">{fromToken.amount}</div>
                <div className="text-sm text-gray-400">{fromToken.symbol}</div>
              </div>
            </div>

            <ArrowRightIcon className="w-6 h-6 text-cyan-400 flex-shrink-0 mx-4" />

            <div className="flex items-center space-x-3">
              {toToken.logoURI && (
                <img src={toToken.logoURI} alt={toToken.symbol} className="w-10 h-10 rounded-full" />
              )}
              <div>
                <div className="text-2xl font-bold text-white">{toToken.amount}</div>
                <div className="text-sm text-gray-400">{toToken.symbol}</div>
              </div>
            </div>
          </div>

          {/* Route Visualization */}
          {route.length > 0 && (
            <div className="mb-4 p-3 bg-white/5 rounded-lg">
              <div className="text-xs text-gray-400 mb-2">Route</div>
              <div className="flex items-center gap-2 flex-wrap">
                {route.map((dex, index) => (
                  <div key={index} className="flex items-center">
                    <span className="text-sm text-cyan-400">{dex}</span>
                    {index < route.length - 1 && (
                      <ArrowRightIcon className="w-3 h-3 text-gray-600 mx-1" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Details */}
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Rate</span>
              <span className="text-white font-medium">{rate}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Price Impact</span>
              <span className={`font-medium ${
                isPriceImpactVeryHigh ? 'text-red-400' : 
                isPriceImpactHigh ? 'text-yellow-400' : 
                'text-emerald-400'
              }`}>
                {priceImpact.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Minimum Received</span>
              <span className="text-white font-medium">{minReceived} {toToken.symbol}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Slippage Tolerance</span>
              <span className="text-white font-medium">{slippage}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Network Fee</span>
              <span className="text-white font-medium">~{networkFee} SOL</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Platform Fee</span>
              <span className="text-white font-medium">{platformFee}%</span>
            </div>
          </div>

          {/* Warning for high price impact */}
          {isPriceImpactHigh && (
            <div className={`mb-4 p-3 rounded-lg border ${
              isPriceImpactVeryHigh 
                ? 'bg-red-500/10 border-red-500/30' 
                : 'bg-yellow-500/10 border-yellow-500/30'
            }`}>
              <div className="flex items-start space-x-2">
                <ExclamationTriangleIcon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  isPriceImpactVeryHigh ? 'text-red-400' : 'text-yellow-400'
                }`} />
                <div className="flex-1">
                  <div className={`text-sm font-medium ${
                    isPriceImpactVeryHigh ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {isPriceImpactVeryHigh ? 'Very High Price Impact!' : 'High Price Impact'}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Consider reducing your swap amount to minimize slippage
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-xl font-medium transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)]"
            >
              Confirm Swap
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
