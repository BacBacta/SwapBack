#!/usr/bin/env npx tsx
/**
 * Test de reproduction de l'erreur Jupiter CPI "mid > len"
 * 
 * Ce script simule exactement ce que fait le frontend pour identifier
 * la source exacte de l'erreur.
 * 
 * Erreur observée:
 * "panicked at programs/jupiter/src/lib.rs:115:41: mid > len"
 * 
 * Hypothèse: 
 * invoke_signed() ne reçoit pas Jupiter Program ID dans remaining_accounts,
 * ce qui viole la règle Solana "program must be in account list".
 */

import { Connection, PublicKey, Keypair, VersionedTransaction } from "@solana/web3.js";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const JUPITER_API = "https://public.jupiterapi.com";
const JUPITER_PROGRAM_ID = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";

async function main() {
  console.log("🔍 Test de reproduction de l'erreur Jupiter CPI\n");
  
  const connection = new Connection(RPC, "confirmed");
  
  // 1. Obtenir un quote Jupiter
  console.log("1️⃣ Récupération du quote Jupiter...");
  const quoteRes = await fetch(
    `${JUPITER_API}/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=10000000&slippageBps=100`
  );
  const quote = await quoteRes.json();
  console.log(`   Quote: ${quote.inAmount} → ${quote.outAmount}\n`);

  // 2. Obtenir la transaction Jupiter
  const testWallet = Keypair.generate();
  console.log("2️⃣ Récupération de la transaction Jupiter...");
  
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
    console.log("❌ Pas de transaction:", swapData);
    return;
  }

  // 3. Analyser la structure de la transaction
  const txBuf = Buffer.from(swapData.swapTransaction, "base64");
  const tx = VersionedTransaction.deserialize(txBuf);
  
  console.log("\n3️⃣ Analyse de la transaction Jupiter:");
  console.log(`   Version: ${tx.version}`);
  console.log(`   Instructions: ${tx.message.compiledInstructions.length}`);
  console.log(`   ALT count: ${tx.message.addressTableLookups?.length || 0}`);
  
  // 4. Trouver l'instruction Jupiter
  const staticKeys = tx.message.staticAccountKeys;
  const jupIdx = staticKeys.findIndex(k => k.toBase58() === JUPITER_PROGRAM_ID);
  console.log(`   Jupiter Program index: ${jupIdx}`);
  
  // 5. Analyser les instructions compilées
  console.log("\n4️⃣ Instructions compilées:");
  for (let i = 0; i < tx.message.compiledInstructions.length; i++) {
    const ix = tx.message.compiledInstructions[i];
    const programKey = staticKeys[ix.programIdIndex];
    console.log(`   [${i}] Program: ${programKey.toBase58().slice(0, 8)}... (idx=${ix.programIdIndex})`);
    console.log(`       Accounts: ${ix.accountKeyIndexes.length}, Data: ${ix.data.length} bytes`);
    
    if (programKey.toBase58() === JUPITER_PROGRAM_ID) {
      console.log(`\n   📋 Instruction Jupiter détaillée:`);
      console.log(`       Premier compte index: ${ix.accountKeyIndexes[0]}`);
      console.log(`       Premier compte: ${staticKeys[ix.accountKeyIndexes[0]]?.toBase58().slice(0, 16)}...`);
      console.log(`       Dernier compte index: ${ix.accountKeyIndexes[ix.accountKeyIndexes.length - 1]}`);
      
      // Vérifier si Jupiter est dans ses propres comptes
      const jupiterInAccounts = ix.accountKeyIndexes.includes(jupIdx);
      console.log(`       Jupiter dans ses propres comptes: ${jupiterInAccounts ? "❌ OUI (bug!)" : "✅ NON"}`);
    }
  }
  
  // 6. Analyse des ALT
  if (tx.message.addressTableLookups && tx.message.addressTableLookups.length > 0) {
    console.log("\n5️⃣ Address Lookup Tables:");
    for (const alt of tx.message.addressTableLookups) {
      console.log(`   ALT: ${alt.accountKey.toBase58().slice(0, 16)}...`);
      console.log(`       Writable indexes: ${alt.writableIndexes.length}`);
      console.log(`       Readonly indexes: ${alt.readonlyIndexes.length}`);
    }
  }
  
  // 7. Résolution ALT et compte des comptes totaux
  console.log("\n6️⃣ Résolution des ALT pour compter les comptes réels...");
  
  let totalResolvedAccounts = 0;
  if (tx.message.addressTableLookups) {
    for (const lookup of tx.message.addressTableLookups) {
      try {
        const altInfo = await connection.getAccountInfo(lookup.accountKey);
        if (altInfo && altInfo.data) {
          const HEADER_SIZE = 56;
          const addressCount = (altInfo.data.length - HEADER_SIZE) / 32;
          console.log(`   ALT ${lookup.accountKey.toBase58().slice(0, 8)}: ${addressCount} adresses`);
          totalResolvedAccounts += lookup.writableIndexes.length + lookup.readonlyIndexes.length;
        }
      } catch (e) {
        console.log(`   ⚠️ Erreur ALT: ${e}`);
      }
    }
  }
  
  console.log(`\n📊 RÉSUMÉ:`);
  console.log(`   Comptes statiques: ${staticKeys.length}`);
  console.log(`   Comptes depuis ALT: ${totalResolvedAccounts}`);
  console.log(`   Total comptes: ${staticKeys.length + totalResolvedAccounts}`);
  
  // 8. Vérification de la structure des données d'instruction
  const jupiterIx = tx.message.compiledInstructions.find(
    ix => staticKeys[ix.programIdIndex].toBase58() === JUPITER_PROGRAM_ID
  );
  
  if (jupiterIx) {
    console.log(`\n7️⃣ Analyse des données de l'instruction Jupiter:`);
    console.log(`   Longueur: ${jupiterIx.data.length} bytes`);
    console.log(`   4 premiers bytes: ${Buffer.from(jupiterIx.data.slice(0, 4)).toString('hex')}`);
    
    // Le premier byte est généralement le discriminant de l'instruction
    const discriminant = jupiterIx.data[0];
    console.log(`   Discriminant: ${discriminant}`);
  }
  
  console.log("\n✅ Analyse terminée");
  console.log("\n💡 DIAGNOSTIC:");
  console.log("   L'erreur 'mid > len' se produit quand Jupiter essaie de slice ses comptes");
  console.log("   mais le compte qu'il cherche n'est pas à l'index attendu.");
  console.log("   ");
  console.log("   CAUSE PROBABLE:");
  console.log("   Dans cpi_jupiter.rs, invoke_signed() reçoit remaining_accounts qui");
  console.log("   ne contient PAS Jupiter Program ID (après notre fix [1..]).");
  console.log("   Mais Solana exige que le programme invoqué soit dans la liste des comptes.");
  console.log("   ");
  console.log("   SOLUTION:");
  console.log("   Modifier swap_with_balance_deltas() pour inclure jupiter_program");
  console.log("   dans le slice passé à invoke_signed().");
}

main().catch(console.error);
