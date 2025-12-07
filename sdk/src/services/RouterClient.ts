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

import { Connection, PublicKey, Transaction, VersionedTransaction, Signer, TransactionInstruction, ComputeBudgetProgram } from "@solana/web3.js";
import { IntelligentOrderRouter } from "./IntelligentOrderRouter";
import { JitoBundleService } from "./JitoBundleService";
import { JupiterService, JupiterQuote } from "./JupiterService";
import { AtomicSwapPlan } from "../types/smart-router";

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
  signTransaction?: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
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
  quote?: JupiterQuote;
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
  ): Promise<JupiterQuote> {
    this.log('Fetching Jupiter quote', { inputMint: inputMint.toString(), outputMint: outputMint.toString(), amountIn });
    
    const quote = await this.jupiterService.getQuote(
      inputMint.toString(),
      outputMint.toString(),
      amountIn,
      slippageBps ?? this.config.defaultSlippageBps
    );

    this.log('Quote received', {
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      priceImpact: quote.priceImpactPct,
      routes: quote.routePlan.length,
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

    // Step 2: Get swap transaction from Jupiter
    const swapResponse = await this.jupiterService.getSwapTransaction(
      quote,
      params.user.publicKey,
      true, // wrap/unwrap SOL
      params.priorityFeeMicroLamports ?? this.config.defaultPriorityFee
    );

    // Step 3: Deserialize and prepare transaction
    const swapTransactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
    let transaction: Transaction;
    
    try {
      transaction = Transaction.from(swapTransactionBuf);
    } catch {
      // Handle versioned transaction by wrapping
      throw new Error(
        'Versioned transaction received. Use executeVersionedSwap() for routes requiring Address Lookup Tables.'
      );
    }

    this.log('Transaction prepared', { 
      instructions: transaction.instructions.length,
      lastValidBlockHeight: swapResponse.lastValidBlockHeight,
    });

    // Step 4: Execute with or without bundle protection
    let signature: string;
    let bundled = false;

    if (params.useBundle && this.jitoService) {
      // MEV-protected execution via Jito bundle
      this.log('Submitting via Jito bundle');
      
      // Sign transaction before bundling
      if (!params.signTransaction) {
        throw new Error('signTransaction callback is required for execution');
      }
      const signedTx = await params.signTransaction(transaction) as Transaction;
      
      const bundleResult = await this.jitoService.submitProtectedBundle([signedTx], {
        tipLamports: 10000, // 0.00001 SOL tip
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

      const signedTx = await params.signTransaction(transaction) as Transaction;
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
        blockhash: transaction.recentBlockhash!,
        lastValidBlockHeight: swapResponse.lastValidBlockHeight,
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }
    }

    const executionTimeMs = Date.now() - startTime;
    const routeLabels = quote.routePlan.map(step => step.swapInfo.label);

    this.log('Swap completed', { signature, executionTimeMs, bundled });

    return {
      signature,
      inputAmount: parseInt(quote.inAmount),
      outputAmount: parseInt(quote.outAmount),
      priceImpact: parseFloat(quote.priceImpactPct),
      route: routeLabels,
      bundled,
      quote,
      executionTimeMs,
    };
  }

  /**
   * Execute a complete smart swap with plan optimization
   * 
   * This combines intelligent route planning with actual execution.
   */
  async executeSmartSwap(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: number,
    user: Signer,
    signTransaction: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>,
    options: {
      useBundle?: boolean;
      slippageBps?: number;
      twapSlices?: number;
      oracleAccount?: PublicKey;
      priorityFeeMicroLamports?: number;
    } = {}
  ): Promise<{ result: SwapExecutionResult; plan: AtomicSwapPlan }> {
    this.log('Executing smart swap', { inputMint: inputMint.toString(), outputMint: outputMint.toString(), amountIn });

    // Step 1: Build intelligent plan for analytics/optimization
    const plan = await this.buildPlan(inputMint, outputMint, amountIn, user);

    // Step 2: Calculate minimum output with slippage
    const slippageBps = options.slippageBps ?? this.config.defaultSlippageBps;
    const minOut = Math.floor(plan.expectedOutput * (1 - slippageBps / 10000));

    // Step 3: Execute swap with real Jupiter integration
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
    quote: JupiterQuote;
  }> {
    const quote = await this.getQuote(inputMint, outputMint, amountIn, slippageBps);
    
    const expectedOutput = parseInt(quote.outAmount);
    const effectiveSlippage = slippageBps ?? this.config.defaultSlippageBps;
    const minOutput = Math.floor(expectedOutput * (1 - effectiveSlippage / 10000));
    
    return {
      expectedOutput,
      minOutput,
      priceImpact: parseFloat(quote.priceImpactPct),
      route: quote.routePlan.map(step => step.swapInfo.label),
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
