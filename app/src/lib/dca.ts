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

import { validateEnv } from "./validateEnv";
import routerIdl from "@/idl/swapback_router.json";

/**
 * Get Router Program ID avec validation lazy (seulement au moment de l'utilisation)
 * Évite les erreurs au chargement du module dans le navigateur
 */
function getRouterProgramId(): PublicKey {
  const routerProgramId = process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID;
  
  if (!routerProgramId) {
    throw new Error(
      `❌ NEXT_PUBLIC_ROUTER_PROGRAM_ID is required. Set it to: ${routerIdl.address}\n\n` +
      `This is CRITICAL for DCA operations to avoid AccountOwnedByWrongProgram errors.\n` +
      `Add to your .env.local or Vercel environment variables.`
    );
  }
  
  return new PublicKey(routerProgramId);
}

// Program constants - utilise une fonction getter pour éviter l'évaluation au chargement
export const ROUTER_PROGRAM_ID = getRouterProgramId();

// Token mints - évaluation lazy pour éviter les erreurs au chargement
export const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

function getUsdcMint(): PublicKey {
  return new PublicKey(
    process.env.NEXT_PUBLIC_USDC_MINT || 
    'BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR'
  );
}

function getBackMint(): PublicKey {
  const backMint = process.env.NEXT_PUBLIC_BACK_MINT;
  if (!backMint) {
    throw new Error(
      '❌ NEXT_PUBLIC_BACK_MINT is required. ' +
      'Devnet: 862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux'
    );
  }
  return new PublicKey(backMint);
}

export const USDC_MINT = getUsdcMint();
export const BACK_MINT = getBackMint();

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
 * DCA Plan with account address
 */
