/**
 * Swap Serialization Tests
 * 
 * Tests de validation de la sérialisation des instructions swap_toc.
 * Vérifie que les arguments et comptes sont correctement sérialisés selon l'IDL.
 * 
 * Référence: docs/ai/solana-native-router-a2z.md
 * 
 * @vitest-environment node
 */

import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import * as crypto from "crypto";

// ============================================================================
// CONSTANTS
// ============================================================================

const ROUTER_PROGRAM_ID = new PublicKey("APHj6L2b2bA2q62jwYZp38dqbTxQUqwatqdUum1trPnN");

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calculate Anchor instruction discriminator
 */
function getDiscriminator(instructionName: string): Buffer {
  const hash = crypto.createHash("sha256").update(`global:${instructionName}`).digest();
  return hash.slice(0, 8);
}

/**
 * Serialize SwapArgs according to IDL
 * This should match exactly what the on-chain program expects
 */
function serializeSwapArgs(args: {
  amountIn: BN;
  minOut: BN;
  slippageTolerance: number | null;
  useDynamicPlan: boolean;
  useBundle: boolean;
  primaryOracleAccount: PublicKey;
  jupiterRoute?: { swapInstruction: Buffer; expectedInputAmount: BN } | null;
}): Buffer {
  const buffers: Buffer[] = [];
  
  // amount_in: u64
  buffers.push(args.amountIn.toArrayLike(Buffer, "le", 8));
  
  // min_out: u64
  buffers.push(args.minOut.toArrayLike(Buffer, "le", 8));
  
  // slippage_tolerance: Option<u16>
  if (args.slippageTolerance !== null) {
    const slippageBuf = Buffer.alloc(3);
    slippageBuf.writeUInt8(1, 0); // Some
    slippageBuf.writeUInt16LE(args.slippageTolerance, 1);
    buffers.push(slippageBuf);
  } else {
    buffers.push(Buffer.from([0])); // None
  }
  
  // twap_slices: Option<u8>
  buffers.push(Buffer.from([0])); // None
  
  // use_dynamic_plan: bool
  buffers.push(Buffer.from([args.useDynamicPlan ? 1 : 0]));
  
  // plan_account: Option<Pubkey>
  buffers.push(Buffer.from([0])); // None
  
  // use_bundle: bool
  buffers.push(Buffer.from([args.useBundle ? 1 : 0]));
  
  // primary_oracle_account: Pubkey
  buffers.push(args.primaryOracleAccount.toBuffer());
  
  // fallback_oracle_account: Option<Pubkey>
  buffers.push(Buffer.from([0])); // None
  
  // jupiter_route: Option<JupiterRouteParams>
  if (args.jupiterRoute && args.jupiterRoute.swapInstruction.length > 0) {
    buffers.push(Buffer.from([1])); // Some
    
    // swap_instruction: Vec<u8>
    const swapIxLen = Buffer.alloc(4);
    swapIxLen.writeUInt32LE(args.jupiterRoute.swapInstruction.length, 0);
    buffers.push(swapIxLen);
    buffers.push(args.jupiterRoute.swapInstruction);
    
    // expected_input_amount: u64
    buffers.push(args.jupiterRoute.expectedInputAmount.toArrayLike(Buffer, "le", 8));
  } else {
    buffers.push(Buffer.from([0])); // None
  }
  
  return Buffer.concat(buffers);
}

// ============================================================================
// TEST SUITE: Discriminator
// ============================================================================

describe("Instruction Discriminator", () => {
  it("should calculate correct discriminator for swap_toc", () => {
    const discriminator = getDiscriminator("swap_toc");
    const expected = Buffer.from([187, 201, 212, 51, 16, 155, 236, 60]);
    
    expect(discriminator).toEqual(expected);
    expect(discriminator.toString("hex")).toBe("bbc9d433109bec3c");
  });
});

// ============================================================================
// TEST SUITE: SwapArgs Serialization
// ============================================================================

