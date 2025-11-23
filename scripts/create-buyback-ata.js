#!/usr/bin/env node
/**
 * Créer l'ATA Buyback Wallet Token Account
 * 
 * Le global_state.buyback_wallet doit pointer vers un Token Account (ATA) 
 * pour le BACK mint, pas juste un wallet SOL.
 */

const { Connection, Keypair, PublicKey, Transaction } = require("@solana/web3.js");
const { 
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");

// Configuration
const NETWORK = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const CNFT_PROGRAM_ID = new PublicKey("EPtggan3TvdcVdxWnsJ9sKUoymoRoS1HdBa7YqNpPoSP");
const BACK_MINT = new PublicKey("862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux");
// Buyback wallet address from global_state
const BUYBACK_WALLET = new PublicKey("DAdb3ArBvhJ77trTRUs5wbHARGXdupoAgjSYCHpkt6gP");

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║       💰 CRÉER BUYBACK WALLET TOKEN ACCOUNT (ATA)           ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const connection = new Connection(NETWORK, "confirmed");

  console.log(`🌐 RPC: ${NETWORK}`);
  console.log(`💰 BACK Mint: ${BACK_MINT.toString()}`);
  console.log(`🏦 Buyback Wallet: ${BUYBACK_WALLET.toString()}`);

  // Charger le wallet
  const walletPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log(`\n👤 Payer: ${payer.publicKey.toString()}`);
  
  const balance = await connection.getBalance(payer.publicKey);
  console.log(`💰 Solde SOL: ${(balance / 1e9).toFixed(4)} SOL`);

  // Déterminer le Token Program
  const mintInfo = await connection.getAccountInfo(BACK_MINT);
  if (!mintInfo) {
    throw new Error(`❌ BACK Mint non trouvé`);
  }

  const tokenProgram = mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID) 
    ? TOKEN_2022_PROGRAM_ID 
    : TOKEN_PROGRAM_ID;
  
  console.log(`\n🪙 Token Program: ${tokenProgram.toString()}`);

  // Calculer l'ATA
  const buybackAta = await getAssociatedTokenAddress(
    BACK_MINT,
    BUYBACK_WALLET,
    false, // allowOwnerOffCurve = false (wallet normal)
    tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  console.log(`\n🏦 Buyback Token Account (ATA): ${buybackAta.toString()}`);

  // Vérifier si existe déjà
  const existing = await connection.getAccountInfo(buybackAta);
  if (existing) {
    console.log(`\n✅ ATA déjà créé (${existing.data.length} bytes)`);
    console.log(`   Owner: ${existing.owner.toString()}`);
    
    try {
      const tokenBalance = await connection.getTokenAccountBalance(buybackAta);
      console.log(`   Balance: ${tokenBalance.value.uiAmount || 0} BACK`);
    } catch (err) {
      console.log(`   ⚠️ Impossible de lire le balance`);
    }
    
    console.log(`\n✅ Rien à faire\n`);
    console.log(`🔧 IMPORTANT: Mettre à jour global_state.buyback_wallet avec cette adresse:`);
    console.log(`   ${buybackAta.toString()}\n`);
    return;
  }

  // Créer l'ATA
  console.log(`\n📝 Création de l'ATA...`);
  const createAtaIx = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    buybackAta,
    BUYBACK_WALLET,
    BACK_MINT,
    tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const tx = new Transaction().add(createAtaIx);

  console.log(`🚀 Envoi de la transaction...`);
  const signature = await connection.sendTransaction(tx, [payer], {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  console.log(`✅ Transaction envoyée: ${signature}`);
  console.log(`🔗 Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

  console.log(`\n⏳ Confirmation...`);
  await connection.confirmTransaction(signature, "confirmed");
  console.log(`✅ Confirmé!`);

  // Vérifier
  const created = await connection.getAccountInfo(buybackAta);
  if (created) {
    console.log(`\n✅ ATA créé (${created.data.length} bytes)`);
    console.log(`   Owner: ${created.owner.toString()}`);
    
    try {
      const tokenBalance = await connection.getTokenAccountBalance(buybackAta);
      console.log(`   Balance: ${tokenBalance.value.uiAmount || 0} BACK`);
    } catch (err) {
      console.log(`   Balance: 0 BACK`);
    }
  }

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║          🎉 BUYBACK TOKEN ACCOUNT CRÉÉ !                    ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`\n📋 Résumé:`);
  console.log(`   • Buyback Wallet: ${BUYBACK_WALLET.toString()}`);
  console.log(`   • Buyback Token Account (ATA): ${buybackAta.toString()}`);
  console.log(`   • Transaction: ${signature}`);
  console.log(`\n🔧 IMPORTANT: Mettre à jour global_state.buyback_wallet avec:`);
  console.log(`   ${buybackAta.toString()}\n`);
}

main().catch((err) => {
  console.error("\n❌ Erreur:", err.message);
  process.exit(1);
});
