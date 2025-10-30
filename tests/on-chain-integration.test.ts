/**
 * On-Chain Integration Tests
 *
 * Tests that simulate on-chain execution flow for weighted swap operations
 * These tests deploy and call the actual Solana programs to verify end-to-end functionality
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { createMint, createAccount, mintTo } from "@solana/spl-token";
import { loadProgram } from "./utils/load-idl";

// ============================================================================
// ON-CHAIN INTEGRATION TESTS
// ============================================================================

const shouldRunOnChainTests = process.env.RUN_ON_CHAIN_TESTS === "true";
const describeOnChain = shouldRunOnChainTests ? describe : describe.skip;

if (!shouldRunOnChainTests) {
  console.warn(
    "Skipping on-chain integration tests. Set RUN_ON_CHAIN_TESTS=true to enable."
  );
}

describeOnChain("On-Chain Integration Tests", () => {
  // Configure the client to use localnet for testing
  const keypair = anchor.web3.Keypair.generate();
  const wallet = new anchor.Wallet(keypair);

  // Use devnet for testing
  const connection = new anchor.web3.Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  // Program instance
  let program: any;

  const COMMON_SWAP_PROGRAM_ID = new PublicKey(
    "D4Hz5ZBPWrLvnjNheQa7FYLVpzuGmPGRqFGWNqg5jRg6"
  );

  // Test tokens (using devnet tokens)
  const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112"); // Wrapped SOL

  // Test accounts
  let globalState: PublicKey;
  let userInputTokenAccount: PublicKey;
  let userOutputTokenAccount: PublicKey;
  let testTokenMint: PublicKey;

  beforeAll(async () => {
    // Airdrop SOL to the test account for transaction fees
    const airdropSignature = await connection.requestAirdrop(
      keypair.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(airdropSignature);

    // Load the program
    program = loadProgram({
      programName: "common_swap",
      provider,
      programId: COMMON_SWAP_PROGRAM_ID.toBase58(),
    }) as any;

    // Derive global state PDA
    [globalState] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_state")],
      program.programId
    );

    // Create test token mint for testing
    testTokenMint = await createMint(
      connection,
      keypair,
      keypair.publicKey,
      null,
      9, // 9 decimals
      undefined,
      {},
      anchor.utils.token.TOKEN_PROGRAM_ID
    );

    // Create user token accounts
    userInputTokenAccount = await createAccount(
      connection,
      keypair,
      testTokenMint,
      keypair.publicKey,
      undefined,
      undefined,
      anchor.utils.token.TOKEN_PROGRAM_ID
    );

    userOutputTokenAccount = await createAccount(
      connection,
      keypair,
      SOL_MINT,
      keypair.publicKey,
      undefined,
      undefined,
      anchor.utils.token.TOKEN_PROGRAM_ID
    );

    // Mint some test tokens to user
    await mintTo(
      connection,
      keypair,
      testTokenMint,
      userInputTokenAccount,
      keypair.publicKey,
      100_000_000_000, // 100k tokens with 9 decimals
      [],
      {},
      anchor.utils.token.TOKEN_PROGRAM_ID
    );

    // Initialize the program if not already done
    try {
      await program.methods
        .initialize()
        .accounts({
          globalState,
          authority: keypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([keypair])
        .rpc();
    } catch (error) {
      // Program might already be initialized
      console.log(
        "Program already initialized or initialization failed:",
        (error as Error).message
      );
    }
  });

  describe("Weighted Swap Execution", () => {
    it("should execute a weighted swap across multiple venues", async () => {
      const inputAmount = 10_000_000_000; // 10k tokens
      const minOutputAmount = 9_000_000_000; // Minimum 9k output
      const weights = [40, 35, 25]; // Weights summing to 100
      const venueAddresses = [
        new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"), // Raydium
        new PublicKey("9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP"), // Orca
        new PublicKey("27haf8L6oxUeXrHrgEgsexjSY5hbVUWEmvv9Nyxg8vQv"), // Phoenix
      ];

      // Execute weighted swap
      const tx = await program.methods
        .executeWeightedSwap(
          testTokenMint, // input_mint
          SOL_MINT, // output_mint
          new BN(inputAmount), // total_input_amount
          new BN(minOutputAmount), // min_output_amount
          Buffer.from(weights), // weights
          venueAddresses, // venue_addresses
          new BN(1_000_000), // oracle_price (1 USD in 6 decimals)
          new BN(10_000), // oracle_confidence
          false, // use_jito_bundling
          500 // max_slippage_bps (5%)
        )
        .accounts({
          globalState,
          user: keypair.publicKey,
          userInputAccount: userInputTokenAccount,
          userOutputAccount: userOutputTokenAccount,
        })
        .signers([keypair])
        .rpc();

      // Verify transaction was successful
      expect(tx).toBeDefined();
      expect(typeof tx).toBe("string");

      // Verify global state was updated
      let globalStateAccount =
        await program.account.globalState.fetch(globalState);
      expect(globalStateAccount.totalSwaps.toNumber()).toBeGreaterThan(0);

      console.log("Weighted swap executed successfully with tx:", tx);
    });

    it("should reject swap with invalid weights", async () => {
      const inputAmount = 1_000_000_000;
      const minOutputAmount = 900_000_000;
      const invalidWeights = [50, 60]; // Weights don't sum to 100
      const venueAddresses = [
        new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"),
        new PublicKey("9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP"),
      ];

      await expect(
        program.methods
          .executeWeightedSwap(
            testTokenMint,
            SOL_MINT,
            new BN(inputAmount),
            new BN(minOutputAmount),
            Buffer.from(invalidWeights),
            venueAddresses,
            new BN(1_000_000),
            new BN(10_000),
            false,
            500
          )
          .accounts({
            globalState,
            user: keypair.publicKey,
            userInputAccount: userInputTokenAccount,
            userOutputAccount: userOutputTokenAccount,
          })
          .signers([keypair])
          .rpc()
      ).rejects.toThrow();
    });

    it("should reject swap when slippage exceeds limit", async () => {
      const inputAmount = 1_000_000_000;
      const minOutputAmount = 1_000_000_000; // Unrealistically high minimum
      const weights = [100]; // Single venue
      const venueAddresses = [
        new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"),
      ];

      await expect(
        program.methods
          .executeWeightedSwap(
            testTokenMint,
            SOL_MINT,
            new BN(inputAmount),
            new BN(minOutputAmount),
            Buffer.from(weights),
            venueAddresses,
            new BN(1_000_000),
            new BN(10_000),
            false,
            500
          )
          .accounts({
            globalState,
            user: keypair.publicKey,
            userInputAccount: userInputTokenAccount,
            userOutputAccount: userOutputTokenAccount,
          })
          .signers([keypair])
          .rpc()
      ).rejects.toThrow();
    });

    it("should handle emergency pause correctly", async () => {
      // Get current authority from global state
      const initialGlobalState =
        await program.account.globalState.fetch(globalState);
      const currentAuthority = initialGlobalState.authority;

      // First pause the program using the correct authority
      await program.methods
        .pauseProgram(true)
        .accounts({
          globalState,
          authority: currentAuthority,
        })
        .signers([keypair]) // Note: this might fail if authority != keypair, but let's try
        .rpc();

      // Verify program is paused
      let updatedGlobalStateAccount =
        await program.account.globalState.fetch(globalState);
      expect(updatedGlobalStateAccount.isPaused).toBe(true);

      // Try to execute swap while paused - should fail
      const inputAmount = 1_000_000_000;
      const minOutputAmount = 900_000_000;
      const weights = [100];
      const venueAddresses = [
        new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"),
      ];

      await expect(
        program.methods
          .executeWeightedSwap(
            testTokenMint,
            SOL_MINT,
            new BN(inputAmount),
            new BN(minOutputAmount),
            Buffer.from(weights),
            venueAddresses,
            new BN(1_000_000),
            new BN(10_000),
            false,
            500
          )
          .accounts({
            globalState,
            user: keypair.publicKey,
            userInputAccount: userInputTokenAccount,
            userOutputAccount: userOutputTokenAccount,
          })
          .signers([keypair])
          .rpc()
      ).rejects.toThrow();
      await program.methods
        .pauseProgram(false)
        .accounts({
          globalState,
          authority: keypair.publicKey,
        })
        .signers([keypair])
        .rpc();

      // Verify program is unpaused
      const resumedGlobalState =
        await program.account.globalState.fetch(globalState);
      expect(resumedGlobalState.isPaused).toBe(false);
    });

    it("should execute dynamic swap with oracle data", async () => {
      const inputAmount = 5_000_000_000;
      const minOutputAmount = 4_000_000_000;

      const oracleData = {
        provider: { pyth: {} }, // Using Pyth oracle
        price: new BN(1_000_000), // 1 USD in 6 decimals
        confidence: new BN(5000), // Confidence interval
        timestamp: new BN(Math.floor(Date.now() / 1000)), // Current timestamp
        exponent: -6, // Price exponent
      };

      // Execute dynamic swap
      const tx = await program.methods
        .executeDynamicSwap(
          testTokenMint,
          SOL_MINT,
          new BN(inputAmount),
          new BN(minOutputAmount),
          oracleData,
          3 // max_venues
        )
        .accounts({
          globalState,
          user: keypair.publicKey,
          userInputAccount: userInputTokenAccount,
          userOutputAccount: userOutputTokenAccount,
        })
        .signers([keypair])
        .rpc();

      expect(tx).toBeDefined();
      console.log("Dynamic swap executed successfully with tx:", tx);
    });
  });

  describe("MEV Protection Integration", () => {
    it("should demonstrate Jito bundling capability", async () => {
      const swapAmount = 50_000_000_000; // Large trade (50k tokens)
      const weights = [30, 30, 40];
      const venueAddresses = [
        new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"),
        new PublicKey("9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP"),
        new PublicKey("27haf8L6oxUeXrHrgEgsexjSY5hbVUWEmvv9Nyxg8vQv"),
      ];

      // Execute swap with Jito bundling enabled
      const tx = await program.methods
        .executeWeightedSwap(
          testTokenMint,
          SOL_MINT,
          new BN(swapAmount),
          new BN(45_000_000_000), // Min output for large trade
          Buffer.from(weights),
          venueAddresses,
          new BN(1_000_000),
          new BN(10_000),
          true, // use_jito_bundling enabled
          300 // Lower slippage for large trades (3%)
        )
        .accounts({
          globalState,
          user: keypair.publicKey,
          userInputAccount: userInputTokenAccount,
          userOutputAccount: userOutputTokenAccount,
        })
        .signers([keypair])
        .rpc();

      expect(tx).toBeDefined();
      console.log("MEV-protected swap executed with tx:", tx);
    });
  });
});
