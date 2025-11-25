/**
 * Shared DCA Execution Utilities
 * 
 * This module provides shared functions for DCA execution
 * that can be used by both the web app and the keeper service
 */

import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { AnchorProvider } from '@coral-xyz/anchor';
import { 
  getAssociatedTokenAddress, 
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAccount
} from '@solana/spl-token';
import { createProgramWithProvider } from '../program';
import routerIdl from '../../idl/swapback_router.json';

// Token mints
export const BACK_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_BACK_MINT ||
  '862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux'
);

export interface DcaPlan {
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

/**
 * Get Router State PDA
 */
export function getRouterStatePDA(): [PublicKey, number] {
  const ROUTER_PROGRAM_ID = new PublicKey(
    process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID || 
    '9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh'
  );
  
  return PublicKey.findProgramAddressSync(
    [Buffer.from('router_state')],
    ROUTER_PROGRAM_ID
  );
}

/**
 * Execute a DCA swap transaction
 * 
 * Can be called by:
 * - The user themselves (via web UI)
 * - The keeper bot (automated execution)
 * 
 * @param connection Solana connection
 * @param provider Anchor provider with the executor's wallet
 * @param userPublicKey The original user who owns the DCA plan
 * @param planPda The DCA plan PDA address
 * @param dcaPlan The DCA plan data
 * @returns Transaction signature
 */
export async function executeDcaSwapShared(
  connection: Connection,
  provider: AnchorProvider,
  userPublicKey: PublicKey,
  planPda: PublicKey,
  dcaPlan: DcaPlan
): Promise<string> {
  const ROUTER_PROGRAM_ID = new PublicKey(
    process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID || 
    '9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh'
  );

  const program = createProgramWithProvider(routerIdl as any, ROUTER_PROGRAM_ID, provider);
  
  const [statePda] = getRouterStatePDA();
  
  // Determine token programs
  const tokenInProgram = dcaPlan.tokenIn.equals(BACK_MINT) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  const tokenOutProgram = dcaPlan.tokenOut.equals(BACK_MINT) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  
  // Get user's token accounts
  const userTokenIn = await getAssociatedTokenAddress(
    dcaPlan.tokenIn,
    userPublicKey,
    false,
    tokenInProgram
  );
  
  const userTokenOut = await getAssociatedTokenAddress(
    dcaPlan.tokenOut,
    userPublicKey,
    false,
    tokenOutProgram
  );
  
  console.log('🔍 Checking token accounts:', {
    userTokenIn: userTokenIn.toBase58(),
    userTokenOut: userTokenOut.toBase58(),
  });
  
  // Check if ATAs exist and create them if needed
  const preInstructions = [];
  
  try {
    await getAccount(connection, userTokenIn, 'confirmed', tokenInProgram);
    console.log('✅ user_token_in exists');
  } catch (error) {
    console.log('⚠️  user_token_in does not exist, creating...');
    preInstructions.push(
      createAssociatedTokenAccountInstruction(
        provider.wallet.publicKey, // payer (executor pays)
        userTokenIn, // ata
        userPublicKey, // owner
        dcaPlan.tokenIn, // mint
        tokenInProgram
      )
    );
  }
  
  try {
    await getAccount(connection, userTokenOut, 'confirmed', tokenOutProgram);
    console.log('✅ user_token_out exists');
  } catch (error) {
    console.log('⚠️  user_token_out does not exist, creating...');
    preInstructions.push(
      createAssociatedTokenAccountInstruction(
        provider.wallet.publicKey, // payer (executor pays)
        userTokenOut, // ata
        userPublicKey, // owner
        dcaPlan.tokenOut, // mint
        tokenOutProgram
      )
    );
  }
  
  console.log('🔄 Executing DCA swap:', {
    planPda: planPda.toBase58(),
    user: userPublicKey.toBase58(),
    executor: provider.wallet.publicKey.toBase58(),
    executedSwaps: dcaPlan.executedSwaps,
    totalSwaps: dcaPlan.totalSwaps,
    preInstructions: preInstructions.length,
  });
  
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
      dcaPlan: planPda,
      state: statePda,
      userTokenIn,
      userTokenOut,
      user: userPublicKey,
      executor: provider.wallet.publicKey,
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
  
  console.log('✅ DCA swap executed:', signature);
  
  return signature;
}
