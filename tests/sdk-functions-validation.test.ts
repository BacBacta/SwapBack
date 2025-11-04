/**
 * Tests E2E - SDK Functions Validation
 * 
 * Tests des fonctions SDK implémentées avec validation de la logique
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { SwapBackClient, SwapBackConfig, SwapBackUtils } from '../sdk/src/index';

describe('✅ SDK E2E - Functions Validation', () => {
  let connection: Connection;
  let payer: Keypair;
  let client: SwapBackClient;

  // Program IDs (devnet)
  const ROUTER_PROGRAM_ID = new PublicKey('3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap');
  const BUYBACK_PROGRAM_ID = new PublicKey('46UWFYdksvkGhTPy9cTSJGa3d5nqzpY766rtJeuxtMgU');

  beforeAll(async () => {
    console.log('\n🔧 Setting up SDK validation tests...\n');

    // Connection to devnet
    connection = new Connection('https://api.devnet.solana.com', 'confirmed');

    // Create test keypair
    payer = Keypair.generate();
    console.log('   Test wallet:', payer.publicKey.toBase58());

    // Create mock wallet adapter
    const mockWallet = {
      publicKey: payer.publicKey,
      signTransaction: async (tx: any) => {
        tx.partialSign(payer);
        return tx;
      },
      signAllTransactions: async (txs: any[]) => {
        return txs.map((tx: any) => {
          tx.partialSign(payer);
          return tx;
        });
      },
      sendTransaction: async (tx: any, conn: Connection) => {
        tx.partialSign(payer);
        const signature = await conn.sendRawTransaction(tx.serialize());
        return signature;
      },
    };

    // Initialize SwapBack client
    const config: SwapBackConfig = {
      connection,
      wallet: mockWallet,
      routerProgramId: ROUTER_PROGRAM_ID,
      buybackProgramId: BUYBACK_PROGRAM_ID,
    };

    client = new SwapBackClient(config);
    console.log('   ✅ SwapBack client initialized\n');
  });

  describe('📊 1. SwapBackUtils - Boost Calculation', () => {
    it('should calculate maximum boost (20%) correctly', () => {
      console.log('\n🥇 Testing maximum boost (Diamond tier)...');
      
      const amount = 10000000; // 10M tokens (1% of supply)
      const duration = 365; // 365 days
      
      const boost = SwapBackUtils.calculateBoost(amount, duration);
      
      console.log(`   Input: ${amount} tokens for ${duration} days`);
      console.log(`   Output: ${boost}% boost`);
      console.log('   Expected: 20% (maximum boost)');
      
      expect(boost).toBe(20);
      console.log('   ✅ Maximum boost calculation correct');
    });

    it('should calculate Platinum boost (~15%) correctly', () => {
      console.log('\n💎 Testing Platinum tier boost...');
      
      const amount = 5000000; // 5M tokens (0.5% of supply)
      const duration = 180; // 180 days
      
      const boost = SwapBackUtils.calculateBoost(amount, duration);
      
      console.log(`   Input: ${amount} tokens for ${duration} days`);
      console.log(`   Output: ${boost}% boost`);
      console.log('   Expected: ~14.93% (Platinum tier)');
      
      expect(boost).toBeCloseTo(14.93, 1);
      console.log('   ✅ Platinum boost calculation correct');
    });

    it('should calculate Gold boost (~4%) correctly', () => {
      console.log('\n� Testing Gold tier boost...');
      
      const amount = 1000000; // 1M tokens (0.1% of supply)
      const duration = 90; // 90 days
      
      const boost = SwapBackUtils.calculateBoost(amount, duration);
      
      console.log(`   Input: ${amount} tokens for ${duration} days`);
      console.log(`   Output: ${boost}% boost`);
      console.log('   Expected: ~4.47% (Gold tier)');
      
      expect(boost).toBeCloseTo(4.47, 1);
      console.log('   ✅ Gold boost calculation correct');
    });

    it('should calculate small boosts for low amounts correctly', () => {
      console.log('\n🔹 Testing low tier boost scenarios...');
      
      const testCases = [
        { amount: 100000, duration: 30, expected: 1.02, tier: 'Silver' },
        { amount: 500000, duration: 7, expected: 1.19, tier: 'Silver+' },
        { amount: 50000, duration: 90, expected: 2.56, tier: 'Bronze+' },
      ];

      testCases.forEach((test, index) => {
        const boost = SwapBackUtils.calculateBoost(test.amount, test.duration);
        console.log(`   Test ${index + 1} (${test.tier}): ${test.amount} tokens, ${test.duration} days`);
        console.log(`   Boost: ${boost}% (expected ~${test.expected}%)`);
        expect(boost).toBeCloseTo(test.expected, 1);
      });
      
      console.log('   ✅ Low tier boost scenarios validated');
    });
  });

  describe('💰 2. SwapBackUtils - Rebate Calculation', () => {
    it('should calculate base rebate correctly', () => {
      console.log('\n💰 Testing base rebate calculation...');
      
      const npi = 1000; // 1000 NPI
      const rebatePercentage = 75; // 75% rebate
      const boost = 0; // No boost
      
      const rebate = SwapBackUtils.calculateRebate(npi, rebatePercentage, boost);
      
      console.log(`   NPI: ${npi}`);
      console.log(`   Rebate %: ${rebatePercentage}%`);
      console.log(`   Boost: ${boost}%`);
      console.log(`   Rebate: ${rebate}`);
      console.log(`   Expected: ${npi * 0.75} (75% of NPI)`);
      
      expect(rebate).toBe(750);
      console.log('   ✅ Base rebate calculation correct');
    });

    it('should apply boost to rebate calculation', () => {
      console.log('\n🚀 Testing rebate with boost...');
      
      const npi = 1000;
      const rebatePercentage = 75;
      const boost = 20; // Maximum boost (Diamond tier)
      
      const rebate = SwapBackUtils.calculateRebate(npi, rebatePercentage, boost);
      
      const baseRebate = npi * (rebatePercentage / 100);
      const expectedRebate = baseRebate * (1 + boost / 100);
      
      console.log(`   NPI: ${npi}`);
      console.log(`   Rebate %: ${rebatePercentage}%`);
      console.log(`   Boost: ${boost}%`);
      console.log(`   Base rebate: ${baseRebate}`);
      console.log(`   Final rebate: ${rebate}`);
      console.log(`   Expected: ${expectedRebate}`);
      
      expect(rebate).toBe(900); // 750 * 1.2 = 900
      console.log('   ✅ Boosted rebate calculation correct');
    });

    it('should handle different boost tiers', () => {
      console.log('\n🎯 Testing rebate across all boost tiers...');
      
      const npi = 1000;
      const rebatePercentage = 75;
      
      const tiers = [
        { name: 'None', boost: 0, expected: 750 },
        { name: 'Silver', boost: 1.02, expected: 757.65 },
        { name: 'Gold', boost: 4.47, expected: 783.525 },
        { name: 'Platinum', boost: 14.93, expected: 861.975 },
        { name: 'Diamond', boost: 20, expected: 900 },
      ];

      tiers.forEach(tier => {
        const rebate = SwapBackUtils.calculateRebate(npi, rebatePercentage, tier.boost);
        console.log(`   ${tier.name} tier (${tier.boost}% boost): ${rebate} (expected ~${tier.expected})`);
        expect(rebate).toBeCloseTo(tier.expected, 0);
      });
      
      console.log('   ✅ All tier calculations correct');
    });
  });

  describe('🔧 3. SwapBackUtils - Amount Formatting', () => {
    it('should format amounts correctly', () => {
      console.log('\n📝 Testing amount formatting...');
      
      const testCases = [
        { amount: 1234.5678, decimals: 2, expected: '1234.57' },
        { amount: 0.123456, decimals: 4, expected: '0.1235' },
        { amount: 1000000, decimals: 0, expected: '1000000' },
        { amount: 3.14159, decimals: 3, expected: '3.142' },
      ];

      testCases.forEach(test => {
        const formatted = SwapBackUtils.formatAmount(test.amount, test.decimals);
        console.log(`   ${test.amount} → ${formatted} (${test.decimals} decimals)`);
        expect(formatted).toBe(test.expected);
      });
      
      console.log('   ✅ Amount formatting correct');
    });

    it('should convert to native amount with decimals', () => {
      console.log('\n🔢 Testing native amount conversion...');
      
      const testCases = [
        { amount: 1, decimals: 9, expected: 1000000000 }, // 1 SOL = 1e9 lamports
        { amount: 100, decimals: 6, expected: 100000000 }, // 100 USDC = 1e8 base units
        { amount: 0.5, decimals: 9, expected: 500000000 },
      ];

      testCases.forEach(test => {
        const native = SwapBackUtils.toNativeAmount(test.amount, test.decimals);
        console.log(`   ${test.amount} → ${native.toString()} (${test.decimals} decimals)`);
        expect(native.toNumber()).toBe(test.expected);
      });
      
      console.log('   ✅ Native amount conversion correct');
    });

    it('should convert from native amount', () => {
      console.log('\n🔄 Testing reverse conversion...');
      
      const native = SwapBackUtils.toNativeAmount(1, 9); // 1 SOL
      const regular = SwapBackUtils.fromNativeAmount(native, 9);
      
      console.log(`   Native: ${native.toString()} lamports`);
      console.log(`   Regular: ${regular} SOL`);
      
      expect(regular).toBe(1);
      console.log('   ✅ Reverse conversion correct');
    });
  });

  describe('🔑 4. PDA Derivation Tests', () => {
    it('should derive global state PDA correctly', () => {
      console.log('\n🔑 Testing global state PDA derivation...');
      
      const [globalStatePDA, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from('global_state')],
        ROUTER_PROGRAM_ID
      );

      console.log(`   Program ID: ${ROUTER_PROGRAM_ID.toBase58()}`);
      console.log(`   Global State PDA: ${globalStatePDA.toBase58()}`);
      console.log(`   Bump: ${bump}`);

      expect(globalStatePDA).toBeDefined();
      expect(bump).toBeGreaterThanOrEqual(0);
      expect(bump).toBeLessThanOrEqual(255);
      console.log('   ✅ Global state PDA derived correctly');
    });

    it('should derive user rebate PDA correctly', () => {
      console.log('\n🔑 Testing user rebate PDA derivation...');
      
      const [userRebatePDA, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from('user_rebate'), payer.publicKey.toBuffer()],
        ROUTER_PROGRAM_ID
      );

      console.log(`   User: ${payer.publicKey.toBase58()}`);
      console.log(`   User Rebate PDA: ${userRebatePDA.toBase58()}`);
      console.log(`   Bump: ${bump}`);

      expect(userRebatePDA).toBeDefined();
      expect(bump).toBeGreaterThanOrEqual(0);
      expect(bump).toBeLessThanOrEqual(255);
      console.log('   ✅ User rebate PDA derived correctly');
    });

    it('should derive user lock PDA correctly', () => {
      console.log('\n🔑 Testing user lock PDA derivation...');
      
      const [userLockPDA, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from('user_lock'), payer.publicKey.toBuffer()],
        ROUTER_PROGRAM_ID
      );

      console.log(`   User: ${payer.publicKey.toBase58()}`);
      console.log(`   User Lock PDA: ${userLockPDA.toBase58()}`);
      console.log(`   Bump: ${bump}`);

      expect(userLockPDA).toBeDefined();
      expect(bump).toBeGreaterThanOrEqual(0);
      expect(bump).toBeLessThanOrEqual(255);
      console.log('   ✅ User lock PDA derived correctly');
    });
  });

  describe('✅ 5. SDK Client Initialization', () => {
    it('should initialize client with correct config', () => {
      console.log('\n✅ Validating client initialization...');
      
      expect(client).toBeDefined();
      console.log(`   Client created: ✅`);
      console.log(`   Connection: ${connection.rpcEndpoint}`);
      console.log(`   Router Program: ${ROUTER_PROGRAM_ID.toBase58()}`);
      console.log(`   Buyback Program: ${BUYBACK_PROGRAM_ID.toBase58()}`);
      console.log('   ✅ Client properly initialized');
    });

    it('should have access to wallet public key', () => {
      console.log('\n🔑 Checking wallet connection...');
      
      expect(client['wallet']).toBeDefined();
      expect(client['wallet'].publicKey).toBeDefined();
      console.log(`   Wallet pubkey: ${client['wallet'].publicKey.toBase58()}`);
      console.log('   ✅ Wallet connected to client');
    });
  });
});
