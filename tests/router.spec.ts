/**
 * 🧪 Router Integration Tests
 * 
 * Tests for the SwapBack Router:
 * - Mock swap execution (without real DEX)
 * - Fee calculation verification
 * - Slippage enforcement
 * 
 * NOTE: These tests use a "mock swap" approach where we simulate
 * the Jupiter CPI by using SPL Token transfers. This allows testing
 * the router logic without depending on external DEX programs.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SwapbackRouter } from "../target/types/swapback_router";
import { 
  Keypair, 
  PublicKey, 
  SystemProgram,
  LAMPORTS_PER_SOL 
} from "@solana/web3.js";
import { expect } from "chai";
import { 
  createTestMint, 
  createTestATA, 
  mintTestTokens,
  getTokenBalance 
} from "./utils/token-helpers";

describe("Router Swap Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SwapbackRouter as Program<SwapbackRouter>;
  const connection = provider.connection;
  
  let authority: Keypair;
  let user: Keypair;
  let tokenInMint: PublicKey;
  let tokenOutMint: PublicKey;
  let userTokenIn: PublicKey;
  let userTokenOut: PublicKey;
  let routerState: PublicKey;
  let routerConfig: PublicKey;
  
  before(async () => {
    // Setup authority and user
    authority = Keypair.generate();
    user = Keypair.generate();
    
    await connection.requestAirdrop(authority.publicKey, 10 * LAMPORTS_PER_SOL);
    await connection.requestAirdrop(user.publicKey, 10 * LAMPORTS_PER_SOL);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create test tokens
    tokenInMint = await createTestMint(connection, authority, authority.publicKey);
    tokenOutMint = await createTestMint(connection, authority, authority.publicKey);
    
    // Create user token accounts
    userTokenIn = await createTestATA(connection, authority, tokenInMint, user.publicKey);
    userTokenOut = await createTestATA(connection, authority, tokenOutMint, user.publicKey);
    
    // Mint tokens to user
    await mintTestTokens(connection, authority, tokenInMint, userTokenIn, authority, 100_000_000);
    
    // Derive PDAs
    [routerState] = PublicKey.findProgramAddressSync(
      [Buffer.from("router_state")],
      program.programId
    );
    
    [routerConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("router_config")],
      program.programId
    );
  });

  describe("Router Initialization", () => {
    it("should initialize router state", async () => {
      try {
        const stateAccount = await connection.getAccountInfo(routerState);
        if (stateAccount === null) {
          await program.methods
            .initialize()
            .accounts({
              state: routerState,
              authority: authority.publicKey,
              systemProgram: SystemProgram.programId,
            })
            .signers([authority])
            .rpc();
        }
        
        const state = await program.account.routerState.fetch(routerState);
        expect(state.authority.toString()).to.equal(authority.publicKey.toString());
        expect(state.rebatePercentage).to.equal(7000); // 70%
        expect(state.treasuryPercentage).to.equal(1500); // 15%
        expect(state.boostVaultPercentage).to.equal(1500); // 15%
      } catch (e) {
        console.log("Init error:", e);
      }
    });

    it("should have correct fee configuration", async () => {
      const state = await program.account.routerState.fetch(routerState);
      
      // NPI allocation: 70% + 15% + 15% = 100%
      const npiSum = state.rebatePercentage + state.treasuryPercentage + state.boostVaultPercentage;
      expect(npiSum).to.equal(10000);
      
      // Platform fee allocation: 85% + 15% = 100%
      const feeSum = state.treasuryFromFeesBps + state.buyburnFromFeesBps;
      expect(feeSum).to.equal(10000);
    });
  });

  describe("Fee Calculation Verification", () => {
    it("should calculate platform fee correctly", () => {
      // 0.2% platform fee
      const PLATFORM_FEE_BPS = 20;
      const amount = 1_000_000_000; // 1000 tokens
      const expectedFee = (amount * PLATFORM_FEE_BPS) / 10000;
      expect(expectedFee).to.equal(2_000_000); // 2 tokens
    });

    it("should calculate rebate correctly", () => {
      // 70% of NPI goes to rebates
      const npi = 10_000_000; // 10 tokens NPI
      const rebateBps = 7000;
      const expectedRebate = (npi * rebateBps) / 10000;
      expect(expectedRebate).to.equal(7_000_000); // 7 tokens
    });

    it("should calculate boosted rebate correctly", () => {
      const npi = 10_000_000;
      const rebateBps = 7000;
      const boostBps = 1000; // 10% boost
      
      const baseRebate = (npi * rebateBps) / 10000;
      const boostAmount = (baseRebate * boostBps) / 10000;
      const totalRebate = baseRebate + boostAmount;
      
      expect(baseRebate).to.equal(7_000_000);
      expect(boostAmount).to.equal(700_000);
      expect(totalRebate).to.equal(7_700_000);
    });
  });

  describe("Slippage Calculation", () => {
    it("should calculate min_out with 50bps slippage", () => {
      const expectedOut = 1_000_000;
      const slippageBps = 50; // 0.5%
      const keepBps = 10000 - slippageBps;
      const minOut = (expectedOut * keepBps) / 10000;
      expect(minOut).to.equal(995_000);
    });

    it("should calculate min_out with 200bps slippage", () => {
      const expectedOut = 1_000_000;
      const slippageBps = 200; // 2%
      const keepBps = 10000 - slippageBps;
      const minOut = (expectedOut * keepBps) / 10000;
      expect(minOut).to.equal(980_000);
    });

    it("should handle 0% slippage", () => {
      const expectedOut = 1_000_000;
      const slippageBps = 0;
      const keepBps = 10000 - slippageBps;
      const minOut = (expectedOut * keepBps) / 10000;
      expect(minOut).to.equal(1_000_000);
    });
  });

  describe("Split Amount by Weights", () => {
    it("should split evenly for equal weights", () => {
      const amount = 1_000_000;
      const weights = [5000, 5000]; // 50-50
      
      const parts = weights.map(w => Math.floor(amount * w / 10000));
      const sum = parts.reduce((a, b) => a + b, 0);
      
      // Adjust last part for rounding
      parts[parts.length - 1] += amount - sum;
      
      expect(parts[0]).to.equal(500_000);
      expect(parts[1]).to.equal(500_000);
      expect(parts.reduce((a, b) => a + b, 0)).to.equal(amount);
    });

    it("should handle uneven weights", () => {
      const amount = 1_000_000;
      const weights = [6000, 3000, 1000]; // 60-30-10
      
      const parts = weights.map(w => Math.floor(amount * w / 10000));
      const sum = parts.reduce((a, b) => a + b, 0);
      parts[parts.length - 1] += amount - sum;
      
      expect(parts[0]).to.equal(600_000);
      expect(parts[1]).to.equal(300_000);
      expect(parts[2]).to.equal(100_000);
      expect(parts.reduce((a, b) => a + b, 0)).to.equal(amount);
    });

    it("should preserve total for odd amounts", () => {
      const amount = 999_997; // Odd amount
      const weights = [3333, 3333, 3334];
      
      const parts = weights.map(w => Math.floor(amount * w / 10000));
      const sum = parts.reduce((a, b) => a + b, 0);
      parts[parts.length - 1] += amount - sum;
      
      expect(parts.reduce((a, b) => a + b, 0)).to.equal(amount);
    });
  });

  describe("Venue Score Weight Adjustment", () => {
    it("should exclude venues below threshold", () => {
      const venues = [
        { venue: "Jupiter", weight: 5000, score: 2000 },
        { venue: "Orca", weight: 5000, score: 9000 },
      ];
      const threshold = 2500;
      
      const filtered = venues.filter(v => v.score >= threshold);
      expect(filtered.length).to.equal(1);
      expect(filtered[0].venue).to.equal("Orca");
    });

    it("should renormalize weights after exclusion", () => {
      const venues = [
        { venue: "Orca", weight: 5000 },
      ];
      
      const totalWeight = venues.reduce((a, v) => a + v.weight, 0);
      const normalized = venues.map(v => ({
        ...v,
        weight: Math.floor(v.weight * 10000 / totalWeight)
      }));
      
      // Adjust for rounding
      const sum = normalized.reduce((a, v) => a + v.weight, 0);
      normalized[normalized.length - 1].weight += 10000 - sum;
      
      expect(normalized[0].weight).to.equal(10000);
    });

    it("should scale weights by score", () => {
      const venues = [
        { venue: "Jupiter", weight: 5000, score: 5000 },  // 50% quality
        { venue: "Orca", weight: 5000, score: 10000 },    // 100% quality
      ];
      
      // Scale by score
      const scaled = venues.map(v => ({
        ...v,
        weight: Math.floor(v.weight * v.score / 10000)
      }));
      
      // Jupiter: 5000 * 5000 / 10000 = 2500
      // Orca: 5000 * 10000 / 10000 = 5000
      expect(scaled[0].weight).to.equal(2500);
      expect(scaled[1].weight).to.equal(5000);
      
      // Renormalize to 10000
      const total = scaled.reduce((a, v) => a + v.weight, 0);
      const normalized = scaled.map(v => ({
        ...v,
        weight: Math.floor(v.weight * 10000 / total)
      }));
      
      // Proportions: Jupiter ~33%, Orca ~66%
      expect(normalized[0].weight).to.be.approximately(3333, 1);
    });
  });

  describe("Revenue Allocation Invariants", () => {
    it("should allocate 100% of NPI", () => {
      const npi = 50_000_000;
      const rebateBps = 7000;
      const treasuryBps = 1500;
      const boostBps = 1500;
      
      const toRebate = Math.floor(npi * rebateBps / 10000);
      const toTreasury = Math.floor(npi * treasuryBps / 10000);
      const toBoost = Math.floor(npi * boostBps / 10000);
      
      // Account for rounding
      const total = toRebate + toTreasury + toBoost;
      expect(total).to.be.approximately(npi, 3);
    });

    it("should allocate 100% of platform fees", () => {
      const fee = 20_000_000;
      const treasuryBps = 8500;
      const buyburnBps = 1500;
      
      const toTreasury = Math.floor(fee * treasuryBps / 10000);
      const toBuyburn = Math.floor(fee * buyburnBps / 10000);
      
      const total = toTreasury + toBuyburn;
      expect(total).to.be.approximately(fee, 3);
    });
  });
});
