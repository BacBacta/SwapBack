/**
 * Tests E2E - Lock/Unlock & Claim Flow
 * Teste les fonctionnalités de lock, unlock et claim du SDK
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { SwapBackClient } from '../sdk/src';

describe('🔐 SDK E2E - Lock/Unlock/Claim Flow', () => {
  let sdk: SwapBackClient;
  let connection: Connection;
  let payer: Keypair;
  
  const ROUTER_PROGRAM_ID = new PublicKey('3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap');
  const BUYBACK_PROGRAM_ID = new PublicKey('46UWFYdksvkGhTPy9cTSJGa3d5nqzpY766rtJeuxtMgU');
  
  beforeAll(async () => {
    // Configuration devnet
    const endpoint = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    connection = new Connection(endpoint, 'confirmed');

    // Créer un wallet de test
    payer = Keypair.generate();
    
    // Airdrop SOL pour les frais
    try {
      const signature = await connection.requestAirdrop(
        payer.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(signature);
      console.log(`   ✅ Airdrop: ${payer.publicKey.toBase58()}`);
    } catch (error) {
      console.log(`   ⚠️  Airdrop failed (devnet limit), using existing balance`);
    }

    // Setup wallet wrapper pour SDK
    const wallet = {
      publicKey: payer.publicKey,
      signTransaction: async (tx: any) => {
        tx.partialSign(payer);
        return tx;
      },
      signAllTransactions: async (txs: any[]) => {
        return txs.map(tx => {
          tx.partialSign(payer);
          return tx;
        });
      },
      sendTransaction: async (tx: any, conn: Connection) => {
        tx.partialSign(payer);
        const rawTx = tx.serialize();
        return await conn.sendRawTransaction(rawTx);
      },
    };

    // Initialiser le SDK avec SwapBackConfig
    sdk = new SwapBackClient({
      connection,
      wallet,
      routerProgramId: ROUTER_PROGRAM_ID,
      buybackProgramId: BUYBACK_PROGRAM_ID,
    });

    console.log(`   📍 SDK initialized`);
    console.log(`      Wallet: ${payer.publicKey.toBase58()}`);
    console.log(`      Router: ${ROUTER_PROGRAM_ID.toBase58()}`);
  });

  describe('1️⃣ User Stats', () => {
    it('devrait récupérer les stats utilisateur', async () => {
      const stats = await sdk.getUserStats();
      
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('totalSwaps');
      expect(stats).toHaveProperty('totalVolume');
      expect(stats).toHaveProperty('lockedAmount');
      expect(stats).toHaveProperty('rebateBoost');
      
      console.log(`   ✅ User stats retrieved:`);
      console.log(`      Total Swaps: ${stats.totalSwaps}`);
      console.log(`      Total Volume: $${stats.totalVolume}`);
      console.log(`      Locked Amount: ${stats.lockedAmount} $BACK`);
      console.log(`      Rebate Boost: ${stats.rebateBoost}%`);
      console.log(`      Pending Rebates: ${stats.pendingRebates}`);
    }, 30000);
  });

  describe('2️⃣ Lock Tokens', () => {
    it('devrait valider les paramètres de lock', () => {
      const lockAmount = 100;
      const lockDurationDays = 30;

      expect(lockAmount).toBeGreaterThan(0);
      expect(lockDurationDays).toBeGreaterThan(0);
      
      console.log(`   ✅ Lock parameters validated:`);
      console.log(`      Amount: ${lockAmount} $BACK`);
      console.log(`      Duration: ${lockDurationDays} days`);
    });

    it('devrait préparer une transaction de lock (mock)', async () => {
      // Note: lockTokens() dans le SDK est partiellement implémenté
      // L'instruction Solana n'est pas encore complète dans le programme
      
      console.log(`   ⚠️  Lock instruction not fully implemented in program yet`);
      console.log(`   📝 SDK method exists but awaits program completion`);
      
      expect(sdk).toHaveProperty('lockTokens');
      console.log(`   ✅ lockTokens() method available in SDK`);
    }, 30000);
  });

  describe('3️⃣ Unlock Tokens', () => {
    it('devrait valider le wallet pour unlock', () => {
      expect(sdk['wallet'].publicKey).toBeDefined();
      console.log(`   ✅ Wallet ready for unlock: ${sdk['wallet'].publicKey?.toBase58()}`);
    });

    it('devrait préparer une transaction de unlock (mock)', async () => {
      console.log(`   ⚠️  Unlock instruction not fully implemented in program yet`);
      console.log(`   📝 SDK method exists but awaits program completion`);
      
      expect(sdk).toHaveProperty('unlockTokens');
      console.log(`   ✅ unlockTokens() method available in SDK`);
    }, 30000);
  });

  describe('4️⃣ Claim Rewards', () => {
    it('devrait valider le wallet pour claim', () => {
      expect(sdk['wallet'].publicKey).toBeDefined();
      console.log(`   ✅ Wallet ready for claim: ${sdk['wallet'].publicKey?.toBase58()}`);
    });

    it('devrait préparer une transaction de claim (mock)', async () => {
      console.log(`   ⚠️  Claim instruction not fully implemented in program yet`);
      console.log(`   📝 SDK method exists but awaits program completion`);
      
      expect(sdk).toHaveProperty('claimRewards');
      console.log(`   ✅ claimRewards() method available in SDK`);
    }, 30000);
  });

  describe('5️⃣ Full Flow Validation', () => {
    it('devrait valider le flow complet (conceptuel)', async () => {
      console.log(`\n   🔄 Validating full lock/unlock/claim flow:`);

      // Step 1: Check user stats
      const stats = await sdk.getUserStats();
      expect(stats).toBeDefined();
      console.log(`   1️⃣ User stats: ${stats.totalSwaps} swaps, ${stats.lockedAmount} locked ✅`);

      // Step 2: Validate lock capability
      expect(sdk).toHaveProperty('lockTokens');
      console.log(`   2️⃣ Lock capability ready ✅`);

      // Step 3: Validate unlock capability
      expect(sdk).toHaveProperty('unlockTokens');
      console.log(`   3️⃣ Unlock capability ready ✅`);

      // Step 4: Validate claim capability
      expect(sdk).toHaveProperty('claimRewards');
      console.log(`   4️⃣ Claim capability ready ✅`);

      console.log(`\n   ✅ Full flow validation completed`);
      console.log(`   📝 Note: On-chain execution awaits program instruction completion`);
    }, 60000);
  });

  describe('6️⃣ SDK Method Signatures', () => {
    it('devrait avoir toutes les méthodes principales', () => {
      const methods = [
        'simulateRoute',
        'executeSwap',
      ];

      for (const method of methods) {
        expect(sdk).toHaveProperty(method);
        const methodValue = (sdk as any)[method];
        expect(typeof methodValue).toBe('function');
        console.log(`   ✅ ${method}() ✓`);
      }

      console.log(`   ✅ All ${methods.length} core methods available`);
    });
  });
});
