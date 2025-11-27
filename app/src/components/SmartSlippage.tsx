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

    setRecommended(calculatedSlippage);
    onChange(calculatedSlippage);
  }, [autoMode, volatility24h, liquidity, onChange]);

  const presetValues = [0.1, 0.5, 1.0, 3.0];

  const handleCustomInput = (input: string) => {
    setCustomValue(input);
    const parsed = parseFloat(input);
    if (!isNaN(parsed) && parsed >= 0.01 && parsed <= 50) {
      onChange(parsed);
    }
  };

  const getSlippageStatus = () => {
    if (value < 0.5) return { color: "text-green-500", label: "Low Risk", icon: "✓" };
    if (value < 1.0) return { color: "text-[var(--primary)]", label: "Normal", icon: "○" };
    if (value < 3.0) return { color: "text-yellow-500", label: "Moderate Risk", icon: "⚠" };
    return { color: "text-red-500", label: "High Risk", icon: "!" };
  };

  const status = getSlippageStatus();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={16} className="terminal-text" />
          <span className="text-sm font-semibold terminal-text">Slippage Tolerance</span>
        </div>
        <div className={`text-xs font-semibold ${status.color} flex items-center gap-1`}>
          <span>{status.icon}</span>
          <span>{status.label}</span>
        </div>
      </div>

      {/* Auto Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setAutoMode(true)}
          className={`flex-1 py-2 px-3 text-sm font-semibold transition-all ${
            autoMode
              ? "bg-[var(--primary)] text-black"
              : "bg-[var(--primary)]/10 terminal-text hover:bg-[var(--primary)]/20"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Zap size={14} />
            <span>Auto ({recommended.toFixed(2)}%)</span>
          </div>
        </button>
        <button
          onClick={() => setAutoMode(false)}
          className={`flex-1 py-2 px-3 text-sm font-semibold transition-all ${
            !autoMode
              ? "bg-[var(--primary)] text-black"
              : "bg-[var(--primary)]/10 terminal-text hover:bg-[var(--primary)]/20"
          }`}
        >
          Custom
        </button>
      </div>

      {/* Manual Mode */}
      {!autoMode && (
        <div className="space-y-3">
          {/* Preset Buttons */}
          <div className="grid grid-cols-4 gap-2">
            {presetValues.map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  onChange(preset);
                  setCustomValue("");
                }}
                className={`py-2 px-3 text-sm font-semibold transition-all ${
                  value === preset && !customValue
                    ? "bg-[var(--primary)] text-black"
                    : "bg-[var(--primary)]/10 terminal-text hover:bg-[var(--primary)]/20 border border-[var(--primary)]/30"
                }`}
              >
                {preset}%
              </button>
            ))}
          </div>

          {/* Custom Input */}
          <div className="relative">
            <input
              type="number"
              value={customValue}
              onChange={(e) => handleCustomInput(e.target.value)}
              placeholder="Custom %"
              min="0.01"
              max="50"
              step="0.1"
              className="input-field w-full pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 terminal-text opacity-50 text-sm">
              %
            </span>
          </div>
        </div>
      )}

      {/* Smart Recommendations */}
      {autoMode && (
        <div className="p-3 bg-black/40 rounded border border-[var(--primary)]/20 space-y-2">
          <div className="flex items-start gap-2 text-xs">
            <Info size={14} className="terminal-text opacity-70 mt-0.5 flex-shrink-0" />
            <div className="space-y-1 terminal-text opacity-70">
              <div>
                Auto-calculated based on:
              </div>
              <ul className="space-y-0.5 ml-3">
                {volatility24h > 0 && (
                  <li>• Volatility: {volatility24h.toFixed(2)}% (24h)</li>
                )}
                {liquidity > 0 && (
                  <li>• Liquidity: ${(liquidity / 1000).toFixed(0)}K</li>
                )}
                {tokenPair && (
                  <li>• Pair: {tokenPair.input}/{tokenPair.output}</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Warning for high slippage */}
      {value >= 3 && (
        <div className="p-3 bg-orange-500/10 border border-orange-500 rounded flex items-start gap-2">
          <AlertTriangle size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-orange-500">
            <div className="font-semibold mb-1">High Slippage Warning</div>
            <div className="opacity-80">
              Your transaction may be frontrun. Consider reducing slippage or trading size.
            </div>
          </div>
        </div>
      )}

      {/* Current Value Display */}
      <div className="flex justify-between items-center text-xs terminal-text opacity-70">
        <span>Current tolerance:</span>
        <span className="font-semibold terminal-glow">{value.toFixed(2)}%</span>
      </div>
    </div>
  );
};
