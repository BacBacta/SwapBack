/**
 * Professional Swap Interface
 * Modern, clean design with complete functionality
 */

"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { BN } from "@coral-xyz/anchor";
import { AccountMeta, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useSwapStore } from "@/store/swapStore";
import { useSwapWebSocket } from "@/hooks/useSwapWebSocket";
import { useHaptic } from "@/hooks/useHaptic";
import { useSwapRouter, DerivedSwapAccounts, type SwapRequest } from "@/hooks/useSwapRouter";
import { ORCA_WHIRLPOOL_PROGRAM_ID } from "@/sdk/config/orca-pools";
import { RAYDIUM_AMM_PROGRAM_ID } from "@/sdk/config/raydium-pools";
import { getExplorerUrl } from "@/config/constants";
import { useInstrumentedFetchRoutes, runInstrumentedFetchRoutes } from "@/hooks/useInstrumentedFetchRoutes";
import dynamic from "next/dynamic";
import { ClockIcon, ExclamationTriangleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { motion, AnimatePresence } from "framer-motion";
import { useSwipeable } from "react-swipeable";
import { toast } from "sonner";
import {
  formatNumberWithCommas,
  parseFormattedNumber,
  validateNumberInput,
  formatCurrency,
  getAdaptiveFontSize,
} from "@/utils/formatNumber";
import { PriceImpactAlert } from "@/components/PriceImpactAlert";
import { TokenSelectorModal } from "@/components/TokenSelectorModal";
import { SmartSlippage } from "@/components/SmartSlippage";
import { SuccessModal } from "@/components/SuccessModal";
import { ErrorFeedback, detectErrorType, type ErrorType } from "@/components/ErrorFeedback";
import { RoutingStrategySelector } from "@/components/RoutingStrategySelector";
import { RouterReliabilityCard } from "@/components/RouterReliabilityCard";
import { RouteIntentsList } from "@/components/RouteIntentsList";
import type { RoutingStrategy } from "@/lib/routing/hybridRouting";
import { debounce } from "lodash";
import { ClientOnlyConnectionStatus } from "./ClientOnlyConnectionStatus";
import { buildNativeRouteInsights, formatTokenAmount as formatNativeTokenAmount, lamportsToTokens } from "@/lib/routing/nativeRouteInsights";
import { NativeRouteCard } from "@/components/NativeRouteCard";
import {
  trackRouteRequest,
  trackRouteResult,
  trackRouterSelection,
  trackSwapPreview,
  trackSwap,
  trackError,
  trackPageView,
  trackRouterComparisonViewed,
} from "@/lib/analytics";

const SwapPreviewModal = dynamic(() => import("./SwapPreviewModal").then((mod) => ({ default: mod.SwapPreviewModal })), {
  ssr: false,
});
const LoadingProgress = dynamic(() => import("./LoadingProgress").then((mod) => ({ default: mod.LoadingProgress })), {
  ssr: false,
});
const RecentSwapsSidebar = dynamic(() => import("./RecentSwapsSidebar").then((mod) => ({ default: mod.RecentSwapsSidebar })), {
  ssr: false,
});
const RouterComparisonModal = dynamic(() => import("./RouterComparisonModal").then((mod) => ({ default: mod.RouterComparisonModal })), {
  ssr: false,
});

type JupiterRoutePlanStep = {
  swapInfo?: {
    ammKey?: string;
    label?: string;
    inputMint?: string;
    outputMint?: string;
    inAmount?: string;
    outAmount?: string;
    feeAmount?: string;
    feeMint?: string;
  };
  [key: string]: unknown;
};

type OrcaDexAccounts = {
  variant: "ORCA_WHIRLPOOL";
  dexProgramId: string;
  whirlpool: string;
  tokenMintA: string;
  tokenMintB: string;
  tokenVaultA: string;
  tokenVaultB: string;
  tickArrays: string[];
  oracle: string;
  direction: "aToB" | "bToA";
  tickSpacing: number;
};

type RaydiumDexAccounts = {
  variant: "RAYDIUM_AMM";
  dexProgramId: string;
  direction: "aToB" | "bToA";
  tokenMintA: string;
  tokenMintB: string;
  ammId: string;
  ammAuthority: string;
  ammOpenOrders: string;
  ammTargetOrders: string;
  poolCoinTokenAccount: string;
  poolPcTokenAccount: string;
  poolWithdrawQueue?: string;
  poolTempLpTokenAccount?: string;
  serumProgramId: string;
  serumMarket: string;
  serumBids: string;
  serumAsks: string;
  serumEventQueue: string;
  serumCoinVault: string;
  serumPcVault: string;
  serumVaultSigner: string;
};

type RouterDexAccounts = OrcaDexAccounts | RaydiumDexAccounts;

type DexStepDescriptor = {
  index: number;
  ammKey: string;
  label: string;
  inputMint: string;
  outputMint: string;
  dexProgramId: string;
};

type DexAccountResolution = {
  descriptor: DexStepDescriptor;
  accounts: RouterDexAccounts;
};

const ORCA_PROGRAM_ID_STR = ORCA_WHIRLPOOL_PROGRAM_ID.toBase58();
const RAYDIUM_PROGRAM_ID_STR = RAYDIUM_AMM_PROGRAM_ID.toBase58();

type DexLabelMetadata = {
  keyword: string;
  friendlyName: string;
  supported: boolean;
  programId?: string;
};

const DEX_LABEL_METADATA: DexLabelMetadata[] = [
  {
    keyword: "orca",
    friendlyName: "Orca Whirlpool",
    supported: true,
    programId: ORCA_PROGRAM_ID_STR,
  },
  {
    keyword: "raydium",
    friendlyName: "Raydium",
    supported: true,
    programId: RAYDIUM_PROGRAM_ID_STR,
  },
  { keyword: "meteora", friendlyName: "Meteora DLMM", supported: false },
  { keyword: "phoenix", friendlyName: "Phoenix", supported: false },
  { keyword: "lifinity", friendlyName: "Lifinity", supported: false },
];

const matchDexLabel = (label: string): DexLabelMetadata | null => {
  const normalized = label.toLowerCase();
  return (
    DEX_LABEL_METADATA.find((metadata) => normalized.includes(metadata.keyword)) ??
    null
  );
};

const partitionPlanDexSteps = (
  plan: JupiterRoutePlanStep[]
): {
  supported: DexStepDescriptor[];
  unsupported: string[];
} => {
  const supported: DexStepDescriptor[] = [];
  const unsupported: string[] = [];

  plan.forEach((step, index) => {
    const swapInfo = step.swapInfo;
    if (!swapInfo?.ammKey || !swapInfo.inputMint || !swapInfo.outputMint) {
      return;
    }

    const label = swapInfo.label ?? `Venue ${index + 1}`;
    const metadata = matchDexLabel(label);

    if (!metadata) {
      return;
    }

    if (metadata.supported && metadata.programId) {
      supported.push({
        index,
        ammKey: swapInfo.ammKey,
        label,
        inputMint: swapInfo.inputMint,
        outputMint: swapInfo.outputMint,
        dexProgramId: metadata.programId,
      });
      return;
    }

    unsupported.push(metadata.friendlyName || label);
  });

  return { supported, unsupported };
};

const BPS_SCALE = 10_000;

function toLamports(amount: string, decimals: number) {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return new BN(0);
  }
  const scale = Math.pow(10, decimals);
  return new BN(Math.floor(parsed * scale).toString());
}

function decodeBase64ToUint8Array(data: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  const nodeBuffer = (globalThis as {
    Buffer?: { from(input: string, encoding: string): Uint8Array };
  }).Buffer;
  if (nodeBuffer) {
    return Uint8Array.from(nodeBuffer.from(data, "base64"));
  }

  throw new Error("Base64 decoding is not supported in this environment");
}

