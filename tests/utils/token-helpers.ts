/**
 * 🧪 Test Utilities - Token helpers for integration tests
 */

import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
  getAccount,
  transfer,
} from "@solana/spl-token";

/**
 * Create a new SPL token mint
 */
export async function createTestMint(
  connection: Connection,
  payer: Keypair,
  mintAuthority: PublicKey,
  decimals: number = 6
): Promise<PublicKey> {
  return await createMint(
    connection,
    payer,
    mintAuthority,
    null, // freeze authority
    decimals
  );
}

/**
 * Create an Associated Token Account for a user
 */
export async function createTestATA(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  return await createAssociatedTokenAccount(
    connection,
    payer,
    mint,
    owner
  );
}

/**
 * Mint tokens to an account
 */
export async function mintTestTokens(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  destination: PublicKey,
  authority: Keypair,
  amount: number
): Promise<string> {
  return await mintTo(
    connection,
    payer,
    mint,
    destination,
    authority,
    amount
  );
}

/**
 * Get token balance
 */
export async function getTokenBalance(
  connection: Connection,
  tokenAccount: PublicKey
): Promise<bigint> {
  const account = await getAccount(connection, tokenAccount);
  return account.amount;
}

/**
 * Transfer tokens
 */
export async function transferTokens(
  connection: Connection,
  payer: Keypair,
  source: PublicKey,
  destination: PublicKey,
  owner: Keypair,
  amount: number
): Promise<string> {
  return await transfer(
    connection,
    payer,
    source,
    destination,
    owner,
    amount
  );
}

/**
 * Setup a test environment with mints and token accounts
 */
export interface TestEnv {
  tokenInMint: PublicKey;
  tokenOutMint: PublicKey;
  userTokenIn: PublicKey;
  userTokenOut: PublicKey;
  vaultTokenIn: PublicKey;
  vaultTokenOut: PublicKey;
}

export async function setupTestEnv(
  connection: Connection,
  payer: Keypair,
  user: PublicKey,
  vault: PublicKey
): Promise<TestEnv> {
  // Create mints
  const tokenInMint = await createTestMint(connection, payer, payer.publicKey);
  const tokenOutMint = await createTestMint(connection, payer, payer.publicKey);

  // Create user ATAs
  const userTokenIn = await createTestATA(connection, payer, tokenInMint, user);
  const userTokenOut = await createTestATA(connection, payer, tokenOutMint, user);

  // Create vault ATAs
  const vaultTokenIn = await createTestATA(connection, payer, tokenInMint, vault);
  const vaultTokenOut = await createTestATA(connection, payer, tokenOutMint, vault);

  // Mint initial tokens to user
  await mintTestTokens(connection, payer, tokenInMint, userTokenIn, payer, 1_000_000_000);

  // Mint tokens to vault (for simulated swap output)
  await mintTestTokens(connection, payer, tokenOutMint, vaultTokenOut, payer, 1_000_000_000);

  return {
    tokenInMint,
    tokenOutMint,
    userTokenIn,
    userTokenOut,
    vaultTokenIn,
    vaultTokenOut,
  };
}

/**
 * Airdrop SOL to a wallet
 */
export async function airdropSol(
  connection: Connection,
  destination: PublicKey,
  lamports: number = LAMPORTS_PER_SOL
): Promise<void> {
  const sig = await connection.requestAirdrop(destination, lamports);
  await connection.confirmTransaction(sig);
}
