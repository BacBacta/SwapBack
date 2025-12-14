#!/usr/bin/env npx tsx
/**
 * Test Full True Native Flow
 * 
 * Simule le flux complet create_plan + swap_toc sur mainnet
 * pour vérifier que les transactions sont correctement construites.
 * 
 * Usage: npx tsx scripts/test-full-native-flow.ts
 */

import {
  Connection,
  PublicKey,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import * as fs from "fs";
import BN from "bn.js";

// Configuration
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const ROUTER_PROGRAM_ID = new PublicKey("APHj6L2b2bA2q62jwYZp38dqbTxQUqwatqdUum1trPnN");

// Test mints
const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

// Pyth Oracle
const PYTH_SOL_USD = new PublicKey("7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE");

// Orca Whirlpool Program
const ORCA_WHIRLPOOL = new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");

// Max staleness for test
const MAX_STALENESS_SECS = 300;

/**
 * Serialize SwapArgs according to IDL structure
 */
function serializeSwapArgs(args: {
  amountIn: BN;
  minOut: BN;
  useDynamicPlan: boolean;
  useBundle: boolean;
  planAccount: PublicKey;
  primaryOracleAccount: PublicKey;
  maxStalenessOverride?: number;
}): Buffer {
  const buffers: Buffer[] = [];
  
  // 1. amount_in: u64
  buffers.push(args.amountIn.toArrayLike(Buffer, "le", 8));
  
  // 2. min_out: u64
  buffers.push(args.minOut.toArrayLike(Buffer, "le", 8));
  
  // 3. slippage_tolerance: Option<u16> - None
  buffers.push(Buffer.from([0]));
  
  // 4. twap_slices: Option<u8> - None
  buffers.push(Buffer.from([0]));
  
  // 5. use_dynamic_plan: bool
  buffers.push(Buffer.from([args.useDynamicPlan ? 1 : 0]));
  
  // 6. plan_account: Option<Pubkey>
  if (args.useDynamicPlan && args.planAccount) {
    buffers.push(Buffer.from([1])); // Some
    buffers.push(args.planAccount.toBuffer());
  } else {
    buffers.push(Buffer.from([0])); // None
  }
  
  // 7. use_bundle: bool
  buffers.push(Buffer.from([args.useBundle ? 1 : 0]));
  
  // 8. primary_oracle_account: Pubkey
  buffers.push(args.primaryOracleAccount.toBuffer());
  
  // 9. fallback_oracle_account: Option<Pubkey> - None
  buffers.push(Buffer.from([0]));
  
  // 10. jupiter_route: Option<JupiterRouteParams> - None
  buffers.push(Buffer.from([0]));
  
  // 11. jupiter_swap_ix_data: Option<Vec<u8>> - None
  buffers.push(Buffer.from([0]));
  
  // 12. liquidity_estimate: Option<u64> - None
  buffers.push(Buffer.from([0]));
  
  // 13. volatility_bps: Option<u16> - None
  buffers.push(Buffer.from([0]));
  
  // 14. min_venue_score: Option<u16> - None
  buffers.push(Buffer.from([0]));
  
  // 15. slippage_per_venue: Option<Vec<VenueSlippage>> - None
  buffers.push(Buffer.from([0]));
  
  // 16. token_a_decimals: Option<u8> - Some(9) for SOL
  buffers.push(Buffer.from([1, 9]));
  
  // 17. token_b_decimals: Option<u8> - Some(6) for USDC
  buffers.push(Buffer.from([1, 6]));
  
  // 18. max_staleness_override: Option<i64>
  if (args.maxStalenessOverride !== undefined && args.maxStalenessOverride > 0) {
    const staleBuf = Buffer.alloc(9);
    staleBuf.writeUInt8(1, 0); // Some
    staleBuf.writeBigInt64LE(BigInt(args.maxStalenessOverride), 1);
    buffers.push(staleBuf);
  } else {
    buffers.push(Buffer.from([0]));
  }
  
  // 19. jito_bundle: Option<JitoBundleConfig> - None
  buffers.push(Buffer.from([0]));
  
  return Buffer.concat(buffers);
}

async function testFullNativeFlow() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("TEST FULL TRUE NATIVE FLOW (create_plan + swap_toc)");
  console.log("═══════════════════════════════════════════════════════════════");
  
  const connection = new Connection(RPC_URL, "confirmed");
  
  // Charger le keypair
  const keypairPath = "/workspaces/SwapBack/mainnet-deploy-keypair.json";
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const user = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  console.log(`\n📍 User: ${user.publicKey.toBase58()}`);
  
  // ===========================================================================
  // DÉRIVER TOUS LES PDAS
  // ===========================================================================
  
  // Router State
  const [routerState] = PublicKey.findProgramAddressSync(
    [Buffer.from("router_state")],
    ROUTER_PROGRAM_ID
  );
  console.log(`📍 RouterState: ${routerState.toBase58()}`);
  
  // Plan PDA
  const [planPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("swap_plan"), user.publicKey.toBuffer()],
    ROUTER_PROGRAM_ID
  );
  console.log(`📍 Plan PDA: ${planPda.toBase58()}`);
  
  // User Rebate PDA
  const [userRebate] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_rebate"), user.publicKey.toBuffer()],
    ROUTER_PROGRAM_ID
  );
  console.log(`📍 User Rebate: ${userRebate.toBase58()}`);
  
  // Rebate Vault PDA (seeds: ["rebate_vault", state])
  const [rebateVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("rebate_vault"), routerState.toBuffer()],
    ROUTER_PROGRAM_ID
  );
  console.log(`📍 Rebate Vault: ${rebateVault.toBase58()}`);
  
  // Oracle Cache PDA (seeds: ["oracle_cache", primary_oracle])
  const [oracleCache] = PublicKey.findProgramAddressSync(
    [Buffer.from("oracle_cache"), PYTH_SOL_USD.toBuffer()],
    ROUTER_PROGRAM_ID
  );
  console.log(`📍 Oracle Cache: ${oracleCache.toBase58()}`);
  
  // Venue Score PDA (seeds: ["venue_score", state])
  const [venueScore] = PublicKey.findProgramAddressSync(
    [Buffer.from("venue_score"), routerState.toBuffer()],
    ROUTER_PROGRAM_ID
  );
  console.log(`📍 Venue Score: ${venueScore.toBase58()}`);
  
  // User Token Accounts (ATAs)
  const userTokenA = await getAssociatedTokenAddress(SOL_MINT, user.publicKey);
  const userTokenB = await getAssociatedTokenAddress(USDC_MINT, user.publicKey);
  console.log(`📍 User Token A (wSOL): ${userTokenA.toBase58()}`);
  console.log(`📍 User Token B (USDC): ${userTokenB.toBase58()}`);
  
  // Vault Token Accounts (PDAs owned by router for SOL and USDC)
  const [vaultTokenA] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), SOL_MINT.toBuffer()],
    ROUTER_PROGRAM_ID
  );
  const [vaultTokenB] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), USDC_MINT.toBuffer()],
    ROUTER_PROGRAM_ID
  );
  console.log(`📍 Vault Token A: ${vaultTokenA.toBase58()}`);
  console.log(`📍 Vault Token B: ${vaultTokenB.toBase58()}`);
  
  // ===========================================================================
  // STEP 1: CREATE PLAN
  // ===========================================================================
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("STEP 1: CREATE PLAN");
  console.log("═══════════════════════════════════════════════════════════════");
  
  const planId = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    planId[i] = Math.floor(Math.random() * 256);
  }
  
  const createPlanDiscriminator = Buffer.from([77, 43, 141, 254, 212, 118, 41, 186]);
  
  // Sérialiser CreatePlanArgs
  const amountIn = 100000000; // 0.1 SOL
  const minOut = 1000000; // 1 USDC min
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  
  const planIdBuffer = Buffer.from(planId);
  const tokenInBuffer = SOL_MINT.toBuffer();
  const tokenOutBuffer = USDC_MINT.toBuffer();
  const amountInBuffer = Buffer.alloc(8);
  amountInBuffer.writeBigUInt64LE(BigInt(amountIn));
  const minOutBuffer = Buffer.alloc(8);
  minOutBuffer.writeBigUInt64LE(BigInt(minOut));
  const expiresAtBuffer = Buffer.alloc(8);
  expiresAtBuffer.writeBigInt64LE(BigInt(expiresAt));
  
  // Venues (1 venue: Orca)
  const venuesLenBuffer = Buffer.alloc(4);
  venuesLenBuffer.writeUInt32LE(1);
  const venueBuffer = ORCA_WHIRLPOOL.toBuffer();
  const weightBuffer = Buffer.alloc(2);
  weightBuffer.writeUInt16LE(10000); // 100%
  
  // Fallback plans (empty)
  const fallbackLenBuffer = Buffer.alloc(4);
  fallbackLenBuffer.writeUInt32LE(0);
  
  const createPlanData = Buffer.concat([
    createPlanDiscriminator,
    planIdBuffer,         // plan_id argument
    planIdBuffer,         // plan_data.plan_id
    tokenInBuffer,
    tokenOutBuffer,
    amountInBuffer,
    minOutBuffer,
    venuesLenBuffer,
    venueBuffer,
    weightBuffer,
    fallbackLenBuffer,
    expiresAtBuffer,
  ]);
  
  const createPlanIx = new TransactionInstruction({
    programId: ROUTER_PROGRAM_ID,
    keys: [
      { pubkey: planPda, isSigner: false, isWritable: true },
      { pubkey: user.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: createPlanData,
  });
  
  console.log(`📦 Create Plan instruction built`);
  console.log(`   Data size: ${createPlanData.length} bytes`);
  
  // ===========================================================================
  // STEP 2: SWAP_TOC
  // ===========================================================================
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("STEP 2: SWAP_TOC");
  console.log("═══════════════════════════════════════════════════════════════");
  
  const swapTocDiscriminator = Buffer.from([187, 201, 212, 51, 16, 155, 236, 60]);
  
  const swapArgsBuffer = serializeSwapArgs({
    amountIn: new BN(amountIn),
    minOut: new BN(minOut),
    useDynamicPlan: true,
    useBundle: false,
    planAccount: planPda,
    primaryOracleAccount: PYTH_SOL_USD,
    maxStalenessOverride: MAX_STALENESS_SECS,
  });
  
  const swapTocData = Buffer.concat([swapTocDiscriminator, swapArgsBuffer]);
  
  console.log(`📦 SwapArgs serialized: ${swapArgsBuffer.length} bytes`);
  console.log(`📦 Total swap_toc data: ${swapTocData.length} bytes`);
  
  /**
   * Comptes swap_toc dans l'ordre de l'IDL:
   * 1.  state (writable)
   * 2.  user (signer, writable)
   * 3.  primary_oracle
   * 4.  fallback_oracle (optional)
   * 5.  user_token_account_a (writable)
   * 6.  user_token_account_b (writable)
   * 7.  vault_token_account_a (writable)
   * 8.  vault_token_account_b (writable)
   * 9.  plan (optional)
   * 10. user_nft (optional)
   * 11. buyback_program (optional)
   * 12. buyback_usdc_vault (optional)
   * 13. buyback_state (optional)
   * 14. user_rebate_account (optional)
   * 15. user_rebate (optional, PDA)
   * 16. rebate_vault (PDA)
   * 17. oracle_cache (optional, PDA)
   * 18. venue_score (optional, PDA)
   * 19. token_program
   * 20. system_program
   */
  const swapTocKeys = [
    // 1. state
    { pubkey: routerState, isSigner: false, isWritable: true },
    // 2. user
    { pubkey: user.publicKey, isSigner: true, isWritable: true },
    // 3. primary_oracle
    { pubkey: PYTH_SOL_USD, isSigner: false, isWritable: false },
    // 4. fallback_oracle (optional) - using primary as placeholder
    { pubkey: PYTH_SOL_USD, isSigner: false, isWritable: false },
    // 5. user_token_account_a
    { pubkey: userTokenA, isSigner: false, isWritable: true },
    // 6. user_token_account_b
    { pubkey: userTokenB, isSigner: false, isWritable: true },
    // 7. vault_token_account_a
    { pubkey: vaultTokenA, isSigner: false, isWritable: true },
    // 8. vault_token_account_b
    { pubkey: vaultTokenB, isSigner: false, isWritable: true },
    // 9. plan (using dynamic plan)
    { pubkey: planPda, isSigner: false, isWritable: true },
    // 10. user_nft (optional) - placeholder
    { pubkey: ROUTER_PROGRAM_ID, isSigner: false, isWritable: false },
    // 11. buyback_program (optional) - placeholder
    { pubkey: ROUTER_PROGRAM_ID, isSigner: false, isWritable: false },
    // 12. buyback_usdc_vault (optional) - placeholder
    { pubkey: ROUTER_PROGRAM_ID, isSigner: false, isWritable: false },
    // 13. buyback_state (optional) - placeholder
    { pubkey: ROUTER_PROGRAM_ID, isSigner: false, isWritable: false },
    // 14. user_rebate_account (optional) - placeholder
    { pubkey: ROUTER_PROGRAM_ID, isSigner: false, isWritable: false },
    // 15. user_rebate (PDA)
    { pubkey: userRebate, isSigner: false, isWritable: true },
    // 16. rebate_vault (PDA)
    { pubkey: rebateVault, isSigner: false, isWritable: true },
    // 17. oracle_cache (PDA)
    { pubkey: oracleCache, isSigner: false, isWritable: true },
    // 18. venue_score (PDA)
    { pubkey: venueScore, isSigner: false, isWritable: true },
    // 19. token_program
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    // 20. system_program
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  
  const swapTocIx = new TransactionInstruction({
    programId: ROUTER_PROGRAM_ID,
    keys: swapTocKeys,
    data: swapTocData,
  });
  
  console.log(`\n🔧 swap_toc accounts (${swapTocKeys.length}):`);
  swapTocKeys.forEach((k, i) => {
    console.log(`   [${i.toString().padStart(2)}] ${k.pubkey.toBase58().slice(0, 20)}... ${k.isWritable ? 'W' : 'R'}${k.isSigner ? 'S' : ''}`);
  });
  
  // ===========================================================================
  // SIMULER LA TRANSACTION COMPLÈTE
  // ===========================================================================
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("SIMULATION");
  console.log("═══════════════════════════════════════════════════════════════");
  
  const { blockhash } = await connection.getLatestBlockhash();
  
  const message = new TransactionMessage({
    payerKey: user.publicKey,
    recentBlockhash: blockhash,
    instructions: [createPlanIx, swapTocIx],
  }).compileToV0Message();
  
  const tx = new VersionedTransaction(message);
  tx.sign([user]);
  
  console.log(`\n🚀 Simulating transaction with 2 instructions...`);
  
  try {
    const result = await connection.simulateTransaction(tx, {
      sigVerify: false,
      replaceRecentBlockhash: true,
    });
    
    console.log(`\n📊 Result:`);
    
    if (result.value.err) {
      console.log(`   ❌ Error: ${JSON.stringify(result.value.err)}`);
      
      if (typeof result.value.err === "object" && "InstructionError" in result.value.err) {
        const [idx, err] = (result.value.err as { InstructionError: [number, unknown] }).InstructionError;
        console.log(`   📍 Instruction index: ${idx} (${idx === 0 ? 'create_plan' : 'swap_toc'})`);
        
        if (typeof err === "object" && "Custom" in (err as Record<string, unknown>)) {
          const customCode = (err as { Custom: number }).Custom;
          console.log(`   📍 Custom error: ${customCode} (0x${customCode.toString(16)})`);
          
          // Décoder les erreurs courantes
          if (customCode === 0x65 || customCode === 101) {
            console.log(`   ⚠️ InstructionFallbackNotFound - instruction non reconnue`);
          } else if (customCode === 0x66 || customCode === 102) {
            console.log(`   ⚠️ InstructionDidNotDeserialize - mauvais format d'arguments`);
          } else if (customCode >= 6000) {
            console.log(`   📍 Anchor custom error: ${customCode - 6000}`);
          }
        }
      }
    } else {
      console.log(`   ✅ Simulation SUCCESS!`);
    }
    
    if (result.value.logs) {
      console.log(`\n📜 Logs:`);
      for (const log of result.value.logs) {
        console.log(`   ${log}`);
      }
    }
    
    console.log(`\n   Units consumed: ${result.value.unitsConsumed}`);
    
  } catch (error) {
    console.log(`\n❌ Exception:`);
    console.log(error);
  }
  
  console.log("\n═══════════════════════════════════════════════════════════════");
}

testFullNativeFlow().catch(console.error);
