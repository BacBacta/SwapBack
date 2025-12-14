"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

interface Token {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  balance?: number;
  isFavorite?: boolean;
  liquidity?: number;
}

export function ImprovedSwapInterface() {
  const { connected } = useWallet();

  // State - Routeur DEX natif uniquement
  const [inputAmount, setInputAmount] = useState("");
  const [outputAmount, setOutputAmount] = useState("");
  const [inputToken, setInputToken] = useState<Token | null>(null);
  const [outputToken, setOutputToken] = useState<Token | null>(null);
  const [slippage, setSlippage] = useState(0.5);
  const [isSearchingRoute, setIsSearchingRoute] = useState(false);
  const [hasRoute, setHasRoute] = useState(false);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [tokenSelectorType, setTokenSelectorType] = useState<"input" | "output">("input");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "liquidity">("liquidity");
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Mock tokens with favorites and liquidity
  const mockTokens: Token[] = [
    { mint: "So11111111111111111111111111111111111111112", symbol: "SOL", name: "Solana", decimals: 9, balance: 10.5, isFavorite: true, liquidity: 1500000000 },
    { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC", name: "USD Coin", decimals: 6, balance: 1234.56, isFavorite: true, liquidity: 1200000000 },
    { mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", symbol: "USDT", name: "Tether", decimals: 6, balance: 0, isFavorite: false, liquidity: 800000000 },
    { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", symbol: "BONK", name: "Bonk", decimals: 5, balance: 1000000, isFavorite: false, liquidity: 50000000 },
  ];

  const filteredTokens = mockTokens
    .filter((token) => {
      const matchesSearch = token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           token.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFavorites = !showFavoritesOnly || token.isFavorite;
      return matchesSearch && matchesFavorites;
    })
    .sort((a, b) => {
      if (sortBy === "liquidity") return (b.liquidity || 0) - (a.liquidity || 0);
      return a.name.localeCompare(b.name);
    });

  const handleSearchRoute = () => {
    setIsSearchingRoute(true);
    setRouteError(null);
    
    // Simulate route search with potential error
    setTimeout(() => {
      const hasError = Math.random() > 0.9; // 10% error rate for demo
      if (hasError) {
        setRouteError("No route found. Try adjusting the amount or selecting different tokens.");
        setIsSearchingRoute(false);
        setHasRoute(false);
      } else {
        setOutputAmount((parseFloat(inputAmount) * 204.5).toFixed(2));
        setIsSearchingRoute(false);
        setHasRoute(true);
      }
    }, 1500);
  };

  const handleAmountPreset = (percentage: number) => {
    if (inputToken?.balance) {
      const amount = (inputToken.balance * percentage / 100).toFixed(inputToken.decimals > 6 ? 6 : inputToken.decimals);
      setInputAmount(amount);
    }
  };

  const getBalancePercentage = () => {
    if (!inputToken?.balance || !inputAmount) return 0;
    return Math.min((parseFloat(inputAmount) / inputToken.balance) * 100, 100);
  };

  // Score de confiance du routeur DEX natif (basé sur la profondeur de liquidité)
  const routerConfidenceScore = 98;

  return (
    <div className="max-w-lg mx-auto">
      {/* Main Swap Card */}
      <div className="bg-[#0a0b14] border border-[#1a1b2e] rounded-2xl p-6 shadow-2xl">
        {/* Header - Routeur DEX Natif */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Swap</h2>
            {/* Tooltip info */}
            <div className="relative">
              <button
                onMouseEnter={() => setShowTooltip("router")}
                onMouseLeave={() => setShowTooltip(null)}
                className="text-gray-400 hover:text-white"
                aria-label="Informations routeur"
              >
                ℹ️
              </button>
              {showTooltip === "router" && (
                <div className="absolute right-0 top-8 w-64 bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 z-50">
                  Routeur DEX natif avec CPI direct vers Orca Whirlpool, Raydium CLMM, et plus. Rebates automatiques + Burn BACK.
                </div>
              )}
            </div>
          </div>

          {/* Bandeau SwapBack Router avec score de confiance */}
          <div className="bg-gradient-to-r from-[#00d4ff] to-[#7b2cbf] rounded-xl p-4 relative">
            <div className="flex items-center justify-center gap-2 text-white">
              <span>⚡</span>
              <span className="font-semibold">SwapBack DEX Router</span>
            </div>
            <div className="text-xs mt-1 text-center text-white/90">+Rebates +Burn • CPI natif DEX</div>
            <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
              {routerConfidenceScore}%
            </div>
          </div>
        </div>

        {/* Input Token */}
        <div className="mb-2">
          <div className="bg-[#1a1b2e] rounded-xl p-4">
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-400">You Pay</label>
              {inputToken?.balance && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    Balance: {inputToken.balance.toFixed(4)} ({getBalancePercentage().toFixed(0)}%)
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 mb-3">
              <input
                type="number"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent text-2xl font-bold text-white outline-none"
                aria-label="Input amount"
              />
              <button
                onClick={() => {
                  setTokenSelectorType("input");
                  setShowTokenSelector(true);
                }}
                className="flex items-center gap-2 bg-[#252640] hover:bg-[#2d2e4a] px-4 py-2 rounded-lg transition-colors"
              >
                {inputToken ? (
                  <>
                    <span className="font-semibold text-white">{inputToken.symbol}</span>
                  </>
                ) : (
                  <span className="text-gray-400">Select</span>
                )}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Amount Presets */}
            {inputToken?.balance && (
              <div className="flex gap-2">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => handleAmountPreset(pct)}
                    className="flex-1 text-xs py-1.5 bg-[#252640] hover:bg-[#00d4ff] hover:text-black rounded-lg transition-all font-semibold text-gray-400"
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Switch Button */}
        <div className="flex justify-center -my-3 relative z-10">
          <button
            onClick={() => {
              const temp = inputToken;
              setInputToken(outputToken);
              setOutputToken(temp);
            }}
            className="bg-[#1a1b2e] border-2 border-[#252640] hover:border-[#00d4ff] rounded-xl p-2 transition-all"
            aria-label="Switch tokens"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        {/* Output Token */}
        <div className="mb-6">
          <div className="bg-[#1a1b2e] rounded-xl p-4">
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-400">You Receive</label>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={outputAmount}
                readOnly
                placeholder="0.00"
                className="flex-1 bg-transparent text-2xl font-bold text-white outline-none"
                aria-label="Output amount"
                aria-live="polite"
              />
              <button
                onClick={() => {
                  setTokenSelectorType("output");
                  setShowTokenSelector(true);
                }}
                className="flex items-center gap-2 bg-[#252640] hover:bg-[#2d2e4a] px-4 py-2 rounded-lg transition-colors"
              >
                {outputToken ? (
                  <span className="font-semibold text-white">{outputToken.symbol}</span>
                ) : (
                  <span className="text-gray-400">Select</span>
                )}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Loading Skeleton / Route Info */}
        {isSearchingRoute && (
          <div className="mb-6 space-y-3 animate-pulse" role="status" aria-live="polite" aria-label="Searching for best route">
            <div className="bg-[#1a1b2e] rounded-lg p-4">
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-700 rounded w-1/2"></div>
            </div>
            <div className="bg-[#1a1b2e] rounded-lg p-4">
              <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-700 rounded w-2/3"></div>
            </div>
            <div className="text-center text-sm text-[#00d4ff] mt-2">
              🔍 Finding best route...
            </div>
          </div>
        )}

        {/* Error State */}
        {routeError && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4" role="alert" aria-live="assertive">
            <div className="flex items-start gap-3">
              <span className="text-red-400 text-xl">⚠️</span>
              <div>
                <div className="text-red-400 font-semibold mb-1">Route Error</div>
                <div className="text-sm text-red-300">{routeError}</div>
              </div>
            </div>
          </div>
        )}

        {/* Route Info with Tooltips */}
        {hasRoute && !isSearchingRoute && (
          <div className="mb-6 space-y-3">
            <div className="bg-[#1a1b2e] rounded-lg p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Rate</span>
                <span className="text-white font-medium">1 SOL ≈ 204.5 USDC</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Price Impact</span>
                <span className="text-green-400">0.5%</span>
              </div>
            </div>

            {/* SwapBack DEX Router Savings - toujours affiché */}
            <div className="bg-gradient-to-r from-[#00d4ff]/10 to-[#7b2cbf]/10 border border-[#00d4ff]/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-[#00d4ff]">⚡ SwapBack Savings</div>
                  <button
                    onMouseEnter={() => setShowTooltip("npi")}
                    onMouseLeave={() => setShowTooltip(null)}
                    className="text-gray-400 hover:text-white text-xs"
                    aria-label="What is NPI?"
                  >
                    ℹ️
                  </button>
                  {showTooltip === "npi" && (
                    <div className="absolute right-8 mt-8 w-64 bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 z-50">
                      <strong>NPI (Net Positive Impact)</strong>: 70% of protocol fees are returned to you as rebates, making your trades more profitable.
                    </div>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">NPI Rebate</span>
                    <span className="text-green-400 font-medium">+0.0123 SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">BACK Burn 🔥</span>
                    <span className="text-orange-400 font-medium">0.004 BACK</span>
                  </div>
                </div>
              </div>
          </div>
        )}

        {/* Swap Button with Better States */}
        <button
          onClick={handleSearchRoute}
          disabled={!connected || !inputToken || !outputToken || !inputAmount || isSearchingRoute}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
            !connected || !inputToken || !outputToken || !inputAmount
              ? "bg-[#1a1b2e] text-gray-600 cursor-not-allowed"
              : isSearchingRoute
                ? "bg-[#00d4ff]/50 text-white cursor-wait"
                : hasRoute
                  ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg hover:scale-[1.02]"
                  : "bg-gradient-to-r from-[#00d4ff] to-[#7b2cbf] text-white hover:shadow-lg hover:scale-[1.02]"
          }`}
          aria-label={!connected ? "Connect wallet to swap" : hasRoute ? "Execute swap" : "Search for best route"}
        >
          {!connected
            ? "Connect Wallet"
            : !inputToken || !outputToken
              ? "Select Tokens"
              : !inputAmount
                ? "Enter Amount"
                : isSearchingRoute
                  ? "🔍 Searching..."
                  : hasRoute
                    ? "✅ Execute Swap"
                    : "🔍 Search Route"}
        </button>
      </div>

      {/* Enhanced Token Selector Modal */}
      {showTokenSelector && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0a0b14] border border-[#1a1b2e] rounded-2xl p-6 max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Select Token</h3>
              <button
                onClick={() => setShowTokenSelector(false)}
                className="text-gray-400 hover:text-white text-2xl"
                aria-label="Close token selector"
              >
                ✕
              </button>
            </div>

            {/* Search Bar */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or symbol"
              className="w-full bg-[#1a1b2e] border border-[#252640] rounded-lg px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-[#00d4ff] mb-3"
              aria-label="Search tokens"
            />

            {/* Filters */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  showFavoritesOnly
                    ? "bg-[#00d4ff] text-black"
                    : "bg-[#1a1b2e] text-gray-400 hover:bg-[#252640]"
                }`}
              >
                ⭐ Favorites
              </button>
              <button
                onClick={() => setSortBy(sortBy === "liquidity" ? "name" : "liquidity")}
                className="px-3 py-1.5 bg-[#1a1b2e] text-gray-400 hover:bg-[#252640] rounded-lg text-sm font-semibold transition-all"
              >
                Sort: {sortBy === "liquidity" ? "💧 Liquidity" : "📝 Name"}
              </button>
            </div>

            {/* Token List */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {filteredTokens.map((token) => (
                <button
                  key={token.mint}
                  onClick={() => {
                    if (tokenSelectorType === "input") {
                      setInputToken(token);
                    } else {
                      setOutputToken(token);
                    }
                    setShowTokenSelector(false);
                    setSearchQuery("");
                  }}
                  className="w-full flex items-center justify-between p-3 bg-[#1a1b2e] hover:bg-[#252640] rounded-lg transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#00d4ff] to-[#7b2cbf] rounded-full" />
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-white">{token.symbol}</div>
                        {token.isFavorite && <span className="text-yellow-400 text-xs">⭐</span>}
                      </div>
                      <div className="text-xs text-gray-400">{token.name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-white">{token.balance?.toFixed(4) || "0.00"}</div>
                    <div className="text-xs text-gray-500">
                      ${(token.liquidity || 0) / 1000000}M
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
