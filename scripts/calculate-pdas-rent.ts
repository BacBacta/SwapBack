#!/usr/bin/env npx tsx
/**
 * Script pour identifier les PDAs du programme SwapBack Router
 * et calculer le rent récupérable
 * 
 * Usage: npx tsx scripts/calculate-pdas-rent.ts
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

// Programme ID mainnet actuel
const ROUTER_PROGRAM_ID = new PublicKey("APHj6L2b2bA2q62jwYZp38dqbTxQUqwatqdUum1trPnN");
const BUYBACK_PROGRAM_ID = new PublicKey("7wCCwRXxWvMY2DJDRrnhFg3b8jVPb5vVPxLH5YAGL6eJ");
const CNFT_PROGRAM_ID = new PublicKey("26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru");

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

interface PDAInfo {
  name: string;
  address: PublicKey;
  seeds: (Buffer | Uint8Array)[];
  bump?: number;
  balance?: number;
  exists?: boolean;
}

async function main() {
  console.log("🔍 SwapBack PDA Rent Calculator");
  console.log("================================\n");
  
  const connection = new Connection(RPC_URL, "confirmed");
  
  // Calculer les PDAs connus
  const pdas: PDAInfo[] = [];
  
  // 1. RouterState PDA
  const [routerState, routerStateBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("router_state")],
    ROUTER_PROGRAM_ID
  );
  pdas.push({
    name: "RouterState",
    address: routerState,
    seeds: [Buffer.from("router_state")],
    bump: routerStateBump,
  });
  
  // 2. RouterConfig PDA
  const [routerConfig, routerConfigBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("router_config")],
    ROUTER_PROGRAM_ID
  );
  pdas.push({
    name: "RouterConfig",
    address: routerConfig,
    seeds: [Buffer.from("router_config")],
    bump: routerConfigBump,
  });
  
  // 3. Rebate Vault PDA (si initialisé avec routerState comme seed)
  const [rebateVault, rebateVaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("rebate_vault"), routerState.toBuffer()],
    ROUTER_PROGRAM_ID
  );
  pdas.push({
    name: "RebateVault",
    address: rebateVault,
    seeds: [Buffer.from("rebate_vault"), routerState.toBuffer()],
    bump: rebateVaultBump,
  });
  
  // 4. Oracle Cache PDAs (pour chaque oracle)
  // Ces PDAs sont créés dynamiquement, on va essayer quelques oracles connus
  const knownOracles = [
    "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG", // SOL/USD legacy
    "Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD", // USDC/USD legacy
  ];
  
  for (const oracleStr of knownOracles) {
    try {
      const oracle = new PublicKey(oracleStr);
      const [oracleCache, oracleCacheBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("oracle_cache"), oracle.toBuffer()],
        ROUTER_PROGRAM_ID
      );
      pdas.push({
        name: `OracleCache (${oracleStr.slice(0, 8)}...)`,
        address: oracleCache,
        seeds: [Buffer.from("oracle_cache"), oracle.toBuffer()],
        bump: oracleCacheBump,
      });
    } catch (e) {
      // Ignorer les erreurs
    }
  }
  
  // 5. Venue Score PDA
  const [venueScore, venueScoreBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("venue_score"), routerState.toBuffer()],
    ROUTER_PROGRAM_ID
  );
  pdas.push({
    name: "VenueScore",
    address: venueScore,
    seeds: [Buffer.from("venue_score"), routerState.toBuffer()],
    bump: venueScoreBump,
  });
  
  // Récupérer les balances
  console.log("📊 Fetching PDA balances...\n");
  
  let totalRent = 0;
  
  for (const pda of pdas) {
    try {
      const accountInfo = await connection.getAccountInfo(pda.address);
      if (accountInfo) {
        pda.exists = true;
        pda.balance = accountInfo.lamports;
        totalRent += accountInfo.lamports;
        console.log(`✅ ${pda.name}`);
        console.log(`   Address: ${pda.address.toBase58()}`);
        console.log(`   Balance: ${(accountInfo.lamports / LAMPORTS_PER_SOL).toFixed(6)} SOL (${accountInfo.lamports} lamports)`);
        console.log(`   Data size: ${accountInfo.data.length} bytes`);
        console.log(`   Owner: ${accountInfo.owner.toBase58()}`);
        console.log();
      } else {
        pda.exists = false;
        console.log(`❌ ${pda.name} - Not found`);
        console.log(`   Address: ${pda.address.toBase58()}`);
        console.log();
      }
    } catch (e) {
      console.log(`⚠️ ${pda.name} - Error: ${e}`);
    }
  }
  
  // Vérifier aussi le compte du programme lui-même
  console.log("📦 Program Accounts:");
  console.log("-------------------");
  
  const programs = [
    { name: "SwapBack Router", id: ROUTER_PROGRAM_ID },
    { name: "Buyback Program", id: BUYBACK_PROGRAM_ID },
    { name: "cNFT Program", id: CNFT_PROGRAM_ID },
  ];
  
  for (const prog of programs) {
    try {
      const accountInfo = await connection.getAccountInfo(prog.id);
      if (accountInfo) {
        console.log(`✅ ${prog.name}`);
        console.log(`   Address: ${prog.id.toBase58()}`);
        console.log(`   Executable: ${accountInfo.executable}`);
        console.log(`   Data size: ${accountInfo.data.length} bytes`);
        console.log();
      } else {
        console.log(`❌ ${prog.name} - Not deployed`);
      }
    } catch (e) {
      console.log(`⚠️ ${prog.name} - Error: ${e}`);
    }
  }
  
  // Rechercher les UserRebate PDAs (difficile sans connaître tous les users)
  // On va utiliser getProgramAccounts pour trouver tous les comptes du programme
  console.log("\n🔍 Searching for all program accounts...");
  
  try {
    const allAccounts = await connection.getProgramAccounts(ROUTER_PROGRAM_ID, {
      dataSlice: { offset: 0, length: 8 }, // Just discriminator
    });
    
    console.log(`Found ${allAccounts.length} accounts owned by the router program\n`);
    
    let allAccountsRent = 0;
    for (const { pubkey, account } of allAccounts) {
      const fullAccount = await connection.getAccountInfo(pubkey);
      if (fullAccount) {
        allAccountsRent += fullAccount.lamports;
      }
    }
    
    console.log(`Total rent in all program accounts: ${(allAccountsRent / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
  } catch (e) {
    console.log(`⚠️ Could not fetch program accounts: ${e}`);
  }
  
  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 SUMMARY");
  console.log("=".repeat(50));
  console.log(`Known PDAs found: ${pdas.filter(p => p.exists).length}/${pdas.length}`);
  console.log(`Total rent recoverable (known PDAs): ${(totalRent / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
  console.log();
  console.log("Note: Additional rent may be locked in:");
  console.log("  - UserRebate accounts (one per user who swapped)");
  console.log("  - DcaPlan accounts (if DCA feature was used)");
  console.log("  - Token vault ATAs");
}

main().catch(console.error);
