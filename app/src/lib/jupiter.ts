/**
 * 🪐 Jupiter Swap Service for DCA
 * 
 * Service pour exécuter des swaps via Jupiter V6 API
 * Utilisé par le système DCA pour les exécutions automatiques
 * 
 * @author SwapBack Team
 * @date November 29, 2025 - Phase 2 Implementation
 */

import { Connection, PublicKey, VersionedTransaction, TransactionInstruction } from '@solana/web3.js';
import { logger } from '@/lib/logger';

// Jupiter V6 API - Use local proxy to avoid CORS issues in browser
const JUPITER_API_BASE = typeof window !== 'undefined' 
  ? '/api/swap'  // Browser: use Next.js API proxy
  : 'https://public.jupiterapi.com'; // Server-side: direct access (public.jupiterapi.com resolves better)

// ============================================================================
// TYPES
// ============================================================================

export interface JupiterQuoteRequest {
  inputMint: string;
  outputMint: string;
  amount: number; // in lamports
  slippageBps?: number;
  swapMode?: 'ExactIn' | 'ExactOut';
  onlyDirectRoutes?: boolean;
  asLegacyTransaction?: boolean;
  maxAccounts?: number;
}

export interface JupiterRoutePlanStep {
  swapInfo: {
    ammKey: string;
    label: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount: string;
    feeMint: string;
  };
  percent: number;
}

export interface JupiterQuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: 'ExactIn' | 'ExactOut';
  slippageBps: number;
  priceImpactPct: string;
  routePlan: JupiterRoutePlanStep[];
  contextSlot: number;
  timeTaken: number;
}

export interface JupiterSwapRequest {
  quoteResponse: JupiterQuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  useSharedAccounts?: boolean;
  feeAccount?: string;
  trackingAccount?: string;
  computeUnitPriceMicroLamports?: number;
  prioritizationFeeLamports?: number | 'auto';
  asLegacyTransaction?: boolean;
  useTokenLedger?: boolean;
  destinationTokenAccount?: string;
  dynamicComputeUnitLimit?: boolean;
  skipUserAccountsRpcCalls?: boolean;
}

export interface JupiterSwapResponse {
  swapTransaction: string; // Base64 encoded transaction
  lastValidBlockHeight: number;
  prioritizationFeeLamports?: number;
  computeUnitLimit?: number;
  prioritizationType?: {
    computeBudget: {
      microLamports: number;
      estimatedMicroLamports: number;
    };
  };
  dynamicSlippageReport?: {
    slippageBps: number;
    otherAmount: number;
    simulatedIncurredSlippageBps: number;
    amplificationRatio: string;
  };
  simulationError?: string;
}

export interface SwapResult {
  signature: string;
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  route: string[];
}

// ============================================================================
// JUPITER SERVICE
// ============================================================================

