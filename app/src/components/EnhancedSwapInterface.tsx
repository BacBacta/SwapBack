/**
 * Professional Swap Interface
 * Modern, clean design with complete functionality
 */

"use client";

import { useState, useEffect } from "react";
import { BN } from "@coral-xyz/anchor";
import { AccountMeta, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSwapStore } from "@/store/swapStore";
import { useSwapWebSocket } from "@/hooks/useSwapWebSocket";
import { useHaptic } from "@/hooks/useHaptic";
import {
  useSwapRouter,
  DerivedSwapAccounts,
} from "@/hooks/useSwapRouter";
import type { JupiterRouteParams } from "@/hooks/useSwapRouter";
import { ORCA_WHIRLPOOL_PROGRAM_ID } from "@/sdk/config/orca-pools";
import { RAYDIUM_AMM_PROGRAM_ID } from "@/sdk/config/raydium-pools";
import { getExplorerUrl } from "@/config/constants";
import { ClientOnlyConnectionStatus } from "./ClientOnlyConnectionStatus";

// Phase 4: Lazy imports for heavy components
import dynamic from "next/dynamic";
const TokenSelector = dynamic(() => import("./TokenSelector").then(mod => ({ default: mod.TokenSelector })), { ssr: false });
const DistributionBreakdown = dynamic(() => import("./DistributionBreakdown").then(mod => ({ default: mod.DistributionBreakdown })), { ssr: false });
const SwapPreviewModal = dynamic(() => import("./SwapPreviewModal").then(mod => ({ default: mod.SwapPreviewModal })), { ssr: false });
const LoadingProgress = dynamic(() => import("./LoadingProgress").then(mod => ({ default: mod.LoadingProgress })), { ssr: false });
const RecentSwapsSidebar = dynamic(() => import("./RecentSwapsSidebar").then(mod => ({ default: mod.RecentSwapsSidebar })), { ssr: false });

