/**
 * PriceRefreshIndicator
 * Shows countdown timer and manual refresh button
 */

import React from "react";
import { RefreshCw } from "lucide-react";

interface PriceRefreshIndicatorProps {
  secondsUntilRefresh: number;
  isRefreshing: boolean;
  onManualRefresh: () => void;
  lastUpdated: Date | null;
}

export const PriceRefreshIndicator = ({
  secondsUntilRefresh,
  isRefreshing,
  onManualRefresh,
  lastUpdated,
}: PriceRefreshIndicatorProps) => {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-black/20 rounded text-xs terminal-text">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
        <span className="opacity-70">
          {isRefreshing ? (
            "Updating prices..."
          ) : (
            <>
              Price updates in{" "}
              <span className="font-semibold terminal-glow">
                {secondsUntilRefresh}s
              </span>
            </>
          )}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {lastUpdated && (
          <span className="opacity-50 text-xs">
            {new Date(lastUpdated).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        )}
        <button
          onClick={onManualRefresh}
          disabled={isRefreshing}
          className={`p-1.5 border border-[var(--primary)]/30 hover:border-[var(--primary)] hover:bg-[var(--primary)]/10 transition-all rounded ${
            isRefreshing ? "opacity-50 cursor-not-allowed" : ""
          }`}
          title="Refresh now"
        >
          <RefreshCw
            size={14}
            className={isRefreshing ? "animate-spin" : ""}
          />
        </button>
      </div>
    </div>
  );
};