export function EnhancedSwapInterface() {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const { swapWithRouter, swapWithRouterVersioned, executeJupiterSwap } = useSwapRouter();
  const haptic = useHaptic();
  const walletAddress = publicKey?.toBase58() ?? null;

  // Store
  const {
    swap,
    routes,
    setInputAmount,
    setInputToken,
    setOutputToken,
    setSlippageTolerance,
    setUseMEVProtection,
    setExecutionChannel,
    switchTokens,
    fetchRoutes,
    clearRoutes,
    routingStrategy,
    setRoutingStrategy,
  } = useSwapStore();

  // WebSocket for real-time data
  useSwapWebSocket();

  // State
  const [selectedRouter, setSelectedRouter] = useState<"swapback" | "jupiter">(
    "swapback"
  );
  const [showSlippageModal, setShowSlippageModal] = useState(false);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [tokenSelectorType, setTokenSelectorType] = useState<
    "input" | "output"
  >("input");
  const [customSlippage, setCustomSlippage] = useState("");
  const [hasSearchedRoute, setHasSearchedRoute] = useState(false);
  const [priceImpact, setPriceImpact] = useState(0);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapSignature, setSwapSignature] = useState<string | null>(null);
  
  // New UX features state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [priceRefreshCountdown, setPriceRefreshCountdown] = useState(10);
  const [loadingStep, setLoadingStep] = useState<'fetching' | 'routing' | 'building' | 'signing' | 'confirming'>('fetching');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showRecentSwaps, setShowRecentSwaps] = useState(false);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [recentSwaps, setRecentSwaps] = useState<Array<{
    id: string;
    fromToken: string;
    toToken: string;
    fromAmount: string;
    toAmount: string;
    timestamp: number;
    status: 'success' | 'pending' | 'failed';
    txSignature?: string;
  }>>([]);
  const [suggestedSlippage, setSuggestedSlippage] = useState<number | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSwapData, setLastSwapData] = useState<{
    inputToken: { symbol: string; amount: string; logoURI?: string };
    outputToken: { symbol: string; amount: string; logoURI?: string };
    explorerUrl: string;
  } | null>(null);
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const instrumentedFetchRoutes = useInstrumentedFetchRoutes({
    swap,
    routingStrategy,
    selectedRouter,
    walletAddress,
    fetchRoutes,
  });

  useEffect(() => {
    trackPageView("enhanced-swap", typeof document !== "undefined" ? document.referrer || undefined : undefined);
  }, []);

  // 🔒 Ref to track if a fetch is in progress (prevents duplicate calls)
  const isFetchingRef = useRef(false);
  const lastFetchParamsRef = useRef<string>("");

  // ✅ Single debounced fetch function with duplicate prevention
  // Uses fresh state from store to avoid stale closures and infinite loops
  const debouncedFetchRoutes = useMemo(
    () =>
      debounce(async (source: string) => {
        // Get fresh state from store to avoid stale closure issues
        const currentState = useSwapStore.getState();
        const currentSwap = currentState.swap;
        
        // Create a unique key for current params
        const currentParams = `${currentSwap.inputToken?.mint}-${currentSwap.outputToken?.mint}-${currentSwap.inputAmount}-${selectedRouter}-${routingStrategy}`;
        
        // Skip if already fetching with same params
        if (isFetchingRef.current && currentParams === lastFetchParamsRef.current) {
          console.debug('[Debounce] Skipping duplicate fetch');
          return;
        }

        const amount = parseFloat(currentSwap.inputAmount);
        if (!currentSwap.inputToken || !currentSwap.outputToken || !Number.isFinite(amount) || amount <= 0) {
          return;
        }

        isFetchingRef.current = true;
        lastFetchParamsRef.current = currentParams;
        
        try {
          await runInstrumentedFetchRoutes(
            {
              swap: currentSwap,
              routingStrategy,
              selectedRouter,
              walletAddress,
              fetchRoutes,
            },
            source as "input-change" | "router-change" | "auto-refresh"
          );
          setHasSearchedRoute(true);
        } catch (err) {
          console.debug(`[${source}] Route fetch failed:`, err);
        } finally {
          isFetchingRef.current = false;
        }
      }, 800), // 800ms debounce
    [selectedRouter, routingStrategy, walletAddress, fetchRoutes, setHasSearchedRoute]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedFetchRoutes.cancel();
    };
  }, [debouncedFetchRoutes]);

  // ✅ Consolidated: Fetch routes when any relevant input changes
  // Use stable references (mint addresses) to avoid unnecessary re-fetches
  const inputTokenMint = swap.inputToken?.mint;
  const outputTokenMint = swap.outputToken?.mint;
  const currentInputAmount = swap.inputAmount;
  
  useEffect(() => {
    if (inputTokenMint && outputTokenMint && parseFloat(currentInputAmount) > 0) {
      debouncedFetchRoutes("input-change");
    } else {
      // Clear routes if inputs are invalid
      clearRoutes();
      setHasSearchedRoute(false);
    }
  }, [inputTokenMint, outputTokenMint, currentInputAmount, selectedRouter, routingStrategy, debouncedFetchRoutes, clearRoutes, setHasSearchedRoute]);

  // Calculate price impact and suggest slippage
  useEffect(() => {
    if (routes.selectedRoute) {
      // RouteCandidate n'a pas priceImpact, on utilise 0.5% par défaut
      const impact = 0.5;
      setPriceImpact(impact);
      
      // Smart slippage suggestions based on price impact
      if (impact < 0.1) {
        setSuggestedSlippage(0.1);
      } else if (impact < 1) {
        setSuggestedSlippage(0.5);
      } else if (impact < 5) {
        setSuggestedSlippage(1.0);
      } else {
        setSuggestedSlippage(2.0);
      }
    }
  }, [routes.selectedRoute]);
  
  // Real-time price refresh countdown (30s interval to avoid rate limits)
  useEffect(() => {
    if (!hasSearchedRoute || routes.isLoading) return;
    
    const REFRESH_INTERVAL = 30; // 30 seconds to avoid rate limiting
    
    const interval = setInterval(() => {
      setPriceRefreshCountdown((prev) => {
        if (prev <= 1) {
          // Auto-refresh route using debounced function
          if (swap.inputToken && swap.outputToken && parseFloat(swap.inputAmount) > 0 && !isFetchingRef.current) {
            debouncedFetchRoutes("auto-refresh");
          }
          return REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [hasSearchedRoute, routes.isLoading, swap.inputToken, swap.outputToken, swap.inputAmount, debouncedFetchRoutes]);

  // Handlers
  const handleInputChange = (value: string) => {
    // Remove commas for validation
    const cleanValue = parseFormattedNumber(value);
    
    // Validate input
    const validation = validateNumberInput(
      cleanValue, 
      swap.inputToken?.decimals || 9
    );
    
    if (validation.valid) {
      setInputAmount(validation.value);
    }
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

  const handleAmountPreset = (percentage: number) => {
    haptic.light();
    if (swap.inputToken?.balance) {
      const amount = (swap.inputToken.balance * percentage / 100).toFixed(swap.inputToken.decimals > 6 ? 6 : swap.inputToken.decimals);
      setInputAmount(amount);
    }
  };

  const handleReduceAmount = (percentage: number = 10) => {
    haptic.light();
    const currentAmount = parseFloat(swap.inputAmount);
    if (currentAmount > 0) {
      const reduced = currentAmount * (1 - percentage / 100);
      setInputAmount(reduced.toFixed(swap.inputToken?.decimals || 6));
    }
  };

  const handleRoutingStrategyChange = (strategy: RoutingStrategy) => {
    setRoutingStrategy(strategy);
    if (swap.inputToken && swap.outputToken && parseFloat(swap.inputAmount) > 0) {
      instrumentedFetchRoutes("strategy-change").catch((err) =>
        console.debug("[Routing strategy] fetch failed", err)
      );
    }
  };

  const handleExecutionChannelChange = (
    channel: "public" | "jito" | "private-rpc"
  ) => {
    setExecutionChannel(channel);
    setUseMEVProtection(channel !== "public");
  };

  const toggleMEVProtection = () => {
    const next = !swap.useMEVProtection;
    setUseMEVProtection(next);
    setExecutionChannel(next ? "jito" : "public");
  };

  const getBalancePercentage = () => {
    if (!swap.inputToken?.balance || !swap.inputAmount) return 0;
    return Math.min((parseFloat(swap.inputAmount) / swap.inputToken.balance) * 100, 100);
  };

  const routerConfidenceScore = selectedRouter === "swapback" ? 98 : 95;
  const isMinimalLayout = false; // Show full details including routes and NPI

  const inputAmount = parseFloat(swap.inputAmount) || 0;
  const outputAmount = parseFloat(swap.outputAmount) || 0;

  const hasQuoteContext =
    hasSearchedRoute &&
    !!swap.inputToken &&
    !!swap.outputToken &&
    inputAmount > 0;

  type DealQualityDescriptor = {
    label: string;
    badge: string;
    description: string;
    gradient: string;
    border: string;
    highlight: string;
    highlightSuffix: string;
    icon: string;
  };

  const dealQuality: DealQualityDescriptor = (() => {
    if (!hasQuoteContext) {
      return {
        label: "Préparez votre swap",
        badge: "Inactif",
        description: "Choisissez vos tokens et lancez une recherche pour obtenir un devis en temps réel.",
        gradient: "from-white/5 via-white/0 to-white/5",
        border: "border-white/10",
        highlight: "--",
        highlightSuffix: "",
        icon: "⌛",
      };
    }

    if (routes.isLoading) {
      return {
        label: "Recherche de route en cours",
        badge: "Calcul",
        description: "Nos routeurs comparent les DEXs compatibles pour sécuriser le meilleur prix.",
        gradient: "from-blue-500/10 via-cyan-500/5 to-emerald-500/10",
        border: "border-blue-500/30",
        highlight: "…",
        highlightSuffix: "",
        icon: "🔍",
      };
    }

    if (priceImpact < 0.5) {
      return {
        label: "Taux excellent",
        badge: "Great",
        description: "Impact quasi nul, route optimale détectée.",
        gradient: "from-emerald-500/20 via-emerald-500/5 to-cyan-500/10",
        border: "border-emerald-500/40",
        highlight: `${priceImpact.toFixed(2)}%`,
        highlightSuffix: "impact",
        icon: "✅",
      };
    }

    if (priceImpact < 1.5) {
      return {
        label: "Taux solide",
        badge: "Fair",
        description: "Route équilibrée. Vous pouvez encore optimiser en ajustant le montant.",
        gradient: "from-emerald-400/15 via-blue-500/10 to-purple-500/10",
        border: "border-emerald-400/40",
        highlight: `${priceImpact.toFixed(2)}%`,
        highlightSuffix: "impact",
        icon: "🟢",
      };
    }

    if (priceImpact < 3) {
      return {
        label: "Surveillez la route",
        badge: "Watch",
        description: "L'impact grimpe. Pensez à réduire le montant ou à augmenter la tolérance.",
        gradient: "from-amber-400/20 via-orange-500/10 to-red-500/10",
        border: "border-amber-400/40",
        highlight: `${priceImpact.toFixed(2)}%`,
        highlightSuffix: "impact",
        icon: "⚠️",
      };
    }

    return {
      label: "Risque élevé",
      badge: "Alert",
      description: "L'impact est important. Splittez votre trade ou changez de route.",
      gradient: "from-red-500/30 via-orange-500/20 to-amber-500/10",
      border: "border-red-500/40",
      highlight: `${priceImpact.toFixed(2)}%`,
      highlightSuffix: "impact",
      icon: "🚨",
    };
  })();

  const routeHopCount = routes.selectedRoute?.venues?.length ?? 0;
  const aggregatorLabel = selectedRouter === "swapback" ? "SwapBack Optimizer" : "Jupiter V6";
  const altRouterLabel = selectedRouter === "swapback" ? "Voir Jupiter" : "Activer SwapBack";
  const shouldSuggestDealTweak = hasQuoteContext && priceImpact >= 1.5;
  const reduceSuggestionValue = priceImpact >= 3 ? 25 : 10;
  const refreshButtonDisabled =
    !swap.inputToken ||
    !swap.outputToken ||
    inputAmount <= 0 ||
    routes.isLoading;

  const getActiveRoutePlan = (): JupiterRoutePlanStep[] | null => {
    if (routes.selectedRoutePlan && routes.selectedRoutePlan.length > 0) {
      return routes.selectedRoutePlan;
    }

    const candidateInstructions = routes.selectedRoute?.instructions;
    if (Array.isArray(candidateInstructions) && candidateInstructions.length > 0) {
      return candidateInstructions as JupiterRoutePlanStep[];
    }

    return null;
  };

  const fetchDexAccountsForPlan = async (
    plan: JupiterRoutePlanStep[]
  ): Promise<DexAccountResolution[]> => {
    const { supported: descriptors, unsupported } = partitionPlanDexSteps(plan);

    if (unsupported.length) {
      const uniqueUnsupported = Array.from(new Set(unsupported));
      throw new Error(
        `La route sélectionnée contient actuellement ${uniqueUnsupported.join(
          ", "
        )}, qui n'est pas encore supportée on-chain. Choisissez une route 100% Orca ou ajustez vos splits.`
      );
    }

    if (!descriptors.length) {
      throw new Error(
        "Aucune venue compatible n'a été trouvée dans le plan actuel. Relancez une recherche ou choisissez une autre route."
      );
    }

    const resolutions = await Promise.all(
      descriptors.map(async (descriptor) => {
        if (descriptor.dexProgramId === ORCA_PROGRAM_ID_STR) {
          const accounts = await fetchOrcaDexAccounts(descriptor);
          return { descriptor, accounts } as DexAccountResolution;
        }

        if (descriptor.dexProgramId === RAYDIUM_PROGRAM_ID_STR) {
          const accounts = await fetchRaydiumDexAccounts(descriptor);
          return { descriptor, accounts } as DexAccountResolution;
        }

        throw new Error(`Venue non supportée: ${descriptor.label}`);
      })
    );

    return resolutions;
  };

  const fetchOrcaDexAccounts = async (
    descriptor: DexStepDescriptor
  ): Promise<OrcaDexAccounts> => {
    // Direct Orca routing not supported - use Jupiter API which aggregates Orca pools
    throw new Error(
      `La résolution des comptes Orca pour ${descriptor.label} nécessite un backend. Veuillez utiliser Jupiter API ou une route alternative.`
    );
  };

  const fetchRaydiumDexAccounts = async (
    descriptor: DexStepDescriptor
  ): Promise<RaydiumDexAccounts> => {
    // Direct Raydium routing not supported - use Jupiter API which aggregates Raydium pools
    throw new Error(
      `La résolution des comptes Raydium pour ${descriptor.label} nécessite un backend. Veuillez utiliser Jupiter API ou une route alternative.`
    );
  };

  const buildOrcaAccountMetas = (
    dexAccounts: OrcaDexAccounts,
    derived: DerivedSwapAccounts,
    userAccounts: Record<string, PublicKey>
  ): AccountMeta[] => {
    const ownerA = userAccounts[dexAccounts.tokenMintA];
    const ownerB = userAccounts[dexAccounts.tokenMintB];

    if (!ownerA || !ownerB) {
      throw new Error(
        "Comptes utilisateurs introuvables pour le couple de tokens sélectionné."
      );
    }

    const tickArrayMetas = dexAccounts.tickArrays.map<AccountMeta>((key) => ({
      pubkey: new PublicKey(key),
      isWritable: true,
      isSigner: false,
    }));

    while (tickArrayMetas.length < 3) {
      tickArrayMetas.push({
        pubkey: tickArrayMetas[0]?.pubkey ?? new PublicKey(dexAccounts.whirlpool),
        isWritable: true,
        isSigner: false,
      });
    }

    return [
      { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
      { pubkey: derived.walletPublicKey, isWritable: false, isSigner: true },
      { pubkey: new PublicKey(dexAccounts.whirlpool), isWritable: true, isSigner: false },
      { pubkey: ownerA, isWritable: true, isSigner: false },
      { pubkey: new PublicKey(dexAccounts.tokenVaultA), isWritable: true, isSigner: false },
      { pubkey: ownerB, isWritable: true, isSigner: false },
      { pubkey: new PublicKey(dexAccounts.tokenVaultB), isWritable: true, isSigner: false },
      tickArrayMetas[0],
      tickArrayMetas[1],
      tickArrayMetas[2],
      { pubkey: new PublicKey(dexAccounts.oracle), isWritable: false, isSigner: false },
    ];
  };

  const buildRaydiumAccountMetas = (
    dexAccounts: RaydiumDexAccounts,
    derived: DerivedSwapAccounts,
    userAccounts: Record<string, PublicKey>,
    descriptor: DexStepDescriptor
  ): AccountMeta[] => {
    const sourceMint =
      dexAccounts.direction === "aToB"
        ? dexAccounts.tokenMintA
        : dexAccounts.tokenMintB;
    const destinationMint =
      dexAccounts.direction === "aToB"
        ? dexAccounts.tokenMintB
        : dexAccounts.tokenMintA;

    const userSource = userAccounts[sourceMint];
    const userDestination = userAccounts[destinationMint];

    if (!userSource || !userDestination) {
      throw new Error(
        `Comptes utilisateurs introuvables pour ${descriptor.label}. Assurez-vous que les tokens nécessaires sont disponibles.`
      );
    }

    return [
      { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
      { pubkey: derived.walletPublicKey, isWritable: false, isSigner: true },
      { pubkey: new PublicKey(dexAccounts.ammId), isWritable: true, isSigner: false },
      { pubkey: new PublicKey(dexAccounts.ammAuthority), isWritable: false, isSigner: false },
      { pubkey: new PublicKey(dexAccounts.ammOpenOrders), isWritable: true, isSigner: false },
      { pubkey: new PublicKey(dexAccounts.ammTargetOrders), isWritable: true, isSigner: false },
      { pubkey: new PublicKey(dexAccounts.poolCoinTokenAccount), isWritable: true, isSigner: false },
      { pubkey: new PublicKey(dexAccounts.poolPcTokenAccount), isWritable: true, isSigner: false },
      { pubkey: new PublicKey(dexAccounts.serumProgramId), isWritable: false, isSigner: false },
      { pubkey: new PublicKey(dexAccounts.serumMarket), isWritable: true, isSigner: false },
      { pubkey: new PublicKey(dexAccounts.serumBids), isWritable: true, isSigner: false },
      { pubkey: new PublicKey(dexAccounts.serumAsks), isWritable: true, isSigner: false },
      { pubkey: new PublicKey(dexAccounts.serumEventQueue), isWritable: true, isSigner: false },
      { pubkey: new PublicKey(dexAccounts.serumCoinVault), isWritable: true, isSigner: false },
      { pubkey: new PublicKey(dexAccounts.serumPcVault), isWritable: true, isSigner: false },
      { pubkey: new PublicKey(dexAccounts.serumVaultSigner), isWritable: false, isSigner: false },
      { pubkey: userSource, isWritable: true, isSigner: false },
      { pubkey: userDestination, isWritable: true, isSigner: false },
    ];
  };

  const createRemainingAccountsBuilder = async () => {
    if (!swap.inputToken || !swap.outputToken) {
      throw new Error("Sélectionnez deux tokens avant d'exécuter un swap.");
    }

    const plan = getActiveRoutePlan();
    if (!plan || plan.length === 0) {
      throw new Error(
        "Plan de route introuvable. Relancez une recherche avant d'exécuter le swap."
      );
    }

    const dexResolutions = await fetchDexAccountsForPlan(plan);

    return ({ derived }: { derived: DerivedSwapAccounts }): AccountMeta[] => {
      const userAccounts: Record<string, PublicKey> = {
        [swap.inputToken!.mint]: derived.userTokenAccountA,
        [swap.outputToken!.mint]: derived.userTokenAccountB,
      };

      return dexResolutions.flatMap((resolution) => {
        if (resolution.accounts.variant === "ORCA_WHIRLPOOL") {
          return buildOrcaAccountMetas(
            resolution.accounts,
            derived,
            userAccounts
          );
        }

        if (resolution.accounts.variant === "RAYDIUM_AMM") {
          return buildRaydiumAccountMetas(
            resolution.accounts,
            derived,
            userAccounts,
            resolution.descriptor
          );
        }

        throw new Error(
          `Venue non supportée dans le plan (program ${(resolution.accounts as any).dexProgramId ?? "inconnu"}).`
        );
      });
    };
  };

  const handleSearchRoute = async () => {
    const amount = parseFloat(swap.inputAmount);

    if (swap.inputToken && swap.outputToken && amount > 0) {
      setRouteError(null);
      setSwapError(null);
      setSwapSignature(null);
      setLoadingStep('fetching');
      setLoadingProgress(0);
      
      try {
        setLoadingProgress(30);
        setLoadingStep('routing');
        const success = await instrumentedFetchRoutes("manual");
        if (success) {
          setLoadingProgress(100);
          setHasSearchedRoute(true);
          setPriceRefreshCountdown(10);
        } else {
          setRouteError("No route found. Try adjusting the amount or selecting different tokens.");
          setHasSearchedRoute(false);
          setLoadingProgress(0);
        }
      } catch (error) {
        setRouteError("No route found. Try adjusting the amount or selecting different tokens.");
        setHasSearchedRoute(false);
        setLoadingProgress(0);
      }
    } else {
      setRouteError("Enter a valid amount and select tokens to search a route.");
      setHasSearchedRoute(false);
    }
  };

  const handleExecuteSwap = async () => {
    // Show preview modal first
    if (!showPreviewModal) {
      if (swap.inputToken && swap.outputToken) {
        trackSwapPreview({
          router: selectedRouter,
          inputToken: swap.inputToken.symbol,
          outputToken: swap.outputToken.symbol,
          inputAmount: parseFloat(swap.inputAmount) || 0,
          outputAmount: parseFloat(swap.outputAmount) || 0,
          nativeMode: shouldAttemptNativeExecution,
          provider: nativeProviderLabel,
          priceImpactPct: priceImpact,
        });
      }
      setShowPreviewModal(true);
      return;
    }
    
    const activeRoutePlan = getActiveRoutePlan();

    if (selectedRouter !== "swapback") {
      setSwapError("L'exécution on-chain est disponible uniquement via le router SwapBack.");
      return;
    }
    if (!swap.inputToken || !swap.outputToken || !routes.selectedRoute) {
      setSwapError("Route invalide. Relancez une recherche avant de swapper.");
      return;
    }
    if (!activeRoutePlan || activeRoutePlan.length === 0) {
      setSwapError("Plan de route introuvable. Relancez une recherche avant de swapper.");
      return;
    }
    if (!swapWithRouter) {
      setSwapError("Client router non initialisé. Veuillez recharger la page.");
      return;
    }
    
    let useNativeExecution = shouldAttemptNativeExecution;
    let nativeAccountsBuilderFactory: ((params: { derived: DerivedSwapAccounts }) => AccountMeta[]) | null = null;

    if (useNativeExecution) {
      try {
        console.log(
          `⚙️ [NativeExecution] Provider ${nativeProviderLabel ?? "SwapBack"} sélectionné (raison: ${nativeExecutionDecision.reason}).`
        );
        nativeAccountsBuilderFactory = await createRemainingAccountsBuilder();
      } catch (builderError) {
        console.warn(
          "⚠️ [NativeExecution] Impossible de préparer les comptes natifs, bascule sur Jupiter CPI",
          builderError
        );
        useNativeExecution = false;
      }
    }
    
    // Check if mock mode - can't execute real swaps
    if (routes.isMock) {
      setSwapError("Mode simulation actif (devnet). Les swaps réels ne sont pas disponibles. Connectez-vous au mainnet pour exécuter des swaps.");
      return;
    }
    
    // Check if Jupiter CPI is available for execution
    if (!routes.jupiterCpi || !routes.jupiterCpi.swapInstruction) {
      // Si pas de jupiterCpi, relancer automatiquement la recherche avec le wallet connecté
      if (publicKey) {
        console.log("🔄 Re-fetching routes with wallet for swap instructions...");
        setSwapError(null);
        const success = await instrumentedFetchRoutes("swap-fallback");
        // Récupérer les nouvelles routes après le fetch
        const updatedRoutes = useSwapStore.getState().routes;
        if (!success || !updatedRoutes.jupiterCpi || !updatedRoutes.jupiterCpi.swapInstruction) {
          setSwapError("Impossible d'obtenir les instructions de swap. Veuillez réessayer.");
          return;
        }
        // Continuer avec les nouvelles données
        toast.info("Route mise à jour avec les instructions de swap");
      } else {
        setSwapError("Veuillez connecter votre wallet pour exécuter le swap.");
        return;
      }
    }

    const amountInLamports = toLamports(
      swap.inputAmount,
      swap.inputToken.decimals ?? 6
    );

    if (amountInLamports.lte(new BN(0))) {
      setSwapError("Montant d'entrée invalide pour le swap.");
      return;
    }

    const expectedOutLamports = toLamports(
      swap.outputAmount,
      swap.outputToken.decimals ?? 6
    );
    const slippageBps = Math.min(
      BPS_SCALE - 1,
      Math.max(1, Math.floor((swap.slippageTolerance || 0.01) * BPS_SCALE))
    );

    let minOutLamports = expectedOutLamports.gt(new BN(0))
      ? expectedOutLamports
          .mul(new BN(BPS_SCALE - slippageBps))
          .div(new BN(BPS_SCALE))
      : new BN(1);
    if (minOutLamports.lte(new BN(0))) {
      minOutLamports = new BN(1);
    }

    let staticRemainingAccounts: AccountMeta[] | null = null;
    let jupiterRoutePayload: JupiterRouteParams | null = null;

    // Flag to track if we can use Router CPI (with rebates) or need Jupiter direct
    let canUseRouterCpi = true;

    try {
      staticRemainingAccounts = routes.jupiterCpi!.accounts.map((meta) => ({
        pubkey: new PublicKey(meta.pubkey),
        isWritable: meta.isWritable,
        isSigner: meta.isSigner,
      }));

      if (!staticRemainingAccounts.length) {
        throw new Error("Liste de comptes Jupiter vide.");
      }

      // Use instructionData (raw instruction bytes) for Router CPI, NOT the full transaction
      const instructionBytes = routes.jupiterCpi!.instructionData 
        ? new Uint8Array(routes.jupiterCpi!.instructionData)
        : null;

      if (!instructionBytes || instructionBytes.length === 0) {
        console.warn("⚠️ No instructionData found, will use Jupiter direct fallback");
        canUseRouterCpi = false;
      } else {
        jupiterRoutePayload = {
          expectedInputAmount: new BN(routes.jupiterCpi!.expectedInputAmount),
          swapInstruction: instructionBytes,
        };
        console.log(`✅ Jupiter instruction prepared: ${instructionBytes.length} bytes (vs full transaction)`);
      }
    } catch (error) {
      console.warn("⚠️ Failed to prepare Router CPI:", error);
      canUseRouterCpi = false;
    }

    setSwapError(null);
    setSwapSignature(null);
    setIsSwapping(true);
    setShowPreviewModal(false);
    setLoadingStep('building');
    setLoadingProgress(20);
    
    // Add to pending swaps
    const tempSwap = {
      id: Date.now().toString(),
      fromToken: swap.inputToken!.symbol,
      toToken: swap.outputToken!.symbol,
      fromAmount: swap.inputAmount,
      toAmount: swap.outputAmount,
      timestamp: Date.now(),
      status: 'pending' as const,
    };
    setRecentSwaps(prev => [tempSwap, ...prev]);

    let signature: string | null = null;
    let swapMethod: 'native' | 'versioned' | 'legacy' | 'jupiter-direct' = 'versioned';

    try {
      setLoadingProgress(40);
      setLoadingStep('signing');

      const buildNativeRemainingAccounts = nativeAccountsBuilderFactory
        ? async ({ derived }: { derived: DerivedSwapAccounts; request: SwapRequest }) =>
            nativeAccountsBuilderFactory({ derived })
        : null;

      if (useNativeExecution && nativeAccountsBuilderFactory && buildNativeRemainingAccounts) {
        try {
          console.log('🛠️ Attempting native on-chain execution via router');
          signature = await swapWithRouterVersioned({
            tokenIn: new PublicKey(swap.inputToken.mint),
            tokenOut: new PublicKey(swap.outputToken.mint),
            amountIn: amountInLamports,
            minOut: minOutLamports,
            slippageBps,
            buildRemainingAccounts: buildNativeRemainingAccounts ?? undefined,
            jupiterRoute: null,
          });
          swapMethod = 'native';
        } catch (nativeError) {
          console.warn('⚠️ Native execution failed, enabling Jupiter CPI fallback', nativeError);
          signature = null;
        }
      }

      if (!signature) {
        // If we can't use Router CPI (no instructionData), go directly to Jupiter
        if (!canUseRouterCpi || !jupiterRoutePayload) {
          console.log('📦 Router CPI not available, using Jupiter direct...');
          if (routes.jupiterCpi?.swapInstruction) {
            signature = await executeJupiterSwap(
              routes.jupiterCpi.swapInstruction,
              {
                lastValidBlockHeight: routes.jupiterCpi.lastValidBlockHeight,
                skipPreflight: false,
              }
            );
            swapMethod = 'jupiter-direct';
            toast.info('Swap exécuté via Jupiter direct (rebates différées)');
          } else {
            throw new Error('No Jupiter swap instruction available');
          }
        } else {
          // Strategy: Try versioned (ALT) first → Legacy → Jupiter direct
          try {
            // 1. First try with Versioned Transaction + ALT (optimal)
            console.log('🚀 Trying swap with Versioned Transaction + ALT...');
            signature = await swapWithRouterVersioned({
              tokenIn: new PublicKey(swap.inputToken.mint),
              tokenOut: new PublicKey(swap.outputToken.mint),
              amountIn: amountInLamports,
              minOut: minOutLamports,
              slippageBps,
              remainingAccounts: staticRemainingAccounts ?? undefined,
              jupiterRoute: {
                ...jupiterRoutePayload,
                addressTableLookups: routes.jupiterCpi?.addressTableLookups,
              },
            });
            swapMethod = 'versioned';
          } catch (versionedError) {
            const errorMsg = versionedError instanceof Error ? versionedError.message : '';
            console.warn('⚠️ Versioned swap failed:', errorMsg);
            
            // 2. If ALT not available or still too large, try legacy
            if (errorMsg.includes('ALT') || errorMsg.includes('not set')) {
              console.log('📦 ALT not available, trying legacy transaction...');
              try {
                signature = await swapWithRouter({
                  tokenIn: new PublicKey(swap.inputToken.mint),
                  tokenOut: new PublicKey(swap.outputToken.mint),
                  amountIn: amountInLamports,
                  minOut: minOutLamports,
                  slippageBps,
                  remainingAccounts: staticRemainingAccounts ?? undefined,
                  jupiterRoute: jupiterRoutePayload,
                });
                swapMethod = 'legacy';
              } catch (legacyError) {
                const legacyMsg = legacyError instanceof Error ? legacyError.message : '';
                if (legacyMsg.includes('Transaction too large') || legacyMsg.includes('1232')) {
                  // Fall through to Jupiter direct
                  throw legacyError;
                }
                throw legacyError;
              }
            } else if (errorMsg.includes('Transaction too large') || errorMsg.includes('1232')) {
              // 3. Last resort: Jupiter direct (no router rebates)
              console.log('📦 Transaction still too large, using Jupiter direct...');
              if (routes.jupiterCpi?.swapInstruction) {
                signature = await executeJupiterSwap(
                  routes.jupiterCpi.swapInstruction,
                  {
                    lastValidBlockHeight: routes.jupiterCpi.lastValidBlockHeight,
                    skipPreflight: false,
                  }
                );
                swapMethod = 'jupiter-direct';
                toast.info('Swap exécuté via Jupiter direct (rebates différées)');
              } else {
                throw new Error('No Jupiter swap instruction available');
              }
            } else {
              throw versionedError;
            }
          }
        }
      }

      setLoadingProgress(70);
      setLoadingStep('confirming');
      
      // Log the swap method used
      console.log(`✅ Swap completed using: ${swapMethod}`);
      
      if (signature) {
        haptic.success();
        setSwapSignature(signature);
        setLoadingProgress(100);
        
        // Save swap data and show success modal
        setLastSwapData({
          inputToken: {
            symbol: swap.inputToken?.symbol || '',
            amount: swap.inputAmount,
            logoURI: swap.inputToken?.logoURI
          },
          outputToken: {
            symbol: swap.outputToken?.symbol || '',
            amount: swap.outputAmount,
            logoURI: swap.outputToken?.logoURI
          },
          explorerUrl: getExplorerUrl('tx', signature)
        });
        setShowSuccessModal(true);
        
        // Clear error
        setErrorType(null);
        setErrorMessage(null);
        
        // Update swap status to success
        setRecentSwaps(prev => prev.map(s => 
          s.id === tempSwap.id 
            ? { ...s, status: 'success' as const, txSignature: signature }
            : s
        ));

        // 🔄 Refresh balances after successful swap (with delay for blockchain confirmation)
        setTimeout(() => {
          refreshBalances();
        }, 2000);

        if (swap.inputToken && swap.outputToken) {
          const buybackDepositLamports = routes.npiOpportunity?.shareLamports
            ? Number(routes.npiOpportunity.shareLamports)
            : 0;

          trackSwap({
            inputToken: swap.inputToken.symbol,
            outputToken: swap.outputToken.symbol,
            inputAmount: Number(amountInLamports.toString()),
            outputAmount: Number(expectedOutLamports.toString()),
            fee: 0,
            route: selectedRouter,
            buybackDeposit: buybackDepositLamports,
            walletAddress,
            router: selectedRouter,
            swapMethod,
            nativeProvider: nativeProviderLabel,
            usedFallback: routes.usedMultiSourceFallback,
            priceImpactBps: Math.round(priceImpact * 100),
            mevProtection: swap.useMEVProtection,
            routeVenues: routes.selectedRoute?.venues ?? [],
            inputDecimals: swap.inputToken.decimals ?? 9,
            outputDecimals: swap.outputToken.decimals ?? 9,
            slippageBps,
            executionChannel: swap.executionChannel,
            priorityLevel: swap.priorityLevel,
            success: true,
          });
        }
      }
    } catch (error) {
      haptic.error();
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      const errorMsg = normalizedError.message || "Swap échoué";
      setSwapError(errorMsg);
      setLoadingProgress(0);
      
      // Detect error type and show intelligent feedback
      const detectedType = detectErrorType(errorMsg);
      setErrorType(detectedType);
      setErrorMessage(errorMsg);
      
      // Update swap status to failed
      setRecentSwaps(prev => prev.map(s => 
        s.id === tempSwap.id 
            ? { ...s, status: 'failed' as const }
            : s
      ));

      trackError(normalizedError, {
        stage: "swap-execution",
        router: selectedRouter,
        swapMethod,
        nativePreferred: shouldAttemptNativeExecution,
        routeVenues: routes.selectedRoute?.venues ?? [],
      });
    } finally {
      setIsSwapping(false);
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

  // 🔄 Refresh token balances function
  const refreshBalances = useCallback(async () => {
    if (!publicKey || !connection) return;
    
    console.log('🔄 [EnhancedSwap] Refreshing token balances...');
    
    // Refresh input token balance
    if (swap.inputToken) {
      const inputBalance = await fetchTokenBalance(swap.inputToken.mint, swap.inputToken.decimals);
      console.log(`🔄 [EnhancedSwap] Input ${swap.inputToken.symbol} balance: ${inputBalance}`);
      setInputToken({ ...swap.inputToken, balance: inputBalance });
    }
    
    // Refresh output token balance
    if (swap.outputToken) {
      const outputBalance = await fetchTokenBalance(swap.outputToken.mint, swap.outputToken.decimals);
      console.log(`🔄 [EnhancedSwap] Output ${swap.outputToken.symbol} balance: ${outputBalance}`);
      setOutputToken({ ...swap.outputToken, balance: outputBalance });
    }
  }, [publicKey, connection, swap.inputToken, swap.outputToken, setInputToken, setOutputToken]);

  // 🔄 Refresh balances when wallet connects/changes
  useEffect(() => {
    if (publicKey && connection) {
      // Small delay to ensure wallet is fully connected
      const timer = setTimeout(() => {
        refreshBalances();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [publicKey, connection, refreshBalances]);

  // Fetch token balance from blockchain
  const fetchTokenBalance = async (mintAddress: string, decimals: number): Promise<number> => {
    if (!publicKey || !connection) return 0;
    
    // Validate decimals - default to 9 if invalid
    const safeDecimals = typeof decimals === 'number' && !isNaN(decimals) && decimals >= 0 ? decimals : 9;
    console.log(`🔍 [fetchTokenBalance] mint: ${mintAddress.substring(0,8)}..., decimals: ${decimals}, safeDecimals: ${safeDecimals}`);
    
    try {
      // Native SOL
      if (mintAddress === "So11111111111111111111111111111111111111112") {
        const lamports = await connection.getBalance(publicKey);
        const balance = lamports / 1e9;
        console.log(`✅ [EnhancedSwap] SOL balance: ${balance}`);
        return balance;
      }
      
      // SPL Token - Use getTokenAccountBalance for accurate decimals
      const { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID } = await import("@solana/spl-token");
      const mintPubkey = new PublicKey(mintAddress);
      
      // Try standard token program first
      try {
        const ata = await getAssociatedTokenAddress(mintPubkey, publicKey, false, TOKEN_PROGRAM_ID);
        
        // Use getTokenAccountBalance which returns the correct UI amount
        try {
          const tokenBalance = await connection.getTokenAccountBalance(ata);
          const balance = tokenBalance.value.uiAmount ?? 0;
          console.log(`✅ [EnhancedSwap] Token ${mintAddress.substring(0,8)}... balance: ${balance} (decimals from chain: ${tokenBalance.value.decimals})`);
          return balance;
        } catch {
          // Fallback to manual parsing if getTokenAccountBalance fails
          const accountInfo = await connection.getAccountInfo(ata);
          if (accountInfo && accountInfo.data.length >= 72) {
            const amount = accountInfo.data.readBigUInt64LE(64);
            const balance = Number(amount) / Math.pow(10, safeDecimals);
            console.log(`✅ [EnhancedSwap] Token ${mintAddress.substring(0,8)}... balance (manual): ${balance}, rawAmount: ${amount.toString()}, decimals: ${safeDecimals}`);
            return balance;
          }
        }
      } catch (e) {
        console.log(`⚠️ [EnhancedSwap] SPL token not found, trying Token-2022...`);
      }
      
      // Try Token-2022
      try {
        const ata = await getAssociatedTokenAddress(mintPubkey, publicKey, false, TOKEN_2022_PROGRAM_ID);
        
        // Use getTokenAccountBalance for accurate decimals
        try {
          const tokenBalance = await connection.getTokenAccountBalance(ata);
          const balance = tokenBalance.value.uiAmount ?? 0;
          console.log(`✅ [EnhancedSwap] Token-2022 ${mintAddress.substring(0,8)}... balance: ${balance}`);
          return balance;
        } catch {
          // Fallback to manual parsing
          const accountInfo = await connection.getAccountInfo(ata);
          if (accountInfo && accountInfo.data.length >= 72) {
            const amount = accountInfo.data.readBigUInt64LE(64);
            const balance = Number(amount) / Math.pow(10, safeDecimals);
            console.log(`✅ [EnhancedSwap] Token-2022 ${mintAddress.substring(0,8)}... balance (manual): ${balance}`);
            return balance;
          }
        }
      } catch (e) {
        console.log(`⚠️ [EnhancedSwap] Token-2022 not found either`);
      }
      
      return 0;
    } catch (error) {
      console.error(`❌ [EnhancedSwap] Error fetching balance:`, error);
      return 0;
    }
  };

  const handleTokenSelect = async (token: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
  }) => {
    console.log('📝 [handleTokenSelect] Starting with token:', token);
    console.log('📝 [handleTokenSelect] tokenSelectorType:', tokenSelectorType);
    
    // Fetch real balance from blockchain
    const balance = await fetchTokenBalance(token.address, token.decimals);
    console.log(`🎯 [EnhancedSwap] Selected ${token.symbol}, balance: ${balance}`);
    
    // Convert TokenSelector format to swapStore format
    const storeToken = {
      mint: token.address,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      logoURI: token.logoURI,
      balance: balance,
    };
    
    console.log('📝 [handleTokenSelect] storeToken:', storeToken);

    if (tokenSelectorType === "input") {
      console.log('📝 [handleTokenSelect] Setting INPUT token');
      setInputToken(storeToken);
    } else {
      console.log('📝 [handleTokenSelect] Setting OUTPUT token');
      setOutputToken(storeToken);
    }
    console.log('📝 [handleTokenSelect] Closing modal');
    setShowTokenSelector(false);
  };

  // Mock route data for display
  // Mock USD prices (in real app, fetch from price oracle)
  const inputTokenUsdPrice = 1; // Assume $1 per token as mock
  const outputTokenUsdPrice = 1;
  const inputUsdValue = inputAmount * inputTokenUsdPrice;
  const outputUsdValue = outputAmount * outputTokenUsdPrice;

  // Display formatted amounts
  const displayInputAmount = inputAmount > 0 ? formatNumberWithCommas(inputAmount) : '';
  const displayOutputAmount = outputAmount > 0 ? formatNumberWithCommas(outputAmount) : '';

  const nativeRouteMeta = routes.nativeRoute;
  const npiOpportunity = routes.npiOpportunity;
  const multiSourceQuotes = routes.multiSourceQuotes ?? [];
  const usedMultiSourceFallback = routes.usedMultiSourceFallback;
  const selectedRouteVenues = routes.selectedRoute?.venues ?? [];

  const { insights: nativeRouteInsights, comparison: routerComparisonData } = buildNativeRouteInsights({
    nativeRoute: nativeRouteMeta,
    npiOpportunity: npiOpportunity ?? undefined,
    usedFallback: usedMultiSourceFallback,
    outputDecimals: swap.outputToken?.decimals ?? 9,
    outputAmountTokens: outputAmount,
    priceImpact,
    selectedRouteVenues,
  });
  const nativeProviderLabel = nativeRouteInsights.provider;
  const nativeRouteFromCache = nativeRouteInsights.fromCache;
  const nativeRouteUsedFallback = nativeRouteInsights.usedFallback;

  const handleRouterSelection = (nextRouter: "swapback" | "jupiter", source: string) => {
    if (nextRouter === selectedRouter) {
      return;
    }

    trackRouterSelection({
      router: nextRouter,
      previousRouter: selectedRouter,
      source,
      priceImpactPct: priceImpact,
      nativeProvider: nativeProviderLabel ?? null,
      economicsAvailable: Boolean(npiOpportunity?.available && npiOpportunity.shareTokens > 0),
    });

    setSelectedRouter(nextRouter);
  };

  const candidateInstructions = routes.selectedRoute?.instructions;
  const hasDexCompatiblePlan = Boolean(
    (routes.selectedRoutePlan?.length ?? 0) > 0 ||
      (Array.isArray(candidateInstructions) && candidateInstructions.length > 0)
  );

  const nativeExecutionDecision = (() => {
    if (!nativeRouteInsights.provider) {
      return { mode: "router-cpi" as const, reason: "missing-provider" };
    }
    if (nativeRouteUsedFallback) {
      return { mode: "router-cpi" as const, reason: "fallback-route" };
    }
    if (!swap.inputToken || !swap.outputToken) {
      return { mode: "router-cpi" as const, reason: "tokens-missing" };
    }
    if (!hasDexCompatiblePlan) {
      return { mode: "router-cpi" as const, reason: "no-dex-plan" };
    }
    if (!nativeRouteInsights.quoteTokens || nativeRouteInsights.quoteTokens <= 0) {
      return { mode: "router-cpi" as const, reason: "invalid-quote" };
    }
    return { mode: "native" as const, reason: "provider-eligible" };
  })();

  const shouldAttemptNativeExecution = nativeExecutionDecision.mode === "native";

  const formatTokenAmount = (value?: number | null, precision = 6) =>
    formatNumberWithCommas(formatNativeTokenAmount(value, precision));

  const lamportsToTokensFloat = (lamports?: string | null) => {
    if (!swap.outputToken?.decimals) {
      return null;
    }
    return lamportsToTokens(lamports, swap.outputToken.decimals);
  };

  const explorerUrl = swapSignature ? getExplorerUrl("tx", swapSignature) : null;

  const canExecuteSwap =
    selectedRouter === "swapback" &&
    hasSearchedRoute &&
    Boolean(routes.selectedRoute) &&
    !routes.isLoading;

  // Check insufficient balance
  const hasInsufficientBalance = swap.inputToken?.balance 
    ? inputAmount > swap.inputToken.balance 
    : false;

  const priceImpactColorClass =
    priceImpact > 5
      ? "text-red-400"
      : priceImpact > 1
        ? "text-yellow-400"
        : "text-emerald-400";

  const primaryButtonDisabled =
    !connected ||
    !swap.inputToken ||
    !swap.outputToken ||
    inputAmount <= 0 ||
    hasInsufficientBalance ||
    routes.isLoading ||
    isSwapping;

  // Get contextual button text
  const getButtonText = () => {
    if (!connected) return "Connect Wallet";
    if (!swap.inputToken || !swap.outputToken) return "Select Tokens";
    if (inputAmount <= 0) return "Enter Amount";
    if (hasInsufficientBalance) {
      return `Insufficient ${swap.inputToken?.symbol} Balance`;
    }
    if (routes.isLoading) return "🔍 Finding Best Route...";
    if (isSwapping) return "⚡ Executing Swap...";
    if (canExecuteSwap) {
      return `Swap for ~${formatNumberWithCommas(outputAmount.toFixed(4))} ${swap.outputToken?.symbol}`;
    }
    return "🔍 Search Best Route";
  };

  const primaryButtonClass = !connected || !swap.inputToken || !swap.outputToken || inputAmount <= 0
    ? "bg-white/5 text-gray-600 cursor-not-allowed shadow-none"
    : hasInsufficientBalance
      ? "bg-red-500/20 text-red-400 cursor-not-allowed border border-red-500/30 shadow-none"
      : routes.isLoading || isSwapping
        ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white opacity-70 cursor-wait"
        : canExecuteSwap
          ? "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-emerald-500/20"
          : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-blue-500/20";

  return (
    <div className="max-w-4xl mx-auto flex flex-col lg:flex-row gap-4">
      {/* Main Swap Card */}
      <div className="flex-1 w-full lg:max-w-lg bg-white/5 border border-white/10 rounded-xl p-3 md:p-4 transition-all hover:bg-white/[0.07] overflow-hidden">
        {/* Header */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRecentSwaps(!showRecentSwaps)}
                className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors relative min-w-[36px] min-h-[36px] flex items-center justify-center"
                title="Recent Swaps"
              >
                <ClockIcon className="w-5 h-5 text-gray-400" />
                {recentSwaps.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                    {recentSwaps.length}
                  </span>
                )}
              </button>
            </div>
            <ClientOnlyConnectionStatus />
          </div>

          {/* Router Selection */}
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => {
                haptic.medium();
                handleRouterSelection("swapback", "primary-toggle");
              }}
              className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all relative active:scale-95 min-h-[40px] text-sm ${
                selectedRouter === "swapback"
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                  : "bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
              aria-pressed={selectedRouter === "swapback"}
            >
              <div className="flex items-center justify-center gap-1">
                <span className="text-sm">⚡</span>
                <span>SwapBack</span>
              </div>
            </button>
            <button
              onClick={() => {
                haptic.medium();
                handleRouterSelection("jupiter", "primary-toggle");
              }}
              className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all relative active:scale-95 min-h-[40px] text-sm ${
                selectedRouter === "jupiter"
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
              aria-pressed={selectedRouter === "jupiter"}
            >
              <div className="flex items-center justify-center gap-1">
                <span className="text-sm">🪐</span>
                <span>Jupiter</span>
              </div>
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 mb-3">
            <RoutingStrategySelector
              value={routingStrategy}
              onChange={handleRoutingStrategyChange}
            />
            <RouterReliabilityCard summary={routes.reliability} />
          </div>
          <div className="flex flex-wrap items-center gap-3 mb-4 text-xs text-white/70">
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold">MEV Shield</span>
              <button
                type="button"
                onClick={toggleMEVProtection}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  swap.useMEVProtection
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-white/5 text-white/60 border border-white/10"
                }`}
              >
                {swap.useMEVProtection ? "Actif" : "Inactif"}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span>Canal</span>
              <select
                value={swap.executionChannel}
                onChange={(event) =>
                  handleExecutionChannelChange(event.target.value as typeof swap.executionChannel)
                }
                className="rounded-lg bg-black/40 border border-white/10 px-3 py-1 text-white text-xs"
              >
                <option value="public">Public RPC</option>
                <option value="jito">Jito bundle</option>
                <option value="private-rpc">Private RPC</option>
              </select>
            </div>
            <span className="text-[11px] text-white/50">
              {swap.executionChannel === "public"
                ? "Latence minimale"
                : swap.executionChannel === "jito"
                ? "Bundles atomiques anti-MEV"
                : "Execution relais prive"}
            </span>
          </div>
          {/* Bloc d'info avancé désactivé */}
          {false && !isMinimalLayout && selectedRouter === "swapback" && (
            <div className="grid gap-3 md:grid-cols-2 mt-4">
              <div
                className={`rounded-2xl border ${dealQuality.border} p-4 md:p-5 bg-gradient-to-br ${dealQuality.gradient} text-white/90`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/60 font-semibold">
                      {dealQuality.badge}
                    </p>
                    <p className="text-xl font-semibold mt-1 flex items-center gap-2">
                      <span>{dealQuality.icon}</span>
                      {dealQuality.label}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold leading-none">
                      {dealQuality.highlight}
                    </p>
                    <p className="text-xs text-white/70 mt-1">
                      {dealQuality.highlightSuffix}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-white/80">
                  {dealQuality.description}
                </p>
                {shouldSuggestDealTweak && (
                  <div className="mt-4 flex items-center justify-between gap-3 text-xs md:text-sm">
                    <span className="text-white/80">
                      Astuce rapide : réduisez légèrement votre montant pour améliorer le prix.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleReduceAmount(reduceSuggestionValue)}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
                    >
                      -{reduceSuggestionValue}%
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-gray-400">Routeur actif</p>
                    <p className="text-white font-semibold">{aggregatorLabel}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400">Confiance</p>
                    <p className="text-emerald-400 font-semibold">{routerConfidenceScore}%</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-300">
                  <div className="flex flex-col">
                    <span className="text-gray-400">Hops</span>
                    <span className="font-semibold">{routeHopCount || '—'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-400">Refresh auto</span>
                    <span className="font-semibold">{routes.isLoading ? '…' : `${priceRefreshCountdown}s`}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-gray-400">Mode</span>
                    <span className="font-semibold text-emerald-300">{selectedRouter === 'swapback' ? 'Rebates' : 'Market'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!routes.isLoading) {
                        handleSearchRoute();
                      }
                    }}
                    disabled={refreshButtonDisabled}
                    className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 border ${
                      refreshButtonDisabled
                        ? 'bg-white/5 text-gray-500 border-white/10 cursor-not-allowed'
                        : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-emerald-500/40 shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-emerald-700'
                    }`}
                  >
                    {routes.isLoading ? 'Calcul en cours…' : 'Rafraîchir le devis'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      haptic.light();
                      const nextRouter = selectedRouter === 'swapback' ? 'jupiter' : 'swapback';
                      handleRouterSelection(nextRouter, 'alt-router-cta');
                    }}
                    className="px-3 py-2 rounded-xl border border-white/10 text-xs uppercase tracking-wide text-gray-400 hover:text-white hover:border-white/30 transition-colors"
                  >
                    {altRouterLabel}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Token */}
        <div className="mb-1">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/[0.07] transition-colors overflow-hidden">
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-400 font-medium">You Pay</label>
              {swap.inputToken?.balance && (
                <span className="text-xs text-gray-500">
                  Balance: {swap.inputToken.balance.toFixed(4)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*"
                value={displayInputAmount}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="0.00"
                className="flex-1 min-w-0 bg-transparent font-bold text-white outline-none min-h-[44px] tracking-tight caret-emerald-500 [-webkit-appearance:none] transition-all"
                style={{
                  fontSize: getAdaptiveFontSize(displayInputAmount.length),
                  lineHeight: 1.2,
                  letterSpacing: '-0.02em'
                }}
              />
              <button
                onClick={openInputTokenSelector}
                className="flex-shrink-0 flex items-center gap-2 bg-gradient-to-r from-white/5 to-white/10 hover:from-emerald-500/10 hover:to-cyan-500/10 px-3 py-2 rounded-xl transition-all active:scale-95 hover:scale-105 min-h-[44px] border border-white/10 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/20 group"
              >
                {swap.inputToken ? (
                  <>
                    {swap.inputToken.logoURI && (
                      <img
                        src={swap.inputToken.logoURI}
                        alt={swap.inputToken.symbol}
                        className="w-6 h-6 rounded-full group-hover:scale-110 transition-transform duration-200 ring-2 ring-transparent group-hover:ring-emerald-500/30"
                      />
                    )}
                    <span className="font-semibold text-base group-hover:text-emerald-400 transition-colors">
                      {swap.inputToken.symbol}
                    </span>
                  </>
                ) : (
                  <span className="text-gray-400 group-hover:text-emerald-400 transition-colors">Select</span>
                )}
                <svg
                  className="w-4 h-4 ml-1"
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
            {inputAmount > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-gray-400 mt-2 font-medium"
              >
                ≈ {formatCurrency(inputUsdValue)}
              </motion.div>
            )}
          </div>
          {!isMinimalLayout && (
            <div className="flex gap-2 mt-2">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => handleAmountPreset(pct)}
                  disabled={!swap.inputToken?.balance}
                  className={`flex-1 text-xs py-2 rounded-lg transition-all font-medium active:scale-95 min-h-[40px] ${
                    swap.inputToken?.balance
                      ? 'bg-white/5 hover:bg-emerald-500 hover:text-white text-gray-400 border border-white/10'
                      : 'bg-white/5 text-gray-600 cursor-not-allowed opacity-50 border border-white/5'
                  }`}
                  title={!swap.inputToken?.balance ? 'Select a token with balance first' : `Set ${pct}% of balance`}
                >
                  {pct === 100 ? 'MAX' : `${pct}%`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Switch Button */}
        <div className="flex justify-center -my-3 relative z-10">
          <button
            {...useSwipeable({
              onSwipedLeft: () => {
                haptic.medium();
                switchTokens();
              },
              onSwipedRight: () => {
                haptic.medium();
                switchTokens();
              },
              trackTouch: true,
              trackMouse: false,
            })}
            onClick={() => {
              haptic.medium();
              switchTokens();
            }}
            className="bg-gradient-to-br from-white/5 to-white/10 border border-white/10 hover:border-emerald-500/50 rounded-lg p-2 transition-all active:scale-95 hover:rotate-180 min-w-[40px] min-h-[40px] flex items-center justify-center group duration-300"
          >
            <svg
              className="w-4 h-4 text-gray-400 group-hover:text-emerald-400 transition-colors"
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
        <div className="mb-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/[0.07] transition-colors overflow-hidden">
            <div className="flex justify-between mb-1">
              <label className="text-sm text-gray-400 font-medium">You Receive</label>
              {swap.outputToken?.balance && (
                <span className="text-xs text-gray-500">
                  Balance: {swap.outputToken.balance.toFixed(4)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={displayOutputAmount}
                readOnly
                placeholder="0.00"
                className="flex-1 min-w-0 bg-transparent font-bold text-white outline-none min-h-[44px] tracking-tight [-webkit-appearance:none] transition-all"
                style={{
                  fontSize: getAdaptiveFontSize(displayOutputAmount.length),
                  lineHeight: 1.2,
                  letterSpacing: '-0.02em'
                }}
              />
              <button
                onClick={openOutputTokenSelector}
                className="flex-shrink-0 flex items-center gap-2 bg-gradient-to-r from-white/5 to-white/10 hover:from-emerald-500/10 hover:to-cyan-500/10 px-3 py-2 rounded-xl transition-all active:scale-95 hover:scale-105 min-h-[44px] border border-white/10 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/20 group"
              >
                {swap.outputToken ? (
                  <>
                    {swap.outputToken.logoURI && (
                      <img
                        src={swap.outputToken.logoURI}
                        alt={swap.outputToken.symbol}
                        className="w-6 h-6 rounded-full group-hover:scale-110 transition-transform duration-200 ring-2 ring-transparent group-hover:ring-emerald-500/30"
                      />
                    )}
                    <span className="font-semibold text-base group-hover:text-emerald-400 transition-colors">
                      {swap.outputToken.symbol}
                    </span>
                  </>
                ) : (
                  <span className="text-gray-400 group-hover:text-emerald-400 transition-colors">Select</span>
                )}
                <svg
                  className="w-4 h-4 ml-1"
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
            {outputAmount > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-gray-400 mt-2 font-medium"
              >
                ≈ {formatCurrency(outputUsdValue)}
              </motion.div>
            )}
          </div>
        </div>

        {/* Price Impact Alert */}
        {!isMinimalLayout && hasSearchedRoute && routes.selectedRoute && priceImpact > 0 && (
          <div className="mb-4">
            <PriceImpactAlert 
              priceImpact={priceImpact}
              onReduceAmount={() => handleReduceAmount(10)}
            />
          </div>
        )}

        {/* Mock Mode Warning */}
        {routes.isMock && hasSearchedRoute && routes.selectedRoute && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3"
          >
            <div className="flex items-start gap-2">
              <ExclamationTriangleIcon className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-yellow-300">
                <span className="font-semibold">Mode Simulation (Devnet)</span>
                <p className="mt-1 text-yellow-400/80">
                  Les prix affichés sont simulés. Connectez-vous au mainnet pour exécuter de vrais swaps.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading Progress */}
        {!isMinimalLayout && routes.isLoading && (
          <div className="mb-6" role="status" aria-live="polite" aria-label="Searching for best route">
            <LoadingProgress step={loadingStep} progress={loadingProgress} />
          </div>
        )}

        {/* Error State */}
        {routeError && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4" 
            role="alert" 
            aria-live="assertive"
          >
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-red-400 font-semibold mb-1">Route Not Found</div>
                <div className="text-sm text-red-300 mb-3">{routeError}</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      haptic.light();
                      setInputAmount((parseFloat(swap.inputAmount) * 0.9).toString());
                      setRouteError(null);
                    }}
                    className="text-xs px-3 py-2 min-h-[36px] bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors active:scale-95"
                  >
                    Try 10% Less
                  </button>
                  <button
                    onClick={() => {
                      haptic.light();
                      switchTokens();
                      setRouteError(null);
                    }}
                    className="text-xs px-3 py-2 min-h-[36px] bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors active:scale-95"
                  >
                    Reverse
                  </button>
                  <button
                    onClick={() => {
                      haptic.light();
                      setRouteError(null);
                    }}
                    className="text-xs px-3 py-2 min-h-[36px] bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors active:scale-95"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Route Info */}
        {hasSearchedRoute && routes.selectedRoute && (
          <div className="mb-3 space-y-2">
            {swapSignature && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 flex flex-col gap-1" role="status" aria-live="polite">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
                  <div className="text-emerald-400 font-semibold text-sm">Swap Successful</div>
                </div>
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors inline-flex items-center gap-1"
                  >
                    View Transaction
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            )}

            {swapError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2" role="alert" aria-live="assertive">
                <div className="text-xs text-red-300">{swapError}</div>
              </div>
            )}

            {usedMultiSourceFallback && (
              <div
                className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 text-[11px] text-amber-200"
                role="status"
                aria-live="polite"
              >
                Jupiter est indisponible — exécution via route native
                {" "}
                <span className="font-semibold text-amber-100">
                  {nativeProviderLabel ?? "SwapBack"}
                </span>
                .
              </div>
            )}

            {isMinimalLayout ? (
              <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Rate</span>
                  <span className="text-white font-semibold">
                    1 {swap.inputToken?.symbol} ≈ {outputAmount > 0 && inputAmount > 0 ? (outputAmount / inputAmount).toFixed(6) : "0"} {swap.outputToken?.symbol}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-gray-400 mt-2">
                  <span>Price Impact</span>
                  <span className={priceImpactColorClass}>{priceImpact.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-3">
                  <span>Refresh</span>
                  <button
                    onClick={() => {
                      haptic.light();
                      handleSearchRoute();
                    }}
                    className="text-emerald-400 hover:text-emerald-300 font-semibold"
                  >
                    {priceRefreshCountdown}s
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-400 font-medium">Price Details</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">{priceRefreshCountdown}s</span>
                      <button
                        onClick={() => {
                          haptic.light();
                          handleSearchRoute();
                        }}
                        className="p-1 min-w-[28px] min-h-[28px] flex items-center justify-center bg-white/5 hover:bg-white/10 rounded transition-colors active:scale-95"
                        title="Refresh now"
                      >
                        <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Rate</span>
                      <span className="text-white font-medium">
                        1 {swap.inputToken?.symbol} ≈{" "}
                        {outputAmount > 0 && inputAmount > 0
                          ? (outputAmount / inputAmount).toFixed(6)
                          : "0"}{" "}
                        {swap.outputToken?.symbol}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Price Impact</span>
                      <span className={priceImpactColorClass}>
                        {priceImpact.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-white/10">
                      <span className="text-gray-400">Slippage</span>
                      <div className="flex items-center gap-1">
                        {[0.5, 1.0, 2.0].map((value) => (
                          <button
                            key={value}
                            onClick={() => {
                              haptic.light();
                              setSlippageTolerance(value);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all active:scale-95 ${
                              swap.slippageTolerance === value
                                ? 'bg-emerald-500 text-white'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                          >
                            {value}%
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            haptic.light();
                            setShowSlippageModal(true);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/5 text-gray-400 hover:bg-white/10 active:scale-95"
                        >
                          Custom
                        </button>
                      </div>
                    </div>
                    {routerComparisonData && (
                      <div className="pt-2">
                        <button
                          onClick={() => {
                            haptic.medium();
                            if (routerComparisonData) {
                              const diff =
                                routerComparisonData.swapback.outputAmount -
                                routerComparisonData.jupiter.outputAmount;
                              const percentDiff =
                                routerComparisonData.jupiter.outputAmount !== 0
                                  ? (diff / routerComparisonData.jupiter.outputAmount) * 100
                                  : 0;

                              trackRouterComparisonViewed({
                                currentRouter: selectedRouter,
                                recommendedRouter: diff >= 0 ? "swapback" : "jupiter",
                                inputToken: swap.inputToken?.symbol,
                                outputToken: swap.outputToken?.symbol,
                                inputAmount: parseFloat(swap.inputAmount) || 0,
                                swapbackOutput: routerComparisonData.swapback.outputAmount,
                                jupiterOutput: routerComparisonData.jupiter.outputAmount,
                                difference: diff,
                                percentDifference: percentDiff,
                                hasEconomics:
                                  routerComparisonData.swapback.rebateAmount > 0 ||
                                  routerComparisonData.swapback.burnAmount > 0,
                                priceImpact: routerComparisonData.swapback.priceImpact,
                                source: "detail-card",
                              });
                            }
                            setShowComparisonModal(true);
                          }}
                          className="w-full text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg py-1.5 transition-all active:scale-95"
                        >
                          Comparer avec Jupiter
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {routes.intents.length > 0 && (
          <div className="mb-4">
            <RouteIntentsList intents={routes.intents} />
          </div>
        )}
        
        {!isMinimalLayout && (
          <div className="mb-2">
            <SmartSlippage
              value={swap.slippageTolerance}
              onChange={setSlippageTolerance}
              tokenPair={swap.inputToken && swap.outputToken ? 
                `${swap.inputToken.symbol}/${swap.outputToken.symbol}` : undefined
              }
            />
          </div>
        )}

        {/* Swap Button */}
        <button
          onClick={canExecuteSwap ? handleExecuteSwap : handleSearchRoute}
          disabled={primaryButtonDisabled}
          className={`w-full py-3 min-h-[48px] rounded-lg font-bold text-base transition-all active:scale-[0.98] shadow-lg ${primaryButtonClass}`}
          aria-label={getButtonText()}
        >
          <div className="flex items-center justify-center gap-2">
            {getButtonText()}
          </div>
        </button>

        {/* Footer Info */}
        <div className="mt-2 text-center text-[10px] text-gray-500">
          {selectedRouter === "swapback" ? (
            <p>⚡ BACK rebates & burns</p>
          ) : (
            <p>🪐 Jupiter V6</p>
          )}
        </div>
      </div>

      {/* Side Panel - Route Details */}
      <AnimatePresence>
        {hasSearchedRoute && routes.selectedRoute && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="w-full lg:w-72 space-y-3"
          >
            {/* Native Route & NPI */}
            {selectedRouter === "swapback" && (nativeRouteMeta || npiOpportunity || usedMultiSourceFallback) && (
              <NativeRouteCard
                insights={nativeRouteInsights}
                providerLabel={nativeProviderLabel}
                outputSymbol={swap.outputToken?.symbol}
                fromCache={nativeRouteFromCache}
                usedFallback={usedMultiSourceFallback}
              />
            )}

            {/* Multi-source diagnostics */}
            {selectedRouter === "swapback" && multiSourceQuotes.length > 0 && (
              <div className="bg-black/40 border border-white/10 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-gray-300">Diagnostics multi-source</div>
                  <div className="text-[10px] text-gray-500">
                    {multiSourceQuotes.filter((quote) => quote.ok).length}/{multiSourceQuotes.length} ok
                  </div>
                </div>
                <div className="space-y-1.5">
                  {multiSourceQuotes.map((quote, idx) => {
                    const quoteTokens = lamportsToTokensFloat(quote.outAmount);
                    const statusColor = quote.ok ? "text-emerald-300" : "text-red-300";
                    return (
                      <div
                        key={`${quote.source}-${idx}`}
                        className="flex items-center justify-between gap-2 text-[11px] bg-white/5 border border-white/10 rounded-lg px-2 py-1.5"
                      >
                        <div>
                          <div className="text-white/90 font-medium">{quote.source}</div>
                          <div className={statusColor}>
                            {quote.ok && quoteTokens !== null
                              ? `${formatTokenAmount(quoteTokens, 4)} ${swap.outputToken?.symbol}`
                              : quote.error ?? "Aucune donnée"}
                          </div>
                        </div>
                        <div className={statusColor}>
                          {typeof quote.latencyMs === "number" ? `${Math.round(quote.latencyMs)} ms` : "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Chemin de routage */}
            {routes.selectedRoute?.venues && routes.selectedRoute.venues.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-gray-300">Chemin de routage</div>
                  <div className="text-[10px] text-gray-500">{routes.selectedRoute.venues.length} hop{routes.selectedRoute.venues.length > 1 ? 's' : ''}</div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {/* Input token */}
                  <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1.5 rounded-lg">
                    {swap.inputToken?.logoURI && (
                      <img src={swap.inputToken.logoURI} alt="" className="w-4 h-4 rounded-full" />
                    )}
                    <span className="text-xs font-medium text-emerald-400">{swap.inputToken?.symbol}</span>
                  </div>
                  {/* Venues */}
                  {routes.selectedRoute.venues.map((venue, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <svg className="w-3 h-3 text-gray-600 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                      <div className="flex-1 bg-white/5 border border-white/10 px-2 py-1 rounded text-[10px] text-gray-400 font-medium">
                        {venue}
                      </div>
                    </div>
                  ))}
                  {/* Output token */}
                  <div className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-gray-600 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <div className="flex-1 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1.5 rounded-lg">
                      {swap.outputToken?.logoURI && (
                        <img src={swap.outputToken.logoURI} alt="" className="w-4 h-4 rounded-full" />
                      )}
                      <span className="text-xs font-medium text-emerald-400">{swap.outputToken?.symbol}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Token Selector Modal - NEW */}
      {showTokenSelector && (
        <TokenSelectorModal
          isOpen={showTokenSelector}
          onClose={() => setShowTokenSelector(false)}
          onSelect={async (token) => {
            console.log('🔵 [TokenSelector] Token selected:', token.symbol, token.address);
            await handleTokenSelect(token);
            console.log('🟢 [TokenSelector] handleTokenSelect completed');
          }}
          title={tokenSelectorType === "input" ? "Select Input Token" : "Select Output Token"}
          selectedToken={tokenSelectorType === "input" ? swap.inputToken?.mint : swap.outputToken?.mint}
        />
      )}
      
      {/* Swap Preview Modal */}
      <AnimatePresence>
        {showPreviewModal && routes.selectedRoute && (
          <SwapPreviewModal
            isOpen={showPreviewModal}
            onClose={() => setShowPreviewModal(false)}
            onConfirm={handleExecuteSwap}
            fromToken={{
              symbol: swap.inputToken?.symbol || '',
              amount: swap.inputAmount,
              logoURI: swap.inputToken?.logoURI,
            }}
            toToken={{
              symbol: swap.outputToken?.symbol || '',
              amount: swap.outputAmount,
              logoURI: swap.outputToken?.logoURI,
            }}
            rate={outputAmount > 0 && inputAmount > 0 ? (outputAmount / inputAmount).toFixed(6) : '0'}
            priceImpact={priceImpact}
            minReceived={(outputAmount * (1 - swap.slippageTolerance / 100)).toFixed(6)}
            slippage={swap.slippageTolerance}
            networkFee="0.000005 SOL"
            platformFee="0.00"
            route={routes.selectedRoute.venues}
            nativeRouteInsights={nativeRouteInsights}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showComparisonModal && routerComparisonData && (
          <RouterComparisonModal
            isOpen={showComparisonModal}
            onClose={() => setShowComparisonModal(false)}
            onSelectRouter={(router) => handleRouterSelection(router, "comparison-modal")}
            currentRouter={selectedRouter}
            swapbackData={routerComparisonData.swapback}
            jupiterData={routerComparisonData.jupiter}
            inputToken={{
              symbol: swap.inputToken?.symbol || "TOKEN",
              amount: swap.inputAmount || "0",
            }}
            outputToken={{ symbol: swap.outputToken?.symbol || "TOKEN" }}
          />
        )}
      </AnimatePresence>
      
      {/* Recent Swaps Sidebar */}
      <AnimatePresence>
        {showRecentSwaps && (
          <RecentSwapsSidebar
            swaps={recentSwaps}
            isOpen={showRecentSwaps}
            onClose={() => setShowRecentSwaps(false)}
          />
        )}
      </AnimatePresence>
      
      {/* Success Modal - NEW */}
      {lastSwapData && (
        <SuccessModal
          isOpen={showSuccessModal}
          onClose={() => {
            setShowSuccessModal(false);
            setLastSwapData(null);
          }}
          inputToken={lastSwapData.inputToken}
          outputToken={lastSwapData.outputToken}
          explorerUrl={lastSwapData.explorerUrl}
          onNewSwap={() => {
            setInputAmount("");
            setSwapSignature(null);
          }}
        />
      )}
      
      {/* Error Feedback - NEW */}
      {errorType && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
          <ErrorFeedback
            error={errorType}
            message={errorMessage || undefined}
            onClose={() => {
              setErrorType(null);
              setErrorMessage(null);
              setSwapError(null);
            }}
            onRetry={() => {
              setErrorType(null);
              setErrorMessage(null);
              handleExecuteSwap();
            }}
            onAdjustSlippage={() => {
              setErrorType(null);
              setErrorMessage(null);
              setSlippageTolerance(swap.slippageTolerance + 0.5);
            }}
            onReduceAmount={() => {
              setErrorType(null);
              setErrorMessage(null);
              handleReduceAmount(20);
            }}
          />
        </div>
      )}
    </div>
  );
}
