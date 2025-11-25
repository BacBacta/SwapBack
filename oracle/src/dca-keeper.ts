/**
 * DCA Keeper - Phase 3 Implementation
 * 
 * Automated execution service for DCA plans
 * Monitors all active plans and executes swaps when ready
 */

import { Connection, PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { 
  getAssociatedTokenAddress, 
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAccount
} from '@solana/spl-token';
import fs from 'fs';
import path from 'path';
import bs58 from 'bs58';
import { createProgramWithProvider } from './utils/program';
import routerIdl from '../idl/swapback_router.json';

// Import DCA functions (need to adapt paths)
interface DcaPlan {
  planId: number[];
  user: PublicKey;
  tokenIn: PublicKey;
  tokenOut: PublicKey;
  amountPerSwap: bigint;
  totalSwaps: number;
  executedSwaps: number;
  intervalSeconds: bigint;
  nextExecution: bigint;
  minOutPerSwap: bigint;
  createdAt: bigint;
  expiresAt: bigint;
  isActive: boolean;
  totalInvested: bigint;
  totalReceived: bigint;
  bump: number;
}

interface DcaPlanWithAddress extends DcaPlan {
  planPda: PublicKey;
}

// Configuration
const CONFIG = {
  RPC_URL: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  ROUTER_PROGRAM_ID: new PublicKey('9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh'),
  CHECK_INTERVAL_MS: 60_000, // Check every minute
  KEYPAIR_PATH: process.env.KEEPER_KEYPAIR_PATH || path.join(process.env.HOME!, '.config', 'solana', 'id.json'),
  DCA_DISCRIMINATOR: Buffer.from([231, 97, 112, 227, 171, 241, 52, 84]),
  DRY_RUN: process.env.DRY_RUN === 'true', // Set to true to not execute, just log
  BACK_MINT: new PublicKey(
    process.env.NEXT_PUBLIC_BACK_MINT ||
    '862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux'
  ),
};

class DCAKeeper {
  private connection: Connection;
  private wallet: Wallet;
  private provider: AnchorProvider;
  private isRunning: boolean = false;
  private executionCount: number = 0;
  private errorCount: number = 0;

  constructor() {
    this.connection = new Connection(CONFIG.RPC_URL, 'confirmed');
    
    // Load keeper wallet
    const keypairData = JSON.parse(fs.readFileSync(CONFIG.KEYPAIR_PATH, 'utf8'));
    const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
    this.wallet = new Wallet(keypair);
    
    this.provider = new AnchorProvider(
      this.connection,
      this.wallet,
      { commitment: 'confirmed', preflightCommitment: 'confirmed' }
    );

    console.log('🤖 DCA Keeper initialized');
    console.log('   Keeper wallet:', this.wallet.publicKey.toBase58());
    console.log('   RPC:', CONFIG.RPC_URL);
    console.log('   Check interval:', CONFIG.CHECK_INTERVAL_MS / 1000, 'seconds');
    console.log('   Dry run mode:', CONFIG.DRY_RUN);
  }

  /**
   * Fetch all DCA plans from the blockchain
   */
  async fetchAllDcaPlans(): Promise<DcaPlanWithAddress[]> {
    try {
      const discriminatorBase58 = bs58.encode(CONFIG.DCA_DISCRIMINATOR);
      
      const accounts = await this.connection.getProgramAccounts(CONFIG.ROUTER_PROGRAM_ID, {
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: discriminatorBase58,
            },
          },
        ],
      });

      console.log(`📦 Found ${accounts.length} total DCA plan(s)`);

      const plans: DcaPlanWithAddress[] = [];

      for (const { pubkey, account } of accounts) {
        try {
          const plan = this.deserializeDcaPlan(account.data);
          plans.push({
            ...plan,
            planPda: pubkey,
          });
        } catch (error) {
          console.warn(`⚠️  Failed to decode plan ${pubkey.toBase58()}:`, error);
        }
      }

      return plans;
    } catch (error) {
      console.error('❌ Error fetching DCA plans:', error);
      throw error;
    }
  }

  /**
   * Deserialize DCA plan account data
   */
  private deserializeDcaPlan(data: Buffer): DcaPlan {
    let offset = 8; // Skip discriminator

    const planId = Array.from(data.slice(offset, offset + 32));
    offset += 32;

    const user = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const tokenIn = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const tokenOut = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    const amountPerSwap = data.readBigUInt64LE(offset);
    offset += 8;

    const totalSwaps = data.readUInt32LE(offset);
    offset += 4;

    const executedSwaps = data.readUInt32LE(offset);
    offset += 4;

    const intervalSeconds = data.readBigInt64LE(offset);
    offset += 8;

    const nextExecution = data.readBigInt64LE(offset);
    offset += 8;

    const minOutPerSwap = data.readBigUInt64LE(offset);
    offset += 8;

    const createdAt = data.readBigInt64LE(offset);
    offset += 8;

    const expiresAt = data.readBigInt64LE(offset);
    offset += 8;

    const isActive = data.readUInt8(offset) !== 0;
    offset += 1;

    const totalInvested = data.readBigUInt64LE(offset);
    offset += 8;

    const totalReceived = data.readBigUInt64LE(offset);
    offset += 8;

    const bump = data.readUInt8(offset);

    return {
      planId,
      user,
      tokenIn,
      tokenOut,
      amountPerSwap,
      totalSwaps,
      executedSwaps,
      intervalSeconds,
      nextExecution,
      minOutPerSwap,
      createdAt,
      expiresAt,
      isActive,
      totalInvested,
      totalReceived,
      bump,
    };
  }

  /**
   * Filter plans that are ready for execution
   */
  filterReadyPlans(plans: DcaPlanWithAddress[]): DcaPlanWithAddress[] {
    const now = BigInt(Math.floor(Date.now() / 1000));

    return plans.filter(plan => {
      // Must be active
      if (!plan.isActive) return false;

      // Must not be completed
      if (plan.executedSwaps >= plan.totalSwaps) return false;

      // Must be past next execution time
      if (plan.nextExecution > now) return false;

      // Check expiry if set
      if (plan.expiresAt > 0n && plan.expiresAt < now) return false;

      return true;
    });
  }

  /**
   * Get Router State PDA
   */
  private getRouterStatePDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('router_state')],
      CONFIG.ROUTER_PROGRAM_ID
    );
  }

  /**
   * Execute a single DCA swap
   */
  async executeDcaSwap(plan: DcaPlanWithAddress): Promise<boolean> {
    try {
      console.log(`\n🔄 Executing DCA swap for plan ${plan.planPda.toBase58()}`);
      console.log(`   User: ${plan.user.toBase58()}`);
      console.log(`   ${plan.tokenIn.toBase58().slice(0, 8)}... → ${plan.tokenOut.toBase58().slice(0, 8)}...`);
      console.log(`   Progress: ${plan.executedSwaps + 1}/${plan.totalSwaps}`);

      if (CONFIG.DRY_RUN) {
        console.log('   ⏭️  DRY RUN - Skipping actual execution');
        return true;
      }

      // Create program instance
      const program = createProgramWithProvider(
        routerIdl as any,
        CONFIG.ROUTER_PROGRAM_ID,
        this.provider
      );
      
      const [statePda] = this.getRouterStatePDA();
      
      // Determine token programs
      const tokenInProgram = plan.tokenIn.equals(CONFIG.BACK_MINT) 
        ? TOKEN_2022_PROGRAM_ID 
        : TOKEN_PROGRAM_ID;
      const tokenOutProgram = plan.tokenOut.equals(CONFIG.BACK_MINT) 
        ? TOKEN_2022_PROGRAM_ID 
        : TOKEN_PROGRAM_ID;
      
      // Get user's token accounts
      const userTokenIn = await getAssociatedTokenAddress(
        plan.tokenIn,
        plan.user,
        false,
        tokenInProgram
      );
      
      const userTokenOut = await getAssociatedTokenAddress(
        plan.tokenOut,
        plan.user,
        false,
        tokenOutProgram
      );
      
      console.log('   🔍 Checking token accounts...');
      
      // Check if ATAs exist and create them if needed
      const preInstructions = [];
      
      try {
        await getAccount(this.connection, userTokenIn, 'confirmed', tokenInProgram);
        console.log('   ✅ user_token_in exists');
      } catch (error) {
        console.log('   ⚠️  user_token_in missing, creating...');
        preInstructions.push(
          createAssociatedTokenAccountInstruction(
            this.wallet.publicKey, // payer (keeper pays)
            userTokenIn, // ata
            plan.user, // owner
            plan.tokenIn, // mint
            tokenInProgram
          )
        );
      }
      
      try {
        await getAccount(this.connection, userTokenOut, 'confirmed', tokenOutProgram);
        console.log('   ✅ user_token_out exists');
      } catch (error) {
        console.log('   ⚠️  user_token_out missing, creating...');
        preInstructions.push(
          createAssociatedTokenAccountInstruction(
            this.wallet.publicKey, // payer (keeper pays)
            userTokenOut, // ata
            plan.user, // owner
            plan.tokenOut, // mint
            tokenOutProgram
          )
        );
      }
      
      if (preInstructions.length > 0) {
        console.log(`   📝 Will create ${preInstructions.length} ATA(s)`);
      }
      
      // Build transaction
      interface ExecuteDcaSwapMethods {
        executeDcaSwap: () => {
          accounts: (accounts: Record<string, unknown>) => {
            preInstructions?: (instructions: any[]) => { rpc: () => Promise<string> };
            rpc: () => Promise<string>;
          };
        };
      }
      
      const txBuilder = (program.methods as unknown as ExecuteDcaSwapMethods)
        .executeDcaSwap()
        .accounts({
          dcaPlan: plan.planPda,
          state: statePda,
          userTokenIn,
          userTokenOut,
          user: plan.user,
          executor: this.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        });
      
      // Add pre-instructions if needed
      let signature: string;
      if (preInstructions.length > 0) {
        signature = await (txBuilder as any).preInstructions(preInstructions).rpc();
      } else {
        signature = await txBuilder.rpc();
      }
      
      console.log(`   ✅ Executed! Signature: ${signature}`);

      this.executionCount++;
      return true;
    } catch (error: any) {
      console.error(`   ❌ Execution failed:`, error.message);
      if (error.logs) {
        console.error(`   📋 Program logs:`, error.logs);
      }
      this.errorCount++;
      return false;
    }
  }

  /**
   * Main keeper loop
   */
  async run() {
    this.isRunning = true;
    console.log('\n🚀 DCA Keeper started');
    console.log('━'.repeat(60));

    while (this.isRunning) {
      try {
        const startTime = Date.now();
        console.log(`\n⏰ [${new Date().toISOString()}] Checking for ready plans...`);

        // Fetch all plans
        const allPlans = await this.fetchAllDcaPlans();

        // Filter ready plans
        const readyPlans = this.filterReadyPlans(allPlans);

        console.log(`✅ ${readyPlans.length} plan(s) ready for execution`);

        if (readyPlans.length > 0) {
          console.log('\n📋 Ready plans:');
          readyPlans.forEach((plan, idx) => {
            const nextExecDate = new Date(Number(plan.nextExecution) * 1000);
            console.log(`   ${idx + 1}. ${plan.planPda.toBase58()}`);
            console.log(`      Next execution was: ${nextExecDate.toISOString()}`);
          });

          // Execute each ready plan
          for (const plan of readyPlans) {
            await this.executeDcaSwap(plan);
            // Small delay between executions to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        // Stats
        const elapsed = Date.now() - startTime;
        console.log(`\n📊 Stats:`);
        console.log(`   Total executions: ${this.executionCount}`);
        console.log(`   Total errors: ${this.errorCount}`);
        console.log(`   Check duration: ${elapsed}ms`);

        // Wait for next check
        console.log(`\n⏳ Next check in ${CONFIG.CHECK_INTERVAL_MS / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, CONFIG.CHECK_INTERVAL_MS));

      } catch (error) {
        console.error('❌ Keeper loop error:', error);
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

    console.log('\n🛑 DCA Keeper stopped');
  }

  /**
   * Stop the keeper
   */
  stop() {
    console.log('\n🛑 Stopping DCA Keeper...');
    this.isRunning = false;
  }

  /**
   * Get keeper statistics
   */
  getStats() {
    return {
      executionCount: this.executionCount,
      errorCount: this.errorCount,
      isRunning: this.isRunning,
    };
  }
}

// Main execution
if (require.main === module) {
  const keeper = new DCAKeeper();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n⚠️  Received SIGINT signal');
    keeper.stop();
    setTimeout(() => process.exit(0), 1000);
  });

  process.on('SIGTERM', () => {
    console.log('\n\n⚠️  Received SIGTERM signal');
    keeper.stop();
    setTimeout(() => process.exit(0), 1000);
  });

  // Start the keeper
  keeper.run().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { DCAKeeper };