import { ClockIcon, ExclamationTriangleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { motion, AnimatePresence } from "framer-motion";
import { useSwipeable } from "react-swipeable";
import { toast } from "sonner";
import { 
  formatNumberWithCommas, 
  parseFormattedNumber, 
  validateNumberInput,
  formatCurrency,
  getAdaptiveFontSize 
} from "@/utils/formatNumber";
import { PriceImpactAlert } from "@/components/PriceImpactAlert";
// import { debounce } from "lodash"; // Désactivé - Pas d'auto-fetch

interface RouteStep {
  label: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  fee: string;
}

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
  const { swapWithRouter } = useSwapRouter();
  const haptic = useHaptic();

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

  // ⚠️ AUTO-FETCH DÉSACTIVÉ pour éviter les boucles infinies
  // User must click "Search Route" manually

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
  
  // Real-time price refresh countdown
  useEffect(() => {
    if (!hasSearchedRoute || routes.isLoading) return;
    
    const interval = setInterval(() => {
      setPriceRefreshCountdown((prev) => {
        if (prev <= 1) {
          // Auto-refresh route
          if (swap.inputToken && swap.outputToken && parseFloat(swap.inputAmount) > 0) {
            fetchRoutes({ userPublicKey: publicKey?.toBase58() ?? null }).catch(() => {});
          }
          return 10;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [hasSearchedRoute, routes.isLoading, swap.inputToken, swap.outputToken, swap.inputAmount, publicKey, fetchRoutes]);

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

  const getBalancePercentage = () => {
    if (!swap.inputToken?.balance || !swap.inputAmount) return 0;
    return Math.min((parseFloat(swap.inputAmount) / swap.inputToken.balance) * 100, 100);
  };

  const routerConfidenceScore = selectedRouter === "swapback" ? 98 : 95;

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
    // TODO: Implement client-side account resolution
    // For now, throw an error to indicate this feature is not available
    throw new Error(
      `La résolution des comptes Orca pour ${descriptor.label} nécessite un backend. Veuillez utiliser Jupiter API ou une route alternative.`
    );
  };

  const fetchRaydiumDexAccounts = async (
    descriptor: DexStepDescriptor
  ): Promise<RaydiumDexAccounts> => {
    // TODO: Implement client-side account resolution
    // For now, throw an error to indicate this feature is not available
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
        await fetchRoutes({ userPublicKey: publicKey?.toBase58() ?? null });
        setLoadingProgress(100);
        setHasSearchedRoute(true);
        setPriceRefreshCountdown(10);
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

    let remainingAccountsBuilder: ((params: {
      derived: DerivedSwapAccounts;
    }) => AccountMeta[]) | null = null;
    let staticRemainingAccounts: AccountMeta[] | null = null;
    let jupiterRoutePayload: JupiterRouteParams | null = null;

    if (routes.jupiterCpi) {
      try {
        staticRemainingAccounts = routes.jupiterCpi.accounts.map((meta) => ({
          pubkey: new PublicKey(meta.pubkey),
          isWritable: meta.isWritable,
          isSigner: meta.isSigner,
        }));

        if (!staticRemainingAccounts.length) {
          throw new Error("Liste de comptes Jupiter vide.");
        }

        jupiterRoutePayload = {
          expectedInputAmount: new BN(routes.jupiterCpi.expectedInputAmount),
          swapInstruction: decodeBase64ToUint8Array(
            routes.jupiterCpi.swapInstruction
          ),
        };
      } catch (error) {
        setSwapError(
          error instanceof Error
            ? error.message
            : "Impossible de préparer l'instruction Jupiter."
        );
        return;
      }
    } else {
      try {
        remainingAccountsBuilder = await createRemainingAccountsBuilder();
      } catch (error) {
        setSwapError(
          error instanceof Error
            ? error.message
            : "Impossible de préparer les comptes DEX."
        );
        return;
      }
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

    try {
      setLoadingProgress(40);
      setLoadingStep('signing');
      const signature = await swapWithRouter({
        tokenIn: new PublicKey(swap.inputToken.mint),
        tokenOut: new PublicKey(swap.outputToken.mint),
        amountIn: amountInLamports,
        minOut: minOutLamports,
        slippageBps,
        remainingAccounts: staticRemainingAccounts ?? undefined,
        buildRemainingAccounts:
          staticRemainingAccounts === null
            ? async ({ derived }) => {
                return remainingAccountsBuilder
                  ? remainingAccountsBuilder({ derived })
                  : [];
              }
            : undefined,
        jupiterRoute: jupiterRoutePayload,
      });

      setLoadingProgress(70);
      setLoadingStep('confirming');
      
      if (signature) {
        haptic.success();
        setSwapSignature(signature);
        setLoadingProgress(100);
        
        // Update swap status to success
        setRecentSwaps(prev => prev.map(s => 
          s.id === tempSwap.id 
            ? { ...s, status: 'success' as const, txSignature: signature }
            : s
        ));
      }
    } catch (error) {
      haptic.error();
      const errorMsg = error instanceof Error ? error.message : "Swap échoué";
      setSwapError(errorMsg);
      setLoadingProgress(0);
      
      // Update swap status to failed
      setRecentSwaps(prev => prev.map(s => 
        s.id === tempSwap.id 
            ? { ...s, status: 'failed' as const }
            : s
      ));
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

  const handleTokenSelect = (token: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
  }) => {
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

  // Mock USD prices (in real app, fetch from price oracle)
  const inputTokenUsdPrice = 1; // Assume $1 per token as mock
  const outputTokenUsdPrice = 1;
  const inputUsdValue = inputAmount * inputTokenUsdPrice;
  const outputUsdValue = outputAmount * outputTokenUsdPrice;

  // Display formatted amounts
  const displayInputAmount = inputAmount > 0 ? formatNumberWithCommas(inputAmount) : '';
  const displayOutputAmount = outputAmount > 0 ? formatNumberWithCommas(outputAmount) : '';

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
          outAmount: (
            (outputAmount * 1000000) /
            routes.selectedRoute!.venues.length
          ).toString(),
          fee: "1000",
        })) as RouteStep[],
      }
    : null;

  const explorerUrl = swapSignature ? getExplorerUrl("tx", swapSignature) : null;

  const usdPerOutputToken =
    outputAmount > 0 && inputAmount > 0 ? inputAmount / outputAmount : 0;

  const npiUsd =
    mockRouteInfo && mockRouteInfo.npi > 0
      ? usdPerOutputToken > 0
        ? mockRouteInfo.npi * usdPerOutputToken
        : mockRouteInfo.npi
      : 0;

  const platformFeeUsd =
    mockRouteInfo && mockRouteInfo.fees > 0
      ? usdPerOutputToken > 0
        ? mockRouteInfo.fees * usdPerOutputToken
        : mockRouteInfo.fees
      : 0;

  const canExecuteSwap =
    selectedRouter === "swapback" &&
    hasSearchedRoute &&
    Boolean(routes.selectedRoute) &&
    !routes.isLoading;

  // Check insufficient balance
  const hasInsufficientBalance = swap.inputToken?.balance 
    ? inputAmount > swap.inputToken.balance 
    : false;

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
    <div className="max-w-2xl mx-auto">
      {/* Main Swap Card */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6 transition-all hover:bg-white/[0.07]">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRecentSwaps(!showRecentSwaps)}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors relative min-w-[44px] min-h-[44px] flex items-center justify-center"
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
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => {
                haptic.medium();
                setSelectedRouter("swapback");
              }}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all relative active:scale-95 min-h-[56px] ${
                selectedRouter === "swapback"
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                  : "bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
              aria-pressed={selectedRouter === "swapback"}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl">⚡</span>
                <span>SwapBack</span>
              </div>
              {selectedRouter === "swapback" && (
                <div className="text-xs mt-1 opacity-90">Rebates & Burn</div>
              )}
            </button>
            <button
              onClick={() => {
                haptic.medium();
                setSelectedRouter("jupiter");
              }}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all relative active:scale-95 min-h-[56px] ${
                selectedRouter === "jupiter"
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
              aria-pressed={selectedRouter === "jupiter"}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl">🪐</span>
                <span>Jupiter</span>
              </div>
              {selectedRouter === "jupiter" && (
                <div className="text-xs mt-1 opacity-90">Best Market</div>
              )}
            </button>
          </div>
        </div>

        {/* Input Token */}
        <div className="mb-2">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 hover:bg-white/[0.07] transition-colors">
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-400 font-medium">You Pay</label>
              {swap.inputToken?.balance && (
                <span className="text-xs text-gray-500">
                  Balance: {swap.inputToken.balance.toFixed(4)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*"
                value={displayInputAmount}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent font-bold text-white outline-none min-h-[44px] tracking-tight caret-emerald-500 [-webkit-appearance:none] transition-all"
                style={{
                  fontSize: getAdaptiveFontSize(displayInputAmount.length),
                  lineHeight: 1.2,
                  letterSpacing: '-0.02em'
                }}
              />
              <button
                onClick={openInputTokenSelector}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-xl transition-all active:scale-95 min-h-[48px] border border-white/10"
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
                    <span className="font-semibold text-base">
                      {swap.inputToken.symbol}
                    </span>
                  </>
                ) : (
                  <span className="text-gray-400">Select</span>
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
          {/* Amount Presets */}
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
            className="bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl p-3 transition-all active:scale-95 min-w-[48px] min-h-[48px] flex items-center justify-center"
          >
            <svg
              className="w-5 h-5 text-gray-400"
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
        <div className="mb-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 hover:bg-white/[0.07] transition-colors">
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-400 font-medium">You Receive</label>
              {swap.outputToken?.balance && (
                <span className="text-xs text-gray-500">
                  Balance: {swap.outputToken.balance.toFixed(4)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                inputMode="decimal"
                value={displayOutputAmount}
                readOnly
                placeholder="0.00"
                className="flex-1 bg-transparent font-bold text-white outline-none min-h-[44px] tracking-tight [-webkit-appearance:none] transition-all"
                style={{
                  fontSize: getAdaptiveFontSize(displayOutputAmount.length),
                  lineHeight: 1.2,
                  letterSpacing: '-0.02em'
                }}
              />
              <button
                onClick={openOutputTokenSelector}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-xl transition-all active:scale-95 min-h-[48px] border border-white/10"
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
                    <span className="font-semibold text-base">
                      {swap.outputToken.symbol}
                    </span>
                  </>
                ) : (
                  <span className="text-gray-400">Select</span>
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
        {hasSearchedRoute && routes.selectedRoute && priceImpact > 0 && (
          <div className="mb-4">
            <PriceImpactAlert 
              priceImpact={priceImpact}
              onReduceAmount={() => handleReduceAmount(10)}
            />
          </div>
        )}

        {/* Loading Progress */}
        {routes.isLoading && (
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
        {hasSearchedRoute && routes.selectedRoute && !routes.isLoading && (
          <div className="mb-6 space-y-3">
            {swapSignature && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex flex-col gap-2" role="status" aria-live="polite">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
                  <div className="text-emerald-400 font-semibold">Swap Successful</div>
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
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4" role="alert" aria-live="assertive">
                <div className="text-sm text-red-300">{swapError}</div>
              </div>
            )}

            {/* Price Info */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-gray-400 font-medium">Price Details</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{priceRefreshCountdown}s</span>
                  <button
                    onClick={() => {
                      haptic.light();
                      handleSearchRoute();
                    }}
                    className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg transition-colors active:scale-95"
                    title="Refresh now"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="space-y-2 text-sm">
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
                  <span
                    className={
                      priceImpact > 5
                        ? "text-red-400"
                        : priceImpact > 1
                          ? "text-yellow-400"
                          : "text-emerald-400"
                    }
                  >
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
              </div>
            </div>

            {/* SwapBack Benefits */}
            {selectedRouter === "swapback" && mockRouteInfo && (
              <div className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚡</span>
                    <div className="text-sm font-semibold text-emerald-400">
                      SwapBack Savings
                    </div>
                  </div>
                  <button
                    onMouseEnter={() => setShowTooltip("npi")}
                    onMouseLeave={() => setShowTooltip(null)}
                    className="text-gray-400 hover:text-white text-sm min-w-[24px] min-h-[24px]"
                    aria-label="What is NPI?"
                  >
                    ℹ️
                  </button>
                  {showTooltip === "npi" && (
                    <div className="absolute right-0 top-6 w-64 bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs text-gray-300 z-50 shadow-xl">
                      <strong>NPI (Net Positive Impact)</strong>: 70% of protocol fees returned as rebates.
                    </div>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Optimization</span>
                    <span className="text-emerald-400 font-medium">
                      +{mockRouteInfo.npi.toFixed(4)} {swap.outputToken?.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">BACK Rebate</span>
                    <span className="text-emerald-400 font-medium">
                      +{mockRouteInfo.rebate.toFixed(4)}{" "}
                      {swap.outputToken?.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">BACK Burn</span>
                    <span className="text-orange-400 font-medium">
                      {mockRouteInfo.burn.toFixed(4)} BACK 🔥
                    </span>
                  </div>
                  <div className="border-t border-white/10 pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span className="text-white">Total Saved</span>
                      <span className="text-emerald-400">
                        +{(mockRouteInfo.npi + mockRouteInfo.rebate).toFixed(4)}{" "}
                        {swap.outputToken?.symbol}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedRouter === "swapback" && mockRouteInfo && (npiUsd > 0 || platformFeeUsd > 0) && (
              <DistributionBreakdown
                npiAmount={npiUsd}
                platformFee={platformFeeUsd}
              />
            )}

            {/* Route Visualization */}
            {routes.selectedRoute.venues &&
              routes.selectedRoute.venues.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/5 border border-white/10 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-gray-300">Route Path</div>
                    <div className="text-xs text-gray-500">{routes.selectedRoute.venues.length} hop{routes.selectedRoute.venues.length > 1 ? 's' : ''}</div>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {/* Start Token */}
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 rounded-lg flex-shrink-0">
                      {swap.inputToken?.logoURI && (
                        <img src={swap.inputToken.logoURI} alt="" className="w-4 h-4 rounded-full" />
                      )}
                      <span className="text-sm font-medium text-emerald-400">{swap.inputToken?.symbol}</span>
                    </div>
                    
                    {/* DEX Steps */}
                    {routes.selectedRoute.venues.map((venue, index) => (
                      <div key={index} className="flex items-center gap-2 flex-shrink-0">
                        <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <div className="bg-white/5 border border-white/10 px-3 py-2 rounded-lg">
                          <span className="text-xs text-gray-400 font-medium">{venue}</span>
                        </div>
                      </div>
                    ))}
                    
                    {/* Arrow to End */}
                    <svg className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    
                    {/* End Token */}
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 rounded-lg flex-shrink-0">
                      {swap.outputToken?.logoURI && (
                        <img src={swap.outputToken.logoURI} alt="" className="w-4 h-4 rounded-full" />
                      )}
                      <span className="text-sm font-medium text-emerald-400">{swap.outputToken?.symbol}</span>
                    </div>
                  </div>
                </motion.div>
              )}
          </div>
        )}

        {/* Swap Button */}
        <button
          onClick={canExecuteSwap ? handleExecuteSwap : handleSearchRoute}
          disabled={primaryButtonDisabled}
          className={`w-full py-4 min-h-[60px] rounded-xl font-bold text-lg transition-all active:scale-[0.98] shadow-lg ${primaryButtonClass}`}
          aria-label={getButtonText()}
        >
          <div className="flex items-center justify-center gap-2">
            {getButtonText()}
          </div>
        </button>

        {/* Footer Info */}
        <div className="mt-4 text-center text-xs text-gray-500">
          {selectedRouter === "swapback" ? (
            <p>⚡ Optimized with BACK token rebates & burns</p>
          ) : (
            <p>🪐 Powered by Jupiter V6 aggregator</p>
          )}
        </div>
      </div>

      {/* Slippage Modal */}
      {showSlippageModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">
                Slippage Settings
              </h3>
              <button
                onClick={() => {
                  haptic.light();
                  setShowSlippageModal(false);
                }}
                className="text-gray-400 hover:text-white text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-95 transition-all"
              >
                ✕
              </button>
            </div>

            {/* Preset Buttons */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[0.1, 0.5, 1.0].map((value) => (
                <button
                  key={value}
                  onClick={() => {
                    haptic.light();
                    handleSlippagePreset(value);
                  }}
                  className={`py-3 min-h-[48px] rounded-xl font-semibold transition-all active:scale-95 ${
                    swap.slippageTolerance === value
                      ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                      : "bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10"
                  }`}
                >
                  {value}%
                </button>
              ))}
            </div>

            {/* Custom Input */}
            <div className="mb-6">
              <label className="text-sm text-gray-400 mb-2 block font-medium">
                Custom Slippage
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  value={customSlippage}
                  onChange={(e) => setCustomSlippage(e.target.value)}
                  placeholder="0.5"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 min-h-[48px] text-white outline-none focus:border-emerald-500 transition-colors"
                />
                <button
                  onClick={() => {
                    haptic.medium();
                    handleCustomSlippage();
                  }}
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-6 py-3 min-h-[48px] rounded-xl font-semibold active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Warning */}
            {parseFloat(customSlippage) > 5 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-sm text-yellow-400 flex items-start gap-2">
                <span className="text-lg flex-shrink-0">⚠️</span>
                <span>High slippage may result in unfavorable trades</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Token Selector Modal */}
      {showTokenSelector && (
        <TokenSelector
          selectedToken={
            tokenSelectorType === "input"
              ? swap.inputToken?.mint || ""
              : swap.outputToken?.mint || ""
          }
          onSelect={handleTokenSelect}
          onClose={() => setShowTokenSelector(false)}
        />
      )}
      
      {/* Swap Preview Modal */}
      <AnimatePresence>
        {showPreviewModal && mockRouteInfo && (
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
            platformFee={mockRouteInfo.fees.toFixed(6)}
            route={routes.selectedRoute.venues}
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
    </div>
  );
}
