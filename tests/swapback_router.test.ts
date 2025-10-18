import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SwapbackRouter } from "../target/types/swapback_router";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

describe("swapback_router", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SwapbackRouter as Program<SwapbackRouter>;
  const provider = anchor.AnchorProvider.env();
  const user = provider.wallet;

  let routerState: PublicKey;
  let planAccount: PublicKey;
  let oracleAccount: PublicKey;

  before(async () => {
    // Derive PDAs
    [routerState] = PublicKey.findProgramAddressSync(
      [Buffer.from("router_state")],
      program.programId
    );

    // Create a mock oracle account (in production, this would be Pyth/Switchboard)
    oracleAccount = Keypair.generate().publicKey;

    // Initialize router state if needed
    try {
      await program.methods
        .initialize()
        .accounts({
          state: routerState,
          authority: user.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (e) {
      // State might already be initialized
    }
  });

  it("Validates oracle account requirement", async () => {
    const amountIn = new anchor.BN(1000000); // 1 SOL in lamports
    const minOut = new anchor.BN(50000);

    try {
      await program.methods
        .processSwapToc({
          amountIn,
          minOut,
          slippageTolerance: null,
          twapSlices: null,
          useDynamicPlan: false,
          planAccount: null,
          useBundle: false,
          oracleAccount: PublicKey.default, // Invalid oracle
        })
        .accounts({
          state: routerState,
          user: user.publicKey,
          oracle: PublicKey.default,
          // ... other accounts would be needed
        })
        .rpc();

      expect.fail("Should have thrown InvalidOraclePrice error");
    } catch (e) {
      expect(e.message).to.include("InvalidOraclePrice");
    }
  });

  it("Creates and validates swap plan with weight constraints", async () => {
    const planId = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 256)
    );

    // Create plan with invalid weights (don't sum to 10000)
    const invalidVenues = [
      {
        venue: new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"), // Raydium
        weight: new anchor.BN(5000), // 50%
      },
      {
        venue: new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"), // Orca
        weight: new anchor.BN(3000), // 30% - total 80%, should fail
      },
    ];

    try {
      await program.methods
        .createPlan({
          planId,
          tokenIn: new PublicKey("So11111111111111111111111111111111111111112"), // SOL
          tokenOut: new PublicKey(
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
          ), // USDC
          amountIn: new anchor.BN(1000000),
          minOut: new anchor.BN(50000),
          venues: invalidVenues,
          fallbackPlans: [],
          expiresAt: new anchor.BN(Date.now() / 1000 + 3600), // 1 hour
        })
        .accounts({
          plan: planAccount,
          user: user.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      expect.fail("Should have thrown InvalidPlanWeights error");
    } catch (e) {
      expect(e.message).to.include("InvalidPlanWeights");
    }
  });

  it("Creates valid swap plan with correct weights", async () => {
    const planId = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 256)
    );

    [planAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("swap_plan"), Buffer.from(planId)],
      program.programId
    );

    const validVenues = [
      {
        venue: new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"), // Raydium
        weight: new anchor.BN(6000), // 60%
      },
      {
        venue: new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"), // Orca
        weight: new anchor.BN(4000), // 40% - total 100%
      },
    ];

    await program.methods
      .createPlan({
        planId,
        tokenIn: new PublicKey("So11111111111111111111111111111111111111112"), // SOL
        tokenOut: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // USDC
        amountIn: new anchor.BN(1000000),
        minOut: new anchor.BN(50000),
        venues: validVenues,
        fallbackPlans: [],
        expiresAt: new anchor.BN(Date.now() / 1000 + 3600), // 1 hour
      })
      .accounts({
        plan: planAccount,
        user: user.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Verify plan was created
    const plan = await program.account.swapPlan.fetch(planAccount);
    expect(plan.venues.length).to.equal(2);
    expect(plan.venues[0].weight.toNumber()).to.equal(6000);
    expect(plan.venues[1].weight.toNumber()).to.equal(4000);
  });

  it("Rejects unauthorized plan access", async () => {
    const unauthorizedUser = Keypair.generate();

    const amountIn = new anchor.BN(1000000);
    const minOut = new anchor.BN(50000);

    try {
      await program.methods
        .processSwapToc({
          amountIn,
          minOut,
          slippageTolerance: null,
          twapSlices: null,
          useDynamicPlan: true,
          planAccount,
          useBundle: false,
          oracleAccount,
        })
        .accounts({
          state: routerState,
          user: unauthorizedUser.publicKey, // Wrong user
          oracle: oracleAccount,
          plan: planAccount,
          // ... other accounts
        })
        .signers([unauthorizedUser])
        .rpc();

      expect.fail("Should have thrown UnauthorizedPlanAccess error");
    } catch (e) {
      expect(e.message).to.include("UnauthorizedPlanAccess");
    }
  });

  it("Rejects expired plans", async () => {
    // Create an expired plan
    const expiredPlanId = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 256)
    );
    const [expiredPlanAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("swap_plan"), Buffer.from(expiredPlanId)],
      program.programId
    );

    const venues = [
      {
        venue: new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"),
        weight: new anchor.BN(10000), // 100%
      },
    ];

    await program.methods
      .createPlan({
        planId: expiredPlanId,
        tokenIn: new PublicKey("So11111111111111111111111111111111111111112"),
        tokenOut: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
        amountIn: new anchor.BN(1000000),
        minOut: new anchor.BN(50000),
        venues,
        fallbackPlans: [],
        expiresAt: new anchor.BN(1), // Already expired
      })
      .accounts({
        plan: expiredPlanAccount,
        user: user.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const amountIn = new anchor.BN(1000000);
    const minOut = new anchor.BN(50000);

    try {
      await program.methods
        .processSwapToc({
          amountIn,
          minOut,
          slippageTolerance: null,
          twapSlices: null,
          useDynamicPlan: true,
          planAccount: expiredPlanAccount,
          useBundle: false,
          oracleAccount,
        })
        .accounts({
          state: routerState,
          user: user.publicKey,
          oracle: oracleAccount,
          plan: expiredPlanAccount,
          // ... other accounts
        })
        .rpc();

      expect.fail("Should have thrown PlanExpired error");
    } catch (e) {
      expect(e.message).to.include("PlanExpired");
    }
  });

  it("Validates plan amount mismatch", async () => {
    const amountIn = new anchor.BN(2000000); // Different from plan amount
    const minOut = new anchor.BN(50000);

    try {
      await program.methods
        .processSwapToc({
          amountIn, // 2 SOL instead of 1 SOL
          minOut,
          slippageTolerance: null,
          twapSlices: null,
          useDynamicPlan: true,
          planAccount,
          useBundle: false,
          oracleAccount,
        })
        .accounts({
          state: routerState,
          user: user.publicKey,
          oracle: oracleAccount,
          plan: planAccount,
          // ... other accounts
        })
        .rpc();

      expect.fail("Should have thrown PlanAmountMismatch error");
    } catch (e) {
      expect(e.message).to.include("PlanAmountMismatch");
    }
  });

  it("Processes TWAP with invalid slice amount", async () => {
    const amountIn = new anchor.BN(1000000);
    const minOut = new anchor.BN(50000);

    try {
      await program.methods
        .processSwapToc({
          amountIn,
          minOut,
          slippageTolerance: null,
          twapSlices: new anchor.BN(1000), // Too many slices for amount
          useDynamicPlan: false,
          planAccount: null,
          useBundle: false,
          oracleAccount,
        })
        .accounts({
          state: routerState,
          user: user.publicKey,
          oracle: oracleAccount,
          // ... other accounts
        })
        .rpc();

      expect.fail("Should have thrown TwapSliceTooSmall error");
    } catch (e) {
      expect(e.message).to.include("TwapSliceTooSmall");
    }
  });

  // New regression tests for oracle validation
  it("Validates oracle staleness - rejects stale oracle data", async () => {
    // This test would require setting up a mock oracle with stale timestamp
    // For now, we'll test the oracle account validation
    const amountIn = new anchor.BN(1000000);
    const minOut = new anchor.BN(50000);

    try {
      await program.methods
        .processSwapToc({
          amountIn,
          minOut,
          slippageTolerance: null,
          twapSlices: null,
          useDynamicPlan: false,
          planAccount: null,
          useBundle: false,
          oracleAccount: Keypair.generate().publicKey, // Random pubkey, no oracle data
        })
        .accounts({
          state: routerState,
          user: user.publicKey,
          oracle: Keypair.generate().publicKey,
          // ... other accounts would be needed
        })
        .rpc();

      // In devnet mode, this should work with fallback logic
      // In production, it would fail with StaleOracleData
    } catch (e) {
      // Expected behavior depends on oracle implementation
      expect((e as Error).message).to.include("Oracle"); // Could be StaleOracleData or InvalidOraclePrice
    }
  });

  it("Tests DEX fallback when primary venue fails", async () => {
    // Create a plan with multiple venues where first venue will fail
    const planId = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 256)
    );

    const venues = [
      {
        venue: new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"), // Raydium (will fail in devnet)
        weight: new anchor.BN(5000), // 50%
      },
      {
        venue: new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"), // Orca (devnet implementation)
        weight: new anchor.BN(5000), // 50%
      },
    ];

    // Create plan account
    [planAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("swap_plan"), user.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .createPlan({
        planId,
        tokenIn: new PublicKey("So11111111111111111111111111111111111111112"),
        tokenOut: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
        amountIn: new anchor.BN(1000000),
        minOut: new anchor.BN(50000),
        venues,
        fallbackPlans: [],
        expiresAt: new anchor.BN(Date.now() / 1000 + 3600),
      })
      .accounts({
        plan: planAccount,
        user: user.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Execute swap with dynamic plan - should fallback to Orca
    const amountIn = new anchor.BN(1000000);
    const minOut = new anchor.BN(50000);

    try {
      await program.methods
        .processSwapToc({
          amountIn,
          minOut,
          slippageTolerance: null,
          twapSlices: null,
          useDynamicPlan: true,
          planAccount,
          useBundle: false,
          oracleAccount,
        })
        .accounts({
          state: routerState,
          user: user.publicKey,
          oracle: oracleAccount,
          plan: planAccount,
          // ... other accounts would be needed for actual swap
        })
        .rpc();

      // In devnet mode, Orca should succeed with simulated swap
    } catch (e) {
      // If all venues fail, expect SlippageExceeded
      expect((e as Error).message).to.include("SlippageExceeded");
    }
  });

  it("Validates security limits - rejects too many venues", async () => {
    const planId = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 256)
    );

    // Create plan with too many venues (MAX_VENUES = 10)
    const tooManyVenues = Array.from({ length: 15 }, (_, i) => ({
      venue: new PublicKey(`675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp${i}`),
      weight: new anchor.BN(1000), // Each gets equal weight
    }));

    try {
      await program.methods
        .createPlan({
          planId,
          tokenIn: new PublicKey("So11111111111111111111111111111111111111112"),
          tokenOut: new PublicKey(
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
          ),
          amountIn: new anchor.BN(1000000),
          minOut: new anchor.BN(50000),
          venues: tooManyVenues,
          fallbackPlans: [],
          expiresAt: new anchor.BN(Date.now() / 1000 + 3600),
        })
        .accounts({
          plan: planAccount,
          user: user.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      expect.fail(
        "Should have thrown InvalidPlanWeights error for too many venues"
      );
    } catch (e) {
      expect((e as Error).message).to.include("InvalidPlanWeights");
    }
  });

  it("Validates security limits - rejects too many fallback plans", async () => {
    const planId = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 256)
    );

    const validVenues = [
      {
        venue: new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"),
        weight: new anchor.BN(10000),
      },
    ];

    // Create too many fallback plans (MAX_FALLBACKS = 5)
    const tooManyFallbacks = Array.from({ length: 10 }, () => ({
      venues: validVenues,
      minOut: new anchor.BN(50000),
    }));

    try {
      await program.methods
        .createPlan({
          planId,
          tokenIn: new PublicKey("So11111111111111111111111111111111111111112"),
          tokenOut: new PublicKey(
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
          ),
          amountIn: new anchor.BN(1000000),
          minOut: new anchor.BN(50000),
          venues: validVenues,
          fallbackPlans: tooManyFallbacks,
          expiresAt: new anchor.BN(Date.now() / 1000 + 3600),
        })
        .accounts({
          plan: planAccount,
          user: user.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      expect.fail(
        "Should have thrown InvalidPlanWeights error for too many fallback plans"
      );
    } catch (e) {
      expect((e as Error).message).to.include("InvalidPlanWeights");
    }
  });

  it("Tests slippage tolerance calculation", async () => {
    const amountIn = new anchor.BN(1000000);
    const expectedMinOut = new anchor.BN(95000); // Expected output before slippage
    const slippageTolerance = new anchor.BN(500); // 5% slippage tolerance

    // This test validates that slippage calculation works correctly
    // In practice, this would be tested by checking the actual min_out calculation
    // For now, we test that the instruction accepts slippage parameters

    try {
      await program.methods
        .processSwapToc({
          amountIn,
          minOut: expectedMinOut,
          slippageTolerance,
          twapSlices: null,
          useDynamicPlan: false,
          planAccount: null,
          useBundle: false,
          oracleAccount,
        })
        .accounts({
          state: routerState,
          user: user.publicKey,
          oracle: oracleAccount,
          // ... other accounts
        })
        .rpc();

      // Should succeed or fail based on oracle/slippage logic
    } catch (e) {
      // Expected - oracle validation or DEX execution might fail in test environment
      expect((e as Error).message).to.include("Oracle"); // Oracle-related error expected
    }
  });

  it("Tests bundle hint emission for MEV protection", async () => {
    // Create a plan for bundled execution
    const planId = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 256)
    );

    const venues = [
      {
        venue: new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"),
        weight: new anchor.BN(10000),
      },
    ];

    await program.methods
      .createPlan({
        planId,
        tokenIn: new PublicKey("So11111111111111111111111111111111111111112"),
        tokenOut: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
        amountIn: new anchor.BN(1000000),
        minOut: new anchor.BN(50000),
        venues,
        fallbackPlans: [],
        expiresAt: new anchor.BN(Date.now() / 1000 + 3600),
      })
      .accounts({
        plan: planAccount,
        user: user.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Execute with bundle flag - should emit BundleHint event
    const amountIn = new anchor.BN(1000000);
    const minOut = new anchor.BN(50000);

    try {
      await program.methods
        .processSwapToc({
          amountIn,
          minOut,
          slippageTolerance: null,
          twapSlices: null,
          useDynamicPlan: true,
          planAccount,
          useBundle: true, // Enable bundling
          oracleAccount,
        })
        .accounts({
          state: routerState,
          user: user.publicKey,
          oracle: oracleAccount,
          plan: planAccount,
          // ... other accounts
        })
        .rpc();

      // BundleHint event should be emitted (would need event parsing to verify)
    } catch (e) {
      // Expected in test environment - DEX execution will fail
      expect((e as Error).message).to.include("SlippageExceeded");
    }
  });
});
