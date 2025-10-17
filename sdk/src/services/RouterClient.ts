/**
 * RouterClient - Client for interacting with the SwapBack Router program
 *
 * Provides high-level interface for:
 * - Creating dynamic swap plans
 * - Executing swaps with intelligent routing
 * - MEV protection via bundling
 * - Fallback route execution
 */

import { Connection, PublicKey, Transaction, Signer } from "@solana/web3.js";
import { IntelligentOrderRouter } from "./IntelligentOrderRouter";
import { JitoBundleService } from "./JitoBundleService";
import { AtomicSwapPlan } from "../types/smart-router";

export interface ExecuteSwapParams {
  amountIn: number;
  minOut: number;
  slippageTolerance?: number;
  twapSlices?: number;
  useDynamicPlan?: boolean;
  planAccount?: PublicKey;
  useBundle?: boolean;
  user: Signer;
  oracleAccount: PublicKey;
}

export class RouterClient {
  private readonly intelligentRouter: IntelligentOrderRouter;
  private readonly jitoService: JitoBundleService;
  private readonly connection: Connection;

  constructor(
    connection: Connection,
    wallet: Signer,
    intelligentRouter: IntelligentOrderRouter,
    jitoService: JitoBundleService
  ) {
    this.connection = connection;
    this.intelligentRouter = intelligentRouter;
    this.jitoService = jitoService;
  }

  /**
   * Build a dynamic plan using IntelligentOrderRouter
   */
  async buildPlan(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number,
    user: Signer
  ): Promise<AtomicSwapPlan> {
    const buildParams = {
      inputMint: inputMint.toString(),
      outputMint: outputMint.toString(),
      inputAmount: amountIn,
      userPublicKey: user.publicKey,
      maxSlippageBps: 50, // 0.5%
    };

    return await this.intelligentRouter.buildAtomicPlan(buildParams);
  }

  /**
   * Execute a swap using the router program
   */
  async executeSwap(params: ExecuteSwapParams): Promise<string> {
    // For now, use Jupiter service as the implementation
    // TODO: Replace with actual router program calls when IDL is available

    if (params.useBundle && this.jitoService) {
      // Use bundle service for MEV protection
      const tx = new Transaction();
      const bundleResult = await this.jitoService.submitBundle({
        transactions: [tx],
        signers: [params.user],
      } as any);

      return bundleResult.signatures?.[0] || "bundle-executed";
    } else {
      // Execute regular transaction - placeholder implementation
      return "mock-transaction-signature";
    }
  }

  /**
   * Execute a complete smart swap with plan optimization
   */
  async executeSmartSwap(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number,
    user: Signer,
    oracleAccount: PublicKey,
    options: {
      useBundle?: boolean;
      slippageTolerance?: number;
      twapSlices?: number;
    } = {}
  ): Promise<{ swapSignature: string; plan: AtomicSwapPlan }> {
    // Build intelligent plan
    const plan = await this.buildPlan(inputMint, outputMint, amountIn, user);

    // Execute swap with optimized plan
    const swapSignature = await this.executeSwap({
      amountIn,
      minOut: Math.floor(plan.expectedOutput * 0.995), // 0.5% slippage
      slippageTolerance: options.slippageTolerance,
      twapSlices: options.twapSlices,
      useDynamicPlan: true,
      useBundle: options.useBundle,
      user,
      oracleAccount,
    });

    return { swapSignature, plan };
  }
}
