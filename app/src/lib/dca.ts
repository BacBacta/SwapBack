/**
 * DCA (Dollar Cost Averaging) Transaction Utilities
 * 
 * This module provides functions to interact with the SwapBack Router DCA functionality
 * including creating plans, executing swaps, and managing DCA orders on-chain.
 */

import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { AnchorProvider, Program, BN, Idl } from '@coral-xyz/anchor';
import { 
  getAssociatedTokenAddress, 
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID 
} from '@solana/spl-token';
import SwapbackRouterIdl from '@/idl/swapback_router.json';

// Program constants
export const ROUTER_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID || 
  'GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt'
);

// Token mints
export const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
export const USDC_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_USDC_MINT || 
  'BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR'
);
export const BACK_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_BACK_MINT || 
  '862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux'
);

// Token symbol to mint mapping
export const TOKEN_MINTS: Record<string, PublicKey> = {
  SOL: SOL_MINT,
  USDC: USDC_MINT,
  BACK: BACK_MINT,
  USDT: new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'),
};

/**
 * DCA Plan on-chain structure
 */
export interface DcaPlan {
  planId: number[];
  user: PublicKey;
  tokenIn: PublicKey;
  tokenOut: PublicKey;
  amountPerSwap: BN;
  totalSwaps: number;
  executedSwaps: number;
  intervalSeconds: BN;
  nextExecution: BN;
  minOutPerSwap: BN;
  createdAt: BN;
  expiresAt: BN;
  isActive: boolean;
  totalInvested: BN;
  totalReceived: BN;
  bump: number;
}

/**
 * DCA Frequency type
 */
export type DCAFrequency = "hourly" | "daily" | "weekly" | "monthly";

/**
 * Parameters for creating a DCA plan
 */
export interface CreateDcaPlanParams {
  tokenIn: PublicKey;
  tokenOut: PublicKey;
  amountPerSwap: number; // in UI units (e.g., 1 SOL, 10 USDC)
  totalSwaps: number;
  intervalSeconds: number; // e.g., 3600 (1h), 86400 (1d), 604800 (1w)
  minOutPerSwap: number; // minimum output tokens (slippage protection)
  expiresAt?: number; // optional Unix timestamp, 0 = no expiry
}

/**
 * Derive the Router State PDA
 */
export function getRouterStatePDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('router_state')],
    ROUTER_PROGRAM_ID
  );
}

/**
 * Derive a DCA Plan PDA for a given user and plan ID
 */
export function getDcaPlanPDA(
  user: PublicKey,
  planId: Buffer
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('dca_plan'),
      user.toBuffer(),
      planId,
    ],
    ROUTER_PROGRAM_ID
  );
}

/**
 * Generate a unique plan ID (32 bytes)
 */
export function generatePlanId(): Buffer {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  
  const buffer = Buffer.alloc(32);
  buffer.writeBigUInt64LE(BigInt(timestamp), 0);
  buffer.writeUInt32LE(random, 8);
  
  return buffer;
}

/**
 * Convert frequency string to interval in seconds
 */
export function frequencyToSeconds(frequency: 'hourly' | 'daily' | 'weekly' | 'monthly'): number {
  const map: Record<string, number> = {
    hourly: 3600,           // 1 hour
    daily: 86400,           // 24 hours
    weekly: 604800,         // 7 days
    monthly: 2592000,       // 30 days
  };
  return map[frequency] || 86400;
}

/**
 * Get token decimals for a given mint
 */
export function getTokenDecimals(tokenMint: PublicKey): number {
  // Handle common tokens
  if (tokenMint.equals(SOL_MINT)) return 9;
  if (tokenMint.equals(USDC_MINT)) return 6;
  if (tokenMint.equals(BACK_MINT)) return 9;
  
  // Default to 9 decimals for unknown tokens
  return 9;
}

/**
 * Convert UI amount to lamports/smallest unit
 */
export function uiToLamports(amount: number, decimals: number): BN {
  return new BN(Math.floor(amount * Math.pow(10, decimals)));
}

/**
 * Convert lamports/smallest unit to UI amount
 */
export function lamportsToUi(amount: BN, decimals: number): number {
  return amount.toNumber() / Math.pow(10, decimals);
}

/**
 * Load the Router program IDL
 */
export function loadRouterIdl(): Idl {
  // Return the imported IDL directly (no fs access needed)
  return SwapbackRouterIdl as Idl;
}

/**
 * Create a DCA plan on-chain
 */
