/**
 * Jupiter Real Integration - TODO #3
 * 
 * Implémentation réelle de l'API Jupiter v6 pour le smart routing
 */

import { createJupiterApiClient, QuoteGetRequest, QuoteResponse } from '@jup-ag/api';
import {
  Connection,
  PublicKey,
  VersionedTransaction,
  Keypair,
} from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

export interface JupiterQuoteParams {
  inputMint: PublicKey;
  outputMint: PublicKey;
  amount: BN;
  slippageBps?: number;
  onlyDirectRoutes?: boolean;
  asLegacyTransaction?: boolean;
}

export interface JupiterSwapResult {
  signature: string;
  inputAmount: BN;
  outputAmount: BN;
  priceImpact: number;
  route: RouteInfo[];
}

export interface RouteInfo {
  marketName: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  feeAmount: string;
}

export class JupiterRealIntegration {
  private readonly connection: Connection;
  private readonly jupiterApi: ReturnType<typeof createJupiterApiClient>;
  private readonly wallet: Keypair;

  constructor(connection: Connection, wallet: Keypair) {
    this.connection = connection;
    this.wallet = wallet;
    this.jupiterApi = createJupiterApiClient();
  }

  /**
   * Obtenir un quote de Jupiter pour un swap
   */
  async getQuote(params: JupiterQuoteParams): Promise<QuoteResponse> {
    try {
      const quoteRequest: QuoteGetRequest = {
        inputMint: params.inputMint.toBase58(),
        outputMint: params.outputMint.toBase58(),
        amount: params.amount.toNumber(),
        slippageBps: params.slippageBps || 50,
        onlyDirectRoutes: params.onlyDirectRoutes || false,
        asLegacyTransaction: params.asLegacyTransaction || false,
      };

      const quote = await this.jupiterApi.quoteGet(quoteRequest);

      if (!quote) {
        throw new Error('No quote available from Jupiter');
      }

      console.log('✅ Jupiter quote received:', {
        inputAmount: quote.inAmount,
        outputAmount: quote.outAmount,
        priceImpactPct: quote.priceImpactPct,
        routePlan: quote.routePlan.length
      });

      return quote;
    } catch (error) {
      console.error('❌ Jupiter quote error:', error);
      throw new Error(`Jupiter API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Construire la transaction de swap depuis un quote
   */
  async buildSwapTransaction(
    quote: QuoteResponse,
    userPublicKey?: PublicKey
  ): Promise<VersionedTransaction> {
    try {
      const swapRequest = {
        userPublicKey: (userPublicKey || this.wallet.publicKey).toBase58(),
        quoteResponse: quote,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto' as any,  // Use auto mode
      };

      const swapResponse = await this.jupiterApi.swapPost({ swapRequest });

      if (!swapResponse.swapTransaction) {
        throw new Error('No swap transaction returned from Jupiter');
      }

      const swapTransactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

      console.log('✅ Jupiter swap transaction built');

      return transaction;
    } catch (error) {
      console.error('❌ Jupiter build swap error:', error);
      throw new Error(`Failed to build swap transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Exécuter un swap complet (quote + build + send)
   */
  async executeSwap(
    params: JupiterQuoteParams,
    options?: {
      userPublicKey?: PublicKey;
      skipPreflight?: boolean;
      maxRetries?: number;
    }
  ): Promise<JupiterSwapResult> {
    const startTime = Date.now();

    try {
      console.log('🔍 Fetching Jupiter quote...');
      const quote = await this.getQuote(params);

      console.log('🔨 Building swap transaction...');
      const transaction = await this.buildSwapTransaction(
        quote,
        options?.userPublicKey
      );

      console.log('✍️ Signing transaction...');
      transaction.sign([this.wallet]);

      console.log('📡 Sending transaction to Solana...');
      const signature = await this.connection.sendTransaction(transaction, {
        skipPreflight: options?.skipPreflight || false,
        maxRetries: options?.maxRetries || 3,
      });

      console.log('⏳ Confirming transaction...');
      await this.connection.confirmTransaction(signature, 'confirmed');

      const duration = Date.now() - startTime;

      const result: JupiterSwapResult = {
        signature,
        inputAmount: new BN(quote.inAmount),
        outputAmount: new BN(quote.outAmount),
        priceImpact: Number.parseFloat(quote.priceImpactPct),
        route: quote.routePlan.map(step => ({
          marketName: step.swapInfo.label || 'Unknown',
          inputMint: step.swapInfo.inputMint,
          outputMint: step.swapInfo.outputMint,
          inAmount: step.swapInfo.inAmount,
          outAmount: step.swapInfo.outAmount,
          feeAmount: step.swapInfo.feeAmount,
        }))
      };

      console.log(`✅ Swap executed successfully in ${duration}ms`);
      console.log(`   Signature: ${signature}`);

      return result;
    } catch (error) {
      console.error('❌ Jupiter swap execution failed:', error);
      throw error;
    }
  }

  /**
   * Simuler un swap avant exécution
   */
  async simulateSwap(params: JupiterQuoteParams): Promise<{
    success: boolean;
    quote?: QuoteResponse;
    error?: string;
  }> {
    try {
      const quote = await this.getQuote(params);
      const transaction = await this.buildSwapTransaction(quote);

      const simulation = await this.connection.simulateTransaction(transaction);

      if (simulation.value.err) {
        return {
          success: false,
          error: JSON.stringify(simulation.value.err)
        };
      }

      return {
        success: true,
        quote
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Vérifier la santé de l'API Jupiter
   */
  async healthCheck(): Promise<boolean> {
    try {
      const quote = await this.getQuote({
        inputMint: new PublicKey('So11111111111111111111111111111111111111112'),
        outputMint: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
        amount: new BN(1000000),
        slippageBps: 50,
      });

      return quote !== null;
    } catch (error) {
      console.error('Jupiter health check failed:', error);
      return false;
    }
  }
}
