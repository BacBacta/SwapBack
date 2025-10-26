"use client";

import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { ArrowDownUp, Settings, TrendingUp, Zap, Info, ChevronDown } from "lucide-react";
import { useBlockchainTracer } from "../hooks/useBlockchainTracer";
import { useTokenData } from "../hooks/useTokenData";
import { useJupiter } from "../hooks/useJupiter";
import { TokenSelector } from "./TokenSelector";
import type { JupiterQuote } from "@swapback/sdk";

interface RouteStep {
  label: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  fee: string;
}

interface RouteInfo {
  type: "Direct" | "Aggregator" | "RFQ" | "Bundle";
  estimatedOutput: number;
  nonOptimizedOutput: number;
  npi: number;
  rebate: number;
  burn: number;
  fees: number;
  route?: RouteStep[];
  priceImpact?: number;
}

interface RouteOption {
  name: string;
  output: number;
  rebate: number;
  gas: number;
  timeEstimate: string;
  badge?: "Best Price" | "Fastest" | "Lowest Gas";
}

export const SwapInterface = () => {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const jupiter = useJupiter();

  const {
    traceSwap,
    operations,
    loading: tracerLoading,
    error: tracerError,
    statistics,
  } = useBlockchainTracer();

  const [inputAmount, setInputAmount] = useState("");
  const [outputAmount, setOutputAmount] = useState("");
  const [inputToken, setInputToken] = useState("USDC");
  const [outputToken, setOutputToken] = useState("SOL");
  const [slippage, setSlippage] = useState(0.5);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [jupiterQuote, setJupiterQuote] = useState<JupiterQuote | null>(null);
  const [selectedRouter, setSelectedRouter] = useState<"swapback" | "jupiter">("swapback");
  const [showInputTokenSelector, setShowInputTokenSelector] = useState(false);
  const [showOutputTokenSelector, setShowOutputTokenSelector] = useState(false);
  const [showRouteDetails, setShowRouteDetails] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [priceChange24h, setPriceChange24h] = useState<number>(0);
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [showRouteComparison, setShowRouteComparison] = useState(false);
  const [showPriceImpactModal, setShowPriceImpactModal] = useState(false);
  const [pendingSwap, setPendingSwap] = useState(false);

  const tokenAddresses: { [key: string]: string } = {
    SOL: "So11111111111111111111111111111111111111112",
    BACK: "BH8thpWca6kpN2pKwWTaKv2F5s4MEkbML18LtJ8eFypU",
    USDC: "3y4dCqwWuYx1B97YEDmgq9qjuNE1eyEwGx2eLgz6Rc6G",
    BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  };

  const tokenDecimals: { [key: string]: number } = {
    SOL: 9,
    BACK: 9,
    USDC: 6,
    USDT: 6,
    BONK: 5,
  };

  const inputTokenData = useTokenData(tokenAddresses[inputToken]);
  const outputTokenData = useTokenData(tokenAddresses[outputToken]);

  // Simulate price calculation with debounce
  useEffect(() => {
    if (!inputAmount || inputAmount === "" || parseFloat(inputAmount) <= 0) {
      setOutputAmount("");
      setRouteInfo(null);
      setJupiterQuote(null);
      return;
    }

    const timer = setTimeout(() => {
      simulateQuote();
    }, 500);

    return () => clearTimeout(timer);
  }, [inputAmount, inputToken, outputToken, selectedRouter]);

  const simulateQuote = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Calculate exchange rate
      const rate = parseFloat(inputAmount) > 0 ? (parseFloat(inputAmount) * 0.005) / parseFloat(inputAmount) : 0;
      setExchangeRate(rate);
      
      // Simulate 24h price change (-5% to +5%)
      const change24h = (Math.random() - 0.5) * 10;
      setPriceChange24h(change24h);
      
      // Generate 3 route options
      const baseOutput = parseFloat(inputAmount) * 0.005;
      const routes: RouteOption[] = [
        {
          name: "SwapBack Optimized",
          output: baseOutput * 1.02,
          rebate: baseOutput * 0.015,
          gas: 0.000012,
          timeEstimate: "~5s",
          badge: "Best Price"
        },
        {
          name: "Jupiter Aggregator",
          output: baseOutput * 0.98,
          rebate: 0,
          gas: 0.000008,
          timeEstimate: "~3s",
          badge: "Fastest"
        },
        {
          name: "Direct Route",
          output: baseOutput * 0.95,
          rebate: 0,
          gas: 0.000005,
          timeEstimate: "~4s",
          badge: "Lowest Gas"
        }
      ];
      setRouteOptions(routes);
      
      const mockRoute: RouteInfo = {
        type: "Aggregator",
        estimatedOutput: baseOutput,
        nonOptimizedOutput: parseFloat(inputAmount) * 0.0045,
        npi: parseFloat(inputAmount) * 0.002,
        rebate: parseFloat(inputAmount) * 0.0015,
        burn: parseFloat(inputAmount) * 0.0005,
        fees: parseFloat(inputAmount) * 0.001,
        priceImpact: 0.12,
      };

      setRouteInfo(mockRoute);
      setOutputAmount(mockRoute.estimatedOutput.toFixed(6));
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwapTokens = () => {
    const tempToken = inputToken;
    const tempAmount = inputAmount;
    
    setInputToken(outputToken);
    setOutputToken(tempToken);
    setInputAmount(outputAmount);
    setOutputAmount(tempAmount);
  };

  const setMaxBalance = () => {
    if (inputTokenData.balance > 0) {
      setInputAmount(inputTokenData.balance.toString());
    }
  };

  const handleExecuteSwap = async () => {
    if (!connected || !publicKey) return;
    
    // Check price impact and show warning modal if > 3%
    if (routeInfo && routeInfo.priceImpact && routeInfo.priceImpact > 3) {
      setShowPriceImpactModal(true);
      setPendingSwap(true);
      return;
    }
    
    await executeSwap();
  };

  const executeSwap = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      alert(
        `✅ Swap exécuté avec succès!\n\n` +
        `${inputAmount} ${inputToken} → ${outputAmount} ${outputToken}`
      );
      
      setInputAmount("");
      setOutputAmount("");
      setRouteInfo(null);
      setShowPriceImpactModal(false);
      setPendingSwap(false);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPriceImpactColor = (impact: number) => {
    if (impact < 1) return "text-green-400";
    if (impact < 3) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <>
      <div className="max-w-xl mx-auto">
        {/* Header avec router selector moderne */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold terminal-text terminal-glow uppercase tracking-wider">
              ⚡ Swap
            </h2>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 border-2 border-[var(--primary)] hover:bg-[var(--primary)] hover:text-black transition-all"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {/* Router Tabs - Style moderne comme Uniswap */}
          <div className="flex gap-2 p-1.5 bg-black/60 backdrop-blur-sm border-2 border-[var(--primary)]/20">
            <button
              onClick={() => setSelectedRouter("swapback")}
              className={`flex-1 py-3 px-4 font-bold terminal-text uppercase tracking-wider transition-all relative ${
                selectedRouter === "swapback"
                  ? "bg-[var(--primary)] text-black"
                  : "text-[var(--primary)] hover:bg-[var(--primary)]/10"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Zap className="w-4 h-4" />
                <span>SwapBack</span>
              </div>
              {selectedRouter === "swapback" && (
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-[var(--primary)] rotate-45"></div>
              )}
            </button>
            <button
              onClick={() => setSelectedRouter("jupiter")}
              className={`flex-1 py-3 px-4 font-bold terminal-text uppercase tracking-wider transition-all relative ${
                selectedRouter === "jupiter"
                  ? "bg-[var(--secondary)] text-black"
                  : "text-[var(--secondary)] hover:bg-[var(--secondary)]/10"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span>Jupiter</span>
              </div>
              {selectedRouter === "jupiter" && (
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-[var(--secondary)] rotate-45"></div>
              )}
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-6 p-6 bg-black/60 backdrop-blur-sm border-2 border-[var(--primary)]/30 animate-fade-in">
            <h3 className="text-lg font-bold terminal-text mb-4 uppercase tracking-wider">
              ⚙️ Paramètres
            </h3>
            <div>
              <label className="block text-sm font-semibold terminal-text uppercase tracking-wider mb-2">
                Slippage Tolerance
              </label>
              <div className="flex gap-2">
                {[0.1, 0.5, 1.0].map((value) => (
                  <button
                    key={value}
                    onClick={() => setSlippage(value)}
                    className={`px-4 py-2 border-2 font-bold terminal-text uppercase transition-all ${
                      slippage === value
                        ? "border-[var(--primary)] bg-[var(--primary)] text-black"
                        : "border-[var(--primary)]/30 text-[var(--primary)] hover:border-[var(--primary)]"
                    }`}
                  >
                    {value}%
                  </button>
                ))}
                <input
                  type="number"
                  value={slippage}
                  onChange={(e) => setSlippage(parseFloat(e.target.value))}
                  className="px-4 py-2 bg-black border-2 border-[var(--primary)]/30 text-[var(--primary)] font-bold terminal-text w-24 focus:border-[var(--primary)] focus:outline-none"
                  step="0.1"
                  min="0.1"
                  max="50"
                />
              </div>
            </div>
          </div>
        )}

        {/* Swap Card - Design moderne inspiré de Uniswap V3 */}
        <div className="relative bg-black/40 backdrop-blur-xl border-2 border-[var(--primary)] p-6 terminal-glow">
          {/* Gradient decoratif */}
          <div className="absolute -inset-px bg-gradient-to-br from-[var(--primary)]/20 via-transparent to-[var(--secondary)]/20 -z-10"></div>

          {/* Input Token Section */}
          <div className="mb-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold terminal-text uppercase tracking-wider text-[var(--primary)]/70">
                Vous payez
              </span>
              {connected && (
                <button
                  onClick={setMaxBalance}
                  className="text-xs font-bold terminal-text uppercase tracking-wider text-[var(--primary)] hover:text-[var(--accent)] transition-colors"
                >
                  Balance: {inputTokenData.loading ? "..." : inputTokenData.balance.toFixed(4)}
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-black/60 border-2 border-[var(--primary)]/30 hover:border-[var(--primary)]/50 transition-all">
              <input
                type="number"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                placeholder="0.0"
                className="flex-1 bg-transparent text-3xl font-bold terminal-text text-[var(--primary)] placeholder-[var(--primary)]/30 outline-none input-glow-pulse"
                disabled={!connected}
              />
              <button
                onClick={() => setShowInputTokenSelector(true)}
                className="flex items-center gap-2 px-4 py-2 border-2 border-[var(--primary)] hover:bg-[var(--primary)] hover:text-black transition-all font-bold terminal-text uppercase tracking-wider"
                disabled={!connected}
              >
                <span>{inputToken}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            
            {inputAmount && inputTokenData.usdPrice > 0 && (
              <div className="mt-2 text-sm font-semibold terminal-text text-[var(--primary)]/70">
                ≈ ${(parseFloat(inputAmount) * inputTokenData.usdPrice).toFixed(2)} USD
              </div>
            )}
          </div>

          {/* Swap Direction Button - Style 1inch */}
          <div className="flex justify-center -my-3 relative z-10">
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={handleSwapTokens}
                className="p-3 bg-black border-2 border-[var(--primary)] hover:bg-[var(--primary)] hover:text-black transition-all group"
                disabled={!connected}
              >
                <ArrowDownUp className="w-5 h-5 group-hover:rotate-180 transition-transform duration-300" />
              </button>
              
              {/* Exchange Rate Display */}
              {exchangeRate > 0 && (
                <div className="bg-black/80 backdrop-blur-sm border-2 border-[var(--primary)]/30 px-4 py-2 mt-1 animate-fade-in">
                  <div className="text-center">
                    <div className="text-xs font-bold terminal-text text-[var(--primary)] whitespace-nowrap">
                      1 {inputToken} = {exchangeRate.toFixed(6)} {outputToken}
                    </div>
                    <div className={`text-xs font-semibold terminal-text flex items-center justify-center gap-1 ${
                      priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {priceChange24h >= 0 ? '↗' : '↘'} {Math.abs(priceChange24h).toFixed(2)}% (24h)
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Output Token Section */}
          <div className="mt-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold terminal-text uppercase tracking-wider text-[var(--primary)]/70">
                Vous recevez
              </span>
              {connected && (
                <span className="text-xs font-bold terminal-text uppercase tracking-wider text-[var(--primary)]/70">
                  Balance: {outputTokenData.loading ? "..." : outputTokenData.balance.toFixed(4)}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-black/60 border-2 border-[var(--primary)]/30 hover:border-[var(--primary)]/50 transition-all">
              <input
                type="text"
                value={loading ? "..." : outputAmount}
                readOnly
                placeholder="0.0"
                className="flex-1 bg-transparent text-3xl font-bold terminal-text text-[var(--primary)] placeholder-[var(--primary)]/30 outline-none animate-count-up"
              />
              <button
                onClick={() => setShowOutputTokenSelector(true)}
                className="flex items-center gap-2 px-4 py-2 border-2 border-[var(--primary)] hover:bg-[var(--primary)] hover:text-black transition-all font-bold terminal-text uppercase tracking-wider"
                disabled={!connected}
              >
                <span>{outputToken}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            
            {outputAmount && outputTokenData.usdPrice > 0 && (
              <div className="mt-2 text-sm font-semibold terminal-text text-[var(--primary)]/70">
                ≈ ${(parseFloat(outputAmount) * outputTokenData.usdPrice).toFixed(2)} USD
              </div>
            )}
          </div>

          {/* Route Info - Style moderne compact */}
          {routeInfo && (
            <div className="mt-6 space-y-3">
              <button
                onClick={() => setShowRouteDetails(!showRouteDetails)}
                className="w-full flex items-center justify-between p-4 bg-black/40 border-2 border-[var(--primary)]/20 hover:border-[var(--primary)]/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <Info className="w-4 h-4 text-[var(--primary)]" />
                  <span className="text-sm font-bold terminal-text uppercase tracking-wider text-[var(--primary)]">
                    Route Details
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-[var(--primary)] transition-transform ${showRouteDetails ? 'rotate-180' : ''}`} />
              </button>

              {showRouteDetails && (
                <div className="p-4 bg-black/60 border-2 border-[var(--primary)]/30 space-y-2 animate-fade-in">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold terminal-text uppercase tracking-wider text-[var(--primary)]/70">
                      Price Impact
                    </span>
                    <span className={`text-sm font-bold terminal-text ${getPriceImpactColor(routeInfo.priceImpact || 0)}`}>
                      {(routeInfo.priceImpact || 0).toFixed(2)}%
                    </span>
                  </div>
                  
                  {selectedRouter === "swapback" && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold terminal-text uppercase tracking-wider text-[var(--primary)]/70">
                          💰 Rebate
                        </span>
                        <span className="text-sm font-bold terminal-text text-green-400">
                          +{routeInfo.rebate.toFixed(6)} {outputToken}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold terminal-text uppercase tracking-wider text-[var(--primary)]/70">
                          🔥 Burn
                        </span>
                        <span className="text-sm font-bold terminal-text text-orange-400">
                          {routeInfo.burn.toFixed(6)} $BACK
                        </span>
                      </div>
                    </>
                  )}
                  
                  <div className="flex justify-between items-center pt-2 border-t-2 border-[var(--primary)]/20">
                    <span className="text-xs font-semibold terminal-text uppercase tracking-wider text-[var(--primary)]/70">
                      Network Fee
                    </span>
                    <span className="text-sm font-bold terminal-text text-[var(--primary)]">
                      ~0.000005 SOL
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Route Comparison Table - Modern Visual */}
          {routeOptions.length > 0 && (
            <div className="mt-3 space-y-2">
              <button
                onClick={() => setShowRouteComparison(!showRouteComparison)}
                className="w-full flex items-center justify-between p-3 bg-black/40 border-2 border-[var(--secondary)]/20 hover:border-[var(--secondary)]/40 transition-all"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[var(--secondary)]" />
                  <span className="text-sm font-bold terminal-text uppercase tracking-wider text-[var(--secondary)]">
                    Compare Routes ({routeOptions.length})
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-[var(--secondary)] transition-transform ${showRouteComparison ? 'rotate-180' : ''}`} />
              </button>

              {showRouteComparison && (
                <div className="p-3 bg-black/60 border-2 border-[var(--secondary)]/30 space-y-2 animate-fade-in">
                  {routeOptions.map((route, index) => (
                    <div 
                      key={index} 
                      className="p-3 bg-black/40 border-2 border-[var(--primary)]/20 hover:border-[var(--primary)]/40 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold terminal-text text-[var(--primary)]">
                            {route.name}
                          </span>
                          {route.badge && (
                            <span className={`text-xs px-2 py-0.5 font-bold terminal-text uppercase ${
                              route.badge === "Best Price" 
                                ? "bg-green-500/20 text-green-400 border border-green-500/40"
                                : route.badge === "Fastest"
                                ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                                : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40"
                            }`}>
                              {route.badge}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-semibold terminal-text text-[var(--primary)]/70">
                          {route.timeEstimate}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-[var(--primary)]/70 font-semibold uppercase tracking-wider mb-1">
                            Output
                          </div>
                          <div className="font-bold terminal-text text-[var(--primary)]">
                            {route.output.toFixed(6)}
                          </div>
                          <div className="mt-1 h-1 bg-black/60 border border-[var(--primary)]/30">
                            <div 
                              className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] transition-all"
                              style={{ width: `${(route.output / Math.max(...routeOptions.map(r => r.output))) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-[var(--primary)]/70 font-semibold uppercase tracking-wider mb-1">
                            Rebate
                          </div>
                          <div className="font-bold terminal-text text-green-400">
                            {route.rebate > 0 ? `+${route.rebate.toFixed(6)}` : '--'}
                          </div>
                          {route.rebate > 0 && (
                            <div className="mt-1 h-1 bg-black/60 border border-green-500/30">
                              <div 
                                className="h-full bg-green-500 transition-all"
                                style={{ width: `${(route.rebate / Math.max(...routeOptions.map(r => r.rebate))) * 100}%` }}
                              ></div>
                            </div>
                          )}
                        </div>
                        
                        <div>
                          <div className="text-[var(--primary)]/70 font-semibold uppercase tracking-wider mb-1">
                            Gas
                          </div>
                          <div className="font-bold terminal-text text-yellow-400">
                            {route.gas.toFixed(8)} SOL
                          </div>
                          <div className="mt-1 h-1 bg-black/60 border border-yellow-500/30">
                            <div 
                              className="h-full bg-yellow-500 transition-all"
                              style={{ width: `${(1 - (route.gas / Math.max(...routeOptions.map(r => r.gas)))) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Swap Button - Style moderne avec gradient */}
          <button
            onClick={handleExecuteSwap}
            disabled={!connected || !inputAmount || !outputAmount || loading}
            className={`w-full mt-6 py-4 font-bold terminal-text uppercase tracking-wider text-lg transition-all hover-scale ${
              !connected
                ? "bg-yellow-500/20 border-2 border-yellow-500 text-yellow-500 cursor-not-allowed"
                : !inputAmount || !outputAmount || loading
                ? "bg-[var(--primary)]/20 border-2 border-[var(--primary)]/50 text-[var(--primary)]/50 cursor-not-allowed"
                : "bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] text-black border-2 border-transparent hover:shadow-[0_0_30px_rgba(0,255,0,0.5)]"
            }`}
          >
            {!connected ? (
              <span className="flex items-center justify-center gap-2">
                <span>🔌</span>
                <span>Connectez votre Wallet</span>
              </span>
            ) : loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⚡</span>
                <span>Processing...</span>
              </span>
            ) : !inputAmount || !outputAmount ? (
              "Entrez un montant"
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Zap className="w-5 h-5" />
                <span>Swap Now</span>
              </span>
            )}
          </button>
        </div>

        {/* Advantages Banner - Style moderne */}
        {selectedRouter === "swapback" && (
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="p-4 bg-black/40 border-2 border-green-500/30 text-center">
              <div className="text-2xl mb-1">💰</div>
              <div className="text-xs font-bold terminal-text uppercase tracking-wider text-green-400">
                Rebates
              </div>
            </div>
            <div className="p-4 bg-black/40 border-2 border-orange-500/30 text-center">
              <div className="text-2xl mb-1">🔥</div>
              <div className="text-xs font-bold terminal-text uppercase tracking-wider text-orange-400">
                Burn
              </div>
            </div>
            <div className="p-4 bg-black/40 border-2 border-blue-500/30 text-center">
              <div className="text-2xl mb-1">⚡</div>
              <div className="text-xs font-bold terminal-text uppercase tracking-wider text-blue-400">
                Best Price
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Token Selectors */}
      {showInputTokenSelector && (
        <TokenSelector
          selectedToken={inputToken}
          onSelect={(token) => {
            setInputToken(token.symbol);
            setShowInputTokenSelector(false);
          }}
          onClose={() => setShowInputTokenSelector(false)}
        />
      )}

      {showOutputTokenSelector && (
        <TokenSelector
          selectedToken={outputToken}
          onSelect={(token) => {
            setOutputToken(token.symbol);
            setShowOutputTokenSelector(false);
          }}
          onClose={() => setShowOutputTokenSelector(false)}
        />
      )}

      {/* Price Impact Warning Modal */}
      {showPriceImpactModal && routeInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="max-w-md w-full bg-black border-4 border-red-500 p-6 animate-slide-in-up">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-2xl font-bold terminal-text text-red-500 uppercase tracking-wider mb-2">
                High Price Impact Warning
              </h3>
              <p className="text-sm terminal-text text-[var(--primary)]/70">
                This swap has an unusually high price impact
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div className="p-4 bg-red-500/10 border-2 border-red-500/30">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold terminal-text text-red-400 uppercase">
                    Price Impact
                  </span>
                  <span className="text-2xl font-bold terminal-text text-red-500">
                    {routeInfo.priceImpact?.toFixed(2)}%
                  </span>
                </div>
                {routeInfo.priceImpact && routeInfo.priceImpact > 10 && (
                  <div className="text-xs terminal-text text-red-400 mt-2 border-t-2 border-red-500/30 pt-2">
                    ❌ <strong>EXTREMELY HIGH!</strong> Consider reducing your swap amount.
                  </div>
                )}
              </div>

              <div className="p-4 bg-black/40 border-2 border-[var(--primary)]/30 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="terminal-text text-[var(--primary)]/70">You pay:</span>
                  <span className="font-bold terminal-text text-[var(--primary)]">
                    {inputAmount} {inputToken}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="terminal-text text-[var(--primary)]/70">You receive:</span>
                  <span className="font-bold terminal-text text-[var(--primary)]">
                    {outputAmount} {outputToken}
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t-2 border-[var(--primary)]/20">
                  <span className="terminal-text text-[var(--primary)]/70">Expected loss:</span>
                  <span className="font-bold terminal-text text-red-400">
                    ~${((parseFloat(inputAmount) * (inputTokenData.usdPrice || 1)) * ((routeInfo.priceImpact || 0) / 100)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPriceImpactModal(false);
                  setPendingSwap(false);
                }}
                className="flex-1 py-3 px-4 bg-black border-2 border-[var(--primary)] text-[var(--primary)] font-bold terminal-text uppercase tracking-wider hover:bg-[var(--primary)] hover:text-black transition-all"
              >
                Cancel
              </button>
              {routeInfo.priceImpact && routeInfo.priceImpact <= 10 ? (
                <button
                  onClick={executeSwap}
                  disabled={loading}
                  className="flex-1 py-3 px-4 bg-red-500/20 border-2 border-red-500 text-red-500 font-bold terminal-text uppercase tracking-wider hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                >
                  {loading ? 'Swapping...' : 'Swap Anyway'}
                </button>
              ) : (
                <button
                  disabled
                  className="flex-1 py-3 px-4 bg-red-500/10 border-2 border-red-500/50 text-red-500/50 font-bold terminal-text uppercase tracking-wider cursor-not-allowed"
                  title="Price impact too high. Reduce your amount."
                >
                  Impact Too High
                </button>
              )}
            </div>

            {routeInfo.priceImpact && routeInfo.priceImpact > 5 && routeInfo.priceImpact <= 10 && (
              <div className="mt-4 p-3 bg-yellow-500/10 border-2 border-yellow-500/30 text-xs terminal-text text-yellow-400">
                💡 <strong>Tip:</strong> Try splitting your swap into smaller amounts to reduce price impact.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
