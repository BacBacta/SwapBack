#!/usr/bin/env npx tsx
/**
 * Analyse approfondie de l'ordre des comptes Jupiter
 * 
 * Ce script compare l'ordre des comptes dans l'instruction Jupiter originale
 * avec ce que notre code reconstruit.
 */

import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const JUPITER_API = "https://public.jupiterapi.com";
const JUPITER_PROGRAM_ID = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";

async function main() {
  console.log("🔍 Analyse de l'ordre des comptes Jupiter\n");
  
  const connection = new Connection(RPC, "confirmed");
  
  // 1. Obtenir un quote et transaction Jupiter
  console.log("1️⃣ Récupération de la transaction Jupiter...\n");
  
  const quoteRes = await fetch(
    `${JUPITER_API}/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=10000000&slippageBps=100`
  );
  const quote = await quoteRes.json();
  
  const swapRes = await fetch(`${JUPITER_API}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: "So11111111111111111111111111111111111111112", // Valid pubkey format
      wrapAndUnwrapSol: true,
    }),
  });
  const swapData = await swapRes.json();
  
  if (!swapData.swapTransaction) {
    console.log("❌ Pas de transaction");
    return;
  }

  // 2. Parser la transaction
  const txBuf = Buffer.from(swapData.swapTransaction, "base64");
  const tx = VersionedTransaction.deserialize(txBuf);
  const staticKeys = tx.message.staticAccountKeys;
  
  // 3. Résoudre les ALT pour avoir tous les comptes
  console.log("2️⃣ Résolution des Address Lookup Tables...\n");
  
  const altAddresses = tx.message.addressTableLookups?.map(l => l.accountKey) || [];
  const altInfos = await connection.getMultipleAccountsInfo(altAddresses);
  
  // Parser les ALT
  const altAccountsMap = new Map<string, PublicKey[]>();
  for (let i = 0; i < altAddresses.length; i++) {
    const altInfo = altInfos[i];
    if (!altInfo) continue;
    
    const HEADER_SIZE = 56;
    const addresses: PublicKey[] = [];
    const data = altInfo.data;
    const addressCount = (data.length - HEADER_SIZE) / 32;
    
    for (let j = 0; j < addressCount; j++) {
      const start = HEADER_SIZE + j * 32;
      addresses.push(new PublicKey(data.subarray(start, start + 32)));
    }
    
    altAccountsMap.set(altAddresses[i].toBase58(), addresses);
  }
  
  // 4. Trouver l'instruction Jupiter
  const jupiterIx = tx.message.compiledInstructions.find(
    ix => staticKeys[ix.programIdIndex]?.toBase58() === JUPITER_PROGRAM_ID
  );
  
  if (!jupiterIx) {
    console.log("❌ Instruction Jupiter non trouvée");
    return;
  }
  
  // 5. Reconstruire la liste COMPLETE des comptes dans l'ordre original
  console.log("3️⃣ Reconstruction de la liste complète des comptes...\n");
  
  const STATIC_ACCOUNT_COUNT = staticKeys.length;
  const allAccountsInOrder: { pubkey: PublicKey; source: string; originalIndex: number }[] = [];
  
  for (const idx of jupiterIx.accountKeyIndexes) {
    if (idx < STATIC_ACCOUNT_COUNT) {
      // Compte statique
      allAccountsInOrder.push({
        pubkey: staticKeys[idx],
        source: "static",
        originalIndex: idx,
      });
    } else {
      // Compte dans ALT
      // Calculer l'offset dans les ALT
      let altOffset = idx - STATIC_ACCOUNT_COUNT;
      let found = false;
      
      for (const lookup of tx.message.addressTableLookups || []) {
        const altKey = lookup.accountKey.toBase58();
        const altAddresses = altAccountsMap.get(altKey) || [];
        const writableCount = lookup.writableIndexes.length;
        const readonlyCount = lookup.readonlyIndexes.length;
        const totalInThisAlt = writableCount + readonlyCount;
        
        if (altOffset < totalInThisAlt) {
          // Ce compte est dans cette ALT
          let localIndex: number;
          if (altOffset < writableCount) {
            localIndex = lookup.writableIndexes[altOffset];
          } else {
            localIndex = lookup.readonlyIndexes[altOffset - writableCount];
          }
          
          if (localIndex < altAddresses.length) {
            allAccountsInOrder.push({
              pubkey: altAddresses[localIndex],
              source: `ALT:${altKey.slice(0, 8)}`,
              originalIndex: idx,
            });
            found = true;
          }
          break;
        }
        altOffset -= totalInThisAlt;
      }
      
      if (!found) {
        console.log(`   ⚠️ Compte index ${idx} non résolu`);
      }
    }
  }
  
  console.log(`📋 Liste des ${allAccountsInOrder.length} comptes dans l'ORDRE ORIGINAL:\n`);
  
  // Afficher les premiers et derniers comptes
  const showCount = 10;
  for (let i = 0; i < Math.min(showCount, allAccountsInOrder.length); i++) {
    const acc = allAccountsInOrder[i];
    const label = acc.pubkey.toBase58();
    const isJupiter = label === JUPITER_PROGRAM_ID ? " ← JUPITER" : "";
    console.log(`   [${i}] ${label.slice(0, 20)}... (${acc.source})${isJupiter}`);
  }
  
  if (allAccountsInOrder.length > showCount * 2) {
    console.log(`   ... (${allAccountsInOrder.length - showCount * 2} comptes omis) ...`);
  }
  
  for (let i = Math.max(showCount, allAccountsInOrder.length - showCount); i < allAccountsInOrder.length; i++) {
    const acc = allAccountsInOrder[i];
    const label = acc.pubkey.toBase58();
    const isJupiter = label === JUPITER_PROGRAM_ID ? " ← JUPITER" : "";
    console.log(`   [${i}] ${label.slice(0, 20)}... (${acc.source})${isJupiter}`);
  }
  
  // 6. Vérifier si Jupiter est dans la liste
  const jupiterIndex = allAccountsInOrder.findIndex(a => a.pubkey.toBase58() === JUPITER_PROGRAM_ID);
  console.log(`\n📊 Jupiter Program ID dans la liste: ${jupiterIndex >= 0 ? `OUI (index ${jupiterIndex})` : "NON"}`);
  
  // 7. Comparer avec ce que notre code fait
  console.log("\n4️⃣ Ce que notre code envoie actuellement:\n");
  
  // Notre code fait:
  // 1. Jupiter Program ID (premier)
  // 2. Comptes statiques filtrés
  // 3. Comptes ALT résolus (writable puis readonly, pour chaque ALT)
  
  const ourOrder: string[] = [];
  
  // 1. Jupiter d'abord
  ourOrder.push(`[0] ${JUPITER_PROGRAM_ID.slice(0, 20)}... (ajouté manuellement)`);
  
  // 2. Comptes statiques de l'instruction
  let ourIndex = 1;
  for (const idx of jupiterIx.accountKeyIndexes) {
    if (idx < STATIC_ACCOUNT_COUNT) {
      ourOrder.push(`[${ourIndex}] ${staticKeys[idx].toBase58().slice(0, 20)}... (static)`);
      ourIndex++;
    }
  }
  
  // 3. Comptes ALT
  for (const lookup of tx.message.addressTableLookups || []) {
    const altKey = lookup.accountKey.toBase58();
    const altAddresses = altAccountsMap.get(altKey) || [];
    
    for (const idx of lookup.writableIndexes) {
      if (idx < altAddresses.length) {
        ourOrder.push(`[${ourIndex}] ${altAddresses[idx].toBase58().slice(0, 20)}... (ALT writable)`);
        ourIndex++;
      }
    }
    for (const idx of lookup.readonlyIndexes) {
      if (idx < altAddresses.length) {
        ourOrder.push(`[${ourIndex}] ${altAddresses[idx].toBase58().slice(0, 20)}... (ALT readonly)`);
        ourIndex++;
      }
    }
  }
  
  console.log(`Notre code envoie ${ourOrder.length} comptes:`);
  for (let i = 0; i < Math.min(5, ourOrder.length); i++) {
    console.log(`   ${ourOrder[i]}`);
  }
  console.log("   ...");
  for (let i = Math.max(5, ourOrder.length - 5); i < ourOrder.length; i++) {
    console.log(`   ${ourOrder[i]}`);
  }
  
  // 8. Diagnostic final
  console.log("\n" + "=".repeat(60));
  console.log("💡 DIAGNOSTIC:");
  console.log("=".repeat(60));
  
  console.log(`
L'ordre des comptes est CRUCIAL pour Jupiter.
L'instruction Jupiter attend ses comptes dans un ordre précis
basé sur accountKeyIndexes.

PROBLÈME IDENTIFIÉ:
Notre code reconstruit les comptes dans un MAUVAIS ORDRE:
1. Jupiter Program ID (ajouté manuellement en premier)
2. Comptes statiques (dans l'ordre des accountKeyIndexes filtrés)
3. Comptes ALT (writable puis readonly, par ALT)

ORDRE CORRECT (accountKeyIndexes original):
Les comptes doivent être dans l'ordre EXACT de accountKeyIndexes,
avec résolution des indices ALT vers les vraies adresses.

SOLUTION:
L'API /api/swap/quote doit résoudre les ALT côté serveur
et retourner la liste complète dans l'ordre original.
`);
}

main().catch(console.error);
