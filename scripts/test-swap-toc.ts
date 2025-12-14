#!/usr/bin/env npx tsx
/**
 * Test SwapToC Instruction
 * 
 * Simule l'instruction swap_toc sur mainnet pour vérifier
 * si le programme déployé supporte cette instruction.
 * 
 * Usage: npx tsx scripts/test-swap-toc.ts
 */

import {
  Connection,
  PublicKey,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import * as fs from "fs";

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

async function testSwapToc() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("TEST SWAP_TOC INSTRUCTION");
  console.log("═══════════════════════════════════════════════════════════════");
  
  const connection = new Connection(RPC_URL, "confirmed");
  
  // Charger le keypair réel
  const keypairPath = "/workspaces/SwapBack/mainnet-deploy-keypair.json";
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const user = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  console.log(`\n📍 User: ${user.publicKey.toBase58()}`);
  
  // Dériver les PDAs
  const [routerState] = PublicKey.findProgramAddressSync(
    [Buffer.from("router_state")],
    ROUTER_PROGRAM_ID
  );
  console.log(`📍 RouterState: ${routerState.toBase58()}`);
  
  const [planPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("swap_plan"), user.publicKey.toBuffer()],
    ROUTER_PROGRAM_ID
  );
  console.log(`📍 Plan PDA: ${planPda.toBase58()}`);
  
  const [userRebate] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_rebate"), user.publicKey.toBuffer()],
    ROUTER_PROGRAM_ID
  );
  console.log(`📍 User Rebate: ${userRebate.toBase58()}`);
  
  const [routerConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("router_config")],
    ROUTER_PROGRAM_ID
  );
  console.log(`📍 Router Config: ${routerConfig.toBase58()}`);
  
  // ATAs
  const userTokenA = await getAssociatedTokenAddress(SOL_MINT, user.publicKey);
  const userTokenB = await getAssociatedTokenAddress(USDC_MINT, user.publicKey);
  console.log(`📍 User Token A (wSOL): ${userTokenA.toBase58()}`);
  console.log(`📍 User Token B (USDC): ${userTokenB.toBase58()}`);
  
  // Vaults (besoin de les dériver ou récupérer)
  // On va utiliser des placeholders pour tester si l'instruction est reconnue
  const vaultTokenA = userTokenA; // Placeholder
  const vaultTokenB = userTokenB; // Placeholder
  
  // Discriminator pour swap_toc (de l'IDL)
  // [187, 201, 212, 51, 16, 155, 236, 60]
  const discriminator = Buffer.from([187, 201, 212, 51, 16, 155, 236, 60]);
  
  // SwapArgs sérialisation
  // struct SwapArgs {
  //   amount_in: u64,
  //   min_out: u64,
  //   use_plan: bool,
  //   slippage_bps: u16,
  //   require_mev_protection: bool,
  //   max_staleness_secs: Option<i64>,
  // }
  
  const amountIn = Buffer.alloc(8);
  amountIn.writeBigUInt64LE(BigInt(100000000)); // 0.1 SOL
  
  const minOut = Buffer.alloc(8);
  minOut.writeBigUInt64LE(BigInt(1000000)); // 1 USDC min
  
  const usePlan = Buffer.from([1]); // true
  
  const slippageBps = Buffer.alloc(2);
  slippageBps.writeUInt16LE(100); // 1%
  
  const requireMevProtection = Buffer.from([0]); // false
  
  // max_staleness_secs: Option<i64> = None
  const maxStaleness = Buffer.from([0]); // None
  
  const instructionData = Buffer.concat([
    discriminator,
    amountIn,
    minOut,
    usePlan,
    slippageBps,
    requireMevProtection,
    maxStaleness,
  ]);
  
  console.log(`\n📦 Instruction data size: ${instructionData.length} bytes`);
  console.log(`   Discriminator: [${Array.from(discriminator).join(", ")}]`);
  
  // Construire l'instruction (avec les comptes minimaux pour voir si elle est reconnue)
  // NOTE: Cette instruction échouera car les comptes ne sont pas correctement configurés,
  // mais on veut juste voir si le discriminator est reconnu
  
  const swapTocIx = new TransactionInstruction({
    programId: ROUTER_PROGRAM_ID,
    keys: [
      { pubkey: routerState, isSigner: false, isWritable: true },
      { pubkey: user.publicKey, isSigner: true, isWritable: true },
      { pubkey: PYTH_SOL_USD, isSigner: false, isWritable: false }, // primary_oracle
      // fallback_oracle: None - on ne l'inclut pas
      { pubkey: userTokenA, isSigner: false, isWritable: true },
      { pubkey: userTokenB, isSigner: false, isWritable: true },
      { pubkey: vaultTokenA, isSigner: false, isWritable: true },
      { pubkey: vaultTokenB, isSigner: false, isWritable: true },
      // plan: Some(planPda)
      { pubkey: planPda, isSigner: false, isWritable: true },
      // remaining accounts...
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: instructionData,
  });
  
  console.log(`\n🔧 Accounts:`);
  console.log(`   [0] state: ${routerState.toBase58()}`);
  console.log(`   [1] user: ${user.publicKey.toBase58()}`);
  console.log(`   [2] primary_oracle: ${PYTH_SOL_USD.toBase58()}`);
  console.log(`   [3] user_token_a: ${userTokenA.toBase58()}`);
  console.log(`   [4] user_token_b: ${userTokenB.toBase58()}`);
  console.log(`   [5] vault_token_a: ${vaultTokenA.toBase58()}`);
  console.log(`   [6] vault_token_b: ${vaultTokenB.toBase58()}`);
  console.log(`   [7] plan: ${planPda.toBase58()}`);
  console.log(`   [8] token_program: ${TOKEN_PROGRAM_ID.toBase58()}`);
  
  // Créer la transaction
  const { blockhash } = await connection.getLatestBlockhash();
  
  const message = new TransactionMessage({
    payerKey: user.publicKey,
    recentBlockhash: blockhash,
    instructions: [swapTocIx],
  }).compileToV0Message();
  
  const tx = new VersionedTransaction(message);
  tx.sign([user]);
  
  console.log(`\n🚀 Simulation de la transaction...`);
  
  try {
    const result = await connection.simulateTransaction(tx, {
      sigVerify: false,
      replaceRecentBlockhash: true,
    });
    
    console.log(`\n📊 Résultat de la simulation:`);
    
    if (result.value.err) {
      console.log(`   ❌ Erreur: ${JSON.stringify(result.value.err)}`);
      
      // Décoder l'erreur
      if (typeof result.value.err === "object" && "InstructionError" in result.value.err) {
        const [idx, err] = (result.value.err as { InstructionError: [number, unknown] }).InstructionError;
        console.log(`   📍 Instruction index: ${idx}`);
        
        if (typeof err === "object" && "Custom" in (err as Record<string, unknown>)) {
          const customCode = (err as { Custom: number }).Custom;
          console.log(`   📍 Custom error code: ${customCode} (0x${customCode.toString(16)})`);
          
          if (customCode === 0x65 || customCode === 101) {
            console.log(`   ⚠️ InstructionFallbackNotFound (0x65)`);
            console.log(`   → Le programme ne reconnaît pas cette instruction!`);
          } else {
            console.log(`   ℹ️ L'instruction est RECONNUE (erreur différente de 0x65)`);
          }
        }
      }
    } else {
      console.log(`   ✅ Simulation réussie!`);
    }
    
    if (result.value.logs) {
      console.log(`\n📜 Logs:`);
      for (const log of result.value.logs.slice(0, 30)) {
        console.log(`   ${log}`);
      }
      if (result.value.logs.length > 30) {
        console.log(`   ... (${result.value.logs.length - 30} more logs)`);
      }
    }
    
    console.log(`\n   Units consumed: ${result.value.unitsConsumed}`);
    
  } catch (error) {
    console.log(`\n❌ Erreur lors de la simulation:`);
    console.log(error);
  }
  
  console.log("\n═══════════════════════════════════════════════════════════════");
}

testSwapToc().catch(console.error);
