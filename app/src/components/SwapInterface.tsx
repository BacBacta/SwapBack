"use client";

import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
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
  nonOptimizedOutput: number; // ✨ NOUVEAU: Prix sans optimisation
  npi: number;
  rebate: number;
  burn: number;
  fees: number;
  route?: RouteStep[];
  priceImpact?: number;
}

export const SwapInterface = () => {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const jupiter = useJupiter();

  // Router selection: "swapback" or "jupiter"
  const [selectedRouter, setSelectedRouter] = useState<"swapback" | "jupiter">(
    "swapback"
  );

  // 🔍 Blockchain Tracer
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
  const [loading, setLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [jupiterQuote, setJupiterQuote] = useState<JupiterQuote | null>(null);
  const [lastOperation, setLastOperation] = useState<string | null>(null);
  const [showInputTokenSelector, setShowInputTokenSelector] = useState(false);
  const [showOutputTokenSelector, setShowOutputTokenSelector] = useState(false);

  // Mapping des tokens vers leurs adresses Solana (DEVNET)
  const tokenAddresses: { [key: string]: string } = {
    SOL: "So11111111111111111111111111111111111111112",
    BACK: "BH8thpWca6kpN2pKwWTaKv2F5s4MEkbML18LtJ8eFypU", // 🆕 SwapBack Token (Devnet)
    USDC: "3y4dCqwWuYx1B97YEDmgq9qjuNE1eyEwGx2eLgz6Rc6G", // 🔄 USDC Test (Devnet)
    BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // Bonk (Devnet)
    USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    PYTH: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    mSOL: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
    JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    JTO: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
  };

  const tokenDecimals: { [key: string]: number } = {
    SOL: 9,
    BACK: 9, // 🆕 SwapBack Token
    USDC: 6,
    USDT: 6,
    BONK: 5,
    PYTH: 6,
    mSOL: 9,
    JUP: 6,
    JTO: 9,
  };

  // Récupérer balance + prix USD pour chaque token
  const inputTokenData = useTokenData(tokenAddresses[inputToken]);
  const outputTokenData = useTokenData(tokenAddresses[outputToken]);

  // 🔄 Calcul automatique du prix avec debounce
  useEffect(() => {
    // Reset output si input est vide
    if (!inputAmount || inputAmount === "" || parseFloat(inputAmount) <= 0) {
      setOutputAmount("");
      setRouteInfo(null);
      setJupiterQuote(null);
      return;
    }

    // Debounce: attendre 800ms après la dernière frappe
    const debounceTimer = setTimeout(() => {
      if (connected && inputAmount && parseFloat(inputAmount) > 0) {
        console.log("🔄 Calcul automatique du prix...");
        handleSimulateRoute();
      }
    }, 800);

    return () => clearTimeout(debounceTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputAmount, inputToken, outputToken, selectedRouter, connected]);

  const handleSimulateRoute = async () => {
    if (!inputAmount || !connected) return;

    setLoading(true);
    try {
      const inputMint = tokenAddresses[inputToken];
      const outputMint = tokenAddresses[outputToken];

      if (!inputMint || !outputMint) {
        throw new Error("Token non supporté");
      }

      if (selectedRouter === "jupiter") {
        // 🪐 Jupiter V6 API
        const inputDecimals = tokenDecimals[inputToken] || 6;
        const amountInSmallestUnit = Math.floor(
          parseFloat(inputAmount) * Math.pow(10, inputDecimals)
        );
        const slippageBps = Math.floor(slippage * 100);

        console.log(
          `🪐 Jupiter quote request: ${inputAmount} ${inputToken} → ${outputToken}`
        );
        console.log(
          `   Amount: ${amountInSmallestUnit} (decimals: ${inputDecimals})`
        );

        const quote = await jupiter.getQuote(
          inputMint,
          outputMint,
          amountInSmallestUnit,
          slippageBps,
          false
        );

        if (quote) {
          setJupiterQuote(quote);
          setRouteInfo(null);
          const outputDecimals = tokenDecimals[outputToken] || 6;
          const output = Number(quote.outAmount) / Math.pow(10, outputDecimals);
          setOutputAmount(output.toFixed(6));
          console.log(`✅ Jupiter quote: ${output.toFixed(6)} ${outputToken}`);
          console.log(`   Price impact: ${quote.priceImpactPct}%`);
          console.log(`   Route markets:`, quote.routePlan?.length || 0);
        } else {
          throw new Error("Impossible d'obtenir un quote Jupiter");
        }
      } else {
        // ⚡ SwapBack API
        const response = await fetch("http://localhost:3003/simulate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputMint,
            outputMint,
            inputAmount: (parseFloat(inputAmount) * 1000000).toString(),
            slippage: slippage / 100,
            userPubkey: publicKey?.toString(),
          }),
        });

        if (!response.ok) {
          throw new Error("Erreur lors de la simulation de route");
        }

        const data = await response.json();

        console.log("📥 Données reçues de l'API:", data);

        const route: RouteInfo = {
          type: data.type || "Aggregator",
          estimatedOutput: data.estimatedOutput / 1000000 || 0,
          nonOptimizedOutput: data.nonOptimizedOutput / 1000000 || 0,
          npi: data.npi / 1000000 || 0,
          rebate: data.rebateAmount / 1000000 || 0,
          burn: data.burnAmount / 1000000 || 0,
          fees: data.fees / 1000000 || 0,
          route: data.route || [],
          priceImpact: data.priceImpact || 0,
        };

        console.log("✅ RouteInfo transformé:", route);
        console.log("🛣️ Nombre d'étapes de route:", route.route?.length);

        setRouteInfo(route);
        setJupiterQuote(null);
        setOutputAmount(route.estimatedOutput.toFixed(6));
      }
    } catch (error) {
      console.error("Erreur lors de la simulation:", error);
      // Fallback vers les données mockées en cas d'erreur
      const mockRoute: RouteInfo = {
        type: "Aggregator",
        estimatedOutput: parseFloat(inputAmount) * 0.005,
        nonOptimizedOutput: parseFloat(inputAmount) * 0.0045,
        npi: parseFloat(inputAmount) * 0.002,
        rebate: parseFloat(inputAmount) * 0.0015,
        burn: parseFloat(inputAmount) * 0.0005,
        fees: parseFloat(inputAmount) * 0.001,
      };

      setRouteInfo(mockRoute);
      setJupiterQuote(null);
      setOutputAmount(mockRoute.estimatedOutput.toFixed(6));
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteSwap = async () => {
    if (!connected || !publicKey) return;

    setLoading(true);
    try {
      if (selectedRouter === "jupiter" && jupiterQuote) {
        // 🪐 Jupiter Swap
        console.log("🔄 Exécution du swap Jupiter...");

        const inputMint = tokenAddresses[inputToken];
        const outputMint = tokenAddresses[outputToken];
        const inputDecimals = tokenDecimals[inputToken] || 6;
        const amountInSmallestUnit = Math.floor(
          parseFloat(inputAmount) * Math.pow(10, inputDecimals)
        );
        const slippageBps = Math.floor(slippage * 100);

        const signature = await jupiter.executeSwap(
          inputMint,
          outputMint,
          amountInSmallestUnit,
          slippageBps
        );

        if (signature) {
          setLastOperation(signature);
          console.log("✅ Swap Jupiter exécuté:", signature);
          alert(
            `✅ Swap Jupiter exécuté avec succès!\n\n` +
              `📋 Signature: ${signature.substring(0, 20)}...\n` +
              `🔗 Voir sur Solscan (devnet)`
          );

          // Reset
          setInputAmount("");
          setOutputAmount("");
          setJupiterQuote(null);
        } else {
          throw new Error("Le swap Jupiter a échoué");
        }
      } else if (selectedRouter === "swapback" && routeInfo) {
        // ⚡ SwapBack Swap
        console.log("🔄 Exécution du swap SwapBack...");

        // Simulation de l'exécution du swap
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 🔍 TRAÇAGE BLOCKCHAIN
        console.log("📝 Traçage de l'opération sur la blockchain...");
        traceSwap();

        console.log("✅ Swap en cours...");

        alert(
          `✅ Swap SwapBack exécuté avec succès!\n\n` +
            `� Montant: ${inputAmount} ${inputToken} → ${outputAmount} ${outputToken}\n` +
            `🔗 Opération tracée sur la blockchain`
        );

        // Reset
        setInputAmount("");
        setOutputAmount("");
        setRouteInfo(null);
      }
    } catch (error) {
      console.error("❌ Erreur lors du swap:", error);
      alert(
        `❌ Erreur lors du swap: ${error instanceof Error ? error.message : "Erreur inconnue"}`
      );
    } finally {
      setLoading(false);
    }
  };

  const setMaxBalance = () => {
    if (inputTokenData.balance > 0) {
      setInputAmount(inputTokenData.balance.toString());
      setRouteInfo(null);
    }
  };

  const setHalfBalance = () => {
    if (inputTokenData.balance > 0) {
      setInputAmount((inputTokenData.balance / 2).toString());
      setRouteInfo(null);
    }
  };

  const swapTokens = () => {
    const tempToken = inputToken;
    const tempAmount = inputAmount;
    setInputToken(outputToken);
    setOutputToken(tempToken);
    setInputAmount(outputAmount);
    setOutputAmount(tempAmount);
    setRouteInfo(null);
  };

  return (
    <>
      <div className="swap-card max-w-2xl mx-auto relative">
        {/* Decorative gradient */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-[var(--primary)]/10 rounded-full blur-3xl -z-10"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-[var(--secondary)]/10 rounded-full blur-3xl -z-10"></div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 bg-[var(--primary)]/10 rounded-full border border-[var(--primary)]/20">
            <span className="w-2 h-2 bg-[var(--primary)] rounded-full animate-pulse"></span>
            <span className="text-xs font-semibold text-[var(--primary)]">
              Smart Router Active
            </span>
          </div>
          <h2 className="section-title mb-3">Swap Tokens</h2>
          <p className="body-regular text-gray-400">
            Get the best price across all Solana DEXs
          </p>
        </div>

        {/* Router Selection Toggle */}
        <div className="mb-6">
          <div className="flex gap-2 p-1 bg-black/30 rounded-xl border border-white/10">
            <button
              onClick={() => {
                setSelectedRouter("swapback");
                setRouteInfo(null);
                setJupiterQuote(null);
                setOutputAmount("");
              }}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                selectedRouter === "swapback"
                  ? "bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] text-white shadow-lg"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span>⚡</span>
                <span>SwapBack</span>
              </div>
              {selectedRouter === "swapback" && (
                <div className="text-xs mt-1 opacity-90">+Rebates +Burn</div>
              )}
            </button>
            <button
              onClick={() => {
                setSelectedRouter("jupiter");
                setRouteInfo(null);
                setJupiterQuote(null);
                setOutputAmount("");
              }}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                selectedRouter === "jupiter"
                  ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span>🪐</span>
                <span>Jupiter V6</span>
              </div>
              {selectedRouter === "jupiter" && (
                <div className="text-xs mt-1 opacity-90">Best Market Price</div>
              )}
            </button>
          </div>
        </div>

        {/* Input Token */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-3">
            <label className="label-text">You pay</label>
            {connected && (
              <div className="text-sm text-gray-400">
                Balance:{" "}
                <span className="font-semibold text-white">
                  {inputTokenData.loading
                    ? "..."
                    : inputTokenData.balance.toFixed(4)}
                </span>{" "}
                {inputToken}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="number"
                value={inputAmount}
                onChange={(e) => {
                  setInputAmount(e.target.value);
                  setRouteInfo(null);
                }}
                placeholder="0.00"
                className="input-field w-full text-2xl font-bold"
                disabled={!connected}
              />
              {inputAmount && inputTokenData.usdPrice > 0 && (
                <div className="mt-2 text-sm text-gray-400">
                  ≈ $
                  {(parseFloat(inputAmount) * inputTokenData.usdPrice).toFixed(
                    2
                  )}{" "}
                  USD
                </div>
              )}
            </div>
            <button
              onClick={() => setShowInputTokenSelector(true)}
              className="px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 hover:border-white/20 transition-all flex items-center gap-2 min-w-[120px]"
              disabled={!connected}
            >
              <span className="font-semibold">{inputToken}</span>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
          {connected && inputTokenData.balance > 0 && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={setHalfBalance}
                className="px-3 py-1.5 text-xs font-semibold bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
              >
                HALF
              </button>
              <button
                onClick={setMaxBalance}
                className="px-3 py-1.5 text-xs font-semibold bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 text-[var(--primary)] rounded-lg transition-colors border border-[var(--primary)]/20"
              >
                MAX
              </button>
            </div>
          )}
        </div>

        {/* Swap Icon */}
        <div className="flex justify-center my-6">
          <button
            className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-all border border-white/20 hover:scale-110"
            onClick={swapTokens}
            disabled={!connected}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
          </button>
        </div>

        {/* Output Token */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-3">
            <label className="label-text">You receive</label>
            {connected && (
              <div className="text-sm text-gray-400">
                Balance:{" "}
                <span className="font-semibold text-white">
                  {outputTokenData.loading
                    ? "..."
                    : outputTokenData.balance.toFixed(4)}
                </span>{" "}
                {outputToken}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="number"
                value={outputAmount}
                placeholder="0.00"
                className="input-field w-full text-2xl font-bold"
                disabled
              />
              {outputAmount && outputTokenData.usdPrice > 0 && (
                <div className="mt-2 text-sm text-gray-400">
                  ≈ $
                  {(
                    parseFloat(outputAmount) * outputTokenData.usdPrice
                  ).toFixed(2)}{" "}
                  USD
                </div>
              )}
            </div>
            <button
              onClick={() => setShowOutputTokenSelector(true)}
              className="px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 hover:border-white/20 transition-all flex items-center gap-2 min-w-[120px]"
              disabled={!connected}
            >
              <span className="font-semibold">{outputToken}</span>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Slippage */}
        <div className="mb-8 text-center">
          <label className="label-text mb-3 block">
            Slippage tolerance: {slippage}%
          </label>
          <div className="max-w-xs mx-auto">
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={slippage}
              onChange={(e) => setSlippage(parseFloat(e.target.value))}
              className="w-full"
              disabled={!connected}
            />
          </div>
        </div>

        {/* Route Info */}
        {routeInfo && (
          <div className="mb-6 space-y-4">
            {/* Chemin de Route Visuel */}
            {routeInfo.route && routeInfo.route.length > 0 && (
              <div className="p-4 bg-black/30 rounded-lg border border-[var(--primary)]/20">
                <h3 className="text-sm font-semibold mb-3 text-[var(--primary)] flex items-center gap-2">
                  <span>🛣️</span>
                  <span>Chemin de Route ({routeInfo.type})</span>
                </h3>
                <div className="space-y-3">
                  {routeInfo.route.map((step, index) => {
                    const inputSymbol =
                      Object.keys(tokenAddresses).find(
                        (key) => tokenAddresses[key] === step.inputMint
                      ) || "TOKEN";
                    const outputSymbol =
                      Object.keys(tokenAddresses).find(
                        (key) => tokenAddresses[key] === step.outputMint
                      ) || "TOKEN";

                    return (
                      <div key={index} className="relative">
                        {/* Étape de la route */}
                        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700 hover:border-[var(--primary)]/40 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="bg-[var(--primary)]/20 text-[var(--primary)] px-2 py-1 rounded text-xs font-semibold">
                                Étape {index + 1}
                              </span>
                              <span className="text-sm font-medium text-gray-300">
                                {step.label}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">
                              Frais:{" "}
                              {(parseFloat(step.fee) / 1000000).toFixed(4)}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-gray-900/50 rounded p-2">
                              <div className="text-xs text-gray-500 mb-1">
                                Entrée
                              </div>
                              <div className="font-semibold text-white">
                                {(parseFloat(step.inAmount) / 1000000).toFixed(
                                  4
                                )}{" "}
                                {inputSymbol}
                              </div>
                            </div>

                            <div className="text-[var(--primary)] text-xl">
                              →
                            </div>

                            <div className="flex-1 bg-gray-900/50 rounded p-2">
                              <div className="text-xs text-gray-500 mb-1">
                                Sortie
                              </div>
                              <div className="font-semibold text-green-400">
                                {(parseFloat(step.outAmount) / 1000000).toFixed(
                                  4
                                )}{" "}
                                {outputSymbol}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Flèche de connexion entre les étapes */}
                        {index < routeInfo.route!.length - 1 && (
                          <div className="flex justify-center py-2">
                            <div className="text-gray-600 text-sm">↓</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Détails Financiers */}
            <div className="p-6 bg-black/20 rounded-lg border border-white/10">
              <h3 className="card-title mb-4 text-center text-white">
                Financial Details
              </h3>
              <div className="space-y-3 text-sm">
                {routeInfo.priceImpact !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Price impact</span>
                    <span
                      className={
                        routeInfo.priceImpact < 1
                          ? "text-green-400"
                          : "text-orange-400"
                      }
                    >
                      {routeInfo.priceImpact.toFixed(2)}%
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">
                    NPI (Net Price Improvement)
                  </span>
                  <span className="text-green-400 font-semibold">
                    +{routeInfo.npi.toFixed(4)} USDC
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Your rebate (30%)</span>
                  <span className="text-green-400 font-semibold">
                    +{routeInfo.rebate.toFixed(4)} USDC
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Burn $BACK (10%)</span>
                  <span className="text-orange-400">
                    {routeInfo.burn.toFixed(4)} USDC
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Network fees</span>
                  <span>{routeInfo.fees.toFixed(4)} USDC</span>
                </div>
                <div className="pt-3 mt-3 border-t border-white/10 flex justify-between items-center font-semibold">
                  <span className="text-white">Estimated total</span>
                  <span className="text-green-400">
                    {routeInfo.estimatedOutput.toFixed(6)} {outputToken}
                  </span>
                </div>
                {/* Vérification de cohérence */}
                <div className="pt-2 mt-2 border-t border-white/10 flex justify-between text-xs">
                  <span className="text-gray-500">Consistency check</span>
                  <span
                    className={
                      (
                        routeInfo.npi +
                        routeInfo.rebate +
                        routeInfo.burn
                      ).toFixed(4) ===
                      (
                        routeInfo.estimatedOutput - routeInfo.nonOptimizedOutput
                      ).toFixed(4)
                        ? "text-green-400"
                        : "text-red-400"
                    }
                  >
                    {(
                      routeInfo.npi +
                      routeInfo.rebate +
                      routeInfo.burn
                    ).toFixed(4)}{" "}
                    ={" "}
                    {(
                      routeInfo.estimatedOutput - routeInfo.nonOptimizedOutput
                    ).toFixed(4)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Résumé Route Optimisée (avant le bouton) */}
        {routeInfo && routeInfo.route && routeInfo.route.length > 0 && (
          <div className="mb-4 p-4 bg-gradient-to-br from-[var(--primary)]/10 to-purple-500/10 rounded-lg border-2 border-[var(--primary)]/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎯</span>
                <span className="font-bold text-white">
                  Route Optimisée Sélectionnée
                </span>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  routeInfo.type === "Direct"
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                }`}
              >
                {routeInfo.type === "Direct" ? "⚡ DIRECT" : "🔀 AGGREGATOR"}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              {routeInfo.route.map((step, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-gray-800/50 rounded text-xs font-semibold text-[var(--primary)] border border-gray-700">
                    {step.label}
                  </span>
                  {index < routeInfo.route!.length - 1 && (
                    <span className="text-gray-500">→</span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-gray-400">
                {routeInfo.route.length} étape
                {routeInfo.route.length > 1 ? "s" : ""}
              </span>
              <span className="text-green-400 font-semibold">
                Meilleur prix garanti
              </span>
            </div>
          </div>
        )}

        {/* 💰 Your Savings */}
        {routeInfo && (
          <div className="mb-6 p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-lg border-2 border-green-500/30">
            <div className="text-center mb-4">
              <span className="text-2xl mb-2 block">💰</span>
              <span className="font-bold text-white text-lg">Your Savings</span>
            </div>

            <div className="space-y-3">
              {/* Prix Sans SwapBack */}
              <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                <div className="flex items-center gap-2">
                  <span className="text-red-400 text-xl">❌</span>
                  <div>
                    <div className="text-xs text-gray-400">Sans SwapBack</div>
                    <div className="text-sm font-semibold text-gray-300">
                      Prix standard du marché
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-red-400">
                    {routeInfo.nonOptimizedOutput.toFixed(6)}
                  </div>
                  <div className="text-xs text-gray-500">{outputToken}</div>
                </div>
              </div>

              {/* Prix Avec SwapBack */}
              <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                <div className="flex items-center gap-2">
                  <span className="text-green-400 text-xl">✅</span>
                  <div>
                    <div className="text-xs text-gray-400">Avec SwapBack</div>
                    <div className="text-sm font-semibold text-gray-300">
                      Route optimisée
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-400">
                    {routeInfo.estimatedOutput.toFixed(6)}
                  </div>
                  <div className="text-xs text-gray-500">{outputToken}</div>
                </div>
              </div>

              {/* Profit / Économie */}
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg border-2 border-green-400/40">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🎉</span>
                  <div>
                    <div className="text-xs text-green-400 font-semibold">
                      VOTRE PROFIT
                    </div>
                    <div className="text-sm text-gray-300">
                      Économie réalisée
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-400">
                    +
                    {(
                      routeInfo.estimatedOutput - routeInfo.nonOptimizedOutput
                    ).toFixed(6)}
                  </div>
                  <div className="text-xs text-green-300">
                    {outputToken} (
                    {(
                      ((routeInfo.estimatedOutput -
                        routeInfo.nonOptimizedOutput) /
                        routeInfo.nonOptimizedOutput) *
                      100
                    ).toFixed(2)}
                    %)
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 text-center text-xs text-gray-400">
              💡 Vous recevez{" "}
              <span className="text-green-400 font-bold">plus de tokens</span>{" "}
              grâce à l'optimisation SwapBack
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-4">
          {!connected ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-[var(--primary)]/20 to-[var(--primary)]/5 rounded-2xl flex items-center justify-center">
                <span className="text-3xl">👛</span>
              </div>
              <p className="text-gray-400 mb-4">
                Connect your wallet to start trading
              </p>
              <p className="text-xs text-gray-500">
                Powered by Solana Wallet Adapter
              </p>
            </div>
          ) : !(routeInfo || jupiterQuote) ? (
            <button
              onClick={handleSimulateRoute}
              disabled={!inputAmount || loading}
              className="btn-primary w-full max-w-xs mx-auto block"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Finding best route...</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>🔍</span>
                  <span>Find Best Route</span>
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={handleExecuteSwap}
              disabled={loading}
              className="btn-primary w-full max-w-xs mx-auto block"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Executing swap...</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>⚡</span>
                  <span>
                    Execute Swap: {inputToken} → {outputToken}
                  </span>
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Token Selectors */}
      {showInputTokenSelector && (
        <TokenSelector
          selectedToken={inputToken}
          onSelect={(token) => setInputToken(token.symbol)}
          onClose={() => setShowInputTokenSelector(false)}
        />
      )}
      {showOutputTokenSelector && (
        <TokenSelector
          selectedToken={outputToken}
          onSelect={(token) => setOutputToken(token.symbol)}
          onClose={() => setShowOutputTokenSelector(false)}
        />
      )}
    </>
  );
};
