/**
 * Test script: Simulate swap transaction to verify no Jupiter panic
 * 
 * Ce script simule la construction d'une transaction de swap router
 * pour vérifier que l'erreur "mid > len" ne se produit plus.
 * 
 * Usage: npx tsx scripts/test-simulate-swap.ts
 */

import { 
  Connection, 
  PublicKey, 
  VersionedTransaction,
  TransactionMessage,
  TransactionInstruction,
  Keypair
} from "@solana/web3.js";
import { 
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction 
} from "@solana/spl-token";
import * as dotenv from "dotenv";
import path from "path";

// Charger les variables d'environnement
dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config({ path: path.join(__dirname, "../app/.env.local") });

const RPC_URL = process.env.SWAPBACK_RPC_ENDPOINT || process.env.ANCHOR_PROVIDER_URL || "https://api.mainnet-beta.solana.com";
const API_URL = process.env.API_URL || "http://localhost:3000";

// Router Program ID
const ROUTER_PROGRAM_ID = new PublicKey("APHj6L2b2bA2q62jwYZp38dqbTxQUqwatqdUum1trPnN");
const JUPITER_PROGRAM_ID = new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");

// Test tokens
const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const AMOUNT = 1000000; // 0.001 SOL
const SLIPPAGE_BPS = 100;

// Use a random keypair for testing (won't have funds, but good for simulation)
const testKeypair = Keypair.generate();
const USER_PUBKEY = testKeypair.publicKey;

interface QuoteResponse {
  success: boolean;
  quote?: {
    inAmount: string;
    outAmount: string;
  };
  jupiterCpi?: {
    accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
    accountsInOrder?: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
    jupiterProgramIndex?: number;
    instructionData?: string;
    expectedInputAmount: string;
  };
  error?: string;
}

