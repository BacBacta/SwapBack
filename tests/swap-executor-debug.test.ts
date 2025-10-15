/**
 * Simple SwapExecutor Test
 * Quick test to identify the exact issue
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Keypair } from "@solana/web3.js";
import { SwapExecutor } from "../sdk/src/services/SwapExecutor";

describe("SwapExecutor - Debug", () => {
  it("should create executor without errors", () => {
    const mockConnection = { getLatestBlockhash: vi.fn() };
    const mockLiquidity = { fetchAggregatedLiquidity: vi.fn() };
    const mockOptimizer = { findOptimalRoutes: vi.fn() };
    const mockRouter = { buildPlan: vi.fn(), adjustPlan: vi.fn() };
    const mockOracle = { getTokenPrice: vi.fn() };
    const mockJito = { submitBundle: vi.fn() };
    const mockCircuit = {
      isTripped: vi.fn().mockReturnValue(false),
      recordSuccess: vi.fn(),
      recordFailure: vi.fn(),
      getNextRetryTime: vi.fn().mockReturnValue(null),
    };

    const executor = new SwapExecutor(
      mockConnection as any,
      mockLiquidity as any,
      mockOptimizer as any,
      mockRouter as any,
      mockOracle as any,
      mockJito as any,
      mockCircuit as any
    );

    expect(executor).toBeDefined();
  });

  it("should call isTripped when executing swap", async () => {
    const mockConnection = { getLatestBlockhash: vi.fn() };
    const mockLiquidity = {
      fetchAggregatedLiquidity: vi
        .fn()
        .mockRejectedValue(new Error("Expected")),
    };
    const mockOptimizer = { findOptimalRoutes: vi.fn() };
    const mockRouter = { buildPlan: vi.fn(), adjustPlan: vi.fn() };
    const mockOracle = { getTokenPrice: vi.fn() };
    const mockJito = { submitBundle: vi.fn() };
    const mockCircuit = {
      isTripped: vi.fn().mockReturnValue(true), // Trip circuit
      recordSuccess: vi.fn(),
      recordFailure: vi.fn(),
      getNextRetryTime: vi.fn().mockReturnValue(Date.now() + 60000),
      getState: vi.fn().mockReturnValue("OPEN"),
    };

    const executor = new SwapExecutor(
      mockConnection as any,
      mockLiquidity as any,
      mockOptimizer as any,
      mockRouter as any,
      mockOracle as any,
      mockJito as any,
      mockCircuit as any
    );

    const testKeypair = Keypair.generate();

    try {
      await executor.executeSwap({
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        inputAmount: 1,
        maxSlippageBps: 50,
        userPublicKey: testKeypair.publicKey,
        signer: testKeypair,
      });
    } catch (error: any) {
      // Expected to throw
      console.log("Error:", error.message);
    }

    // Should have checked circuit breaker
    expect(mockCircuit.isTripped).toHaveBeenCalled();
  });
});
