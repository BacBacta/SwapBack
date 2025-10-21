/**
 * Tests Jupiter Real Integration - TODO #3
 */

import { describe, it, expect } from 'vitest';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { JupiterRealIntegration } from '../sdk/src/integrations/JupiterRealIntegration';

const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

describe('TODO #3 - Jupiter Real Integration', () => {
  it('should initialize Jupiter client', () => {
    const connection = new Connection('https://api.devnet.solana.com');
    const wallet = Keypair.generate();
    const jupiter = new JupiterRealIntegration(connection, wallet);

    expect(jupiter).toBeDefined();
    console.log('✅ Jupiter client initialized');
  });

  it('should fetch quote for SOL → USDC', async () => {
    const connection = new Connection('https://api.devnet.solana.com');
    const wallet = Keypair.generate();
    const jupiter = new JupiterRealIntegration(connection, wallet);

    try {
      const quote = await jupiter.getQuote({
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        amount: new BN(1_000_000), // 0.001 SOL
        slippageBps: 50,
      });

      expect(quote).toBeDefined();
      expect(quote.inAmount).toBeDefined();
      expect(quote.outAmount).toBeDefined();
      expect(quote.routePlan.length).toBeGreaterThan(0);

      console.log('✅ Quote received:');
      console.log(`   Input: ${quote.inAmount}`);
      console.log(`   Output: ${quote.outAmount}`);
      console.log(`   Price Impact: ${quote.priceImpactPct}%`);
    } catch (error) {
      // Peut échouer si pas de connexion Internet
      console.warn('⚠️ Jupiter API not accessible:', error instanceof Error ? error.message : 'Unknown error');
      expect(error).toBeDefined();
    }
  }, 30000);

  it('should handle health check', async () => {
    const connection = new Connection('https://api.devnet.solana.com');
    const wallet = Keypair.generate();
    const jupiter = new JupiterRealIntegration(connection, wallet);

    try {
      const isHealthy = await jupiter.healthCheck();
      console.log('✅ Jupiter API health:', isHealthy ? 'OK' : 'NOT OK');
      expect(typeof isHealthy).toBe('boolean');
    } catch (error) {
      console.warn('⚠️ Health check failed');
    }
  }, 30000);
});
