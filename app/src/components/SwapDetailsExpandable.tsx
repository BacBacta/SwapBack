/**
 * Swap Details Expandable Component
 * Shows detailed breakdown of swap transaction
 */

"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDownIcon,
  ArrowsRightLeftIcon,
  InformationCircleIcon,
  ChartBarIcon,
  BanknotesIcon
} from "@heroicons/react/24/outline";
import { formatNumberWithCommas, formatCurrency } from "@/utils/formatNumber";

interface SwapDetailsProps {
  inputToken: {
    symbol: string;
    amount: string;
    usdPrice?: number;
  };
  outputToken: {
    symbol: string;
    amount: string;
    usdPrice?: number;
  };
  priceImpact: number;
  slippage: number;
  networkFee?: number;
  platformFee?: number;
  route?: string[];
}

export function SwapDetailsExpandable({
  inputToken,
  outputToken,
  priceImpact,
  slippage,
  networkFee = 0.00089, // Default SOL network fee
  platformFee = 0.3, // Default 0.3% platform fee
  route = []
}: SwapDetailsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showUsdRate, setShowUsdRate] = useState(false);

  // Calculate exchange rate
  const exchangeRate = useMemo(() => {
    if (!inputToken.amount || !outputToken.amount) return 0;
    const input = parseFloat(inputToken.amount);
    const output = parseFloat(outputToken.amount);
    if (input === 0) return 0;
    return output / input;
  }, [inputToken.amount, outputToken.amount]);

  // Calculate inverse rate
  const inverseRate = useMemo(() => {
    if (exchangeRate === 0) return 0;
    return 1 / exchangeRate;
  }, [exchangeRate]);

  // Calculate minimum received (with slippage)
  const minimumReceived = useMemo(() => {
    const output = parseFloat(outputToken.amount || '0');
    return output * (1 - slippage / 100);
  }, [outputToken.amount, slippage]);

  // Calculate total fees in USD
  const totalFeesUsd = useMemo(() => {
    const input = parseFloat(inputToken.amount || '0');
    const inputPrice = inputToken.usdPrice || 0;
    const platformFeeUsd = (input * inputPrice * platformFee) / 100;
    const networkFeeUsd = networkFee * 100; // Assuming SOL = $100
    return platformFeeUsd + networkFeeUsd;
  }, [inputToken.amount, inputToken.usdPrice, platformFee, networkFee]);

  // Price impact color
  const impactColor = useMemo(() => {
    if (priceImpact < 1) return "text-emerald-400";
    if (priceImpact < 3) return "text-yellow-400";
    if (priceImpact < 10) return "text-orange-400";
    return "text-red-400";
  }, [priceImpact]);

  return (
    <div className="space-y-3">
      {/* Summary Header (Always Visible) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 
                 rounded-2xl border border-white/10 transition-all group"
      >
        <div className="flex items-center gap-3">
          <ChartBarIcon className="w-5 h-5 text-gray-400" />
          <div className="text-left">
            <div className="text-sm font-medium text-white">
              1 {inputToken.symbol} ≈ {formatNumberWithCommas(exchangeRate.toFixed(6))} {outputToken.symbol}
            </div>
            <div className="text-xs text-gray-500">
              {totalFeesUsd > 0 && `Fees: ${formatCurrency(totalFeesUsd)}`}
            </div>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDownIcon className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
        </motion.div>
      </button>

      {/* Expandable Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4 bg-black/40 rounded-2xl border border-white/10">
              {/* Exchange Rate Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowsRightLeftIcon className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-400">Exchange Rate</span>
                </div>
                <button
                  onClick={() => setShowUsdRate(!showUsdRate)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 
                           rounded-lg transition-all active:scale-95"
                >
                  <span className="text-sm font-medium text-white">
                    {showUsdRate ? (
                      <>
                        1 {inputToken.symbol} ≈ {formatCurrency(exchangeRate * (outputToken.usdPrice || 0))}
                      </>
                    ) : (
                      <>
                        1 {inputToken.symbol} = {formatNumberWithCommas(exchangeRate.toFixed(6))} {outputToken.symbol}
                      </>
                    )}
                  </span>
                  <ArrowsRightLeftIcon className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </div>

              {/* Inverse Rate */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Inverse Rate</span>
                <span className="text-sm font-medium text-white">
                  1 {outputToken.symbol} = {formatNumberWithCommas(inverseRate.toFixed(6))} {inputToken.symbol}
                </span>
              </div>

              {/* Divider */}
              <div className="border-t border-white/10" />

              {/* Price Impact */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-gray-400">Price Impact</span>
                  <div className="group relative">
                    <InformationCircleIcon className="w-3.5 h-3.5 text-gray-500 cursor-help" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block 
                                  w-48 p-2 bg-gray-900 rounded-lg text-xs text-gray-300 border border-white/10 z-10">
                      The difference between market price and estimated execution price due to trade size
                    </div>
                  </div>
                </div>
                <span className={`text-sm font-medium ${impactColor}`}>
                  {priceImpact < 0.01 ? '< 0.01' : priceImpact.toFixed(2)}%
                </span>
              </div>

              {/* Minimum Received */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-gray-400">Minimum Received</span>
                  <div className="group relative">
                    <InformationCircleIcon className="w-3.5 h-3.5 text-gray-500 cursor-help" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block 
                                  w-48 p-2 bg-gray-900 rounded-lg text-xs text-gray-300 border border-white/10 z-10">
                      Minimum amount you'll receive after {slippage}% slippage tolerance
                    </div>
                  </div>
                </div>
                <span className="text-sm font-medium text-white">
                  {formatNumberWithCommas(minimumReceived.toFixed(6))} {outputToken.symbol}
                </span>
              </div>

              {/* Slippage Tolerance */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Slippage Tolerance</span>
                <span className="text-sm font-medium text-white">{slippage}%</span>
              </div>

              {/* Divider */}
              <div className="border-t border-white/10" />

              {/* Network Fee */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Network Fee</span>
                <span className="text-sm font-medium text-white">
                  {networkFee} SOL ({formatCurrency(networkFee * 100)})
                </span>
              </div>

              {/* Platform Fee */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-gray-400">Platform Fee</span>
                  <div className="group relative">
                    <InformationCircleIcon className="w-3.5 h-3.5 text-gray-500 cursor-help" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block 
                                  w-48 p-2 bg-gray-900 rounded-lg text-xs text-gray-300 border border-white/10 z-10">
                      {platformFee}% fee on input amount. Used for liquidity and platform maintenance.
                    </div>
                  </div>
                </div>
                <span className="text-sm font-medium text-white">
                  {platformFee}% ({formatCurrency((parseFloat(inputToken.amount || '0') * (inputToken.usdPrice || 0) * platformFee) / 100)})
                </span>
              </div>

              {/* Total Fees */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <BanknotesIcon className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-300">Total Fees</span>
                </div>
                <span className="text-sm font-semibold text-white">
                  {formatCurrency(totalFeesUsd)}
                </span>
              </div>

              {/* Route (if available) */}
              {route.length > 0 && (
                <>
                  <div className="border-t border-white/10" />
                  <div className="space-y-2">
                    <span className="text-sm text-gray-400">Route</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {route.map((hop, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <span className="px-3 py-1.5 bg-white/5 rounded-lg text-xs font-medium text-white">
                            {hop}
                          </span>
                          {index < route.length - 1 && (
                            <ChevronDownIcon className="w-3 h-3 text-gray-500 rotate-[-90deg]" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
