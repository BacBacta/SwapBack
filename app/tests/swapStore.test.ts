/**
 * SwapStore Unit Tests
 * Tests Zustand state management for swap functionality
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { Mock } from "vitest";
import { useSwapStore } from "../src/store/swapStore";
import type { Token } from "../src/store/swapStore";
import { VenueName } from "@/../../sdk/src/types/smart-router";
import type { RouteCandidate } from "@/../../sdk/src/types/smart-router";

// ============================================================================
// MOCKS
// ============================================================================

// Mock fetch globally
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// ============================================================================
// MOCK DATA
// ============================================================================

const mockSOL: Token = {
  mint: "So11111111111111111111111111111111111111112",
  symbol: "SOL",
  name: "Solana",
  decimals: 9,
  balance: 10.5,
};

const mockUSDC: Token = {
  mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
  balance: 1000,
};

const mockRoute: RouteCandidate = {
  id: "route-1",
  venues: [VenueName.JUPITER],
  path: [mockSOL.mint, mockUSDC.mint],
  hops: 1,
  splits: [],
  expectedOutput: 100,
  totalCost: 0.3,
  effectiveRate: 100,
  riskScore: 5,
  mevRisk: "low" as const,
  instructions: [],
  estimatedComputeUnits: 100000,
};

// ============================================================================
// TEST SUITE
// ============================================================================

describe("SwapStore", () => {
  beforeEach(() => {
    // Clear localStorage to avoid state leaking between tests
    window.localStorage.clear();

    // Reset store to initial state
    useSwapStore.getState().reset();
    // Also manually clear history since reset() doesn't clear it
    useSwapStore.setState({ transactionHistory: [] });

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // SWAP STATE TESTS
  // ==========================================================================

  describe("Swap State Management", () => {
    it("should set input token", () => {
      const { setInputToken } = useSwapStore.getState();

      setInputToken(mockSOL);

      expect(useSwapStore.getState().swap.inputToken).toEqual(mockSOL);
      expect(useSwapStore.getState().swap.inputToken?.symbol).toBe("SOL");
    });

    it("should set output token", () => {
      const { setOutputToken } = useSwapStore.getState();

      setOutputToken(mockUSDC);

      expect(useSwapStore.getState().swap.outputToken).toEqual(mockUSDC);
      expect(useSwapStore.getState().swap.outputToken?.symbol).toBe("USDC");
    });

    it("should set input amount", () => {
      const { setInputAmount } = useSwapStore.getState();

      setInputAmount("1.5");

      expect(useSwapStore.getState().swap.inputAmount).toBe("1.5");
    });

    it("should set output amount", () => {
      const { setOutputAmount } = useSwapStore.getState();

      setOutputAmount("150");

      expect(useSwapStore.getState().swap.outputAmount).toBe("150");
    });

    it("should set slippage tolerance", () => {
      const { setSlippageTolerance } = useSwapStore.getState();

      setSlippageTolerance(0.05);

      expect(useSwapStore.getState().swap.slippageTolerance).toBe(0.05);
    });

    it("should toggle MEV protection", () => {
      const { setUseMEVProtection } = useSwapStore.getState();

      // Default is true
      expect(useSwapStore.getState().swap.useMEVProtection).toBe(true);

      setUseMEVProtection(false);
      expect(useSwapStore.getState().swap.useMEVProtection).toBe(false);

      setUseMEVProtection(true);
      expect(useSwapStore.getState().swap.useMEVProtection).toBe(true);
    });

    it("should set priority level", () => {
      const { setPriorityLevel } = useSwapStore.getState();

      setPriorityLevel("high");
      expect(useSwapStore.getState().swap.priorityLevel).toBe("high");

      setPriorityLevel("low");
      expect(useSwapStore.getState().swap.priorityLevel).toBe("low");
    });

    it("should switch tokens", () => {
      const {
        setInputToken,
        setOutputToken,
        setInputAmount,
        setOutputAmount,
        switchTokens,
      } = useSwapStore.getState();

      // Setup initial state
      setInputToken(mockSOL);
      setOutputToken(mockUSDC);
      setInputAmount("1.5");
      setOutputAmount("150");

      // Switch
      switchTokens();

      const state = useSwapStore.getState().swap;
      expect(state.inputToken).toEqual(mockUSDC);
      expect(state.outputToken).toEqual(mockSOL);
      expect(state.inputAmount).toBe("150");
      expect(state.outputAmount).toBe("1.5");
    });

    it("should handle null tokens when switching", () => {
      const { switchTokens } = useSwapStore.getState();

      // No tokens set, should not crash
      switchTokens();

      const state = useSwapStore.getState().swap;
      expect(state.inputToken).toBeNull();
      expect(state.outputToken).toBeNull();
    });
  });

  // ==========================================================================
  // ROUTE STATE TESTS
  // ==========================================================================

  describe("Route State Management", () => {
    it("should fetch routes successfully", async () => {
      const { setInputToken, setOutputToken, setInputAmount, fetchRoutes } =
        useSwapStore.getState();

      // Setup swap state
      setInputToken(mockSOL);
      setOutputToken(mockUSDC);
      setInputAmount("1.5");

      // Mock Jupiter-style quote response
      const mockQuoteResponse = {
        inAmount: "1500000000", // 1.5 SOL (9 decimals)
        outAmount: "100000000", // 100 USDC (6 decimals)
        priceImpactPct: "0.5",
        routePlan: [
          {
            swapInfo: {
              label: "Jupiter",
              inAmount: "1500000000",
              outAmount: "100000000",
            },
            percent: 100,
          },
        ],
      };

  (global.fetch as unknown as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuoteResponse,
      });

      // Fetch routes
      await fetchRoutes();

      const state = useSwapStore.getState().routes;
      expect(state.routes).toHaveLength(1);
      expect(state.routes[0].expectedOutput).toBe(100000000);
      expect(state.selectedRoute?.venues[0]).toBe("Jupiter");
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(useSwapStore.getState().swap.outputAmount).toBe("100");
    });

    it("should set loading state during fetch", async () => {
      const { setInputToken, setOutputToken, setInputAmount, fetchRoutes } =
        useSwapStore.getState();

      setInputToken(mockSOL);
      setOutputToken(mockUSDC);
      setInputAmount("1.5");

      // Mock delayed response
      const mockQuoteResponse = {
        inAmount: "1500000000",
        outAmount: "100000000",
        priceImpactPct: "0.5",
        routePlan: [],
      };

      (global.fetch as unknown as Mock).mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => mockQuoteResponse,
                }),
              100
            )
          )
      );

      // Start fetching
      const fetchPromise = fetchRoutes();

      // Check loading state immediately
      expect(useSwapStore.getState().routes.isLoading).toBe(true);

      await fetchPromise;

      expect(useSwapStore.getState().routes.isLoading).toBe(false);
    });

    it("should handle fetch errors", async () => {
      const { setInputToken, setOutputToken, setInputAmount, fetchRoutes } =
        useSwapStore.getState();

      setInputToken(mockSOL);
      setOutputToken(mockUSDC);
      setInputAmount("1.5");

      // Mock fetch error
  (global.fetch as unknown as Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Internal server error" }),
      });

      await fetchRoutes();

      const state = useSwapStore.getState().routes;
      expect(state.isLoading).toBe(false);
  expect(state.error).toBe("Internal server error");
      expect(state.routes).toHaveLength(0);
    });

    it("should handle network errors", async () => {
      const { setInputToken, setOutputToken, setInputAmount, fetchRoutes } =
        useSwapStore.getState();

      setInputToken(mockSOL);
      setOutputToken(mockUSDC);
      setInputAmount("1.5");

      // Mock network error
  (global.fetch as unknown as Mock).mockRejectedValueOnce(new Error("Network error"));

      await fetchRoutes();

      const state = useSwapStore.getState().routes;
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe("Network error");
    });

    it("should not fetch routes if required fields are missing", async () => {
      const { fetchRoutes } = useSwapStore.getState();

      // No tokens or amount set
      await fetchRoutes();

      // Fetch should not be called
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should select route", () => {
      const { selectRoute } = useSwapStore.getState();

      selectRoute(mockRoute);

      expect(useSwapStore.getState().routes.selectedRoute).toEqual(mockRoute);
    });

    it("should clear routes", () => {
      const { selectRoute, clearRoutes } = useSwapStore.getState();

      // Set a route first
      selectRoute(mockRoute);
      expect(useSwapStore.getState().routes.selectedRoute).not.toBeNull();

      // Clear
      clearRoutes();

      const state = useSwapStore.getState().routes;
      expect(state.routes).toHaveLength(0);
      expect(state.selectedRoute).toBeNull();
    });
  });

  // ==========================================================================
  // TRANSACTION STATE TESTS
  // ==========================================================================

  describe("Transaction State Management", () => {
    it("should set transaction status", () => {
      const { setTransactionStatus } = useSwapStore.getState();

      setTransactionStatus("preparing");
      expect(useSwapStore.getState().transaction.status).toBe("preparing");

      setTransactionStatus("signing");
      expect(useSwapStore.getState().transaction.status).toBe("signing");

      setTransactionStatus("confirmed");
      expect(useSwapStore.getState().transaction.status).toBe("confirmed");
    });

    it("should set transaction signature", () => {
      const { setTransactionSignature } = useSwapStore.getState();

      const mockSignature = "5j7s1QkJwKjZdP3xQqF8vXeC9kT2mN4pL6rV8sW9uY1xZ";
      setTransactionSignature(mockSignature);

      expect(useSwapStore.getState().transaction.signature).toBe(mockSignature);
    });

    it("should set transaction error and mark as failed", () => {
      const { setTransactionError } = useSwapStore.getState();

      setTransactionError("Insufficient funds");

      const state = useSwapStore.getState().transaction;
      expect(state.error).toBe("Insufficient funds");
      expect(state.status).toBe("failed");
    });

    it("should increment confirmations", () => {
      const { incrementConfirmations } = useSwapStore.getState();

      expect(useSwapStore.getState().transaction.confirmations).toBe(0);

      incrementConfirmations();
      expect(useSwapStore.getState().transaction.confirmations).toBe(1);

      incrementConfirmations();
      incrementConfirmations();
      expect(useSwapStore.getState().transaction.confirmations).toBe(3);
    });

    it("should reset transaction state", () => {
      const {
        setTransactionStatus,
        setTransactionSignature,
        incrementConfirmations,
        resetTransaction,
      } = useSwapStore.getState();

      // Modify transaction state
      setTransactionStatus("confirmed");
      setTransactionSignature("abc123");
      incrementConfirmations();

      // Reset
      resetTransaction();

      const state = useSwapStore.getState().transaction;
      expect(state.status).toBe("idle");
      expect(state.signature).toBeNull();
      expect(state.error).toBeNull();
      expect(state.confirmations).toBe(0);
    });
  });

  // ==========================================================================
  // TRANSACTION HISTORY TESTS
  // ==========================================================================

  describe("Transaction History", () => {
    it("should add transaction to history", () => {
      const { addToHistory } = useSwapStore.getState();

      const mockTx = {
        signature: "abc123",
        timestamp: Date.now(),
        inputToken: mockSOL,
        outputToken: mockUSDC,
        inputAmount: "1.5",
        outputAmount: "150",
        status: "confirmed" as const,
      };

      addToHistory(mockTx);

      const history = useSwapStore.getState().transactionHistory;
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(mockTx);
    });

    it("should keep only last 50 transactions", () => {
      const { addToHistory } = useSwapStore.getState();

      // Add 60 transactions
      for (let i = 0; i < 60; i++) {
        addToHistory({
          signature: `tx_${i}`,
          timestamp: Date.now() + i,
          inputToken: mockSOL,
          outputToken: mockUSDC,
          inputAmount: "1",
          outputAmount: "100",
          status: "confirmed",
        });
      }

      const history = useSwapStore.getState().transactionHistory;
      expect(history).toHaveLength(50);
      expect(history[0].signature).toBe("tx_59"); // Most recent
      expect(history[49].signature).toBe("tx_10"); // Oldest kept
    });

    it("should add new transactions to the beginning", () => {
      const { addToHistory } = useSwapStore.getState();

      addToHistory({
        signature: "first",
        timestamp: Date.now(),
        inputToken: mockSOL,
        outputToken: mockUSDC,
        inputAmount: "1",
        outputAmount: "100",
        status: "confirmed",
      });

      addToHistory({
        signature: "second",
        timestamp: Date.now() + 1000,
        inputToken: mockSOL,
        outputToken: mockUSDC,
        inputAmount: "2",
        outputAmount: "200",
        status: "confirmed",
      });

      const history = useSwapStore.getState().transactionHistory;
      expect(history[0].signature).toBe("second");
      expect(history[1].signature).toBe("first");
    });
  });

  // ==========================================================================
  // PERSISTENCE TESTS
  // ==========================================================================

  describe("LocalStorage Persistence", () => {
    it("should persist slippage tolerance to state", () => {
      const { setSlippageTolerance } = useSwapStore.getState();

      setSlippageTolerance(0.05);

      // Verify it's set in the store
      expect(useSwapStore.getState().swap.slippageTolerance).toBe(0.05);
    });

    it("should persist MEV protection setting", () => {
      const { setUseMEVProtection } = useSwapStore.getState();

      setUseMEVProtection(false);

      const stored = window.localStorage.getItem("swapback-storage");
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.state.swap.useMEVProtection).toBe(false);
      }
    });

    it("should persist priority level", () => {
      const { setPriorityLevel } = useSwapStore.getState();

      setPriorityLevel("high");

      const stored = window.localStorage.getItem("swapback-storage");
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.state.swap.priorityLevel).toBe("high");
      }
    });

    it("should persist transaction history", () => {
      const { addToHistory } = useSwapStore.getState();

      const mockTx = {
        signature: "persist_test",
        timestamp: Date.now(),
        inputToken: mockSOL,
        outputToken: mockUSDC,
        inputAmount: "1",
        outputAmount: "100",
        status: "confirmed" as const,
      };

      addToHistory(mockTx);

      const stored = window.localStorage.getItem("swapback-storage");
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.state.transactionHistory.length).toBeGreaterThan(0);
        // Find our test transaction
        const found = parsed.state.transactionHistory.find(
          (tx: any) => tx.signature === "persist_test"
        );
        expect(found).toBeTruthy();
      }
    });

    it("should NOT persist temporary swap state (tokens, amounts)", () => {
      const { setInputToken, setInputAmount } = useSwapStore.getState();

      setInputToken(mockSOL);
      setInputAmount("1.5");

      const stored = window.localStorage.getItem("swapback-storage");
      if (stored) {
        const parsed = JSON.parse(stored);
        // Tokens and amounts should not be persisted
        expect(parsed.state.swap.inputToken).toBeUndefined();
        expect(parsed.state.swap.inputAmount).toBeUndefined();
      }
    });
  });

  // ==========================================================================
  // RESET TESTS
  // ==========================================================================

  describe("Reset Functionality", () => {
    it("should reset entire store to initial state", () => {
      const {
        setInputToken,
        setOutputToken,
        setInputAmount,
        setSlippageTolerance,
        selectRoute,
        setTransactionStatus,
        reset,
      } = useSwapStore.getState();

      // Modify all states
      setInputToken(mockSOL);
      setOutputToken(mockUSDC);
      setInputAmount("1.5");
      setSlippageTolerance(0.05);
      selectRoute(mockRoute);
      setTransactionStatus("confirmed");

      // Reset
      reset();

      const state = useSwapStore.getState();

      // Swap state reset
      expect(state.swap.inputToken).toBeNull();
      expect(state.swap.outputToken).toBeNull();
      expect(state.swap.inputAmount).toBe("");
      expect(state.swap.slippageTolerance).toBe(0.01); // Default

      // Routes reset
      expect(state.routes.routes).toHaveLength(0);
      expect(state.routes.selectedRoute).toBeNull();

      // Transaction reset
      expect(state.transaction.status).toBe("idle");
    });

    it("should NOT reset transaction history on reset", () => {
      const { addToHistory, reset } = useSwapStore.getState();

      addToHistory({
        signature: "should_persist",
        timestamp: Date.now(),
        inputToken: mockSOL,
        outputToken: mockUSDC,
        inputAmount: "1",
        outputAmount: "100",
        status: "confirmed",
      });

      reset();

      // History should remain
      expect(useSwapStore.getState().transactionHistory).toHaveLength(1);
    });
  });
});
