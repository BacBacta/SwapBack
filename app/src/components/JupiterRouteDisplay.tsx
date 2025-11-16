"use client";

import React from "react";
import type { JupiterQuote, RouteInfo } from "@swapback/sdk";

interface JupiterRouteDisplayProps {
  quote: JupiterQuote;
  routeInfo: RouteInfo;
  inputDecimals: number;
  outputDecimals: number;
  inputSymbol: string;
  outputSymbol: string;
}

/**
 * Composant pour afficher les détails d'une route Jupiter
 */
export const JupiterRouteDisplay: React.FC<JupiterRouteDisplayProps> = ({
  quote,
  routeInfo,
  inputDecimals,
  outputDecimals,
  inputSymbol,
  outputSymbol,
}) => {
  // Calculate amounts in readable format
  const inputAmount = Number(quote.inAmount) / Math.pow(10, inputDecimals);
  const outputAmount = Number(quote.outAmount) / Math.pow(10, outputDecimals);
  const priceImpact = routeInfo.priceImpactPct;

  // Déterminer la couleur du price impact
  const getPriceImpactColor = (impact: number) => {
    if (impact < 0.1) return "text-green-600";
    if (impact < 0.5) return "text-yellow-600";
    if (impact < 1) return "text-orange-600";
    return "text-red-600";
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Route Jupiter</h3>
        <span className="text-xs text-gray-500">
          {routeInfo.marketInfos.length}{" "}
          {routeInfo.marketInfos.length === 1 ? "AMM" : "AMMs"}
        </span>
      </div>

      {/* Amounts */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500">Vous payez</p>
          <p className="text-sm font-medium">
            {inputAmount.toFixed(6)} {inputSymbol}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Vous recevez</p>
          <p className="text-sm font-medium">
            {outputAmount.toFixed(6)} {outputSymbol}
          </p>
        </div>
      </div>

      {/* Price Impact */}
      <div className="flex items-center justify-between py-2 border-t border-gray-200">
        <span className="text-xs text-gray-600">Price Impact</span>
        <span
          className={`text-xs font-medium ${getPriceImpactColor(priceImpact)}`}
        >
          {priceImpact < 0.01 ? "< 0.01%" : `${priceImpact.toFixed(2)}%`}
        </span>
      </div>

      {/* Détails de la route */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-700">
          Détails de la route :
        </p>
        <div className="space-y-1">
          {routeInfo.marketInfos.map((market, index) => {
            const feeAmount = market.feeAmount
              ? Number(market.feeAmount) / Math.pow(10, inputDecimals)
              : 0;

            return (
              <div
                key={`${market.id}-${index}`}
                className="bg-[var(--primary)] rounded p-2 text-xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-700">
                    {market.label}
                  </span>
                  {feeAmount > 0 && (
                    <span className="text-gray-500">
                      Fee: {feeAmount.toFixed(6)}
                    </span>
                  )}
                </div>
                <div className="flex items-center text-gray-600">
                  <span className="truncate text-[10px]">
                    {market.inputMint.slice(0, 4)}...
                    {market.inputMint.slice(-4)}
                  </span>
                  <svg
                    className="w-3 h-3 mx-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  <span className="truncate text-[10px]">
                    {market.outputMint.slice(0, 4)}...
                    {market.outputMint.slice(-4)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Informations supplémentaires */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200 text-xs">
        <div>
          <span className="text-gray-500">Swap Mode:</span>
          <span className="ml-1 font-medium text-gray-700">
            {quote.swapMode || "ExactIn"}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Slippage:</span>
          <span className="ml-1 font-medium text-gray-700">
            {(quote.slippageBps / 100).toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
};
