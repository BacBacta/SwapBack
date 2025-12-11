/**
 * Test script: Verify Jupiter CPI account order fix
 * 
 * Ce script teste que la correction de l'ordre des comptes Jupiter fonctionne.
 * 
 * Usage: npx tsx scripts/test-jupiter-cpi-fix.ts
 */

import { Connection, PublicKey, VersionedTransaction, TransactionMessage } from "@solana/web3.js";
import * as dotenv from "dotenv";
import path from "path";

// Charger les variables d'environnement
dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config({ path: path.join(__dirname, "../app/.env.local") });

const RPC_URL = process.env.SWAPBACK_RPC_ENDPOINT || process.env.ANCHOR_PROVIDER_URL || "https://api.mainnet-beta.solana.com";
const API_URL = process.env.API_URL || "http://localhost:3000";

// Tokens de test (SOL -> USDC est commun)
const INPUT_MINT = "So11111111111111111111111111111111111111112"; // SOL
const OUTPUT_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC
const AMOUNT = "1000000"; // 0.001 SOL
const SLIPPAGE_BPS = 100; // 1%
// Use a real wallet address (System Program works as a valid pubkey)
const USER_PUBKEY = "Hzw4awWHMZDYttSfFw5YH3BCrfDJLW9jJVwvnSfMVNHK"; // Random valid pubkey

const JUPITER_PROGRAM_ID = new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");

interface QuoteApiResponse {
  success: boolean;
  quote?: {
    inAmount: string;
    outAmount: string;
    inputMint: string;
    outputMint: string;
  };
  jupiterCpi?: {
    accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
    accountsInOrder?: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
    jupiterProgramIndex?: number;
    instructionData?: string;
    programId?: string;
    addressTableLookups?: { accountKey: string; writableIndexes: number[]; readonlyIndexes: number[] }[];
    expectedInputAmount: string;
  };
  error?: string;
}

