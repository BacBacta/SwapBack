#!/usr/bin/env ts-node

/**
 * Script d'initialisation de Router State
 * 
 * Ce script initialise le PDA `router_state` du programme swapback_router
 * sur devnet.
 * 
 * Usage:
 *   npx ts-node scripts/init-router-state.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import fs from "fs";
import path from "path";

// Program ID déployé sur devnet
const ROUTER_PROGRAM_ID = new PublicKey("GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt");

async function main() {
  console.log("🔧 Initialisation de Router State sur Devnet\n");

  // Configuration du provider
  const connection = new Connection(
    process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com",
    "confirmed"
  );

  // Charger le wallet
  const walletPath = process.env.ANCHOR_WALLET || 
    path.join(process.env.HOME!, ".config/solana/id.json");
  
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  const wallet = new Wallet(walletKeypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  anchor.setProvider(provider);

  console.log("📍 Configuration:");
  console.log(`   RPC: ${connection.rpcEndpoint}`);
  console.log(`   Wallet: ${wallet.publicKey.toString()}`);
  console.log(`   Program: ${ROUTER_PROGRAM_ID.toString()}\n`);

  // Charger l'IDL du programme
  // Note: IDL on-chain pas disponible (Program ID mismatch)
  // On charge depuis le fichier local
  let idl;
  try {
    const idlPath = path.join(__dirname, "../target/idl/swapback_router.json");
    
    if (!fs.existsSync(idlPath)) {
      console.error("❌ Erreur: swapback_router.json IDL introuvable");
      console.log(`   Chemin attendu: ${idlPath}`);
      console.log(`   Exécutez 'anchor build' pour générer l'IDL\n`);
      process.exit(1);
    }

    idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
    console.log("✅ IDL chargé depuis le fichier local\n");
  } catch (error) {
    console.error("❌ Erreur lors du chargement de l'IDL:", error);
    process.exit(1);
  }

  // Créer le programme
  // @ts-ignore - Anchor 0.30.1 API
  const program = new Program(idl, ROUTER_PROGRAM_ID, provider);

  // Dériver le PDA router_state
  const [routerStatePDA, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("router_state")],
    ROUTER_PROGRAM_ID
  );

  console.log("📋 Router State PDA:");
  console.log(`   Address: ${routerStatePDA.toString()}`);
  console.log(`   Bump: ${bump}\n`);

  // Vérifier si le state existe déjà
  try {
    const accountInfo = await connection.getAccountInfo(routerStatePDA);
    
    if (accountInfo) {
      console.log("⚠️  Router State déjà initialisé !");
      console.log(`   Owner: ${accountInfo.owner.toString()}`);
      console.log(`   Data length: ${accountInfo.data.length} bytes`);
      console.log(`   Lamports: ${accountInfo.lamports / 1e9} SOL\n`);
      
      // Lire les données du state
      try {
        // @ts-ignore - IDL chargé dynamiquement
        const stateAccount = program.account["RouterState"];
        const stateData = await stateAccount.fetch(routerStatePDA);
        console.log("📊 État actuel:");
        console.log(`   Authority: ${(stateData as any).authority.toString()}`);
        console.log(`   Bump: ${(stateData as any).bump}\n`);
      } catch (e) {
        console.log("⚠️  Impossible de décoder le state (format incompatible)\n");
      }

      console.log("ℹ️  Aucune action nécessaire. Le state est déjà configuré.");
      return;
    }
  } catch (error) {
    // Account n'existe pas, c'est normal
  }

  console.log("🚀 Initialisation du Router State...\n");

  // Vérifier le solde avant l'initialisation
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`💰 Solde actuel: ${balance / 1e9} SOL`);
  
  if (balance < 0.01 * 1e9) {
    console.error("❌ Solde insuffisant (< 0.01 SOL)");
    console.log("   Obtenez des SOL devnet via:");
    console.log("   solana airdrop 2\n");
    process.exit(1);
  }

  try {
    // Appeler initialize()
    // @ts-ignore - Types Anchor complexes
    const tx = await program.methods
      .initialize()
      .accounts({
        state: routerStatePDA,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Router State initialisé avec succès !");
    console.log(`   Transaction: ${tx}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);

    // Vérifier le state créé
    // @ts-ignore - IDL chargé dynamiquement
    const stateAccount = program.account["RouterState"];
    const stateData = await stateAccount.fetch(routerStatePDA);
    console.log("📊 État créé:");
    console.log(`   Authority: ${(stateData as any).authority.toString()}`);
    console.log(`   Bump: ${(stateData as any).bump}\n`);

    console.log("🎉 Initialisation terminée !");
  } catch (error: any) {
    console.error("❌ Erreur lors de l'initialisation:");
    console.error(error);

    if (error.logs) {
      console.log("\n📜 Program logs:");
      error.logs.forEach((log: string) => console.log(`   ${log}`));
    }

    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