export class JupiterService {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Récupère une quote Jupiter pour un swap
   */
  async getQuote(params: JupiterQuoteRequest): Promise<JupiterQuoteResponse> {
    const isBrowser = typeof window !== 'undefined';
    
    logger.info('JupiterService', 'Fetching quote', { 
      inputMint: params.inputMint, 
      outputMint: params.outputMint, 
      amount: params.amount,
      isBrowser
    });

    let response: Response;

    if (isBrowser) {
      // Browser: use POST to Next.js API proxy to avoid CORS
      response = await fetch('/api/swap/quote', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json' 
        },
        body: JSON.stringify({
          inputMint: params.inputMint,
          outputMint: params.outputMint,
          amount: params.amount,
          slippageBps: params.slippageBps ?? 50,
          swapMode: params.swapMode ?? 'ExactIn',
          onlyDirectRoutes: params.onlyDirectRoutes,
          asLegacyTransaction: params.asLegacyTransaction,
          maxAccounts: params.maxAccounts,
        }),
      });
    } else {
      // Server-side: direct GET to Jupiter API (public.jupiterapi.com resolves better)
      const url = new URL('https://public.jupiterapi.com/quote');
      url.searchParams.set('inputMint', params.inputMint);
      url.searchParams.set('outputMint', params.outputMint);
      url.searchParams.set('amount', params.amount.toString());
      url.searchParams.set('slippageBps', (params.slippageBps ?? 50).toString());
      url.searchParams.set('swapMode', params.swapMode ?? 'ExactIn');
      
      if (params.onlyDirectRoutes !== undefined) {
        url.searchParams.set('onlyDirectRoutes', params.onlyDirectRoutes.toString());
      }
      if (params.asLegacyTransaction !== undefined) {
        url.searchParams.set('asLegacyTransaction', params.asLegacyTransaction.toString());
      }
      if (params.maxAccounts !== undefined) {
        url.searchParams.set('maxAccounts', params.maxAccounts.toString());
      }

      response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('JupiterService', 'Quote request failed', { status: response.status, error: errorText });
      throw new Error(`Jupiter quote failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Handle response from our API proxy (wraps quote in { success, quote })
    const quote: JupiterQuoteResponse = data.quote || data;
    
    if (!quote.inAmount || !quote.outAmount) {
      logger.error('JupiterService', 'Invalid quote response', { data });
      throw new Error('Invalid quote response from Jupiter');
    }
    
    logger.info('JupiterService', 'Quote received', { 
      inAmount: quote.inAmount, 
      outAmount: quote.outAmount,
      priceImpact: quote.priceImpactPct 
    });

    return quote;
  }

  /**
   * Construit une transaction de swap depuis une quote
   */
  async buildSwapTransaction(params: JupiterSwapRequest): Promise<JupiterSwapResponse> {
    const isBrowser = typeof window !== 'undefined';
    const url = isBrowser ? '/api/swap/transaction' : 'https://public.jupiterapi.com/swap';

    logger.info('JupiterService', 'Building swap transaction', { 
      userPublicKey: params.userPublicKey,
      inAmount: params.quoteResponse.inAmount,
      outAmount: params.quoteResponse.outAmount,
      isBrowser
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        quoteResponse: params.quoteResponse,
        userPublicKey: params.userPublicKey,
        wrapAndUnwrapSol: params.wrapAndUnwrapSol ?? true,
        useSharedAccounts: params.useSharedAccounts ?? true,
        feeAccount: params.feeAccount,
        trackingAccount: params.trackingAccount,
        computeUnitPriceMicroLamports: params.computeUnitPriceMicroLamports,
        prioritizationFeeLamports: params.prioritizationFeeLamports ?? 'auto',
        asLegacyTransaction: params.asLegacyTransaction ?? false,
        useTokenLedger: params.useTokenLedger ?? false,
        destinationTokenAccount: params.destinationTokenAccount,
        dynamicComputeUnitLimit: params.dynamicComputeUnitLimit ?? true,
        skipUserAccountsRpcCalls: params.skipUserAccountsRpcCalls ?? false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('JupiterService', 'Swap transaction build failed', { status: response.status, error: errorText });
      throw new Error(`Jupiter swap build failed: ${response.status} - ${errorText}`);
    }

    const swapResponse = await response.json() as JupiterSwapResponse;

    if (swapResponse.simulationError) {
      logger.warn('JupiterService', 'Simulation warning', { error: swapResponse.simulationError });
    }

    logger.info('JupiterService', 'Swap transaction built successfully');

    return swapResponse;
  }

  /**
   * Désérialise une transaction versionnée depuis base64
   */
  deserializeTransaction(base64Transaction: string): VersionedTransaction {
    const buffer = Buffer.from(base64Transaction, 'base64');
    return VersionedTransaction.deserialize(buffer);
  }

  /**
   * Exécute un swap complet : quote → build → sign → send
   * Avec retry automatique en cas d'expiration du blockhash
   */
  async executeSwap(
    inputMint: string,
    outputMint: string,
    amount: number,
    userPublicKey: string,
    signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>,
    options?: {
      slippageBps?: number;
      priorityFee?: number | 'auto';
      maxRetries?: number;
    }
  ): Promise<SwapResult> {
    const maxRetries = options?.maxRetries ?? 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logger.info('JupiterService', `Retry attempt ${attempt}/${maxRetries}`);
        }

        // 1. Get fresh quote for each attempt
        const quote = await this.getQuote({
          inputMint,
          outputMint,
          amount,
          slippageBps: options?.slippageBps ?? 100 // 1% default slippage
        });

        // 2. Build swap transaction with fresh blockhash
        const swapResponse = await this.buildSwapTransaction({
          quoteResponse: quote,
          userPublicKey,
          prioritizationFeeLamports: options?.priorityFee ?? 'auto',
          dynamicComputeUnitLimit: true
        });

        // 3. Deserialize transaction
        const transaction = this.deserializeTransaction(swapResponse.swapTransaction);

        // 4. Sign transaction
        const signedTransaction = await signTransaction(transaction);

        // 5. Send transaction with optimized settings
        const rawTransaction = signedTransaction.serialize();
        
        const signature = await this.connection.sendRawTransaction(rawTransaction, {
          skipPreflight: true, // Skip preflight for faster submission
          preflightCommitment: 'processed',
          maxRetries: 0 // We handle retries ourselves
        });

        logger.info('JupiterService', 'Transaction sent', { signature, attempt });

        // 6. Confirm transaction with timeout
        const confirmationPromise = this.connection.confirmTransaction({
          signature,
          blockhash: transaction.message.recentBlockhash,
          lastValidBlockHeight: swapResponse.lastValidBlockHeight
        }, 'confirmed');

        // Add a 60 second timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Transaction confirmation timeout')), 60000);
        });

        const confirmation = await Promise.race([confirmationPromise, timeoutPromise]);

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }

        logger.info('JupiterService', 'Swap completed successfully', { signature });

        // Extract route labels
        const routeLabels = quote.routePlan.map(step => step.swapInfo.label);

        return {
          signature,
          inputAmount: parseInt(quote.inAmount),
          outputAmount: parseInt(quote.outAmount),
          priceImpact: parseFloat(quote.priceImpactPct),
          route: routeLabels
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMessage = lastError.message;

        // Retry only on blockhash expiration or timeout errors
        const isRetryable = 
          errorMessage.includes('block height exceeded') ||
          errorMessage.includes('blockhash not found') ||
          errorMessage.includes('Blockhash not found') ||
          errorMessage.includes('confirmation timeout') ||
          errorMessage.includes('Transaction confirmation timeout');

        if (isRetryable && attempt < maxRetries) {
          logger.warn('JupiterService', `Retryable error, will retry`, { 
            error: errorMessage, 
            attempt,
            maxRetries 
          });
          // Small delay before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        // Not retryable or max retries reached
        throw lastError;
      }
    }

    // Should not reach here, but just in case
    throw lastError || new Error('Swap failed after all retries');
  }

  /**
   * Vérifie la santé de l'API Jupiter
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${JUPITER_API_BASE}/health`, { method: 'GET' });
      return response.ok;
    } catch (error) {
      logger.error('JupiterService', 'Health check failed', error);
      return false;
    }
  }

  /**
   * Récupère les tokens supportés par Jupiter
   */
  async getSupportedTokens(): Promise<string[]> {
    try {
      const response = await fetch('https://token.jup.ag/strict', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tokens: ${response.status}`);
      }

      const tokens = await response.json() as Array<{ address: string }>;
      return tokens.map(t => t.address);
    } catch (error) {
      logger.error('JupiterService', 'Failed to get supported tokens', error);
      return [];
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let jupiterServiceInstance: JupiterService | null = null;

export function getJupiterService(connection: Connection): JupiterService {
  if (!jupiterServiceInstance) {
    jupiterServiceInstance = new JupiterService(connection);
  }
  return jupiterServiceInstance;
}
