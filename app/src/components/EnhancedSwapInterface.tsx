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
import {
  useSwapRouter,
  DerivedSwapAccounts,
} from "@/hooks/useSwapRouter";
import type { JupiterRouteParams } from "@/hooks/useSwapRouter";
import { ORCA_WHIRLPOOL_PROGRAM_ID } from "@/sdk/config/orca-pools";
import { RAYDIUM_AMM_PROGRAM_ID } from "@/sdk/config/raydium-pools";
import { getExplorerUrl } from "@/config/constants";
import { ClientOnlyConnectionStatus } from "./ClientOnlyConnectionStatus";
import { TokenSelector } from "./TokenSelector";
import { DistributionBreakdown } from "./DistributionBreakdown";
import { SwapPreviewModal } from "./SwapPreviewModal";
import { LoadingProgress } from "./LoadingProgress";
import { RecentSwapsSidebar } from "./RecentSwapsSidebar";
import { ClockIcon, ExclamationTriangleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { motion, AnimatePresence } from "framer-motion";
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

  const handleAmountPreset = (percentage: number) => {
    if (swap.inputToken?.balance) {
      const amount = (swap.inputToken.balance * percentage / 100).toFixed(swap.inputToken.decimals > 6 ? 6 : swap.inputToken.decimals);
      setInputAmount(amount);
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

  const primaryButtonDisabled =
    !connected ||
    !swap.inputToken ||
    !swap.outputToken ||
    inputAmount <= 0 ||
    routes.isLoading ||
    isSwapping;

  const primaryButtonClass = !connected || !swap.inputToken || !swap.outputToken || inputAmount <= 0
    ? "bg-gray-800 text-gray-600 cursor-not-allowed"
    : routes.isLoading || isSwapping
      ? "bg-[var(--primary)]/50 text-black cursor-wait"
      : canExecuteSwap
        ? "bg-green-600 text-white hover:bg-green-700"
        : "bg-[var(--primary)] text-black hover:bg-[var(--primary)]/90";

  return (
    <div className="max-w-lg mx-auto">
      {/* Main Swap Card */}
      <div className="backdrop-blur-xl bg-[#06B6D4]/5 border-2 border-[#06B6D4]/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(0,255,255,0.2)] hover:border-[#06B6D4]/50 transition-all">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Swap</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRecentSwaps(!showRecentSwaps)}
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors relative"
                title="Recent Swaps"
              >
                <ClockIcon className="w-5 h-5 text-gray-400" />
                {recentSwaps.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-cyan-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                    {recentSwaps.length}
                  </span>
                )}
              </button>
              <ClientOnlyConnectionStatus />
            </div>
          </div>

          {/* Router Selection */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSelectedRouter("swapback")}
              className={`flex-1 py-2.5 px-4 rounded-lg font-semibold transition-all relative ${
                selectedRouter === "swapback"
                  ? "bg-[var(--primary)] text-black"
                  : "bg-gray-900 text-gray-400 hover:bg-gray-800"
              }`}
              aria-pressed={selectedRouter === "swapback"}
            >
              <div className="flex items-center justify-center gap-2">
                <span>⚡</span>
                <span>SwapBack</span>
              </div>
              {selectedRouter === "swapback" && (
                <>
                  <div className="text-xs mt-1 opacity-80">+Rebates +Burn</div>
                  <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                    {routerConfidenceScore}%
                  </div>
                </>
              )}
            </button>
            <button
              onClick={() => setSelectedRouter("jupiter")}
              className={`flex-1 py-2.5 px-4 rounded-lg font-semibold transition-all relative ${
                selectedRouter === "jupiter"
                  ? "bg-[var(--secondary)] text-black"
                  : "bg-gray-900 text-gray-400 hover:bg-gray-800"
              }`}
              aria-pressed={selectedRouter === "jupiter"}
            >
              <div className="flex items-center justify-center gap-2">
                <span>🪐</span>
                <span>Jupiter</span>
              </div>
              {selectedRouter === "jupiter" && (
                <>
                  <div className="text-xs mt-1 opacity-80">Best Market</div>
                  <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                    {routerConfidenceScore}%
                  </div>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Input Token */}
        <div className="mb-2">
          <div className="backdrop-blur-xl bg-[#10B981]/10 border border-[#10B981]/30 rounded-2xl p-4 shadow-[0_0_20px_rgba(0,255,0,0.15)]">
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-400">You Pay</label>
              {swap.inputToken?.balance && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    Balance: {swap.inputToken.balance.toFixed(4)} ({getBalancePercentage().toFixed(0)}%)
                  </span>
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
                    <span className="font-semibold">
                      {swap.inputToken.symbol}
                    </span>
                  </>
                ) : (
                  <span className="text-gray-400">Select token</span>
                )}
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
            {inputAmount > 0 && (
              <div className="text-sm text-gray-500 mt-2">
                ≈ ${(inputAmount * 1).toFixed(2)} USD
              </div>
            )}
          </div>
          {/* Amount Presets - Always visible */}
          <div className="flex gap-2 mt-2">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                onClick={() => handleAmountPreset(pct)}
                disabled={!swap.inputToken?.balance}
                className={`flex-1 text-xs py-1.5 rounded-lg transition-all font-semibold ${
                  swap.inputToken?.balance
                    ? 'bg-gray-800 hover:bg-[var(--primary)] hover:text-black text-gray-400 cursor-pointer'
                    : 'bg-gray-900 text-gray-600 cursor-not-allowed opacity-50'
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
            onClick={switchTokens}
            className="backdrop-blur-lg bg-[#10B981]/10 border-2 border-[#10B981]/40 hover:border-[#10B981] rounded-xl p-2 transition-all hover:shadow-[0_0_20px_rgba(0,255,0,0.3)]"
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
          <div className="backdrop-blur-xl bg-[#10B981]/10 border border-[#10B981]/30 rounded-2xl p-4 shadow-[0_0_20px_rgba(0,255,0,0.15)]">
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
                    <span className="font-semibold">
                      {swap.outputToken.symbol}
                    </span>
                  </>
                ) : (
                  <span className="text-gray-400">Select token</span>
                )}
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
            {outputAmount > 0 && (
              <div className="text-sm text-gray-500 mt-2">
                ≈ ${(outputAmount * 1).toFixed(2)} USD
              </div>
            )}
          </div>
        </div>

        {/* Loading Progress */}
        {routes.isLoading && (
          <div className="mb-6" role="status" aria-live="polite" aria-label="Searching for best route">
            <LoadingProgress step={loadingStep} progress={loadingProgress} />
          </div>
        )}

        {/* Enhanced Error State */}
        {routeError && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4" 
            role="alert" 
            aria-live="assertive"
          >
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-red-400 font-semibold mb-1">Route Not Found</div>
                <div className="text-sm text-red-300 mb-3">{routeError}</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setInputAmount((parseFloat(swap.inputAmount) * 0.9).toString());
                      setRouteError(null);
                    }}
                    className="text-xs px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
                  >
                    Try 10% Less
                  </button>
                  <button
                    onClick={() => {
                      switchTokens();
                      setRouteError(null);
                    }}
                    className="text-xs px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
                  >
                    Reverse Direction
                  </button>
                  <button
                    onClick={() => setRouteError(null)}
                    className="text-xs px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Route Info - Show after search */}
        {hasSearchedRoute && routes.selectedRoute && !routes.isLoading && (
          <div className="mb-6 space-y-3">
            {swapSignature && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex flex-col gap-2" role="status" aria-live="polite">
                <div className="text-green-400 font-semibold">Swap submitted successfully</div>
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-[var(--primary)] hover:underline"
                  >
                    View on Solana Explorer ↗
                  </a>
                )}
              </div>
            )}

            {swapError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4" role="alert" aria-live="assertive">
                <div className="text-sm text-red-300">{swapError}</div>
              </div>
            )}

            {/* Price Info with Real-time Updates */}
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-gray-400">Price Updates</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-cyan-400">Refreshing in {priceRefreshCountdown}s</span>
                  <button
                    onClick={handleSearchRoute}
                    className="p-1 bg-cyan-500/10 hover:bg-cyan-500/20 rounded transition-colors"
                    title="Refresh now"
                  >
                    <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Rate</span>
                <span className="text-white font-medium">
                  1 {swap.inputToken?.symbol} ≈{" "}
                  {outputAmount > 0 && inputAmount > 0
                    ? (outputAmount / inputAmount).toFixed(6)
                    : "0"}{" "}
                  {swap.outputToken?.symbol}
                </span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Price Impact</span>
                <span
                  className={
                    priceImpact > 5
                      ? "text-red-400"
                      : priceImpact > 1
                        ? "text-yellow-400"
                        : "text-green-400"
                  }
                >
                  {priceImpact.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-gray-400">Slippage Tolerance</span>
                <div className="flex items-center gap-2">
                  {suggestedSlippage !== null && suggestedSlippage !== swap.slippageTolerance && (
                    <button
                      onClick={() => setSlippageTolerance(suggestedSlippage)}
                      className="text-xs px-2 py-0.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded transition-colors"
                      title="Suggested based on price impact"
                    >
                      Use {suggestedSlippage}%
                    </button>
                  )}
                  <button
                    onClick={() => setShowSlippageModal(true)}
                    className="text-[var(--primary)] hover:text-[var(--primary)]/80"
                  >
                    {swap.slippageTolerance}% ⚙️
                  </button>
                </div>
              </div>
            </div>

            {/* SwapBack Benefits (if SwapBack router selected) */}
            {selectedRouter === "swapback" && mockRouteInfo && (
              <div className="bg-gradient-to-r from-[var(--primary)]/10 to-[var(--secondary)]/10 border border-[var(--primary)]/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-[var(--primary)]">
                    ⚡ Your SwapBack Savings
                  </div>
                  <div className="relative">
                    <button
                      onMouseEnter={() => setShowTooltip("npi")}
                      onMouseLeave={() => setShowTooltip(null)}
                      className="text-gray-400 hover:text-white text-xs"
                      aria-label="What is NPI?"
                    >
                      ℹ️
                    </button>
                    {showTooltip === "npi" && (
                      <div className="absolute right-0 top-6 w-64 bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 z-50">
                        <strong>NPI (Net Positive Impact)</strong>: 70% of protocol fees are returned to you as rebates, making your trades more profitable.
                      </div>
                    )}
                  </div>
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
                  <div className="border-t border-gray-700 pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span className="text-white">Total Saved</span>
                      <span className="text-[var(--primary)]">
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

            {/* Enhanced Route Visualization */}
            {routes.selectedRoute.venues &&
              routes.selectedRoute.venues.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-900 rounded-lg p-4 border border-gray-800"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-gray-300">Route Path</div>
                    <div className="text-xs text-gray-500">{routes.selectedRoute.venues.length} hop{routes.selectedRoute.venues.length > 1 ? 's' : ''}</div>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
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
                        <div className="bg-cyan-500/10 border border-cyan-500/30 px-3 py-2 rounded-lg">
                          <span className="text-xs text-cyan-400 font-medium">{venue}</span>
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
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${primaryButtonClass}`}
          aria-label={
            !connected
              ? "Connect wallet to swap"
              : canExecuteSwap
                ? "Execute swap"
                : "Search for best route"
          }
        >
          {!connected
            ? "Connect Wallet"
            : !swap.inputToken || !swap.outputToken
              ? "Select Tokens"
              : inputAmount <= 0
                ? "Enter Amount"
                : routes.isLoading
                  ? "🔍 Searching..."
                  : canExecuteSwap
                    ? isSwapping
                      ? "⚡ Executing Swap..."
                      : "✅ Execute Swap"
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
          <div className="backdrop-blur-xl bg-[#10B981]/5 border-2 border-[#10B981]/40 rounded-2xl p-6 max-w-md w-full shadow-[0_0_40px_rgba(0,255,0,0.3)]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">
                Slippage Settings
              </h3>
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
              <label className="text-sm text-gray-400 mb-2 block">
                Custom Slippage
              </label>
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
