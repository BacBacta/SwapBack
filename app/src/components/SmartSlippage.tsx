/**
 * SmartSlippage Component
 * Intelligent slippage calculation based on volatility & liquidity
 * Auto-mode calculates optimal slippage dynamically
 */

import React, { useState, useEffect } from "react";
import { Zap, AlertTriangle, Info } from "lucide-react";

interface SmartSlippageProps {
  value: number;
  onChange: (value: number) => void;
  tokenPair?: { input: string; output: string };
  liquidity?: number; // Pool liquidity in USD
  volatility24h?: number; // 24h price volatility %
}

export const SmartSlippage = ({
  value,
  onChange,
  tokenPair,
  liquidity = 0,
  volatility24h = 0,
}: SmartSlippageProps) => {
  const [autoMode, setAutoMode] = useState(true);
  const [customValue, setCustomValue] = useState("");
  const [recommended, setRecommended] = useState(0.5);

  // Calculate recommended slippage based on market conditions
  useEffect(() => {
    if (!autoMode) return;

    let calculatedSlippage = 0.5; // Base 0.5%

    // Adjust based on volatility
    if (volatility24h > 10) {
      calculatedSlippage += 1.5; // High volatility: +1.5%
    } else if (volatility24h > 5) {
      calculatedSlippage += 0.5; // Medium volatility: +0.5%
    }

    // Adjust based on liquidity
    if (liquidity > 0 && liquidity < 100000) {
      calculatedSlippage += 1.0; // Low liquidity: +1%
    } else if (liquidity >= 100000 && liquidity < 1000000) {
      calculatedSlippage += 0.3; // Medium liquidity: +0.3%
    }

    // Cap at reasonable limits
    calculatedSlippage = Math.min(Math.max(calculatedSlippage, 0.1), 5.0);

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
