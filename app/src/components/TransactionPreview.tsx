/**
 * TransactionPreview
 * Shows detailed breakdown before executing swap
 */

import React from "react";
import { AlertTriangle, Info, X } from "lucide-react";

interface TransactionPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  data: {
    youSend: string;
    youReceive: string;
    minimumReceived: string;
    priceImpact: number;
    networkFee: string;
    platformFee: string;
    route: string[];
    slippage: number;
  };
}

export const TransactionPreview = ({
  isOpen,
  onClose,
  onConfirm,
  data,
}: TransactionPreviewProps) => {
  if (!isOpen) return null;

  const { youSend, youReceive, minimumReceived, priceImpact, networkFee, platformFee, route, slippage } = data;

  const isHighImpact = priceImpact > 3;
  const isVeryHighImpact = priceImpact > 5;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/90 z-50 animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-50 animate-fade-in">
        <div className="swap-card m-4 border-2 border-[var(--primary)]">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold terminal-text terminal-glow flex items-center gap-2">
              <Info size={24} />
              Transaction Preview
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[var(--primary)]/10 transition-colors rounded"
            >
              <X size={20} className="terminal-text" />
            </button>
          </div>

          {/* Summary */}
          <div className="space-y-4 mb-6">
            {/* You Send */}
            <div className="p-4 bg-black/40 rounded border border-[var(--primary)]/20">
              <div className="text-xs terminal-text opacity-50 mb-1">You Send</div>
              <div className="text-2xl font-bold terminal-text terminal-glow">
                {youSend}
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <div className="w-8 h-8 border-2 border-[var(--primary)] flex items-center justify-center">
                <svg
                  className="w-4 h-4 terminal-text"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </div>
            </div>

            {/* You Receive */}
            <div className="p-4 bg-black/40 rounded border border-[var(--primary)]/20">
              <div className="text-xs terminal-text opacity-50 mb-1">You Receive (estimated)</div>
              <div className="text-2xl font-bold terminal-text terminal-glow">
                {youReceive}
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-3 mb-6">
            <div className="text-sm font-semibold terminal-text opacity-70 mb-2">
              TRANSACTION DETAILS
            </div>

            <DetailRow label="Minimum Received" value={minimumReceived} />
            <DetailRow
              label="Price Impact"
              value={`${priceImpact.toFixed(2)}%`}
              valueColor={
                isVeryHighImpact
                  ? "text-red-500"
                  : isHighImpact
                  ? "text-orange-500"
                  : "text-[var(--primary)]"
              }
            />
            <DetailRow label="Slippage Tolerance" value={`${slippage}%`} />
            <DetailRow label="Network Fee" value={networkFee} />
            <DetailRow label="Platform Fee" value={platformFee} />
            
            {/* Route */}
            <div className="flex justify-between items-start py-2 border-t border-[var(--primary)]/20">
              <span className="text-sm terminal-text opacity-70">Route</span>
              <div className="text-right">
                {route.map((step, i) => (
                  <div key={i} className="text-sm terminal-text">
                    {step}
                    {i < route.length - 1 && (
                      <span className="mx-2 opacity-50">→</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Price Impact Warning */}
          {isHighImpact && (
            <div
              className={`p-4 mb-6 rounded border-2 ${
                isVeryHighImpact
                  ? "bg-red-500/10 border-red-500"
                  : "bg-orange-500/10 border-orange-500"
              }`}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle
                  size={20}
                  className={isVeryHighImpact ? "text-red-500" : "text-orange-500"}
                />
                <div>
                  <div className="font-semibold mb-1 text-sm">
                    {isVeryHighImpact ? "Very High" : "High"} Price Impact
                  </div>
                  <div className="text-xs opacity-70">
                    {isVeryHighImpact
                      ? "This swap will significantly impact the token price. Consider reducing your trade size."
                      : "This swap may impact the token price. Please review the details carefully."}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-6 border-2 border-[var(--primary)]/30 hover:border-[var(--primary)] hover:bg-[var(--primary)]/10 transition-all terminal-text font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="flex-1 py-3 px-6 bg-[var(--primary)] hover:bg-[var(--primary)]/80 text-black font-bold transition-all"
            >
              Confirm Swap
            </button>
          </div>

          {/* Fine Print */}
          <div className="mt-4 text-xs terminal-text opacity-50 text-center">
            Output is estimated. You will receive at least {minimumReceived} or the transaction will revert.
          </div>
        </div>
      </div>
    </>
  );
};

// Detail Row Component
const DetailRow = ({
  label,
  value,
  valueColor = "terminal-text terminal-glow",
}: {
  label: string;
  value: string;
  valueColor?: string;
}) => (
  <div className="flex justify-between items-center py-2 border-t border-[var(--primary)]/20">
    <span className="text-sm terminal-text opacity-70">{label}</span>
    <span className={`text-sm font-semibold ${valueColor}`}>{value}</span>
  </div>
);
