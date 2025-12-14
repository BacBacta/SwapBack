#!/usr/bin/env npx tsx
/**
 * Test Create Plan Script
 * 
 * Simule l'instruction create_plan sur mainnet pour vérifier
 * si le programme déployé supporte cette instruction.
 * 
 * Usage: npx tsx scripts/test-create-plan.ts
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
import * as fs from "fs";
import * as os from "os";

// Configuration
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const ROUTER_PROGRAM_ID = new PublicKey("APHj6L2b2bA2q62jwYZp38dqbTxQUqwatqdUum1trPnN");

// Test mints
const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

// Orca Whirlpool Program
const ORCA_WHIRLPOOL = new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");

async function testCreatePlan() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("TEST CREATE_PLAN INSTRUCTION");
  console.log("═══════════════════════════════════════════════════════════════");
  
  const connection = new Connection(RPC_URL, "confirmed");
  
  // Charger le keypair réel (qui a du SOL)
  const keypairPath = process.env.SOLANA_KEYPAIR || "/workspaces/SwapBack/mainnet-deploy-keypair.json";
  let testUser: Keypair;
  
  try {
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
    testUser = Keypair.fromSecretKey(Uint8Array.from(keypairData));
    console.log(`\n📍 User réel: ${testUser.publicKey.toBase58()}`);
  } catch {
    testUser = Keypair.generate();
    console.log(`\n📍 User de test (généré): ${testUser.publicKey.toBase58()}`);
    console.log(`   ⚠️ Ce user n'a pas de SOL, la simulation peut échouer.`);
  }
  
  // Dériver le PDA du plan
  const [planPda, planBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("swap_plan"), testUser.publicKey.toBuffer()],
    ROUTER_PROGRAM_ID
  );
  console.log(`📍 Plan PDA: ${planPda.toBase58()} (bump: ${planBump})`);
  
  // Générer un plan_id aléatoire
  const planId = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    planId[i] = Math.floor(Math.random() * 256);
  }
  
  // Discriminator pour create_plan (de l'IDL)
  // [77, 43, 141, 254, 212, 118, 41, 186]
  const discriminator = Buffer.from([77, 43, 141, 254, 212, 118, 41, 186]);
  
  // Sérialiser les arguments
  const planIdBuffer = Buffer.from(planId);
  const tokenInBuffer = SOL_MINT.toBuffer();
  const tokenOutBuffer = USDC_MINT.toBuffer();
  
  const amountInBuffer = Buffer.alloc(8);
  amountInBuffer.writeBigUInt64LE(BigInt(100000000)); // 0.1 SOL
  
  const minOutBuffer = Buffer.alloc(8);
  minOutBuffer.writeBigUInt64LE(BigInt(1000000)); // 1 USDC min
  
  // Venues (1 venue)
  const venuesLenBuffer = Buffer.alloc(4);
  venuesLenBuffer.writeUInt32LE(1);
  const venueBuffer = ORCA_WHIRLPOOL.toBuffer();
  const weightBuffer = Buffer.alloc(2);
  weightBuffer.writeUInt16LE(10000); // 100%
  
  // Fallback plans (empty)
  const fallbackLenBuffer = Buffer.alloc(4);
  fallbackLenBuffer.writeUInt32LE(0);
  
  // Expiration (1 heure dans le futur)
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const expiresAtBuffer = Buffer.alloc(8);
  expiresAtBuffer.writeBigInt64LE(BigInt(expiresAt));
  
  // Construire les données de l'instruction
  // Format: discriminator + plan_id (instruction arg) + plan_data (struct)
  // plan_data = { plan_id, token_in, token_out, amount_in, min_out, venues, fallback_plans, expires_at }
  const instructionData = Buffer.concat([
    discriminator,
    planIdBuffer,         // Argument plan_id de l'instruction
    planIdBuffer,         // plan_data.plan_id
    tokenInBuffer,        // plan_data.token_in
    tokenOutBuffer,       // plan_data.token_out
    amountInBuffer,       // plan_data.amount_in
    minOutBuffer,         // plan_data.min_out
    venuesLenBuffer,      // plan_data.venues.len()
    venueBuffer,          // plan_data.venues[0].venue
    weightBuffer,         // plan_data.venues[0].weight
    fallbackLenBuffer,    // plan_data.fallback_plans.len()
    expiresAtBuffer,      // plan_data.expires_at
  ]);
  
  console.log(`\n📦 Instruction data size: ${instructionData.length} bytes`);
  console.log(`   Discriminator: [${Array.from(discriminator).join(", ")}]`);
  
  // Créer l'instruction
  const createPlanIx = new TransactionInstruction({
    programId: ROUTER_PROGRAM_ID,
    keys: [
      { pubkey: planPda, isSigner: false, isWritable: true },
      { pubkey: testUser.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: instructionData,
  });
  
  console.log(`\n🔧 Accounts:`);
  console.log(`   [0] plan: ${planPda.toBase58()} (writable)`);
  console.log(`   [1] user: ${testUser.publicKey.toBase58()} (signer, writable)`);
  console.log(`   [2] system_program: ${SystemProgram.programId.toBase58()}`);
  
  // Créer la transaction
  const { blockhash } = await connection.getLatestBlockhash();
  
  const message = new TransactionMessage({
    payerKey: testUser.publicKey,
    recentBlockhash: blockhash,
    instructions: [createPlanIx],
  }).compileToV0Message();
  
  const tx = new VersionedTransaction(message);
  // On ne signe pas vraiment, juste simuler
  tx.sign([testUser]);
  
  console.log(`\n🚀 Simulation de la transaction...`);
  
  try {
    // Utiliser accounts pour fournir un compte de test avec des fonds virtuels
    const result = await connection.simulateTransaction(tx, {
      sigVerify: false,
      replaceRecentBlockhash: true,
      accounts: {
        encoding: "base64",
        addresses: [testUser.publicKey.toBase58()],
      },
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
          
          // Interpréter le code d'erreur
          if (customCode === 0x65 || customCode === 101) {
            console.log(`   ⚠️ InstructionFallbackNotFound (0x65)`);
            console.log(`   → Le programme ne reconnaît pas cette instruction!`);
            console.log(`   → L'instruction create_plan n'existe PAS dans le programme déployé.`);
          } else if (customCode >= 6000) {
            const anchorCode = customCode - 6000;
            console.log(`   📍 Anchor error: ${anchorCode}`);
          }
        }
      }
    } else {
      console.log(`   ✅ Simulation réussie!`);
      console.log(`   → L'instruction create_plan EXISTE dans le programme.`);
    }
    
    if (result.value.logs) {
      console.log(`\n📜 Logs:`);
      for (const log of result.value.logs.slice(0, 20)) {
        console.log(`   ${log}`);
      }
      if (result.value.logs.length > 20) {
        console.log(`   ... (${result.value.logs.length - 20} more logs)`);
      }
    }
    
    console.log(`\n   Units consumed: ${result.value.unitsConsumed}`);
    
  } catch (error) {
    console.log(`\n❌ Erreur lors de la simulation:`);
    console.log(error);
  }
  
  console.log("\n═══════════════════════════════════════════════════════════════");
}

testCreatePlan().catch(console.error);
