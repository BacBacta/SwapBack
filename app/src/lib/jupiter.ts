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

// Jupiter V6 API base URL
const JUPITER_API_BASE = 'https://quote-api.jup.ag/v6';

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
    const url = new URL(`${JUPITER_API_BASE}/quote`);
    
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

    logger.info('JupiterService', 'Fetching quote', { 
      inputMint: params.inputMint, 
      outputMint: params.outputMint, 
      amount: params.amount 
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('JupiterService', 'Quote request failed', { status: response.status, error: errorText });
      throw new Error(`Jupiter quote failed: ${response.status} - ${errorText}`);
    }

    const quote = await response.json() as JupiterQuoteResponse;
    
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
    const url = `${JUPITER_API_BASE}/swap`;

    logger.info('JupiterService', 'Building swap transaction', { 
      userPublicKey: params.userPublicKey,
      inAmount: params.quoteResponse.inAmount,
      outAmount: params.quoteResponse.outAmount
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
    }
  ): Promise<SwapResult> {
    // 1. Get quote
    const quote = await this.getQuote({
      inputMint,
      outputMint,
      amount,
      slippageBps: options?.slippageBps ?? 100 // 1% default slippage
    });

    // 2. Build swap transaction
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

    // 5. Send transaction
    const rawTransaction = signedTransaction.serialize();
    
    const signature = await this.connection.sendRawTransaction(rawTransaction, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3
    });

    logger.info('JupiterService', 'Transaction sent', { signature });

    // 6. Confirm transaction
    const confirmation = await this.connection.confirmTransaction({
      signature,
      blockhash: transaction.message.recentBlockhash,
      lastValidBlockHeight: swapResponse.lastValidBlockHeight
    }, 'confirmed');

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