export interface DcaPlanWithAddress extends DcaPlan {
  planPda: PublicKey;
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
 * Convert lamports/smallest unit to UI amount (safe for large values)
 * Uses BN division to avoid Number overflow for amounts > 2^53
 */
export function lamportsToUi(amount: BN, decimals: number): number {
  // Diviser d'abord avec BN pour réduire la magnitude
  const divisor = new BN(10).pow(new BN(decimals));
  const whole = amount.div(divisor); // Partie entière
  const remainder = amount.mod(divisor); // Reste
  
  // Conversion safe: only convert after division
  // Si whole > MAX_SAFE_INTEGER, retourner MAX_SAFE_INTEGER (cas extrême)
  if (whole.gt(new BN(Number.MAX_SAFE_INTEGER))) {
    console.warn(`Amount too large: ${amount.toString()} lamports. Returning MAX_SAFE_INTEGER`);
    return Number.MAX_SAFE_INTEGER;
  }
  
  return whole.toNumber() + (remainder.toNumber() / Math.pow(10, decimals));
}

/**
 * Ensure Router State is initialized (helper function)
 * Checks if state exists, and initializes if not
 */
export async function ensureRouterStateInitialized(
  connection: Connection,
  provider: AnchorProvider,
  authorityPublicKey: PublicKey
): Promise<boolean> {
  
  const [statePda] = getRouterStatePDA();
  
  try {
    const stateAccount = await connection.getAccountInfo(statePda);
    if (stateAccount) {
      console.log('✅ Router State is initialized');
      return true;
    }
  } catch (error) {
    console.log('⚠️ Error checking Router State:', error);
    // State not found, need to initialize
  }
  
  console.log('⚠️ Router State not initialized, initializing now...');
  console.log('📍 State PDA:', statePda.toBase58());
  console.log('👤 Authority:', authorityPublicKey.toBase58());
  
  try {
    const signature = await initializeRouterState(connection, provider, authorityPublicKey);
    console.log('✅ Initialization successful, signature:', signature);
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Router State:', error);
    // Log more details about the error
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return false;
  }
}

/**
 * Load the Router program IDL
 * Loads from public folder to avoid fs module issues
 */
let cachedIdl: Idl | null = null;

export async function loadRouterIdl(): Promise<Idl> {
  // Return cached IDL if available
  if (cachedIdl) {
    return cachedIdl;
  }

  try {
    // Load IDL from public folder (works in browser)
    const response = await fetch('/idl/swapback_router.json');
    if (!response.ok) {
      throw new Error(`Failed to load IDL: ${response.statusText}`);
    }
    cachedIdl = await response.json();
    return cachedIdl as Idl;
  } catch (error) {
    console.error('Error loading Router IDL:', error);
    throw new Error('Router IDL not found. Please ensure swapback_router.json is in /public/idl/');
  }
}

/**
 * Initialize the Router State (must be called once before any DCA operations)
 */
export async function initializeRouterState(
  connection: Connection,
  provider: AnchorProvider,
  authorityPublicKey: PublicKey
): Promise<string> {
  
  // Load IDL and create program instance
  const idl = await loadRouterIdl();
  const program = new Program(idl, provider);
  
  // Derive state PDA
  const [statePda] = getRouterStatePDA();
  
  // Check if already initialized
  try {
    const stateAccount = await connection.getAccountInfo(statePda);
    if (stateAccount) {
      console.log('✅ Router State already initialized');
      return 'already_initialized';
    }
  } catch {
    console.log('Router State not initialized, proceeding...');
  }
  
  console.log('🔄 Initializing Router State:', {
    statePda: statePda.toBase58(),
    authority: authorityPublicKey.toBase58(),
    programId: ROUTER_PROGRAM_ID.toBase58(),
  });
  
  try {
    // Build transaction
    interface InitializeMethods {
      initialize: () => {
        accounts: (accounts: Record<string, unknown>) => {
          rpc: () => Promise<string>;
        };
      };
    }
    
    const signature = await (program.methods as unknown as InitializeMethods)
      .initialize()
      .accounts({
        state: statePda,
        authority: authorityPublicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log('✅ Router State initialized:', signature);
    
    return signature;
  } catch (error) {
    console.error('❌ Failed to call initialize instruction:', error);
    throw error;
  }
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
  const idl = await loadRouterIdl();
  const program = new Program(idl, provider);
  
  // Generate unique plan ID
  const planId = generatePlanId();
  
  // Derive PDAs
  const [planPda] = getDcaPlanPDA(userPublicKey, planId);
  const [statePda] = getRouterStatePDA();
  
  // 🔒 VALIDATION CRITIQUE: Vérifier la cohérence du Program ID (côté serveur uniquement)
  if (typeof window === 'undefined') {
    // Validation stricte côté serveur
    const envConfig = validateEnv();
    console.log('🔍 [DCA CREATE] Server-side environment validation:');
    console.log('   ROUTER_PROGRAM_ID:', ROUTER_PROGRAM_ID.toString());
    console.log('   IDL address:', routerIdl.address);
    console.log('   State PDA:', statePda.toString());
    
    if (ROUTER_PROGRAM_ID.toString() !== routerIdl.address) {
      throw new Error(
        `❌ CRITICAL: Router Program ID mismatch! This WILL cause AccountOwnedByWrongProgram errors!\n` +
        `  Code uses: ${ROUTER_PROGRAM_ID.toString()}\n` +
        `  IDL has:   ${routerIdl.address}\n\n` +
        `Fix: Set NEXT_PUBLIC_ROUTER_PROGRAM_ID=${routerIdl.address}`
      );
    }
  }
  
  // Check if Router State is initialized
  try {
    const stateAccount = await connection.getAccountInfo(statePda);
    if (!stateAccount) {
      throw new Error('Router State not initialized. Please initialize first.');
    }
  } catch (error) {
    console.error('⚠️ Router State check failed:', error);
    throw new Error('Router State must be initialized before creating DCA plans');
  }
  
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
): Promise<DcaPlanWithAddress[]> {
  
  console.log('🔍 Fetching DCA plans for user:', userPublicKey.toBase58());
  
  const idl = await loadRouterIdl();
  const program = new Program(idl, provider);
  
  // DcaPlan account structure:
  // - discriminator: 8 bytes [231, 97, 112, 227, 171, 241, 52, 84]
  // - plan_id: 32 bytes (u8[32])
  // - user: 32 bytes (pubkey) <- at offset 40
  
  console.log('🔍 Searching with filters:', {
    programId: ROUTER_PROGRAM_ID.toBase58(),
    discriminator: Buffer.from([231, 97, 112, 227, 171, 241, 52, 84]).toString('hex'),
    userOffset: 40,
  });
  
  // Use getProgramAccounts to fetch all DCA plans owned by the user
  const accounts = await connection.getProgramAccounts(ROUTER_PROGRAM_ID, {
    filters: [
      {
        // Filter by DcaPlan account discriminator
        memcmp: {
          offset: 0,
          bytes: Buffer.from([231, 97, 112, 227, 171, 241, 52, 84]).toString('base64'),
        },
      },
      {
        // Filter by user pubkey (at offset 40 = 8 bytes discriminator + 32 bytes plan_id)
        memcmp: {
          offset: 40,
          bytes: userPublicKey.toBase58(),
        },
      },
    ],
  });
  
  console.log(`📦 Found ${accounts.length} account(s) matching filters`);
  
  const plans: DcaPlanWithAddress[] = [];
  
  for (const account of accounts) {
    try {
      console.log('🔓 Decoding account:', account.pubkey.toBase58());
      // Deserialize account data
      const dcaPlan = program.coder.accounts.decode('DcaPlan', account.account.data) as DcaPlan;
      console.log('✅ Decoded plan:', {
        user: dcaPlan.user.toBase58(),
        tokenIn: dcaPlan.tokenIn.toBase58(),
        tokenOut: dcaPlan.tokenOut.toBase58(),
        executedSwaps: dcaPlan.executedSwaps,
        totalSwaps: dcaPlan.totalSwaps,
      });
      plans.push({
        ...dcaPlan,
        planPda: account.pubkey,
      });
    } catch (error) {
      console.warn('❌ Failed to decode DCA plan:', account.pubkey.toBase58(), error);
    }
  }
  
  console.log(`✅ Successfully fetched ${plans.length} DCA plan(s) for user ${userPublicKey.toBase58()}`);
  
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
  
  const idl = await loadRouterIdl();
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
  
  const idl = await loadRouterIdl();
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
  
  const idl = await loadRouterIdl();
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
  
  const idl = await loadRouterIdl();
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
  
  // Safe conversion: timestamps are in seconds (< 2^32), always safe
  const nextExecution = dcaPlan.nextExecution.toNumber();
  
  return (
    dcaPlan.isActive &&
    dcaPlan.executedSwaps < dcaPlan.totalSwaps &&
    now >= nextExecution
  );
}

/**
 * Format timestamp to readable date (safe for timestamp values)
 */
export function formatTimestamp(timestamp: BN | number): string {
  // Timestamps are seconds since epoch, always < 2^32, safe to convert
  const ts = typeof timestamp === 'number' ? timestamp : timestamp.toNumber();
  return new Date(ts * 1000).toLocaleString();
}

/**
 * Get time remaining until next execution
 */
export function getTimeUntilNextExecution(nextExecution: BN): string {
  const now = Date.now() / 1000;
  // Safe: timestamp in seconds, always < 2^32
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