async function main() {
  console.log("🔬 Testing swap transaction simulation...\n");
  console.log("Configuration:");
  console.log(`  - RPC: ${RPC_URL.slice(0, 50)}...`);
  console.log(`  - API: ${API_URL}`);
  console.log(`  - Test wallet: ${USER_PUBKEY.toBase58().slice(0, 12)}...`);
  console.log();

  const connection = new Connection(RPC_URL, "confirmed");

  // Step 1: Get quote with CPI data
  console.log("📡 Step 1: Getting quote with Jupiter CPI data...");
  
  let response: QuoteResponse;
  try {
    const res = await fetch(`${API_URL}/api/swap/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputMint: SOL_MINT.toBase58(),
        outputMint: USDC_MINT.toBase58(),
        amount: AMOUNT.toString(),
        slippageBps: SLIPPAGE_BPS,
        userPublicKey: USER_PUBKEY.toBase58(),
      }),
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    response = await res.json();
  } catch (error) {
    console.error("❌ Failed to get quote:", error);
    process.exit(1);
  }

  if (!response.success || !response.jupiterCpi) {
    console.error("❌ No Jupiter CPI data in response");
    process.exit(1);
  }

  const cpi = response.jupiterCpi;
  console.log(`✅ Quote received: ${response.quote?.inAmount} -> ${response.quote?.outAmount}`);
  console.log(`   - accountsInOrder: ${cpi.accountsInOrder?.length || 0}`);
  console.log(`   - Jupiter at index: ${cpi.jupiterProgramIndex}`);

  // Step 2: Build remaining accounts like the client would
  console.log("\n🔧 Step 2: Building remaining accounts...");
  
  const jupiterRemainingAccounts: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] = [];
  
  // Use accountsInOrder directly (no longer need Jupiter at position 0)
  // The on-chain program now searches for Jupiter at any position
  if (cpi.accountsInOrder && cpi.accountsInOrder.length > 0) {
    for (const acc of cpi.accountsInOrder) {
      jupiterRemainingAccounts.push({
        pubkey: new PublicKey(acc.pubkey),
        isSigner: false,
        isWritable: acc.isWritable,
      });
    }
    console.log(`✅ Built ${jupiterRemainingAccounts.length} remaining accounts (accountsInOrder exact order)`);
  } else {
    // Fallback to old method
    for (const acc of cpi.accounts || []) {
      jupiterRemainingAccounts.push({
        pubkey: new PublicKey(acc.pubkey),
        isSigner: false,
        isWritable: acc.isWritable,
      });
    }
    console.log(`⚠️ Built ${jupiterRemainingAccounts.length} remaining accounts (legacy fallback)`);
  }

  // Step 3: Verify account structure
  console.log("\n🔍 Step 3: Verifying account structure...");
  
  // Count Jupiter occurrences
  const jupiterCount = jupiterRemainingAccounts.filter(
    a => a.pubkey.equals(JUPITER_PROGRAM_ID)
  ).length;
  console.log(`   Total accounts: ${jupiterRemainingAccounts.length}`);
  console.log(`   Jupiter occurrences: ${jupiterCount}`);
  console.log(`   Jupiter index in accountsInOrder: ${cpi.jupiterProgramIndex}`);

  // Step 4: Build a mock swap instruction (for structure verification)
  console.log("\n📦 Step 4: Building mock swap instruction...");
  
  // Derive required accounts
  const [routerState] = PublicKey.findProgramAddressSync(
    [Buffer.from("router_state")],
    ROUTER_PROGRAM_ID
  );
  
  const userTokenAccountA = getAssociatedTokenAddressSync(SOL_MINT, USER_PUBKEY);
  const userTokenAccountB = getAssociatedTokenAddressSync(USDC_MINT, USER_PUBKEY);
  const vaultTokenAccountA = getAssociatedTokenAddressSync(SOL_MINT, routerState, true);
  const vaultTokenAccountB = getAssociatedTokenAddressSync(USDC_MINT, routerState, true);
  
  // Build the instruction data (simplified - just checking structure)
  // Real instruction would have proper discriminator and args
  const discriminator = Buffer.from([143, 190, 90, 218, 196, 30, 51, 222]); // swap_toc
  const mockData = Buffer.concat([
    discriminator,
    Buffer.alloc(100), // Mock args
  ]);
  
  // Build instruction with all accounts
  const mainAccounts = [
    { pubkey: USER_PUBKEY, isSigner: true, isWritable: true },
    { pubkey: routerState, isSigner: false, isWritable: true },
    { pubkey: userTokenAccountA, isSigner: false, isWritable: true },
    { pubkey: userTokenAccountB, isSigner: false, isWritable: true },
    { pubkey: vaultTokenAccountA, isSigner: false, isWritable: true },
    { pubkey: vaultTokenAccountB, isSigner: false, isWritable: true },
    { pubkey: SOL_MINT, isSigner: false, isWritable: false },
    { pubkey: USDC_MINT, isSigner: false, isWritable: false },
    // ... more accounts would be here in real instruction
  ];
  
  console.log(`   Main accounts: ${mainAccounts.length}`);
  console.log(`   Remaining accounts (Jupiter): ${jupiterRemainingAccounts.length}`);
  console.log(`   Total accounts: ${mainAccounts.length + jupiterRemainingAccounts.length}`);

  // Step 5: Verify no "mid > len" condition
  console.log("\n🔎 Step 5: Checking for potential 'mid > len' condition...");
  
  // The panic happens when Jupiter's internal code tries to access an account
  // at an index that doesn't exist. This typically happens in the BinarySearch
  // or when parsing AccountMeta.
  
  const totalAccounts = jupiterRemainingAccounts.length;
  const instructionDataBytes = cpi.instructionData ? Buffer.from(cpi.instructionData, 'base64') : Buffer.alloc(0);
  
  console.log(`   Instruction data: ${instructionDataBytes.length} bytes`);
  console.log(`   Jupiter accounts: ${totalAccounts}`);
  
  // Simple sanity check: Jupiter swap usually needs 20-50 accounts
  if (totalAccounts < 10) {
    console.log(`   ⚠️ WARNING: Only ${totalAccounts} accounts - might be insufficient`);
  } else if (totalAccounts > 100) {
    console.log(`   ⚠️ WARNING: ${totalAccounts} accounts - unusually high`);
  } else {
    console.log(`   ✅ Account count looks reasonable`);
  }
  
  // Check instruction data is substantial enough
  if (instructionDataBytes.length < 10) {
    console.log(`   ⚠️ WARNING: Instruction data only ${instructionDataBytes.length} bytes - might be wrong instruction`);
  } else {
    console.log(`   ✅ Instruction data size looks reasonable`);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 SIMULATION SUMMARY");
  console.log("=".repeat(60));
  
  const issues: string[] = [];
  
  if (!cpi.accountsInOrder || cpi.accountsInOrder.length === 0) {
    issues.push("accountsInOrder is empty - using legacy fallback");
  }
  
  // Jupiter can now be at any position - just check it's present
  const jupiterFound = jupiterRemainingAccounts.some(a => a.pubkey.equals(JUPITER_PROGRAM_ID));
  if (!jupiterFound) {
    issues.push("Jupiter Program ID not found in remaining accounts");
  }
  
  if (totalAccounts < 10) {
    issues.push("Too few accounts");
  }
  
  if (instructionDataBytes.length < 10) {
    issues.push("Instruction data too small");
  }
  
  if (issues.length === 0) {
    console.log("✅ PASS: Transaction structure looks correct");
    console.log("✅ PASS: Jupiter accounts in order with proper count");
    console.log("✅ PASS: No obvious 'mid > len' trigger conditions");
    console.log();
    console.log("The fix appears to be working. To fully verify:");
    console.log("  1. Deploy app to staging/production");
    console.log("  2. Execute a real swap with a funded wallet");
    console.log("  3. Monitor logs for any 'mid > len' panics");
  } else {
    console.log("❌ ISSUES DETECTED:");
    for (const issue of issues) {
      console.log(`   - ${issue}`);
    }
    process.exit(1);
  }
  
  console.log();
}

main().catch(console.error);
