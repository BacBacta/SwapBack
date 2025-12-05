"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { ArrowDownUp, Settings, TrendingUp, Zap, Info, ChevronDown } from "lucide-react";
import { useTokenData } from "../hooks/useTokenData";
import { TokenSelector } from "./TokenSelector";
import { depositToBuybackVault, BuybackDepositResult } from "../lib/buybackIntegration";
import {
  trackSwap,
  trackRouteRequest,
  trackRouteResult,
  trackRouterSelection,
  trackPageView,
  trackWalletConnect,
  trackWalletDisconnect,
  trackError,
  trackRouterComparisonViewed,
  trackRouterComparisonAction,
} from "../lib/analytics";
import { getExplorerTxUrl } from "../utils/explorer";
import toast from "react-hot-toast";

interface RouteStep {
  label: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  fee: string;
}

type JupiterSwapInfo = {
  label?: string;
  inputMint?: string;
  outputMint?: string;
  inAmount?: string;
  outAmount?: string;
  fee?: string;
  feeAmount?: string;
};

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

type RouteComparisonSummary = {
  swapbackOutput: number;
  jupiterOutput: number;
  difference: number;
  percentDifference?: number;
  recommendedRouter: "swapback" | "jupiter";
  hasEconomics: boolean;
};

const inferRouterFromRouteName = (name: string): "swapback" | "jupiter" | "other" => {
  const normalized = name.toLowerCase();
  if (normalized.includes("swapback")) {
    return "swapback";
  }
  if (normalized.includes("jupiter")) {
    return "jupiter";
  }
  return "other";
};

const CLASSIC_COMPARISON_SOURCE = "classic-route-card";

