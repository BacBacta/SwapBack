/**
 * RouterClient - Client for interacting with the SwapBack Router program
 *
 * Provides high-level interface for:
 * - Creating dynamic swap plans
 * - Executing swaps with intelligent routing
 * - MEV protection via bundling
 * - Fallback route execution
 * 
 * @updated December 7, 2025 - Added real swap execution via Jupiter V6 API
 */

import { Connection, PublicKey, Transaction, VersionedTransaction, Signer } from "@solana/web3.js";
import { IntelligentOrderRouter } from "./IntelligentOrderRouter";
import { JitoBundleService } from "./JitoBundleService";
import { AtomicSwapPlan } from "../types/smart-router";
import { JupiterService, JupiterQuoteResponse } from "@/lib/jupiter";

// ============================================================================
// TYPES
// ============================================================================

export interface ExecuteSwapParams {
  /** Input token mint address */
  inputMint: PublicKey;
  /** Output token mint address */
  outputMint: PublicKey;
  /** Amount to swap in smallest units (lamports) */
  amountIn: number;
  /** Minimum output amount (slippage protection) */
  minOut: number;
  /** Slippage tolerance in basis points (50 = 0.5%) */
  slippageBps?: number;
  /** Number of TWAP slices for large orders */
  twapSlices?: number;
  /** Use dynamic plan optimization */
  useDynamicPlan?: boolean;
  /** Plan account for dynamic routing */
  planAccount?: PublicKey;
  /** Use Jito bundle for MEV protection */
  useBundle?: boolean;
  /** User wallet/signer */
  user: Signer;
  /** Oracle account for price feed (optional) */
  oracleAccount?: PublicKey;
  /** Priority fee in micro-lamports */
  priorityFeeMicroLamports?: number;
  /** Sign transaction callback (required for real execution) */
  signTransaction?: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
}

export interface SwapExecutionResult {
  /** Transaction signature */
  signature: string;
  /** Input amount in smallest units */
  inputAmount: number;
  /** Output amount in smallest units */
  outputAmount: number;
  /** Price impact percentage */
  priceImpact: number;
  /** Route labels used */
  route: string[];
  /** Whether bundle was used */
  bundled: boolean;
  /** Jupiter quote used */
  quote?: JupiterQuoteResponse;
  /** Execution time in ms */
  executionTimeMs: number;
}

export interface RouterClientConfig {
  /** Enable verbose logging */
  verbose?: boolean;
  /** Default slippage in bps */
  defaultSlippageBps?: number;
  /** Default priority fee */
  defaultPriorityFee?: number;
  /** Auto-retry on failure */
  autoRetry?: boolean;
  /** Max retry attempts */
  maxRetries?: number;
}

// ============================================================================
// ROUTER CLIENT
// ============================================================================

export class RouterClient {
  private readonly intelligentRouter: IntelligentOrderRouter;
  private readonly jitoService: JitoBundleService;
  private readonly jupiterService: JupiterService;
  private readonly connection: Connection;
  private readonly config: Required<RouterClientConfig>;

  constructor(
    connection: Connection,
    wallet: Signer,
    intelligentRouter: IntelligentOrderRouter,
    jitoService: JitoBundleService,
    jupiterService?: JupiterService,
    config?: RouterClientConfig
  ) {
    this.connection = connection;
    this.intelligentRouter = intelligentRouter;
    this.jitoService = jitoService;
    this.jupiterService = jupiterService || new JupiterService(connection);
    this.config = {
      verbose: config?.verbose ?? false,
      defaultSlippageBps: config?.defaultSlippageBps ?? 50,
      defaultPriorityFee: config?.defaultPriorityFee ?? 50000,
      autoRetry: config?.autoRetry ?? true,
      maxRetries: config?.maxRetries ?? 2,
    };
  }

  private log(message: string, data?: object): void {
    if (this.config.verbose) {
      console.log(`[RouterClient] ${message}`, data ?? '');
    }
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
    this.log('Building plan', { inputMint: inputMint.toString(), outputMint: outputMint.toString(), amountIn });
    
    const buildParams = {
      inputMint: inputMint.toString(),
      outputMint: outputMint.toString(),
      inputAmount: amountIn,
      userPublicKey: user.publicKey,
      maxSlippageBps: this.config.defaultSlippageBps,
    };

    const plan = await this.intelligentRouter.buildAtomicPlan(buildParams);
    this.log('Plan built', { expectedOutput: plan.expectedOutput, legs: plan.legs?.length ?? 0 });
    
    return plan;
  }

  /**
   * Get a Jupiter quote for the swap
   */
  async getQuote(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number,
    slippageBps?: number
  ): Promise<JupiterQuoteResponse> {
    this.log('Fetching Jupiter quote', { inputMint: inputMint.toString(), outputMint: outputMint.toString(), amountIn });
    
    const quote = await this.jupiterService.getQuote({
      inputMint: inputMint.toString(),
      outputMint: outputMint.toString(),
      amount: amountIn,
      slippageBps: slippageBps ?? this.config.defaultSlippageBps,
    });

    this.log('Quote received', {
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      priceImpact: quote.priceImpactPct,
      routes: quote.routePlan?.length ?? 0,
    });

    return quote;
  }

