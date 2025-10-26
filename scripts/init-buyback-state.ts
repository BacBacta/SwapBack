#!/usr/bin/env ts-node

/**
 * Script d'initialisation de Buyback State
 * 
 * Ce script initialise le PDA `buyback_state` du programme swapback_buyback
 * sur devnet.
 * 
 * Usage:
 *   npx ts-node scripts/init-buyback-state.ts
 */

import { Connection, PublicKey, Keypair, Transaction, SystemProgram } from "@solana/web3.js";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import fs from "fs";
import path from "path";

// Program IDs
const BUYBACK_PROGRAM_ID = new PublicKey("EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf");

// Token mints (à mettre à jour avec les vrais mints)
const BACK_MINT = new PublicKey("11111111111111111111111111111111"); // TODO: Remplacer avec le vrai mint $BACK
const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"); // USDC devnet

async function main() {
  console.log("🔧 Initialisation de Buyback State sur Devnet\n");

  // Configuration
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

  console.log("📍 Configuration:");
  console.log(`   RPC: ${connection.rpcEndpoint}`);
  console.log(`   Wallet: ${walletKeypair.publicKey.toString()}`);
  console.log(`   Program: ${BUYBACK_PROGRAM_ID.toString()}\n`);

  // Dériver le PDA buyback_state
  const [buybackStatePDA, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("buyback_state")],
    BUYBACK_PROGRAM_ID
  );

  console.log("📋 Buyback State PDA:");
  console.log(`   Address: ${buybackStatePDA.toString()}`);
  console.log(`   Bump: ${bump}\n`);

  // Vérifier si le state existe déjà
  try {
    const accountInfo = await connection.getAccountInfo(buybackStatePDA);
    
    if (accountInfo) {
      console.log("⚠️  Buyback State déjà initialisé !");
      console.log(`   Owner: ${accountInfo.owner.toString()}`);
      console.log(`   Data length: ${accountInfo.data.length} bytes`);
      console.log(`   Lamports: ${accountInfo.lamports / 1e9} SOL\n`);
      
      console.log("ℹ️  Aucune action nécessaire. Le state est déjà configuré.");
      return;
    }
  } catch (error) {
    // Account n'existe pas, c'est normal
  }

  console.log("❌ ATTENTION: Script d'initialisation Buyback incomplet\n");
  console.log("📋 Actions requises manuellement:");
  console.log("");
  console.log("1. Déployer le token $BACK sur devnet");
  console.log("   - Créer le mint");
  console.log("   - Configurer l'authority");
  console.log("");
  console.log("2. Créer les token accounts (vaults):");
  console.log("   - USDC vault (pour accumuler les fees)");
  console.log("   - BACK vault (pour stocker les tokens buyback)");
  console.log("");
  console.log("3. Appeler initialize() du programme avec:");
  console.log("   - back_mint: [à définir]");
  console.log("   - usdc_vault: [à créer]");
  console.log("   - min_buyback_amount: 1000 USDC (recommandé)");
  console.log("");
  console.log("📚 Référence:");
  console.log("   Voir programs/swapback_buyback/src/lib.rs:initialize()");
  console.log("");
  console.log("⏸️  Script en pause - Requires token setup first\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