export async function createDcaPlanTransaction(
  connection: Connection,
  provider: AnchorProvider,
  userPublicKey: PublicKey,
  params: CreateDcaPlanParams
): Promise<{ signature: string; planPda: PublicKey; planId: Buffer }> {
  
  // Load IDL and create program instance
  const idl = loadRouterIdl();
  const program = new Program(idl, provider);
  
  // Generate unique plan ID
  const planId = generatePlanId();
  
  // Derive PDAs
  const [planPda] = getDcaPlanPDA(userPublicKey, planId);
  const [statePda] = getRouterStatePDA();
  
  // Get token decimals
  const tokenInDecimals = getTokenDecimals(params.tokenIn);
  const tokenOutDecimals = getTokenDecimals(params.tokenOut);
  
  // Convert amounts to lamports
  const amountPerSwapLamports = uiToLamports(params.amountPerSwap, tokenInDecimals);
  const minOutPerSwapLamports = uiToLamports(params.minOutPerSwap, tokenOutDecimals);
  
  console.log('🔄 Creating DCA Plan:', {
    planId: planId.toString('hex').slice(0, 16) + '...',
    planPda: planPda.toBase58(),
    tokenIn: params.tokenIn.toBase58(),
    tokenOut: params.tokenOut.toBase58(),
    amountPerSwap: params.amountPerSwap,
    totalSwaps: params.totalSwaps,
    intervalSeconds: params.intervalSeconds,
  });
  
  // Prepare instruction arguments
  const args = {
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    amountPerSwap: amountPerSwapLamports,
    totalSwaps: params.totalSwaps,
    intervalSeconds: new BN(params.intervalSeconds),
    minOutPerSwap: minOutPerSwapLamports,
    expiresAt: new BN(params.expiresAt || 0),
  };
  
  // Build transaction
  interface CreateDcaPlanMethods {
    createDcaPlan: (
      planId: number[],
      args: {
        tokenIn: PublicKey;
        tokenOut: PublicKey;
        amountPerSwap: BN;
        totalSwaps: number;
        intervalSeconds: BN;
        minOutPerSwap: BN;
        expiresAt: BN;
      }
    ) => {
      accounts: (accounts: Record<string, unknown>) => {
        rpc: () => Promise<string>;
      };
    };
  }
  
  const signature = await (program.methods as unknown as CreateDcaPlanMethods)
    .createDcaPlan(Array.from(planId), args)
    .accounts({
      dcaPlan: planPda,
      state: statePda,
      user: userPublicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  
  console.log('✅ DCA Plan created:', signature);
  
  return { signature, planPda, planId };
}

/**
 * Fetch all DCA plans for a user
 */
export async function fetchUserDcaPlans(
  connection: Connection,
  provider: AnchorProvider,
  userPublicKey: PublicKey
): Promise<DcaPlan[]> {
  
  const idl = loadRouterIdl();
  const program = new Program(idl, provider);
  
  // Use getProgramAccounts to fetch all DCA plans owned by the user
  const accounts = await connection.getProgramAccounts(ROUTER_PROGRAM_ID, {
    filters: [
      {
        memcmp: {
          offset: 8, // Skip discriminator (8 bytes)
          bytes: userPublicKey.toBase58(),
        },
      },
    ],
  });
  
  const plans: DcaPlan[] = [];
  
  for (const account of accounts) {
    try {
      // Deserialize account data
      const dcaPlan = program.coder.accounts.decode('DcaPlan', account.account.data);
      plans.push(dcaPlan as DcaPlan);
    } catch (error) {
      console.warn('Failed to decode DCA plan:', error);
    }
  }
  
  console.log(`✅ Fetched ${plans.length} DCA plans for user ${userPublicKey.toBase58()}`);
  
  return plans;
}

/**
 * Execute a DCA swap for a given plan
 */
export async function executeDcaSwapTransaction(
  connection: Connection,
  provider: AnchorProvider,
  userPublicKey: PublicKey,
  planPda: PublicKey,
  dcaPlan: DcaPlan
): Promise<string> {
  
  const idl = loadRouterIdl();
  const program = new Program(idl, provider);
  
  const [statePda] = getRouterStatePDA();
  
  // Get user's token accounts
  const userTokenIn = await getAssociatedTokenAddress(
    dcaPlan.tokenIn,
    userPublicKey,
    false,
    dcaPlan.tokenIn.equals(BACK_MINT) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID
  );
  
  const userTokenOut = await getAssociatedTokenAddress(
    dcaPlan.tokenOut,
    userPublicKey,
    false,
    dcaPlan.tokenOut.equals(BACK_MINT) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID
  );
  
  console.log('🔄 Executing DCA swap:', {
    planPda: planPda.toBase58(),
    executedSwaps: dcaPlan.executedSwaps,
    totalSwaps: dcaPlan.totalSwaps,
  });
  
  // Build transaction
  interface ExecuteDcaSwapMethods {
    executeDcaSwap: () => {
      accounts: (accounts: Record<string, unknown>) => {
        rpc: () => Promise<string>;
      };
    };
  }
  
  const signature = await (program.methods as unknown as ExecuteDcaSwapMethods)
    .executeDcaSwap()
    .accounts({
      dcaPlan: planPda,
      state: statePda,
      userTokenIn,
      userTokenOut,
      user: userPublicKey,
      executor: provider.wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  
  console.log('✅ DCA swap executed:', signature);
  
  return signature;
}

/**
 * Pause a DCA plan
 */
export async function pauseDcaPlanTransaction(
  connection: Connection,
  provider: AnchorProvider,
  userPublicKey: PublicKey,
  planPda: PublicKey
): Promise<string> {
  
  const idl = loadRouterIdl();
  const program = new Program(idl, provider);
  
  console.log('⏸️  Pausing DCA plan:', planPda.toBase58());
  
  interface PauseDcaPlanMethods {
    pauseDcaPlan: () => {
      accounts: (accounts: Record<string, unknown>) => {
        rpc: () => Promise<string>;
      };
    };
  }
  
  const signature = await (program.methods as unknown as PauseDcaPlanMethods)
    .pauseDcaPlan()
    .accounts({
      dcaPlan: planPda,
      user: userPublicKey,
    })
    .rpc();
  
  console.log('✅ DCA plan paused:', signature);
  
  return signature;
}

/**
 * Resume a DCA plan
 */
export async function resumeDcaPlanTransaction(
  connection: Connection,
  provider: AnchorProvider,
  userPublicKey: PublicKey,
  planPda: PublicKey
): Promise<string> {
  
  const idl = loadRouterIdl();
  const program = new Program(idl, provider);
  
  console.log('▶️  Resuming DCA plan:', planPda.toBase58());
  
  interface ResumeDcaPlanMethods {
    resumeDcaPlan: () => {
      accounts: (accounts: Record<string, unknown>) => {
        rpc: () => Promise<string>;
      };
    };
  }
  
  const signature = await (program.methods as unknown as ResumeDcaPlanMethods)
    .resumeDcaPlan()
    .accounts({
      dcaPlan: planPda,
      user: userPublicKey,
    })
    .rpc();
  
  console.log('✅ DCA plan resumed:', signature);
  
  return signature;
}

/**
 * Cancel a DCA plan (closes the account and refunds rent)
 */
export async function cancelDcaPlanTransaction(
  connection: Connection,
  provider: AnchorProvider,
  userPublicKey: PublicKey,
  planPda: PublicKey
): Promise<string> {
  
  const idl = loadRouterIdl();
  const program = new Program(idl, provider);
  
  console.log('❌ Cancelling DCA plan:', planPda.toBase58());
  
  interface CancelDcaPlanMethods {
    cancelDcaPlan: () => {
      accounts: (accounts: Record<string, unknown>) => {
        rpc: () => Promise<string>;
      };
    };
  }
  
  const signature = await (program.methods as unknown as CancelDcaPlanMethods)
    .cancelDcaPlan()
    .accounts({
      dcaPlan: planPda,
      user: userPublicKey,
    })
    .rpc();
  
  console.log('✅ DCA plan cancelled:', signature);
  
  return signature;
}

/**
 * Check if a DCA plan is ready for execution
 */
export function isPlanReadyForExecution(dcaPlan: DcaPlan): boolean {
  const now = Date.now() / 1000; // Current time in seconds
  const nextExecution = dcaPlan.nextExecution.toNumber();
  
  return (
    dcaPlan.isActive &&
    dcaPlan.executedSwaps < dcaPlan.totalSwaps &&
    now >= nextExecution
  );
}

/**
 * Format timestamp to readable date
 */
export function formatTimestamp(timestamp: BN | number): string {
  const ts = typeof timestamp === 'number' ? timestamp : timestamp.toNumber();
  return new Date(ts * 1000).toLocaleString();
}

/**
 * Get time remaining until next execution
 */
export function getTimeUntilNextExecution(nextExecution: BN): string {
  const now = Date.now() / 1000;
  const next = nextExecution.toNumber();
  const diff = next - now;
  
  if (diff <= 0) return 'Ready now';
  
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  
  return `${minutes}m`;
}