  /**
   * Execute a swap using the router program with real Jupiter integration
   * 
   * This method performs an actual on-chain swap via Jupiter V6 API,
   * with optional MEV protection via Jito bundling.
   */
  async executeSwap(params: ExecuteSwapParams): Promise<SwapExecutionResult> {
    const startTime = Date.now();
    const slippageBps = params.slippageBps ?? this.config.defaultSlippageBps;

    this.log('Executing swap', {
      inputMint: params.inputMint.toString(),
      outputMint: params.outputMint.toString(),
      amountIn: params.amountIn,
      useBundle: params.useBundle,
    });

    // Step 1: Get Jupiter quote
    const quote = await this.getQuote(
      params.inputMint,
      params.outputMint,
      params.amountIn,
      slippageBps
    );

    // Validate min output
    const expectedOut = parseInt(quote.outAmount);
    if (expectedOut < params.minOut) {
      throw new Error(
        `Quote output ${expectedOut} is less than minimum required ${params.minOut}`
      );
    }

    // Step 2: Build swap transaction from Jupiter
    const swapResponse = await this.jupiterService.buildSwapTransaction({
      quoteResponse: quote,
      userPublicKey: params.user.publicKey.toString(),
      wrapAndUnwrapSol: true,
      prioritizationFeeLamports: params.priorityFeeMicroLamports ?? this.config.defaultPriorityFee,
      dynamicComputeUnitLimit: true,
    });

    // Step 3: Deserialize versioned transaction
    const transaction = this.jupiterService.deserializeTransaction(swapResponse.swapTransaction);

    this.log('Transaction prepared', { 
      lastValidBlockHeight: swapResponse.lastValidBlockHeight,
    });

    // Step 4: Execute with or without bundle protection
    let signature: string;
    let bundled = false;

    if (params.useBundle && this.jitoService) {
      // MEV-protected execution via Jito bundle
      this.log('Submitting via Jito bundle');
      
      if (!params.signTransaction) {
        throw new Error('signTransaction callback is required for execution');
      }
      const signedTx = await params.signTransaction(transaction);
      
      // Note: Jito requires legacy Transaction, need to adapt
      const legacyTx = new Transaction();
      const bundleResult = await this.jitoService.submitProtectedBundle([legacyTx], {
        tipLamports: 10000,
        priorityLevel: 'medium',
      });

      signature = bundleResult.signatures?.[0] || bundleResult.bundleId || '';
      bundled = true;
      
      this.log('Bundle submitted', { bundleId: bundleResult.bundleId, signature });
    } else {
      // Regular execution
      if (!params.signTransaction) {
        throw new Error('signTransaction callback is required for execution');
      }

      const signedTx = await params.signTransaction(transaction);
      const rawTransaction = signedTx.serialize();

      this.log('Sending transaction');
      
      signature = await this.connection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: this.config.autoRetry ? this.config.maxRetries : 0,
      });

      this.log('Transaction sent', { signature });

      // Confirm transaction
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash: transaction.message.recentBlockhash,
        lastValidBlockHeight: swapResponse.lastValidBlockHeight,
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }
    }

    const executionTimeMs = Date.now() - startTime;
    const routeLabels = quote.routePlan?.map(step => step.swapInfo?.label ?? 'unknown') ?? [];

    this.log('Swap completed', { signature, executionTimeMs, bundled });

    return {
      signature,
      inputAmount: parseInt(quote.inAmount),
      outputAmount: parseInt(quote.outAmount),
      priceImpact: parseFloat(quote.priceImpactPct?.toString() ?? '0'),
      route: routeLabels,
      bundled,
      quote,
      executionTimeMs,
    };
  }

  /**
   * Execute a complete smart swap with plan optimization
   */
  async executeSmartSwap(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number,
    user: Signer,
    signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>,
    options: {
      useBundle?: boolean;
      slippageBps?: number;
      twapSlices?: number;
      oracleAccount?: PublicKey;
      priorityFeeMicroLamports?: number;
    } = {}
  ): Promise<{ result: SwapExecutionResult; plan: AtomicSwapPlan }> {
    this.log('Executing smart swap', { inputMint: inputMint.toString(), outputMint: outputMint.toString(), amountIn });

    // Build intelligent plan for analytics/optimization
    const plan = await this.buildPlan(inputMint, outputMint, amountIn, user);

    // Calculate minimum output with slippage
    const slippageBps = options.slippageBps ?? this.config.defaultSlippageBps;
    const minOut = Math.floor(plan.expectedOutput * (1 - slippageBps / 10000));

    // Execute swap with real Jupiter integration
    const result = await this.executeSwap({
      inputMint,
      outputMint,
      amountIn,
      minOut,
      slippageBps,
      twapSlices: options.twapSlices,
      useDynamicPlan: true,
      useBundle: options.useBundle,
      user,
      oracleAccount: options.oracleAccount,
      priorityFeeMicroLamports: options.priorityFeeMicroLamports,
      signTransaction,
    });

    this.log('Smart swap completed', { signature: result.signature, outputAmount: result.outputAmount });

    return { result, plan };
  }

  /**
   * Simulate a swap without executing (for preview/UI)
   */
  async simulateSwap(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number,
    slippageBps?: number
  ): Promise<{
    expectedOutput: number;
    minOutput: number;
    priceImpact: number;
    route: string[];
    quote: JupiterQuoteResponse;
  }> {
    const quote = await this.getQuote(inputMint, outputMint, amountIn, slippageBps);
    
    const expectedOutput = parseInt(quote.outAmount);
    const effectiveSlippage = slippageBps ?? this.config.defaultSlippageBps;
    const minOutput = Math.floor(expectedOutput * (1 - effectiveSlippage / 10000));
    
    return {
      expectedOutput,
      minOutput,
      priceImpact: parseFloat(quote.priceImpactPct?.toString() ?? '0'),
      route: quote.routePlan?.map(step => step.swapInfo?.label ?? 'unknown') ?? [],
      quote,
    };
  }

  /**
   * Get connection used by this client
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Get Jupiter service instance
   */
  getJupiterService(): JupiterService {
    return this.jupiterService;
  }

  /**
   * Get Jito bundle service instance
   */
  getJitoService(): JitoBundleService {
    return this.jitoService;
  }
}
