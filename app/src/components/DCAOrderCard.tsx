/**
 * DCA Order Card Component
 * 
 * Displays a single DCA plan with:
 * - Token pair and amounts
 * - Progress tracking
 * - Next execution time
 * - Action buttons (Execute, Pause/Resume, Cancel)
 */

"use client";

import React, { useState } from "react";
import { DcaPlan } from "@/lib/dca";
import { DcaPlanUI, useExecuteDcaSwap, usePauseDcaPlan, useResumeDcaPlan, useCancelDcaPlan } from "@/hooks/useDCA";
import { toast } from "react-hot-toast";
import { bnToNumberWithFallback } from "@/lib/bnUtils";
import { lamportsToUi } from "@/lib/dca";

interface DCAOrderCardProps {
  plan: DcaPlanUI;
}

export const DCAOrderCard = ({ plan }: DCAOrderCardProps) => {
  const [showDetails, setShowDetails] = useState(false);
  
  const { executeSwap, isExecuting } = useExecuteDcaSwap();
  const { pausePlan, isPausing } = usePauseDcaPlan();
  const { resumePlan, isResuming } = useResumeDcaPlan();
  const { cancelPlan, isCancelling } = useCancelDcaPlan();

  // Get token decimals
  const tokenInDecimals = 9; // Default, should be determined from mint
  const tokenOutDecimals = 9;

  // Format amounts
  const amountPerSwap = lamportsToUi(plan.amountPerSwap, tokenInDecimals);
  const totalInvested = lamportsToUi(plan.totalInvested, tokenInDecimals);
  const totalReceived = lamportsToUi(plan.totalReceived, tokenOutDecimals);
  const averagePrice = totalInvested > 0 ? totalReceived / totalInvested : 0;

  // Status styling
  const getStatusColor = () => {
    if (plan.executedSwaps >= plan.totalSwaps) return "text-green-400";
    if (!plan.isActive) return "text-yellow-400";
    return "text-blue-400";
  };

  const getStatusText = () => {
    if (plan.executedSwaps >= plan.totalSwaps) return "COMPLETED";
    if (!plan.isActive) return "PAUSED";
    return "ACTIVE";
  };

  const handleExecute = () => {
    executeSwap({ planPda: plan.planPda, dcaPlan: plan });
  };

  const handlePauseResume = () => {
    if (plan.isActive) {
      pausePlan(plan.planPda);
    } else {
      resumePlan(plan.planPda);
    }
  };

  const handleCancel = () => {
    if (confirm("Are you sure you want to cancel this DCA plan? This action cannot be undone.")) {
      cancelPlan(plan.planPda);
    }
  };

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6 hover:border-[var(--primary)] transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-bold terminal-text">
              {plan.tokenIn.toBase58().slice(0, 4)}... → {plan.tokenOut.toBase58().slice(0, 4)}...
            </h3>
            <span className={`text-xs px-2 py-1 rounded terminal-text ${getStatusColor()} bg-opacity-10 bg-current`}>
              {getStatusText()}
            </span>
          </div>
          <p className="text-sm text-gray-400 terminal-text">
            Created {plan.createdAtFormatted}
          </p>
        </div>
        
        {plan.readyForExecution && plan.isActive && (
          <div className="flex items-center gap-2 text-green-400 animate-pulse">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-xs terminal-text">READY</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400 terminal-text">Progress</span>
          <span className="text-white terminal-text">
            {plan.executedSwaps} / {plan.totalSwaps} swaps ({plan.progress.toFixed(1)}%)
          </span>
        </div>
        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] transition-all duration-500"
            style={{ width: `${plan.progress}%` }}
          />
        </div>
      </div>

      {/* Key Info */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-400 terminal-text mb-1">AMOUNT PER SWAP</p>
          <p className="text-white terminal-text font-mono">{amountPerSwap.toFixed(4)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 terminal-text mb-1">NEXT EXECUTION</p>
          <p className="text-white terminal-text font-mono">{plan.timeUntilNext}</p>
        </div>
      </div>

      {/* Expandable Details */}
      {showDetails && (
        <div className="border-t border-[var(--border)] pt-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 terminal-text mb-1">TOTAL INVESTED</p>
              <p className="text-white terminal-text font-mono">{totalInvested.toFixed(4)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 terminal-text mb-1">TOTAL RECEIVED</p>
              <p className="text-white terminal-text font-mono">{totalReceived.toFixed(4)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 terminal-text mb-1">AVERAGE PRICE</p>
              <p className="text-white terminal-text font-mono">
                {averagePrice > 0 ? averagePrice.toFixed(6) : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 terminal-text mb-1">INTERVAL</p>
              <p className="text-white terminal-text font-mono">
                {bnToNumberWithFallback(plan.intervalSeconds, 0) / 3600}h
              </p>
            </div>
          </div>
          
          <div>
            <p className="text-xs text-gray-400 terminal-text mb-1">PLAN PDA</p>
            <p className="text-xs text-white terminal-text font-sans break-all">
              {plan.planPda.toBase58()}
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {/* Execute Button - Only show if ready and active */}
        {plan.readyForExecution && plan.isActive && (
          <button
            onClick={handleExecute}
            disabled={isExecuting}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded terminal-text transition-colors"
          >
            {isExecuting ? "EXECUTING..." : "▶️ EXECUTE NOW"}
          </button>
        )}

        {/* Pause/Resume Button - Only show if not completed */}
        {plan.executedSwaps < plan.totalSwaps && (
          <button
            onClick={handlePauseResume}
            disabled={isPausing || isResuming}
            className={`flex-1 ${
              plan.isActive
                ? "bg-yellow-600 hover:bg-yellow-700"
                : "bg-blue-600 hover:bg-blue-700"
            } disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded terminal-text transition-colors`}
          >
            {isPausing || isResuming
              ? "..."
              : plan.isActive
              ? "⏸️ PAUSE"
              : "▶️ RESUME"}
          </button>
        )}

        {/* Details Toggle */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded terminal-text transition-colors"
        >
          {showDetails ? "▲" : "▼"}
        </button>

        {/* Cancel Button */}
        <button
          onClick={handleCancel}
          disabled={isCancelling}
          className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded terminal-text transition-colors"
        >
          {isCancelling ? "..." : "❌"}
        </button>
      </div>
    </div>
  );
};