export const SwapInterface = () => {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const wallet = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const lastWalletRef = useRef<string | null>(null);

  useEffect(() => {
    trackPageView(
      "classic-swap",
      typeof document !== "undefined" ? document.referrer || undefined : undefined
    );
  }, []);

  useEffect(() => {
    const previous = lastWalletRef.current;
    if (walletAddress && walletAddress !== previous) {
      trackWalletConnect(walletAddress);
    }
    if (!walletAddress && previous) {
      trackWalletDisconnect();
    }
    lastWalletRef.current = walletAddress;
  }, [walletAddress]);

  const [inputAmount, setInputAmount] = useState("");
  const [outputAmount, setOutputAmount] = useState("");
  const [inputToken, setInputToken] = useState("USDC");
  const [outputToken, setOutputToken] = useState("SOL");
  const [slippage, setSlippage] = useState(0.5);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [selectedRouter, setSelectedRouter] = useState<"swapback" | "jupiter">("swapback");
  const [showInputTokenSelector, setShowInputTokenSelector] = useState(false);
  const [showOutputTokenSelector, setShowOutputTokenSelector] = useState(false);
  const [showRouteDetails, setShowRouteDetails] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [priceChange24h, setPriceChange24h] = useState<number>(0);
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [showRouteComparison, setShowRouteComparison] = useState(false);
  const [showPriceImpactModal, setShowPriceImpactModal] = useState(false);
  const [buybackDeposit, setBuybackDeposit] = useState<BuybackDepositResult | null>(null);

  const routeComparisonSummary = useMemo<RouteComparisonSummary | null>(() => {
    if (!routeOptions.length) {
      return null;
    }

    const swapbackRoute = routeOptions.find(
      (option) => inferRouterFromRouteName(option.name) === "swapback"
    );
    const jupiterRoute = routeOptions.find(
      (option) => inferRouterFromRouteName(option.name) === "jupiter"
    );

    if (!swapbackRoute && !jupiterRoute) {
      return null;
    }

    const swapbackOutput = swapbackRoute?.output ?? 0;
    const jupiterOutput = jupiterRoute?.output ?? 0;
    const difference = swapbackOutput - jupiterOutput;
    const percentDifference = jupiterOutput !== 0 ? (difference / jupiterOutput) * 100 : undefined;
    const recommendedRouter =
      swapbackRoute && jupiterRoute
        ? swapbackRoute.output >= jupiterRoute.output
          ? "swapback"
          : "jupiter"
        : swapbackRoute
        ? "swapback"
        : "jupiter";
    const hasEconomics = Boolean(swapbackRoute?.rebate && swapbackRoute.rebate > 0);

    return {
      swapbackOutput,
      jupiterOutput,
      difference,
      percentDifference,
      recommendedRouter,
      hasEconomics,
    };
  }, [routeOptions]);

  // Token addresses mapping - stable reference
  const tokenAddresses = useMemo(() => ({
    SOL: "So11111111111111111111111111111111111111112",
    BACK: process.env.NEXT_PUBLIC_BACK_MINT || "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux",
    USDC: process.env.NEXT_PUBLIC_USDC_MINT || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    JTO: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
    mSOL: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
  }), []);

  // Helper function to get token mint address - memoized
  const getTokenMint = useCallback((token: string): string => {
    // Si c'est déjà une adresse valide Solana (32-44 chars base58)
    if (token.length >= 32 && token.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(token)) {
      return token;
    }
    // Sinon chercher dans notre mapping
    return tokenAddresses[token as keyof typeof tokenAddresses] || token;
  }, [tokenAddresses]);

  // Memoize mint addresses to avoid hook re-triggers
  const inputMintAddress = useMemo(() => {
    const mint = getTokenMint(inputToken);
    console.log(`🎯 [SwapInterface] inputToken="${inputToken}" -> inputMintAddress="${mint}"`);
    return mint;
  }, [getTokenMint, inputToken]);
  
  const outputMintAddress = useMemo(() => {
    const mint = getTokenMint(outputToken);
    console.log(`🎯 [SwapInterface] outputToken="${outputToken}" -> outputMintAddress="${mint}"`);
    return mint;
  }, [getTokenMint, outputToken]);

  const inputTokenData = useTokenData(inputMintAddress);
  const outputTokenData = useTokenData(outputMintAddress);

  const getTokenDecimals = (symbol: string): number => {
    if (symbol === "SOL" || symbol === "mSOL") {
      return 9;
    }
    return 6;
  };

  const toBaseUnits = (amount: number, decimals: number): number => {
    if (!Number.isFinite(amount)) {
      return 0;
    }
    return Math.round(amount * Math.pow(10, decimals));
  };
  
  // Debug: log balance changes
  useEffect(() => {
    console.log(`💰 [SwapInterface] inputTokenData.balance = ${inputTokenData.balance}, loading = ${inputTokenData.loading}`);
  }, [inputTokenData.balance, inputTokenData.loading]);

  // Fetch real quote from Jupiter API
  const fetchRealQuote = useCallback(async () => {
    const amountValue = parseFloat(inputAmount);
    if (!inputAmount || inputAmount === "" || !Number.isFinite(amountValue) || amountValue <= 0) {
      setOutputAmount("");
      setRouteInfo(null);
      setRouteOptions([]);
      return;
    }

    const fetchSource = "classic-auto";
    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();

    trackRouteRequest({
      inputToken,
      outputToken,
      inputAmount: amountValue,
      walletConnected: Boolean(walletAddress),
      routerPreference: selectedRouter,
      mevProtection: false,
      priorityLevel: "medium",
      routingStrategy: "classic-ui",
      executionChannel: "public",
      source: fetchSource,
    });

    console.log("🚀 [REAL DATA] Fetching real quote from Jupiter API...");
    setLoading(true);
    try {
      // Get token mint addresses
      const inputMint = inputToken === "SOL" ? "So11111111111111111111111111111111111111112" :
                      inputToken === "USDC" ? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" :
                      inputToken === "USDT" ? "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" :
                      inputToken; // For custom tokens

      const outputMint = outputToken === "SOL" ? "So11111111111111111111111111111111111111112" :
                       outputToken === "USDC" ? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" :
                       outputToken === "USDT" ? "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" :
                       outputToken; // For custom tokens

      // Convert amount to lamports/smallest unit
      const amountInLamports = inputToken === "SOL" ? amountValue * 1e9 :
              inputToken === "USDC" || inputToken === "USDT" ? amountValue * 1e6 :
              amountValue; // Assume 1e6 for other tokens

      console.log("📊 Request params:", { inputToken, outputToken, inputAmount, amountInLamports });

      // Call our API endpoint (Fly.io in production)
      const { getApiUrl, API_ENDPOINTS } = await import('@/config/api');
      const response = await fetch(getApiUrl(API_ENDPOINTS.quote), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputMint,
          outputMint,
          amount: amountInLamports.toString(),
          slippageBps: 50, // 0.5%
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ API Error:", response.status, errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("✅ [REAL DATA] Received quote:", data);

      if (data.success && data.quote) {
        const quote = data.quote;
        const routePlan = Array.isArray(quote.routePlan) ? quote.routePlan : [];
        const normalizedRouteSteps: RouteStep[] = routePlan
          .map((step: { swapInfo?: JupiterSwapInfo }) => step?.swapInfo)
          .filter((swapInfo): swapInfo is JupiterSwapInfo => Boolean(swapInfo))
          .map((swapInfo) => ({
            label: swapInfo.label ?? "Venue",
            inputMint: swapInfo.inputMint ?? "",
            outputMint: swapInfo.outputMint ?? "",
            inAmount: swapInfo.inAmount ?? "0",
            outAmount: swapInfo.outAmount ?? "0",
            fee: swapInfo.fee ?? swapInfo.feeAmount ?? "0",
          }));
        const routeVenues = normalizedRouteSteps.map((step) => step.label);
        const priceImpactRaw = typeof quote.priceImpactPct === "string"
          ? parseFloat(quote.priceImpactPct)
          : quote.priceImpactPct ?? 0;

        // Set output amount
        const outputAmountValue = parseFloat(quote.outAmount) /
          (outputToken === "SOL" ? 1e9 : outputToken === "USDC" || outputToken === "USDT" ? 1e6 : 1e6);
        
        console.log(`💰 [REAL DATA] Output: ${outputAmountValue} ${outputToken} (from ${inputAmount} ${inputToken})`);
        setOutputAmount(outputAmountValue.toFixed(6));

        // Set route info
        setRouteInfo({
          type: "Aggregator",
          estimatedOutput: outputAmountValue,
          nonOptimizedOutput: outputAmountValue * 0.98, // Estimate
          npi: outputAmountValue * 0.002, // 0.2% NPI
          rebate: outputAmountValue * 0.0015, // 0.15% rebate
          burn: outputAmountValue * 0.0005, // 0.05% burn
          fees: outputAmountValue * 0.001, // 0.1% fees
          priceImpact: priceImpactRaw * 100,
          route: normalizedRouteSteps,
        });

        // Generate route options based on real quote
        const baseOutput = outputAmountValue;
        const routes: RouteOption[] = [
          {
            name: "SwapBack Optimized",
            output: baseOutput * 1.002, // Slight advantage
            rebate: baseOutput * 0.0015,
            gas: 0.000012,
            timeEstimate: "~5s",
            badge: "Best Price"
          },
          {
            name: "Jupiter Direct",
            output: baseOutput,
            rebate: 0,
            gas: 0.000008,
            timeEstimate: "~3s",
            badge: "Fastest"
          },
          {
            name: "Multi-hop Route",
            output: baseOutput * 0.995,
            rebate: 0,
            gas: 0.000015,
            timeEstimate: "~7s",
            badge: "Lowest Gas"
          }
        ];
        setRouteOptions(routes);

        // Calculate exchange rate
        const rate = parseFloat(inputAmount) > 0 ? outputAmountValue / parseFloat(inputAmount) : 0;
        setExchangeRate(rate);

        // Simulate 24h price change (this could be fetched from real data)
        const change24h = (Math.random() - 0.5) * 10;
        setPriceChange24h(change24h);

        const finishedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
        trackRouteResult({
          inputToken,
          outputToken,
          inputAmount: amountValue,
          routerUsed: selectedRouter,
          bestVenue: routeVenues[0] ?? null,
          priceImpactPct: priceImpactRaw,
          nativeProvider: data.nativeRoute?.provider ?? null,
          nativeShareTokens: data.nativeRoute?.npiShareTokens ?? null,
          usedFallback: data.usedMultiSourceFallback ?? false,
          routePlanLength: routePlan.length,
          quoteSources: Array.isArray(data.multiSourceQuotes) ? data.multiSourceQuotes.length : undefined,
          mevRisk: priceImpactRaw > 3 ? "high" : priceImpactRaw > 1 ? "medium" : "low",
          routeVenues,
          source: fetchSource,
          latencyMs: finishedAt - startedAt,
          success: true,
        });

      } else {
        console.error("❌ Invalid response structure:", data);
        throw new Error(data.error || 'Failed to get quote');
      }
    } catch (error) {
      console.error("❌ Error fetching real quote:", error);
      const finishedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      trackRouteResult({
        inputToken,
        outputToken,
        inputAmount: amountValue,
        routerUsed: selectedRouter,
        source: fetchSource,
        latencyMs: finishedAt - startedAt,
        success: false,
        errorMessage: normalizedError.message,
      });
      trackError(normalizedError, {
        stage: "classic-route-fetch",
        source: fetchSource,
        inputToken,
        outputToken,
      });
      // Show error to user
      toast.error(`Impossible d'obtenir un prix réel: ${normalizedError.message}`);
      // Fallback to mock data if API fails
      console.log("🔄 Falling back to mock data due to API error");
      
      // Mock fallback (minimal)
      const baseOutput = parseFloat(inputAmount) * 0.005;
      setOutputAmount(baseOutput.toFixed(6));
      setRouteInfo({
        type: "Aggregator",
        estimatedOutput: baseOutput,
        nonOptimizedOutput: baseOutput * 0.98,
        npi: baseOutput * 0.002,
        rebate: baseOutput * 0.0015,
        burn: baseOutput * 0.0005,
        fees: baseOutput * 0.001,
        priceImpact: 0.12,
      });
    } finally {
      setLoading(false);
    }
  }, [inputAmount, inputToken, outputToken, selectedRouter, walletAddress]);


  // Simulate price calculation with debounce
  useEffect(() => {
    if (!inputAmount || inputAmount === "" || parseFloat(inputAmount) <= 0) {
      setOutputAmount("");
      setRouteInfo(null);
      return;
    }

    const timer = setTimeout(() => {
      fetchRealQuote();
    }, 500);

    return () => clearTimeout(timer);
  }, [inputAmount, fetchRealQuote]);

  const handleSwapTokens = () => {
    const tempToken = inputToken;
    const tempAmount = inputAmount;
    
    setInputToken(outputToken);
    setOutputToken(tempToken);
    setInputAmount(outputAmount);
    setOutputAmount(tempAmount);
  };

  const handleRouterSelection = (
    router: "swapback" | "jupiter",
    source: string
  ) => {
    if (router === selectedRouter) {
      return;
    }

    trackRouterSelection({
      router,
      previousRouter: selectedRouter,
      source,
      priceImpactPct: routeInfo?.priceImpact,
      nativeProvider: routeInfo?.route?.[0]?.label ?? null,
      economicsAvailable: Boolean((routeInfo?.rebate ?? 0) > 0 || (routeInfo?.npi ?? 0) > 0),
    });

    setSelectedRouter(router);
  };

  const handleToggleRouteComparison = () => {
    if (!showRouteComparison && routeComparisonSummary) {
      trackRouterComparisonViewed({
        currentRouter: selectedRouter,
        recommendedRouter: routeComparisonSummary.recommendedRouter,
        inputToken,
        outputToken,
        inputAmount: parseFloat(inputAmount) || 0,
        swapbackOutput: routeComparisonSummary.swapbackOutput,
        jupiterOutput: routeComparisonSummary.jupiterOutput,
        difference: routeComparisonSummary.difference,
        percentDifference: routeComparisonSummary.percentDifference,
        hasEconomics: routeComparisonSummary.hasEconomics,
        priceImpact: routeInfo?.priceImpact,
        source: CLASSIC_COMPARISON_SOURCE,
      });
    }

    setShowRouteComparison((prev) => !prev);
  };

  const handleRouteOptionClick = (route: RouteOption) => {
    if (!routeComparisonSummary) {
      return;
    }

    const routeRouter = inferRouterFromRouteName(route.name);

    trackRouterComparisonAction({
      currentRouter: selectedRouter,
      recommendedRouter: routeComparisonSummary.recommendedRouter,
      selectedRouter: routeRouter === "other" ? selectedRouter : routeRouter,
      actionSource: "card",
      inputToken,
      outputToken,
      inputAmount: parseFloat(inputAmount) || 0,
      swapbackOutput: routeComparisonSummary.swapbackOutput,
      jupiterOutput: routeComparisonSummary.jupiterOutput,
      difference: routeComparisonSummary.difference,
      percentDifference: routeComparisonSummary.percentDifference,
      hasEconomics: routeComparisonSummary.hasEconomics,
      priceImpact: routeInfo?.priceImpact,
      source: CLASSIC_COMPARISON_SOURCE,
    });
  };

  const setMaxBalance = () => {
    if (inputTokenData.balance > 0) {
      setInputAmount(inputTokenData.balance.toString());
    }
  };

  const setHalfBalance = () => {
    if (inputTokenData.balance > 0) {
      setInputAmount((inputTokenData.balance / 2).toString());
    }
  };

  const handleExecuteSwap = async () => {
    if (!connected || !publicKey) return;
    
    // Check price impact and show warning modal if > 3%
    if (routeInfo && routeInfo.priceImpact && routeInfo.priceImpact > 3) {
      setShowPriceImpactModal(true);
      return;
    }
    
    await executeSwap();
  };

  const executeSwap = async () => {
    setLoading(true);
    setBuybackDeposit(null); // Reset previous result

    const inputDecimals = getTokenDecimals(inputToken);
    const outputDecimals = getTokenDecimals(outputToken);
    const parsedInputAmount = parseFloat(inputAmount) || 0;
    const parsedOutputAmount = parseFloat(outputAmount) || 0;
    const inputAmountBase = toBaseUnits(parsedInputAmount, inputDecimals);
    const outputAmountBase = toBaseUnits(parsedOutputAmount, outputDecimals);
    const swapFee = Math.round(inputAmountBase * 0.003);
    const slippageBps = Math.max(1, Math.round(slippage * 100));
    const routeVenues = routeInfo?.route?.map((step) => step.label) ?? [];
    const priceImpactBps =
      routeInfo?.priceImpact !== undefined ? Math.round(routeInfo.priceImpact * 100) : undefined;

    const emitSwapAnalytics = (success: boolean, opts?: { errorMessage?: string; buyback?: number }) => {
      trackSwap({
        inputToken,
        outputToken,
        inputAmount: inputAmountBase,
        outputAmount: outputAmountBase,
        fee: swapFee,
        route: selectedRouter,
        buybackDeposit: opts?.buyback ?? buybackDeposit?.amount ?? 0,
        walletAddress,
        router: selectedRouter,
        swapMethod: "legacy",
        priceImpactBps,
        mevProtection: false,
        savingsUsd:
          routeInfo && outputTokenData.usdPrice
            ? routeInfo.rebate * outputTokenData.usdPrice
            : undefined,
        routeVenues,
        inputDecimals,
        outputDecimals,
        slippageBps,
        executionChannel: "public",
        priorityLevel: "medium",
        success,
        errorMessage: opts?.errorMessage,
      });
    };

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Try to deposit 25% of fees to buyback vault (non-blocking)
      if (connection && wallet && swapFee > 0) {
        try {
          const depositResult = await depositToBuybackVault(connection, wallet, swapFee);
          setBuybackDeposit(depositResult);

          if (!depositResult.skipped) {
            toast.success(
              `🔥 Buyback: ${(depositResult.amount / 1e6).toFixed(2)} USDC deposited!`,
              { duration: 5000 }
            );
          }

          emitSwapAnalytics(true, { buyback: depositResult.amount });
        } catch (error) {
          console.warn("Buyback deposit error (non-blocking):", error);
          const fallbackAmount = Math.floor(swapFee * 0.25);
          setBuybackDeposit({
            skipped: true,
            amount: fallbackAmount,
            reason: "Failed to execute deposit",
          });
          emitSwapAnalytics(true, { buyback: fallbackAmount });
        }
      } else {
        emitSwapAnalytics(true);
      }

      toast.success(
        `✅ Swap successful!\n${inputAmount} ${inputToken} → ${outputAmount} ${outputToken}`,
        { duration: 4000 }
      );

      setInputAmount("");
      setOutputAmount("");
      setRouteInfo(null);
      setShowPriceImpactModal(false);
    } catch (error) {
      console.error("Error:", error);
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      toast.error("❌ Swap failed");
      emitSwapAnalytics(false, { errorMessage: normalizedError.message });
      trackError(normalizedError, {
        stage: "classic-swap-execution",
        router: selectedRouter,
        routeVenues,
      });
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
          <div className="flex gap-2 p-1.5 bg-black/60 backdrop-blur-sm border-2 border-[var(--primary)]/20 rounded">
            <button
              onClick={() => handleRouterSelection("swapback", "classic-toggle")}
              className={`flex-1 py-3 px-4 font-bold terminal-text uppercase tracking-wider transition-all border-2 rounded ${
                selectedRouter === "swapback"
                  ? "bg-[var(--primary)] border-[var(--primary)] text-black hover:bg-[var(--primary-hover)]"
                  : "bg-transparent border-transparent text-[var(--primary)] hover:bg-[var(--primary)]/10 hover:border-[var(--primary)]/30"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Zap className="w-4 h-4" />
                <span>SwapBack</span>
              </div>
            </button>
            <button
              onClick={() => handleRouterSelection("jupiter", "classic-toggle")}
              className={`flex-1 py-3 px-4 font-bold terminal-text uppercase tracking-wider transition-all border-2 rounded ${
                selectedRouter === "jupiter"
                  ? "bg-[var(--secondary)] border-[var(--secondary)] text-black hover:opacity-90"
                  : "bg-transparent border-transparent text-[var(--secondary)] hover:bg-[var(--secondary)]/10 hover:border-[var(--secondary)]/30"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span>Jupiter</span>
              </div>
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-6 p-6 bg-black/60 backdrop-blur-sm border-2 border-[var(--primary)]/30 animate-fade-in">
            <h3 className="text-lg font-bold terminal-text mb-4 uppercase tracking-wider">
              ⚙️ Settings
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
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold terminal-text uppercase tracking-wider text-[var(--primary)]/70">
                    Balance: {inputTokenData.loading ? "..." : inputTokenData.balance.toFixed(6)}
                  </span>
                  <button
                    onClick={setHalfBalance}
                    className="px-2 py-1 text-xs font-bold terminal-text uppercase tracking-wider bg-[var(--primary)]/10 border border-[var(--primary)]/50 hover:bg-[var(--primary)]/20 transition-colors"
                  >
                    HALF
                  </button>
                  <button
                    onClick={setMaxBalance}
                    className="px-2 py-1 text-xs font-bold terminal-text uppercase tracking-wider bg-[var(--primary)]/10 border border-[var(--primary)]/50 hover:bg-[var(--primary)]/20 transition-colors"
                  >
                    MAX
                  </button>
                </div>
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
                onClick={handleToggleRouteComparison}
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
                      onClick={() => handleRouteOptionClick(route)}
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

          {/* Buyback Deposit Result */}
          {buybackDeposit && !buybackDeposit.skipped && (
            <div className="mt-4 p-4 bg-green-500/10 border-2 border-green-500/50 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <div className="text-2xl">🔥</div>
                <div className="flex-1">
                  <p className="font-bold terminal-text uppercase tracking-wider text-green-400 mb-1">
                    Buyback Contribution
                  </p>
                  <p className="text-sm text-[var(--primary)]">
                    {(buybackDeposit.amount / 1e6).toFixed(2)} USDC deposited for $BACK buyback
                  </p>
                  {buybackDeposit.signature && (
                    <a
                      href={getExplorerTxUrl(buybackDeposit.signature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--secondary)] hover:underline mt-1 inline-block"
                    >
                      View transaction ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {buybackDeposit && buybackDeposit.skipped && (
            <div className="mt-4 p-3 bg-black/40 border-2 border-[var(--primary)]/20 backdrop-blur-sm">
              <p className="text-xs text-[var(--primary)]/70">
                ℹ️ Buyback deposit skipped: {buybackDeposit.reason}
              </p>
            </div>
          )}
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
