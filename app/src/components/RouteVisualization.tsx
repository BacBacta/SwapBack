/**
 * RouteVisualization Component
 * Visual representation of swap path through multiple DEXs
 * Shows each hop with fees, price impact, and DEX logos
 */

import React from "react";
import { ArrowRight, TrendingDown, Zap } from "lucide-react";

interface RouteStep {
  from: string;
  to: string;
  via: string;
  fee: number; // in %
  priceImpact?: number; // in %
  inputAmount?: string;
  outputAmount?: string;
}

interface RouteVisualizationProps {
  steps: RouteStep[];
  totalPriceImpact?: number;
  executionTime?: string;
  isOptimal?: boolean;
}

export const RouteVisualization = ({
  steps,
  totalPriceImpact = 0,
  executionTime = "~5s",
  isOptimal = false,
}: RouteVisualizationProps) => {
  // DEX color mapping
  const dexColors: Record<string, string> = {
    Jupiter: "from-purple-500 to-blue-500",
    Raydium: "from-blue-500 to-cyan-500",
    Orca: "from-cyan-500 to-teal-500",
    Meteora: "from-green-500 to-emerald-500",
    Phoenix: "from-orange-500 to-red-500",
    SwapBack: "from-[var(--primary)] to-green-600",
  };

  const getDexGradient = (dex: string) => {
    return dexColors[dex] || "from-gray-500 to-gray-600";
  };

  const getPriceImpactColor = (impact: number) => {
    if (impact < 1) return "text-green-500";
    if (impact < 3) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold terminal-text">Route Path</div>
          {isOptimal && (
            <div className="px-2 py-0.5 bg-[var(--primary)]/20 border border-[var(--primary)] text-[var(--primary)] text-xs font-semibold flex items-center gap-1">
              <Zap size={10} />
              OPTIMAL
            </div>
          )}
        </div>
        <div className="text-xs terminal-text opacity-70">
          Est. {executionTime}
        </div>
      </div>

      {/* Route Steps */}
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={index}>
            {/* Step Card */}
            <div className="relative p-4 bg-black/40 rounded border border-[var(--primary)]/20 hover:border-[var(--primary)]/40 transition-all">
              {/* Step Number */}
              <div className="absolute -top-2 -left-2 w-6 h-6 bg-[var(--primary)] text-black rounded-full flex items-center justify-center text-xs font-bold">
                {index + 1}
              </div>

              <div className="space-y-3">
                {/* Tokens */}
                <div className="flex items-center gap-3">
                  {/* From Token */}
                  <div className="flex-1">
                    <div className="text-xs terminal-text opacity-50 mb-1">From</div>
                    <div className="font-semibold terminal-text terminal-glow">
                      {step.from}
                    </div>
                    {step.inputAmount && (
                      <div className="text-xs terminal-text opacity-70 mt-0.5">
                        {step.inputAmount}
                      </div>
                    )}
                  </div>

                  {/* Arrow */}
                  <ArrowRight size={20} className="terminal-text opacity-50" />

                  {/* To Token */}
                  <div className="flex-1">
                    <div className="text-xs terminal-text opacity-50 mb-1">To</div>
                    <div className="font-semibold terminal-text terminal-glow">
                      {step.to}
                    </div>
                    {step.outputAmount && (
                      <div className="text-xs terminal-text opacity-70 mt-0.5">
                        {step.outputAmount}
                      </div>
                    )}
                  </div>
                </div>

                {/* DEX & Metrics */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--primary)]/20">
                  {/* DEX Badge */}
                  <div className={`px-3 py-1 bg-gradient-to-r ${getDexGradient(step.via)} text-white text-xs font-bold rounded`}>
                    via {step.via}
                  </div>

                  {/* Metrics */}
                  <div className="flex items-center gap-4 text-xs">
                    {/* Fee */}
                    <div className="terminal-text opacity-70">
                      Fee: <span className="font-semibold">{step.fee}%</span>
                    </div>

                    {/* Price Impact */}
                    {step.priceImpact !== undefined && (
                      <div className="flex items-center gap-1">
                        <TrendingDown size={12} className={getPriceImpactColor(step.priceImpact)} />
                        <span className={getPriceImpactColor(step.priceImpact)}>
                          {step.priceImpact.toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Connector Arrow (between steps) */}
            {index < steps.length - 1 && (
              <div className="flex justify-center py-2">
                <div className="w-0.5 h-4 bg-gradient-to-b from-[var(--primary)] to-transparent"></div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="p-3 bg-[var(--primary)]/5 rounded border border-[var(--primary)]/30 space-y-2">
        <div className="flex justify-between items-center text-xs terminal-text">
          <span className="opacity-70">Total Hops:</span>
          <span className="font-semibold terminal-glow">{steps.length}</span>
        </div>
        
        <div className="flex justify-between items-center text-xs terminal-text">
          <span className="opacity-70">Total Fees:</span>
          <span className="font-semibold terminal-glow">
            {steps.reduce((sum, step) => sum + step.fee, 0).toFixed(2)}%
          </span>
        </div>

        {totalPriceImpact > 0 && (
          <div className="flex justify-between items-center text-xs">
            <span className="terminal-text opacity-70">Total Price Impact:</span>
            <span className={`font-semibold ${getPriceImpactColor(totalPriceImpact)}`}>
              {totalPriceImpact.toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      {/* Route Optimization Info */}
      {isOptimal && (
        <div className="p-3 bg-black/20 rounded border border-[var(--primary)]/20 text-xs terminal-text opacity-70">
          <div className="flex items-start gap-2">
            <Zap size={14} className="text-[var(--primary)] mt-0.5 flex-shrink-0" />
            <div>
              This route has been optimized by SwapBack's smart routing engine to provide
              the best output amount while minimizing fees and price impact.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Compact version for quick display
export const RouteVisualizationCompact = ({ steps }: { steps: RouteStep[] }) => {
  return (
    <div className="flex items-center gap-2 text-xs terminal-text flex-wrap">
      {steps.map((step, index) => (
        <React.Fragment key={index}>
          <span className="font-semibold terminal-glow">{step.from}</span>
          <div className="flex items-center gap-1 px-2 py-0.5 bg-[var(--primary)]/10 rounded border border-[var(--primary)]/30">
            <span className="opacity-70">via</span>
            <span className="font-semibold">{step.via}</span>
          </div>
          {index < steps.length - 1 ? (
            <ArrowRight size={12} className="opacity-50" />
          ) : (
            <>
              <ArrowRight size={12} className="opacity-50" />
              <span className="font-semibold terminal-glow">{step.to}</span>
            </>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
