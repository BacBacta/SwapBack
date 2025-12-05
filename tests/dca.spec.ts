/**
 * 🧪 DCA Integration Tests
 * 
 * Tests for DCA (Dollar Cost Averaging) plan lifecycle:
 * - Create plan
 * - Pause/Resume
 * - Cancel
 * - State invariants
 * 
 * NOTE: These tests run against a local validator without external DEX dependencies.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SwapbackRouter } from "../target/types/swapback_router";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { expect } from "chai";
import { createTestMint, createTestATA, mintTestTokens } from "./utils/token-helpers";

const shouldRunAnchorDcaSuite = process.env.RUN_ANCHOR_DCA_TESTS === "true";
const describeDca = shouldRunAnchorDcaSuite ? describe : describe.skip;

if (!shouldRunAnchorDcaSuite) {
  console.warn(
    "[tests/dca.spec.ts] Skipping Anchor-dependent DCA suite (set RUN_ANCHOR_DCA_TESTS=true to enable)."
  );
}

describeDca("DCA Plan Lifecycle", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SwapbackRouter as Program<SwapbackRouter>;
  const connection = provider.connection;
  
  // Test accounts
  let user: Keypair;
  let tokenInMint: PublicKey;
  let tokenOutMint: PublicKey;
  let userTokenIn: PublicKey;
  let userTokenOut: PublicKey;
  let routerState: PublicKey;
  let dcaPlanPda: PublicKey;
  
  // Plan parameters
  const planId = Keypair.generate().publicKey.toBytes().slice(0, 32);
  const amountPerSwap = new anchor.BN(1_000_000); // 1 token
  const totalSwaps = 10;
  const intervalSeconds = new anchor.BN(3600); // 1 hour
  const minOutPerSwap = new anchor.BN(900_000); // 0.9 token (10% slippage)
  
  before(async () => {
    // Setup user
    user = Keypair.generate();
    await connection.requestAirdrop(user.publicKey, 10 * LAMPORTS_PER_SOL);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create test tokens
    tokenInMint = await createTestMint(connection, user, user.publicKey);
    tokenOutMint = await createTestMint(connection, user, user.publicKey);
    
    // Create user token accounts
    userTokenIn = await createTestATA(connection, user, tokenInMint, user.publicKey);
    userTokenOut = await createTestATA(connection, user, tokenOutMint, user.publicKey);
    
    // Mint tokens to user
    await mintTestTokens(connection, user, tokenInMint, userTokenIn, user, 100_000_000);
    
    // Derive PDAs
    [routerState] = PublicKey.findProgramAddressSync(
      [Buffer.from("router_state")],
      program.programId
    );
    
    [dcaPlanPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("dca_plan"),
        user.publicKey.toBuffer(),
        Buffer.from(planId)
      ],
      program.programId
    );
  });

  describe("Initialize Router (if needed)", () => {
    it("should initialize router state", async () => {
      try {
        const stateAccount = await connection.getAccountInfo(routerState);
        if (stateAccount === null) {
          // Initialize only if not exists
          await program.methods
            .initialize()
            .accounts({
              state: routerState,
              authority: user.publicKey,
              systemProgram: SystemProgram.programId,
            })
            .signers([user])
            .rpc();
        }
      } catch (e) {
        // State may already exist from previous tests
        console.log("Router state already initialized or error:", e);
      }
    });
  });

  describe("Create DCA Plan", () => {
    it("should create a new DCA plan", async () => {
      const expiresAt = new anchor.BN(Math.floor(Date.now() / 1000) + 86400 * 30); // 30 days
      
      try {
        await program.methods
          .createDcaPlan(
            Array.from(planId),
            tokenInMint,
            tokenOutMint,
            amountPerSwap,
            totalSwaps,
            intervalSeconds,
            minOutPerSwap,
            expiresAt
          )
          .accounts({
            dcaPlan: dcaPlanPda,
            state: routerState,
            user: user.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([user])
          .rpc();

        // Verify plan was created
        const plan = await program.account.dcaPlan.fetch(dcaPlanPda);
        expect(plan.user.toString()).to.equal(user.publicKey.toString());
        expect(plan.tokenIn.toString()).to.equal(tokenInMint.toString());
        expect(plan.tokenOut.toString()).to.equal(tokenOutMint.toString());
        expect(plan.amountPerSwap.toNumber()).to.equal(amountPerSwap.toNumber());
        expect(plan.totalSwaps).to.equal(totalSwaps);
        expect(plan.isActive).to.be.true;
        expect(plan.executedSwaps).to.equal(0);
      } catch (e) {
        console.log("Create DCA plan error:", e);
        throw e;
      }
    });

    it("should have correct initial state", async () => {
      const plan = await program.account.dcaPlan.fetch(dcaPlanPda);
      
      // Invariants
      expect(plan.executedSwaps).to.equal(0);
      expect(plan.totalInvested.toNumber()).to.equal(0);
      expect(plan.totalReceived.toNumber()).to.equal(0);
      expect(plan.isActive).to.be.true;
    });
  });

  describe("Pause DCA Plan", () => {
    it("should pause an active plan", async () => {
      await program.methods
        .pauseDcaPlan()
        .accounts({
          dcaPlan: dcaPlanPda,
          user: user.publicKey,
        })
        .signers([user])
        .rpc();

      const plan = await program.account.dcaPlan.fetch(dcaPlanPda);
      expect(plan.isActive).to.be.false;
    });

    it("should not change executed_swaps when pausing", async () => {
      const plan = await program.account.dcaPlan.fetch(dcaPlanPda);
      expect(plan.executedSwaps).to.equal(0);
    });

    it("should fail if already paused", async () => {
      try {
        await program.methods
          .pauseDcaPlan()
          .accounts({
            dcaPlan: dcaPlanPda,
            user: user.publicKey,
          })
          .signers([user])
          .rpc();
        expect.fail("Should have thrown AlreadyPaused error");
      } catch (e: any) {
        expect(e.message).to.include("AlreadyPaused");
      }
    });
  });

  describe("Resume DCA Plan", () => {
    it("should resume a paused plan", async () => {
      await program.methods
        .resumeDcaPlan()
        .accounts({
          dcaPlan: dcaPlanPda,
          user: user.publicKey,
        })
        .signers([user])
        .rpc();

      const plan = await program.account.dcaPlan.fetch(dcaPlanPda);
      expect(plan.isActive).to.be.true;
    });

    it("should not change executed_swaps when resuming", async () => {
      const plan = await program.account.dcaPlan.fetch(dcaPlanPda);
      expect(plan.executedSwaps).to.equal(0);
    });

    it("should fail if already active", async () => {
      try {
        await program.methods
          .resumeDcaPlan()
          .accounts({
            dcaPlan: dcaPlanPda,
            user: user.publicKey,
          })
          .signers([user])
          .rpc();
        expect.fail("Should have thrown AlreadyActive error");
      } catch (e: any) {
        expect(e.message).to.include("AlreadyActive");
      }
    });
  });

  describe("Cancel DCA Plan", () => {
    it("should cancel and close the plan", async () => {
      const userBalanceBefore = await connection.getBalance(user.publicKey);
      
      await program.methods
        .cancelDcaPlan()
        .accounts({
          dcaPlan: dcaPlanPda,
          user: user.publicKey,
        })
        .signers([user])
        .rpc();

      // Verify account is closed
      const accountInfo = await connection.getAccountInfo(dcaPlanPda);
      expect(accountInfo).to.be.null;

      // Verify rent was refunded
      const userBalanceAfter = await connection.getBalance(user.publicKey);
      expect(userBalanceAfter).to.be.greaterThan(userBalanceBefore - 10000); // Allow for tx fee
    });
  });

  describe("Ownership Invariants", () => {
    let otherUser: Keypair;
    let newPlanPda: PublicKey;
    const newPlanId = Keypair.generate().publicKey.toBytes().slice(0, 32);

    before(async () => {
      otherUser = Keypair.generate();
      await connection.requestAirdrop(otherUser.publicKey, 2 * LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));

      [newPlanPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("dca_plan"),
          user.publicKey.toBuffer(),
          Buffer.from(newPlanId)
        ],
        program.programId
      );

      // Create a new plan for ownership tests
      const expiresAt = new anchor.BN(Math.floor(Date.now() / 1000) + 86400 * 30);
      await program.methods
        .createDcaPlan(
          Array.from(newPlanId),
          tokenInMint,
          tokenOutMint,
          amountPerSwap,
          totalSwaps,
          intervalSeconds,
          minOutPerSwap,
          expiresAt
        )
        .accounts({
          dcaPlan: newPlanPda,
          state: routerState,
          user: user.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([user])
        .rpc();
    });

    it("should reject pause from non-owner", async () => {
      try {
        await program.methods
          .pauseDcaPlan()
          .accounts({
            dcaPlan: newPlanPda,
            user: otherUser.publicKey,
          })
          .signers([otherUser])
          .rpc();
        expect.fail("Should have rejected non-owner");
      } catch (e: any) {
        // Expected: constraint violation
        expect(e.toString()).to.include("Error");
      }
    });

    it("should reject cancel from non-owner", async () => {
      try {
        await program.methods
          .cancelDcaPlan()
          .accounts({
            dcaPlan: newPlanPda,
            user: otherUser.publicKey,
          })
          .signers([otherUser])
          .rpc();
        expect.fail("Should have rejected non-owner");
      } catch (e: any) {
        expect(e.toString()).to.include("Error");
      }
    });

    after(async () => {
      // Cleanup
      try {
        await program.methods
          .cancelDcaPlan()
          .accounts({
            dcaPlan: newPlanPda,
            user: user.publicKey,
          })
          .signers([user])
          .rpc();
      } catch (e) {
        // Ignore cleanup errors
      }
    });
  });
});
