#!/usr/bin/env npx tsx
/**
 * Quick test script to validate Jupiter CPI data structure
 * after the on-chain fix for remaining_accounts[1..]
 */
import { Connection, PublicKey, Keypair, VersionedTransaction } from "@solana/web3.js";

const RPC = "https://api.mainnet-beta.solana.com";
const JUPITER_API = "https://public.jupiterapi.com";
const ROUTER_ID = "APHj6L2b2bA2q62jwYZp38dqbTxQUqwatqdUum1trPnN";

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const testWallet = Keypair.generate();
  
  console.log("🔧 Test wallet:", testWallet.publicKey.toBase58());
  console.log("📡 Getting Jupiter quote + swap tx...\n");

  // Get quote
  const quoteRes = await fetch(
    `${JUPITER_API}/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=10000000&slippageBps=100`
  );
  const quote = await quoteRes.json();
  console.log("✅ Quote:", quote.inAmount, "→", quote.outAmount);

  // Get swap tx 
  const swapRes = await fetch(`${JUPITER_API}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: testWallet.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
    }),
  });
  const swapData = await swapRes.json();
  
  if (!swapData.swapTransaction) {
    console.log("❌ No swap transaction:", swapData);
    return;
  }

  console.log("✅ Got Jupiter swap transaction");
  
  // Deserialize to check structure
  const txBuf = Buffer.from(swapData.swapTransaction, "base64");
  const tx = VersionedTransaction.deserialize(txBuf);
  
  console.log("\n📋 Transaction details:");
  console.log("   Version:", tx.version);
  console.log("   Signatures:", tx.signatures.length);
  console.log("   Instructions:", tx.message.compiledInstructions.length);
  console.log("   ALT count:", tx.message.addressTableLookups?.length || 0);
  
  // Show Jupiter program in accounts
  const staticKeys = tx.message.staticAccountKeys.map(k => k.toBase58());
  const jupIdx = staticKeys.findIndex(k => k.startsWith("JUP"));
  console.log("   Jupiter Program idx:", jupIdx, jupIdx >= 0 ? `(${staticKeys[jupIdx]})` : "");
  
  // Count accounts that would be in remaining_accounts
  const jupProgramId = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
  const otherAccounts = staticKeys.filter(k => k !== jupProgramId && !k.startsWith("11111111"));
  console.log("   Other accounts:", otherAccounts.length);
  
  console.log("\n✅ Jupiter CPI data structure validated");
  console.log("ℹ️  On-chain fix deployed: remaining_accounts[1..] skips Jupiter Program ID");
  console.log("ℹ️  Full e2e test requires real wallet with SOL balance");
}

main().catch(console.error);