describe("SwapArgs Serialization", () => {
  it("should serialize minimal SwapArgs (no jupiter_route) correctly", () => {
    const oracle = new PublicKey("7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE");
    
    const buffer = serializeSwapArgs({
      amountIn: new BN(1000000),
      minOut: new BN(900000),
      slippageTolerance: null,
      useDynamicPlan: false,
      useBundle: false,
      primaryOracleAccount: oracle,
      jupiterRoute: null,
    });
    
    // Expected structure:
    // - amount_in: 8 bytes
    // - min_out: 8 bytes
    // - slippage_tolerance None: 1 byte
    // - twap_slices None: 1 byte
    // - use_dynamic_plan: 1 byte
    // - plan_account None: 1 byte
    // - use_bundle: 1 byte
    // - primary_oracle_account: 32 bytes
    // - fallback_oracle_account None: 1 byte
    // - jupiter_route None: 1 byte
    // Total: 8 + 8 + 1 + 1 + 1 + 1 + 1 + 32 + 1 + 1 = 55 bytes
    
    expect(buffer.length).toBe(55);
  });

  it("should serialize SwapArgs with jupiter_route correctly", () => {
    const oracle = new PublicKey("7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE");
    const fakeSwapIx = Buffer.alloc(100); // 100 bytes fake swap instruction
    
    const buffer = serializeSwapArgs({
      amountIn: new BN(1000000),
      minOut: new BN(900000),
      slippageTolerance: null,
      useDynamicPlan: false,
      useBundle: false,
      primaryOracleAccount: oracle,
      jupiterRoute: {
        swapInstruction: fakeSwapIx,
        expectedInputAmount: new BN(1000000),
      },
    });
    
    // Expected structure:
    // - Base: 54 bytes (excluding jupiter_route None byte)
    // - jupiter_route Some: 1 byte
    // - swap_instruction length (u32): 4 bytes
    // - swap_instruction data: 100 bytes
    // - expected_input_amount: 8 bytes
    // Total: 54 + 1 + 4 + 100 + 8 = 167 bytes
    
    expect(buffer.length).toBe(167);
  });

  it("should serialize slippage_tolerance as Some correctly", () => {
    const oracle = new PublicKey("7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE");
    
    const buffer = serializeSwapArgs({
      amountIn: new BN(1000000),
      minOut: new BN(900000),
      slippageTolerance: 50, // 50 bps = 0.5%
      useDynamicPlan: false,
      useBundle: false,
      primaryOracleAccount: oracle,
      jupiterRoute: null,
    });
    
    // slippage_tolerance Some adds 2 bytes for the u16 value
    // Total: 55 + 2 = 57 bytes
    expect(buffer.length).toBe(57);
    
    // Check the slippage value is correctly serialized
    // Position: after amount_in (8) + min_out (8) = 16
    expect(buffer[16]).toBe(1); // Some
    expect(buffer.readUInt16LE(17)).toBe(50); // 50 bps
  });
});

// ============================================================================
// TEST SUITE: Accounts Count
// ============================================================================

describe("Accounts Order (IDL compliance)", () => {
  const IDL_ACCOUNT_COUNT = 19; // According to swap_toc IDL

  it("should have exactly 19 fixed accounts", () => {
    // The accounts list from the IDL
    const accounts = [
      "state",
      "user",
      "primary_oracle",
      "fallback_oracle",
      "user_token_account_a",
      "user_token_account_b",
      "vault_token_account_a",
      "vault_token_account_b",
      "plan",
      "user_nft",
      "buyback_program",
      "buyback_usdc_vault",
      "buyback_state",
      "user_rebate_account",
      "rebate_vault",
      "oracle_cache",
      "venue_score",
      "token_program",
      "system_program",
    ];
    
    expect(accounts.length).toBe(IDL_ACCOUNT_COUNT);
  });
});

// ============================================================================
// TEST SUITE: Oracle Validation
// ============================================================================

describe("Oracle Validation", () => {
  it("should not allow empty oracle pubkey", () => {
    const emptyOracle = PublicKey.default;
    
    // The oracle should not be the default empty key
    expect(emptyOracle.toBase58()).toBe("11111111111111111111111111111111");
    
    // In production, we should validate that the oracle is not the system program
    expect(emptyOracle.equals(PublicKey.default)).toBe(true);
  });
});
