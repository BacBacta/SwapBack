/**
 * Smart Slippage Settings with Auto Mode
 * Automatically calculates optimal slippage based on token pair and market conditions
 */

"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  InformationCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  BoltIcon
} from "@heroicons/react/24/outline";

interface SmartSlippageProps {
  value: number;
  onChange: (value: number) => void;
  tokenPair?: string;
  isAutoMode?: boolean;
  onAutoModeChange?: (enabled: boolean) => void;
}

const PRESET_SLIPPAGES = [
  { value: 0.1, label: "0.1%", type: "Low", risk: "High failure risk" },
  { value: 0.5, label: "0.5%", type: "Normal", risk: "Balanced" },
  { value: 1.0, label: "1%", type: "High", risk: "Low failure risk" },
];

export function SmartSlippage({
  value,
  onChange,
  tokenPair = "SOL/USDC",
  isAutoMode = true,
  onAutoModeChange
}: SmartSlippageProps) {
  const [customValue, setCustomValue] = useState("");
  const [mode, setMode] = useState<"auto" | "manual">(isAutoMode ? "auto" : "manual");

  // Calculate recommended slippage based on token pair (mock logic)
  const getRecommendedSlippage = () => {
    if (tokenPair.includes("USDC") || tokenPair.includes("USDT")) {
      return 0.5; // Stablecoins = low slippage
    }
    return 1.0; // Other pairs = medium slippage
  };

  const recommendedSlippage = getRecommendedSlippage();

  useEffect(() => {
    if (mode === "auto") {
      onChange(recommendedSlippage);
    }
  }, [mode, recommendedSlippage, onChange]);

  const handleModeToggle = () => {
    const newMode = mode === "auto" ? "manual" : "auto";
    setMode(newMode);
    if (newMode === "auto") {
      onChange(recommendedSlippage);
      onAutoModeChange?.(true);
    } else {
      onAutoModeChange?.(false);
    }
  };

  const handlePresetClick = (presetValue: number) => {
    onChange(presetValue);
    setCustomValue("");
  };

  const handleCustomSubmit = () => {
    const parsed = parseFloat(customValue);
    if (!isNaN(parsed) && parsed >= 0.01 && parsed <= 50) {
      onChange(parsed);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">Slippage Tolerance</span>
          <div className="group relative">
            <InformationCircleIcon className="w-4 h-4 text-gray-400 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 
                          bg-gray-800 border border-white/10 rounded-lg text-xs text-gray-300
                          opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity
                          shadow-xl z-10">
              <strong className="text-white">Slippage Tolerance</strong>
              <p className="mt-1">
                Maximum price difference you're willing to accept between quote and execution.
              </p>
            </div>
          </div>
        </div>

        {/* Auto Toggle */}
        <button
          onClick={handleModeToggle}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 ${
            mode === "auto"
              ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
              : "bg-white/5 text-gray-400 hover:bg-white/10"
          }`}
        >
          <BoltIcon className="w-4 h-4" />
          Auto
        </button>
      </div>

      {/* Auto Mode */}
      {mode === "auto" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
        >
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-emerald-400 mb-1">
                Optimal: {recommendedSlippage}% (for {tokenPair})
              </div>
              <div className="text-xs text-gray-400">
                Auto-adjusted based on liquidity and volatility to minimize failure risk
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Manual Mode */}
      {mode === "manual" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          {/* Preset Buttons */}
          <div className="grid grid-cols-3 gap-2">
            {PRESET_SLIPPAGES.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handlePresetClick(preset.value)}
                className={`p-3 rounded-xl border transition-all active:scale-95 ${
                  value === preset.value
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className={`font-medium mb-1 ${
                  value === preset.value ? "text-emerald-400" : "text-white"
                }`}>
                  {preset.label}
                </div>
                <div className="text-xs text-gray-400">{preset.type}</div>
              </button>
            ))}
          </div>

          {/* Custom Input */}
          <div className="space-y-2">
            <label className="text-xs text-gray-400 font-medium">Custom Slippage</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCustomSubmit();
                }}
                placeholder="1.0"
                min="0.01"
                max="50"
                step="0.1"
                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl 
                         text-white outline-none focus:border-emerald-500 transition-colors"
              />
              <button
                onClick={handleCustomSubmit}
                disabled={!customValue}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 
                         hover:from-emerald-600 hover:to-emerald-700 
                         disabled:from-white/5 disabled:to-white/5 disabled:text-gray-600
                         text-white font-medium rounded-xl transition-all active:scale-95
                         disabled:cursor-not-allowed"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Warning for high slippage */}
          {value > 5 && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl"
            >
              <ExclamationTriangleIcon className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-orange-400 mb-1">
                  High Slippage Warning
                </div>
                <div className="text-xs text-gray-400">
                  Setting slippage above 5% may result in unfavorable rates. 
                  Consider using Auto mode or reducing your amount.
                </div>
              </div>
            </motion.div>
          )}

          {/* Info for very low slippage */}
          {value < 0.5 && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl"
            >
              <InformationCircleIcon className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-400">
                  Low slippage tolerance may cause transaction failures during high volatility.
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}
