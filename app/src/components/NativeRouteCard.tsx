/**
 * Native Route Summary Card
 * Displays provider, quote, and NPI economics using normalized insights
 */

"use client";

import React from "react";
import type { NativeRouteInsights } from "@/lib/routing/nativeRouteInsights";
import { formatTokenAmount } from "@/lib/routing/nativeRouteInsights";
import { formatNumberWithCommas } from "@/utils/formatNumber";

interface NativeRouteCardProps {
  insights: NativeRouteInsights;
  providerLabel?: string | null;
  outputSymbol?: string;
  fromCache?: boolean;
  usedFallback?: boolean;
}

export function NativeRouteCard({
  insights,
  providerLabel,
  outputSymbol,
  fromCache,
  usedFallback,
}: NativeRouteCardProps) {
  const provider = providerLabel ?? insights.provider ?? "SwapBack";
  const sharePercentSuffix = insights.sharePercent
    ? ` (${insights.sharePercent.toFixed(1)}%)`
    : "";

  const format = (value?: number | null, precision = 6) =>
    formatNumberWithCommas(formatTokenAmount(value, precision));

  return (
    <div className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">⚡</span>
          <div className="text-xs font-semibold text-emerald-400">Route native SwapBack</div>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-white/80">
          {fromCache && (
            <span className="px-2 py-0.5 rounded-full bg-white/10 uppercase tracking-wide">cache</span>
          )}
          {usedFallback && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-100 uppercase tracking-wide">
              fallback
            </span>
          )}
        </div>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-400">Provider</span>
          <span className="text-white font-medium">{provider}</span>
        </div>
        {insights.quoteTokens !== null && (
          <div className="flex justify-between">
            <span className="text-gray-400">Quote</span>
            <span className="text-white font-medium">
              {format(insights.quoteTokens, 4)} {outputSymbol}
            </span>
          </div>
        )}
        {insights.baseTokens !== null && insights.improvedTokens !== null && (
          <div className="flex justify-between">
            <span className="text-gray-400">Comparatif</span>
            <span className="text-white font-medium">
              {format(insights.baseTokens, 4)} → {format(insights.improvedTokens, 4)} {outputSymbol}
            </span>
          </div>
        )}
        {insights.improvementBps > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-400">Amélioration</span>
            <span className="text-emerald-400 font-semibold">
              +{insights.improvementBps.toFixed(2)} bps
            </span>
          </div>
        )}
        {insights.hasEconomics ? (
          <>
            <div className="flex justify-between">
              <span className="text-gray-400">Part utilisateur{sharePercentSuffix}</span>
              <span className="text-emerald-400 font-medium">
                +{format(insights.userShareTokens, 6)} {outputSymbol}
              </span>
            </div>
            {insights.totalGainTokens > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Gain total</span>
                <span className="text-emerald-300 font-medium">
                  +{format(insights.totalGainTokens, 6)} {outputSymbol}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="text-[11px] text-gray-400">
            {insights.explanation ?? "Pas d'opportunité NPI détectée sur cette paire."}
          </div>
        )}
        {insights.explanation && insights.hasEconomics && (
          <div className="text-[11px] text-white/70 border-t border-white/10 pt-1">
            {insights.explanation}
          </div>
        )}
      </div>
    </div>
  );
}