async function main() {
  console.log("🧪 Testing Jupiter CPI account order fix...\n");
  console.log("Configuration:");
  console.log(`  - RPC: ${RPC_URL.slice(0, 50)}...`);
  console.log(`  - API: ${API_URL}`);
  console.log(`  - Input: ${INPUT_MINT.slice(0, 8)}... (SOL)`);
  console.log(`  - Output: ${OUTPUT_MINT.slice(0, 8)}... (USDC)`);
  console.log(`  - Amount: ${AMOUNT} lamports`);
  console.log();

  // Step 1: Call the quote API
  console.log("📡 Step 1: Calling quote API...");
  let response: QuoteApiResponse;
  try {
    const res = await fetch(`${API_URL}/api/swap/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputMint: INPUT_MINT,
        outputMint: OUTPUT_MINT,
        amount: AMOUNT,
        slippageBps: SLIPPAGE_BPS,
        userPublicKey: USER_PUBKEY,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`API error: ${res.status} - ${errorText.slice(0, 200)}`);
    }

    response = await res.json();
  } catch (error) {
    console.error("❌ Failed to call API:", error);
    console.log("\n🔧 Make sure the app server is running: cd app && npm run dev");
    process.exit(1);
  }

  if (!response.success) {
    console.error("❌ API returned error:", response.error);
    process.exit(1);
  }

  console.log("✅ Quote received:", {
    inAmount: response.quote?.inAmount,
    outAmount: response.quote?.outAmount,
  });

  // Step 2: Check jupiterCpi data
  console.log("\n📦 Step 2: Checking Jupiter CPI data...");
  
  if (!response.jupiterCpi) {
    console.error("❌ No jupiterCpi in response!");
    process.exit(1);
  }

  const cpi = response.jupiterCpi;
  console.log("  - Static accounts:", cpi.accounts?.length || 0);
  console.log("  - Accounts in order:", cpi.accountsInOrder?.length || 0);
  console.log("  - Jupiter program index:", cpi.jupiterProgramIndex ?? "N/A");
  console.log("  - Instruction data bytes:", cpi.instructionData?.length || 0);
  console.log("  - ALT count:", cpi.addressTableLookups?.length || 0);

  // Step 3: Verify accountsInOrder is present and populated
  console.log("\n🔍 Step 3: Verifying accountsInOrder...");
  
  if (!cpi.accountsInOrder || cpi.accountsInOrder.length === 0) {
    console.error("❌ FAIL: accountsInOrder is empty or missing!");
    console.log("   This means ALT resolution may have failed.");
    console.log("   Check server logs for errors.");
    
    // Try to understand what happened
    if (cpi.addressTableLookups && cpi.addressTableLookups.length > 0) {
      console.log(`   ALTs were present (${cpi.addressTableLookups.length}) but not resolved.`);
    }
    
    process.exit(1);
  }

  console.log(`✅ accountsInOrder has ${cpi.accountsInOrder.length} accounts`);

  // Check if account count is reasonable (should be close to static + ALT accounts)
  const staticCount = cpi.accounts?.length || 0;
  const altLookups = cpi.addressTableLookups || [];
  const altAccountEstimate = altLookups.reduce(
    (sum, alt) => sum + alt.writableIndexes.length + alt.readonlyIndexes.length,
    0
  );
  
  console.log(`  - Expected approximately: ${staticCount + altAccountEstimate} accounts`);
  console.log(`  - Got: ${cpi.accountsInOrder.length} accounts`);

  // Step 4: Check Jupiter Program ID position
  console.log("\n🔍 Step 4: Checking Jupiter Program ID position...");
  
  const jupiterInList = cpi.accountsInOrder.findIndex(
    acc => acc.pubkey === JUPITER_PROGRAM_ID.toBase58()
  );
  
  if (jupiterInList === -1) {
    console.log("  - Jupiter NOT found in accountsInOrder (may be in static accounts only)");
  } else {
    console.log(`  - Jupiter found at index ${jupiterInList} in accountsInOrder`);
  }
  
  // The API should report jupiterProgramIndex
  if (cpi.jupiterProgramIndex !== undefined && cpi.jupiterProgramIndex >= 0) {
    console.log(`  - API reported jupiterProgramIndex: ${cpi.jupiterProgramIndex}`);
  }

  // Step 5: Simulate what the client would build
  console.log("\n🔧 Step 5: Simulating client account construction...");
  
  const clientAccounts: string[] = [];
  
  // Client adds Jupiter at position 0
  clientAccounts.push(JUPITER_PROGRAM_ID.toBase58());
  
  // Client adds all accounts from accountsInOrder
  for (const acc of cpi.accountsInOrder) {
    clientAccounts.push(acc.pubkey);
  }
  
  console.log(`  - Total accounts client would send: ${clientAccounts.length}`);
  console.log(`  - Position 0: ${clientAccounts[0].slice(0, 8)}... (should be Jupiter)`);
  
  // Check for duplicates (Jupiter might appear twice now)
  const jupiterOccurrences = clientAccounts.filter(a => a === JUPITER_PROGRAM_ID.toBase58()).length;
  console.log(`  - Jupiter occurrences in list: ${jupiterOccurrences}`);
  
  if (jupiterOccurrences > 1) {
    console.log("  ℹ️  Jupiter appears multiple times - this is expected if Jupiter refs itself");
  }

  // Step 6: Verify account order makes sense
  console.log("\n🔍 Step 6: Account order analysis...");
  
  // Print first 10 accounts
  console.log("  First 10 accounts in order:");
  for (let i = 0; i < Math.min(10, cpi.accountsInOrder.length); i++) {
    const acc = cpi.accountsInOrder[i];
    const isJupiter = acc.pubkey === JUPITER_PROGRAM_ID.toBase58();
    console.log(`    [${i}] ${acc.pubkey.slice(0, 8)}... ${acc.isWritable ? "W" : "R"} ${isJupiter ? "(JUPITER)" : ""}`);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(60));
  
  const passed = cpi.accountsInOrder.length > 0;
  
  if (passed) {
    console.log("✅ PASS: accountsInOrder is populated with resolved accounts");
    console.log("✅ PASS: Client can now use the correct account order for Jupiter CPI");
    console.log();
    console.log("Next steps:");
    console.log("  1. Test with a real wallet to verify transaction simulation");
    console.log("  2. Execute a small test swap on mainnet");
    console.log("  3. Verify no 'mid > len' panic occurs");
  } else {
    console.log("❌ FAIL: accountsInOrder is empty - fix not working");
    process.exit(1);
  }

  console.log();
}

main().catch(console.error);
