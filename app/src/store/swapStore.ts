/**
 * Swap Store - State Management
 * Manages swap state, routes, transaction status using Zustand
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { RouteCandidate } from "@/../../sdk/src/types/smart-router";

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

type JupiterCpiMeta = {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
};

export type JupiterCpiState = {
  expectedInputAmount: string;
  swapInstruction: string;
  accounts: JupiterCpiMeta[];
} | null;

// ============================================================================
// TYPES
// ============================================================================

export interface Token {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  balance?: number;
}

export interface SwapState {
  inputToken: Token | null;
  outputToken: Token | null;
  inputAmount: string;
  outputAmount: string;
  slippageTolerance: number;
  useMEVProtection: boolean;
  priorityLevel: "low" | "medium" | "high";
}

export interface RouteState {
  routes: RouteCandidate[];
  selectedRoute: RouteCandidate | null;
  selectedRoutePlan: JupiterRoutePlanStep[] | null;
  jupiterCpi: JupiterCpiState;
  isLoading: boolean;
  error: string | null;
}

export interface TransactionState {
  status:
    | "idle"
    | "preparing"
    | "signing"
    | "sending"
    | "confirming"
    | "confirmed"
    | "failed";
  signature: string | null;
  error: string | null;
  confirmations: number;
}

export interface SwapStore {
  // Swap State
  swap: SwapState;
  setInputToken: (token: Token | null) => void;
  setOutputToken: (token: Token | null) => void;
  setInputAmount: (amount: string) => void;
  setOutputAmount: (amount: string) => void;
  setSlippageTolerance: (tolerance: number) => void;
  setUseMEVProtection: (use: boolean) => void;
  setPriorityLevel: (level: "low" | "medium" | "high") => void;
  switchTokens: () => void;

  // Route State
  routes: RouteState;
  fetchRoutes: (options?: { userPublicKey?: string | null }) => Promise<void>;
  selectRoute: (route: RouteCandidate) => void;
  clearRoutes: () => void;

  // Transaction State
  transaction: TransactionState;
  setTransactionStatus: (status: TransactionState["status"]) => void;
  setTransactionSignature: (signature: string) => void;
  setTransactionError: (error: string | null) => void;
  incrementConfirmations: () => void;
  resetTransaction: () => void;

  // History
  transactionHistory: Array<{
    signature: string;
    timestamp: number;
    inputToken: Token;
    outputToken: Token;
    inputAmount: string;
    outputAmount: string;
    status: "confirmed" | "failed";
  }>;
  addToHistory: (tx: SwapStore["transactionHistory"][0]) => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialSwapState: SwapState = {
  inputToken: null,
  outputToken: null,
  inputAmount: "",
  outputAmount: "",
  slippageTolerance: 0.01, // 1%
  useMEVProtection: true,
  priorityLevel: "medium",
};

const initialRouteState: RouteState = {
  routes: [],
  selectedRoute: null,
  selectedRoutePlan: null,
  jupiterCpi: null,
  isLoading: false,
  error: null,
};

const initialTransactionState: TransactionState = {
  status: "idle",
  signature: null,
  error: null,
  confirmations: 0,
};

// ============================================================================
// STORE
// ============================================================================

export const useSwapStore = create<SwapStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Swap State
        swap: initialSwapState,

        setInputToken: (token) =>
          set((state) => ({
            swap: { ...state.swap, inputToken: token },
          })),

        setOutputToken: (token) =>
          set((state) => ({
            swap: { ...state.swap, outputToken: token },
          })),

        setInputAmount: (amount) =>
          set((state) => ({
            swap: { ...state.swap, inputAmount: amount },
          })),

        setOutputAmount: (amount) =>
          set((state) => ({
            swap: { ...state.swap, outputAmount: amount },
          })),

        setSlippageTolerance: (tolerance) =>
          set((state) => ({
            swap: { ...state.swap, slippageTolerance: tolerance },
          })),

        setUseMEVProtection: (use) =>
          set((state) => ({
            swap: { ...state.swap, useMEVProtection: use },
          })),

        setPriorityLevel: (level) =>
          set((state) => ({
            swap: { ...state.swap, priorityLevel: level },
          })),

        switchTokens: () =>
          set((state) => ({
            swap: {
              ...state.swap,
              inputToken: state.swap.outputToken,
              outputToken: state.swap.inputToken,
              inputAmount: state.swap.outputAmount,
              outputAmount: state.swap.inputAmount,
            },
          })),

        // Route State
        routes: initialRouteState,

        fetchRoutes: async (options) => {
          const { swap } = get();
          
          if (!swap.inputToken || !swap.outputToken || !swap.inputAmount) {
            return;
          }

          set((state) => ({
            routes: {
              ...state.routes,
              isLoading: true,
              error: null,
              jupiterCpi: null,
            },
          }));

          try {
            // Convert amount to lamports (assuming 9 decimals for SOL-like tokens)
            const inputDecimals = swap.inputToken.decimals || 9;
            const amountInSmallestUnit = Math.floor(
              parseFloat(swap.inputAmount) * Math.pow(10, inputDecimals)
            );

            // Call API route (uses CORS proxy on Vercel)
            const response = await fetch("/api/swap/quote", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                inputMint: swap.inputToken.mint,
                outputMint: swap.outputToken.mint,
                amount: amountInSmallestUnit,
                slippageBps: Math.floor(swap.slippageTolerance * 10000),
                userPublicKey: options?.userPublicKey ?? null,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || "Failed to fetch routes");
            }

            const data = await response.json();
            
            // API returns {success: true, quote: {...}, routeInfo: {...}}
            if (!data.success || !data.quote) {
              throw new Error(data.error || "Invalid API response");
            }

            const quote = data.quote;
            const routePlan: JupiterRoutePlanStep[] = quote?.routePlan ?? [];

            if (quote && quote.outAmount) {
              // Parse price impact (peut être string ou number)
              const priceImpact = typeof quote.priceImpactPct === 'string' 
                ? parseFloat(quote.priceImpactPct) 
                : (quote.priceImpactPct || 0);

              const route: RouteCandidate = {
                id: `route_${Date.now()}`,
                venues: quote.routePlan?.map((step: { swapInfo?: { label?: string } }) => 
                  step.swapInfo?.label || "Unknown"
                ) || [],
                path: [swap.inputToken.mint, swap.outputToken.mint],
                hops: quote.routePlan?.length || 1,
                splits: [],
                expectedOutput: parseFloat(quote.outAmount),
                totalCost: 0,
                effectiveRate: parseFloat(quote.outAmount) / parseFloat(quote.inAmount),
                riskScore: priceImpact ? Math.min(100, priceImpact * 10) : 10,
                mevRisk: priceImpact > 2 ? "high" : priceImpact > 0.5 ? "medium" : "low",
                instructions: routePlan,
                estimatedComputeUnits: 200000,
              };

              // Calculate output amount in human-readable format
              const outputDecimals = swap.outputToken.decimals || 9;
              const outputAmount = parseFloat(quote.outAmount) / Math.pow(10, outputDecimals);

              set((state) => ({
                swap: {
                  ...state.swap,
                  outputAmount: outputAmount.toString(),
                },
                routes: {
                  ...state.routes,
                  routes: [route],
                  selectedRoute: route,
                  selectedRoutePlan: routePlan,
                  jupiterCpi: data.jupiterCpi ?? null,
                  isLoading: false,
                },
              }));
            } else {
              throw new Error("No quote received from API");
            }
          } catch (error) {
            console.error("Error fetching routes:", error);
            set((state) => ({
              routes: {
                ...state.routes,
                isLoading: false,
                error: error instanceof Error ? error.message : "Unknown error",
                selectedRoutePlan: null,
                jupiterCpi: null,
              },
            }));
          }
        },

        selectRoute: (route) =>
          set((state) => ({
            routes: {
              ...state.routes,
              selectedRoute: route,
              selectedRoutePlan: Array.isArray(route.instructions)
                ? (route.instructions as JupiterRoutePlanStep[])
                : state.routes.selectedRoutePlan,
            },
          })),

        clearRoutes: () =>
          set((state) => ({
            routes: {
              ...state.routes,
              routes: [],
              selectedRoute: null,
              selectedRoutePlan: null,
              jupiterCpi: null,
            },
          })),

        // Transaction State
        transaction: initialTransactionState,

        setTransactionStatus: (status) =>
          set((state) => ({
            transaction: { ...state.transaction, status },
          })),

        setTransactionSignature: (signature) =>
          set((state) => ({
            transaction: { ...state.transaction, signature },
          })),

        setTransactionError: (error) =>
          set((state) => ({
            transaction: { ...state.transaction, error, status: "failed" },
          })),

        incrementConfirmations: () =>
          set((state) => ({
            transaction: {
              ...state.transaction,
              confirmations: state.transaction.confirmations + 1,
            },
          })),

        resetTransaction: () =>
          set(() => ({
            transaction: initialTransactionState,
          })),

        // History
        transactionHistory: [],

        addToHistory: (tx) =>
          set((state) => ({
            transactionHistory: [tx, ...state.transactionHistory].slice(0, 50), // Keep last 50
          })),

        // Reset
        reset: () =>
          set(() => ({
            swap: initialSwapState,
            routes: initialRouteState,
            transaction: initialTransactionState,
          })),
      }),
      {
        name: "swapback-storage",
        partialize: (state) => ({
          transactionHistory: state.transactionHistory,
          swap: {
            slippageTolerance: state.swap.slippageTolerance,
            useMEVProtection: state.swap.useMEVProtection,
            priorityLevel: state.swap.priorityLevel,
          },
        }),
      }
    )
  )
);
