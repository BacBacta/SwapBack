#!/usr/bin/env node
/**
 * Initialiser le Vault Token Account pour le programme CNFT
 * 
 * Ce compte ATA appartient au vault_authority PDA et stocke les tokens BACK lockés.
 */

const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const { 
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");

// Configuration
const NETWORK = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const CNFT_PROGRAM_ID = new PublicKey(
  process.env.CNFT_PROGRAM_ID || 
  process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID || 
  "EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP"
);
const BACK_MINT = new PublicKey(
  process.env.BACK_MINT || 
  process.env.NEXT_PUBLIC_BACK_MINT || 
  "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux"
);

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║     🏦 INITIALISER VAULT TOKEN ACCOUNT - CNFT Program       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const connection = new Connection(NETWORK, "confirmed");

  console.log(`🌐 RPC: ${NETWORK}`);
  console.log(`🆔 CNFT Program ID: ${CNFT_PROGRAM_ID.toString()}`);
  console.log(`💰 BACK Mint: ${BACK_MINT.toString()}`);

  // Charger le wallet
  const walletPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log(`\n👤 Payer: ${payer.publicKey.toString()}`);
  
  const balance = await connection.getBalance(payer.publicKey);
  console.log(`💰 Solde SOL: ${(balance / 1e9).toFixed(4)} SOL`);

  // Dériver le vault_authority PDA
  const [vaultAuthority, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority")],
    CNFT_PROGRAM_ID
  );

  console.log(`\n🔑 Vault Authority PDA: ${vaultAuthority.toString()}`);
  console.log(`   Bump: ${bump}`);

  // Déterminer le Token Program à utiliser
  const mintInfo = await connection.getAccountInfo(BACK_MINT);
  if (!mintInfo) {
    throw new Error(`❌ BACK Mint ${BACK_MINT.toString()} non trouvé sur ${NETWORK}`);
  }

  const tokenProgram = mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID) 
    ? TOKEN_2022_PROGRAM_ID 
    : TOKEN_PROGRAM_ID;
  
  console.log(`🪙 Token Program: ${tokenProgram.toString()}`);

  // Calculer l'adresse de l'ATA
  const vaultTokenAccount = await getAssociatedTokenAddress(
    BACK_MINT,
    vaultAuthority,
    true, // allowOwnerOffCurve = true (car vault_authority est un PDA)
    tokenProgram
  );

  console.log(`\n🏦 Vault Token Account (ATA): ${vaultTokenAccount.toString()}`);

  // Vérifier si déjà créé
  const existing = await connection.getAccountInfo(vaultTokenAccount);
  if (existing) {
    console.log(`\n✅ Vault Token Account déjà créé (${existing.data.length} bytes)`);
    console.log(`   Owner: ${existing.owner.toString()}`);
    console.log(`   Lamports: ${(existing.lamports / 1e9).toFixed(6)} SOL`);
    
    // Lire le balance si possible
    try {
      const tokenBalance = await connection.getTokenAccountBalance(vaultTokenAccount);
      console.log(`   Balance: ${tokenBalance.value.uiAmount || 0} BACK`);
    } catch (err) {
      console.log(`   ⚠️ Impossible de lire le balance:`, err.message);
    }
    
    console.log(`\n✅ Rien à faire - compte déjà initialisé\n`);
    return;
  }

  // Créer l'instruction pour créer l'ATA
  console.log(`\n📝 Création de l'instruction ATA...`);
  const createAtaIx = createAssociatedTokenAccountInstruction(
    payer.publicKey,        // payer
    vaultTokenAccount,      // associatedToken
    vaultAuthority,         // owner (le PDA)
    BACK_MINT,              // mint
    tokenProgram            // token program
  );

  const { Transaction } = require("@solana/web3.js");
  const tx = new Transaction().add(createAtaIx);

  console.log(`🚀 Envoi de la transaction...`);
  const signature = await connection.sendTransaction(tx, [payer], {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  console.log(`✅ Transaction envoyée: ${signature}`);
  console.log(`🔗 Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

  console.log(`\n⏳ Confirmation de la transaction...`);
  await connection.confirmTransaction(signature, "confirmed");
  console.log(`✅ Transaction confirmée!`);

  // Vérifier le résultat
  console.log(`\n📊 Vérification du résultat...`);
  const created = await connection.getAccountInfo(vaultTokenAccount);
  if (created) {
    console.log(`✅ Vault Token Account créé (${created.data.length} bytes)`);
    console.log(`   Owner: ${created.owner.toString()}`);
    console.log(`   Lamports: ${(created.lamports / 1e9).toFixed(6)} SOL`);
    
    try {
      const tokenBalance = await connection.getTokenAccountBalance(vaultTokenAccount);
      console.log(`   Balance: ${tokenBalance.value.uiAmount || 0} BACK`);
    } catch (err) {
      console.log(`   ⚠️ Impossible de lire le balance:`, err.message);
    }
  } else {
    console.log(`❌ Échec - compte non créé`);
    process.exit(1);
  }

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║        🎉 VAULT TOKEN ACCOUNT INITIALISÉ !                  ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`\n📋 Résumé:`);
  console.log(`   • Vault Authority: ${vaultAuthority.toString()}`);
  console.log(`   • Vault Token Account: ${vaultTokenAccount.toString()}`);
  console.log(`   • Transaction: ${signature}`);
  console.log(`   • Coût: ~0.002 SOL\n`);
  console.log(`✅ Les locks de tokens peuvent maintenant être effectués!\n`);
}

main().catch((err) => {
  console.error("\n❌ Erreur:", err.message);
  process.exit(1);
});
