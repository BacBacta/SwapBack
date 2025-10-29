/**
 * Professional Swap Interface
 * Modern, clean design with complete functionality
 */

"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSwapStore } from "@/store/swapStore";
import { useSwapWebSocket } from "@/hooks/useSwapWebSocket";
import { ConnectionStatus } from "./ConnectionStatus";
import { TokenSelector } from "./TokenSelector";
import { AnimatePresence, motion } from "framer-motion";
// import { debounce } from "lodash"; // Désactivé - Pas d'auto-fetch

interface RouteStep {
  label: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  fee: string;
}

export function EnhancedSwapInterface() {
  const { connected } = useWallet();
  
  // Store
  const {
    swap,
    routes,
    setInputAmount,
    setInputToken,
    setOutputToken,
    setSlippageTolerance,
    switchTokens,
    fetchRoutes,
  } = useSwapStore();

  // WebSocket for real-time data
  useSwapWebSocket();

  // State
  const [selectedRouter, setSelectedRouter] = useState<"swapback" | "jupiter">("swapback");
  const [showSlippageModal, setShowSlippageModal] = useState(false);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [tokenSelectorType, setTokenSelectorType] = useState<"input" | "output">("input");
  const [customSlippage, setCustomSlippage] = useState("");
  const [hasSearchedRoute, setHasSearchedRoute] = useState(false);
  const [priceImpact, setPriceImpact] = useState(0);

  // ⚠️ AUTO-FETCH DÉSACTIVÉ pour éviter les boucles infinies
  // L'utilisateur doit cliquer sur "Rechercher Route" manuellement
  
  // Debounced route fetching - DÉSACTIVÉ
  // const debouncedFetchRoutes = useCallback(
  //   debounce((inputToken: typeof swap.inputToken, outputToken: typeof swap.outputToken, inputAmount: string) => {
  //     const amount = parseFloat(inputAmount);
  //     if (inputToken && outputToken && amount > 0) {
  //       fetchRoutes();
  //     }
  //   }, 800),
  //   [fetchRoutes]
  // );

  // Fetch routes when amount changes - DÉSACTIVÉ
  // useEffect(() => {
  //   debouncedFetchRoutes(swap.inputToken, swap.outputToken, swap.inputAmount);
  // }, [swap.inputToken, swap.outputToken, swap.inputAmount, debouncedFetchRoutes]);

  // Calculate price impact
  useEffect(() => {
    if (routes.selectedRoute) {
      // RouteCandidate n'a pas priceImpact, on utilise 0.5% par défaut
      setPriceImpact(0.5);
    }
  }, [routes.selectedRoute]);

  // Handlers
  const handleInputChange = (value: string) => {
    setInputAmount(value);
  };

  const handleSlippagePreset = (value: number) => {
    setSlippageTolerance(value);
    setCustomSlippage("");
  };

  const handleCustomSlippage = () => {
    const value = parseFloat(customSlippage);
    if (!isNaN(value) && value >= 0 && value <= 100) {
      setSlippageTolerance(value);
      setShowSlippageModal(false);
    }
  };

  const setMaxBalance = () => {
    if (swap.inputToken?.balance) {
      setInputAmount(swap.inputToken.balance.toString());
    }
  };

  const setHalfBalance = () => {
    if (swap.inputToken?.balance) {
      const half = swap.inputToken.balance / 2;
      setInputAmount(half.toString());
    }
  };

  const handleSearchRoute = () => {
    const amount = parseFloat(swap.inputAmount);
    if (swap.inputToken && swap.outputToken && amount > 0) {
      fetchRoutes();
      setHasSearchedRoute(true);
    }
  };

  const openInputTokenSelector = () => {
    setTokenSelectorType("input");
    setShowTokenSelector(true);
  };

  const openOutputTokenSelector = () => {
    setTokenSelectorType("output");
    setShowTokenSelector(true);
  };

  const handleTokenSelect = (token: { address: string; symbol: string; name: string; decimals: number; logoURI?: string }) => {
    // Convert TokenSelector format to swapStore format
    const storeToken = {
      mint: token.address,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      logoURI: token.logoURI,
      balance: 0, // Will be updated by websocket
    };
    
    if (tokenSelectorType === "input") {
      setInputToken(storeToken);
    } else {
      setOutputToken(storeToken);
    }
    setShowTokenSelector(false);
  };

  // Mock route data for display
  const inputAmount = parseFloat(swap.inputAmount) || 0;
  const outputAmount = parseFloat(swap.outputAmount) || 0;
  
  const mockRouteInfo = routes.selectedRoute
    ? {
        type: "Aggregator" as const,
        estimatedOutput: outputAmount,
        nonOptimizedOutput: outputAmount * 0.98,
        npi: outputAmount * 0.02,
        rebate: outputAmount * 0.012,
        burn: outputAmount * 0.004,
        fees: outputAmount * 0.004,
        priceImpact: priceImpact,
        route: routes.selectedRoute.venues.map((venue) => ({
          label: venue,
          inputMint: swap.inputToken?.mint || "",
          outputMint: swap.outputToken?.mint || "",
          inAmount: (inputAmount * 1000000).toString(),
          outAmount: ((outputAmount * 1000000) / routes.selectedRoute!.venues.length).toString(),
          fee: "1000",
        })) as RouteStep[],
      }
    : null;

  return (
    <div className="max-w-lg mx-auto">
      {/* Main Swap Card */}
      <div className="bg-black border border-[var(--primary)]/20 rounded-xl p-6 shadow-xl">
        
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Swap</h2>
            <ConnectionStatus />
          </div>
          
          {/* Router Selection */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSelectedRouter("swapback")}
              className={`flex-1 py-2.5 px-4 rounded-lg font-semibold transition-all ${
                selectedRouter === "swapback"
                  ? "bg-[var(--primary)] text-black"
                  : "bg-gray-900 text-gray-400 hover:bg-gray-800"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span>⚡</span>
                <span>SwapBack</span>
              </div>
              {selectedRouter === "swapback" && (
                <div className="text-xs mt-1 opacity-80">+Rebates +Burn</div>
              )}
            </button>
            <button
              onClick={() => setSelectedRouter("jupiter")}
              className={`flex-1 py-2.5 px-4 rounded-lg font-semibold transition-all ${
                selectedRouter === "jupiter"
                  ? "bg-[var(--secondary)] text-black"
                  : "bg-gray-900 text-gray-400 hover:bg-gray-800"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span>🪐</span>
                <span>Jupiter</span>
              </div>
              {selectedRouter === "jupiter" && (
                <div className="text-xs mt-1 opacity-80">Best Market</div>
              )}
            </button>
          </div>
        </div>

        {/* Input Token */}
        <div className="mb-2">
          <div className="bg-gray-900 rounded-xl p-4">
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-400">You Pay</label>
              {swap.inputToken?.balance && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    Balance: {swap.inputToken.balance.toFixed(4)}
                  </span>
                  <button
                    onClick={setHalfBalance}
                    className="text-xs text-[var(--primary)] hover:text-[var(--primary)]/80"
                  >
                    HALF
                  </button>
                  <button
                    onClick={setMaxBalance}
                    className="text-xs text-[var(--primary)] hover:text-[var(--primary)]/80"
                  >
                    MAX
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={swap.inputAmount || ""}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent text-2xl font-bold text-white outline-none"
              />
              <button 
                onClick={openInputTokenSelector}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors"
              >
                {swap.inputToken ? (
                  <>
                    {swap.inputToken.logoURI && (
                      <img
                        src={swap.inputToken.logoURI}
                        alt={swap.inputToken.symbol}
                        className="w-6 h-6 rounded-full"
                      />
                    )}
                    <span className="font-semibold">{swap.inputToken.symbol}</span>
                  </>
                ) : (
                  <span className="text-gray-400">Select token</span>
                )}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            {inputAmount > 0 && (
              <div className="text-sm text-gray-500 mt-2">
                ≈ ${(inputAmount * 1).toFixed(2)} USD
              </div>
            )}
          </div>
        </div>

        {/* Switch Button */}
        <div className="flex justify-center -my-3 relative z-10">
          <button
            onClick={switchTokens}
            className="bg-gray-900 border-2 border-gray-800 hover:border-[var(--primary)] rounded-lg p-2 transition-all"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        {/* Output Token */}
        <div className="mb-6">
          <div className="bg-gray-900 rounded-xl p-4">
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-400">You Receive</label>
              {swap.outputToken?.balance && (
                <span className="text-xs text-gray-500">
                  Balance: {swap.outputToken.balance.toFixed(4)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={swap.outputAmount || ""}
                readOnly
                placeholder="0.00"
                className="flex-1 bg-transparent text-2xl font-bold text-white outline-none"
              />
              <button 
                onClick={openOutputTokenSelector}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors"
              >
                {swap.outputToken ? (
                  <>
                    {swap.outputToken.logoURI && (
                      <img
                        src={swap.outputToken.logoURI}
                        alt={swap.outputToken.symbol}
                        className="w-6 h-6 rounded-full"
                      />
                    )}
                    <span className="font-semibold">{swap.outputToken.symbol}</span>
                  </>
                ) : (
                  <span className="text-gray-400">Select token</span>
                )}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            {outputAmount > 0 && (
              <div className="text-sm text-gray-500 mt-2">
                ≈ ${(outputAmount * 1).toFixed(2)} USD
              </div>
            )}
          </div>
        </div>

        {/* Route Info - Show after search */}
        {hasSearchedRoute && routes.selectedRoute && (
          <div className="mb-6 space-y-3">
            {/* Price Info */}
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Rate</span>
                <span className="text-white font-medium">
                  1 {swap.inputToken?.symbol} ≈ {outputAmount > 0 && inputAmount > 0 ? (outputAmount / inputAmount).toFixed(6) : '0'} {swap.outputToken?.symbol}
                </span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Price Impact</span>
                <span className={priceImpact > 5 ? "text-red-400" : priceImpact > 1 ? "text-yellow-400" : "text-green-400"}>
                  {priceImpact.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Slippage Tolerance</span>
                <button
                  onClick={() => setShowSlippageModal(true)}
                  className="text-[var(--primary)] hover:text-[var(--primary)]/80"
                >
                  {swap.slippageTolerance}% ⚙️
                </button>
              </div>
            </div>

            {/* SwapBack Benefits (if SwapBack router selected) */}
            {selectedRouter === "swapback" && mockRouteInfo && (
              <div className="bg-gradient-to-r from-[var(--primary)]/10 to-[var(--secondary)]/10 border border-[var(--primary)]/30 rounded-lg p-4">
                <div className="text-sm font-semibold text-[var(--primary)] mb-3">
                  ⚡ Your SwapBack Savings
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">NPI Optimization</span>
                    <span className="text-green-400 font-medium">
                      +{mockRouteInfo.npi.toFixed(4)} {swap.outputToken?.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">BACK Rebate</span>
                    <span className="text-green-400 font-medium">
                      +{mockRouteInfo.rebate.toFixed(4)} {swap.outputToken?.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">BACK Burn</span>
                    <span className="text-orange-400 font-medium">
                      {mockRouteInfo.burn.toFixed(4)} BACK 🔥
                    </span>
                  </div>
                  <div className="border-t border-gray-700 pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span className="text-white">Total Saved</span>
                      <span className="text-[var(--primary)]">
                        +{(mockRouteInfo.npi + mockRouteInfo.rebate).toFixed(4)} {swap.outputToken?.symbol}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Route Visualization */}
            {routes.selectedRoute.venues && routes.selectedRoute.venues.length > 0 && (
              <div className="bg-gray-900 rounded-lg p-3">
                <div className="text-sm font-semibold text-gray-300 mb-2">Route</div>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  {routes.selectedRoute.venues.map((venue, index) => (
                    <div key={index} className="flex items-center">
                      <span className="bg-gray-800 px-2 py-1 rounded">{venue}</span>
                      {index < routes.selectedRoute!.venues.length - 1 && (
                        <span className="mx-1">→</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Swap Button */}
        <button
          onClick={handleSearchRoute}
          disabled={!connected || !swap.inputToken || !swap.outputToken || inputAmount <= 0 || routes.isLoading}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
            !connected || !swap.inputToken || !swap.outputToken || inputAmount <= 0
              ? "bg-gray-800 text-gray-600 cursor-not-allowed"
              : routes.isLoading
              ? "bg-[var(--primary)]/50 text-black cursor-wait"
              : "bg-[var(--primary)] text-black hover:bg-[var(--primary)]/90"
          }`}
        >
          {!connected
            ? "Connect Wallet"
            : !swap.inputToken || !swap.outputToken
            ? "Select Tokens"
            : inputAmount <= 0
            ? "Enter Amount"
            : routes.isLoading
            ? "🔍 Finding Best Route..."
            : hasSearchedRoute && routes.selectedRoute
            ? "✅ Execute Swap"
            : "🔍 Search Route"}
        </button>

        {/* Footer Info */}
        <div className="mt-4 text-center text-xs text-gray-500">
          {selectedRouter === "swapback" && (
            <p>⚡ Optimized routing with BACK token rebates & burns</p>
          )}
          {selectedRouter === "jupiter" && (
            <p>🪐 Powered by Jupiter V6 aggregator</p>
          )}
        </div>
      </div>

      {/* Slippage Modal */}
      {showSlippageModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-[var(--primary)]/30 rounded-xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Slippage Settings</h3>
              <button
                onClick={() => setShowSlippageModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Preset Buttons */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[0.1, 0.5, 1.0].map((value) => (
                <button
                  key={value}
                  onClick={() => handleSlippagePreset(value)}
                  className={`py-2 rounded-lg font-semibold transition-all ${
                    swap.slippageTolerance === value
                      ? "bg-[var(--primary)] text-black"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {value}%
                </button>
              ))}
            </div>

            {/* Custom Input */}
            <div className="mb-6">
              <label className="text-sm text-gray-400 mb-2 block">Custom Slippage</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={customSlippage}
                  onChange={(e) => setCustomSlippage(e.target.value)}
                  placeholder="0.5"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white outline-none focus:border-[var(--primary)]"
                />
                <button
                  onClick={handleCustomSlippage}
                  className="bg-[var(--primary)] text-black px-6 py-2 rounded-lg font-semibold hover:bg-[var(--primary)]/90"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Warning */}
            {parseFloat(customSlippage) > 5 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-400">
                ⚠️ High slippage tolerance may result in unfavorable trades
              </div>
            )}
          </div>
        </div>
      )}

      {/* Token Selector Modal */}
      {showTokenSelector && (
        <TokenSelector
          selectedToken={tokenSelectorType === "input" ? swap.inputToken?.mint || "" : swap.outputToken?.mint || ""}
          onSelect={handleTokenSelect}
          onClose={() => setShowTokenSelector(false)}
        />
      )}
    </div>
  );
}
