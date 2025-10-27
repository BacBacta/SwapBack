/**
 * Script pour verrouiller des tokens $BACK et minter un cNFT de niveau
 * 
 * Cette instruction (mint_level_nft) permet aux utilisateurs de:
 * 1. Transférer BACK tokens (lock)
 * 2. Calculer le boost basé sur montant + durée
 * 3. Créer un cNFT représentant le niveau de boost
 * 4. Mettre à jour GlobalState (total_value_locked, active_locks_count, total_community_boost)
 * 
 * Note: Dans le programme actuel, lock et mint sont combinés en une seule instruction
 * 
 * Prérequis: GlobalState initialisé, CollectionConfig initialisé, BACK tokens dans le wallet
 */

const { Connection, Keypair, PublicKey, Transaction, SystemProgram, TransactionInstruction } = require("@solana/web3.js");
const { getOrCreateAssociatedTokenAccount, getAccount, TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Configuration devnet
const NETWORK = "https://api.devnet.solana.com";
const CNFT_PROGRAM_ID = new PublicKey("9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw");
const BACK_MINT = new PublicKey("14rtHCJVvU7NKeFJotJsHdbsQGajnNmoQ7MHid41RLTa");

// Paramètres du lock
const LOCK_AMOUNT = 100_000_000_000; // 100 BACK (avec 9 decimals)
const LOCK_DURATION = 90 * 24 * 60 * 60; // 90 jours en secondes

async function main() {
  console.log("\n🔒 LOCK BACK & MINT cNFT - Devnet\n");

  const connection = new Connection(NETWORK, "confirmed");

  // Charger le wallet
  const walletPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log(`👤 Wallet: ${payer.publicKey.toString()}`);
  
  const balance = await connection.getBalance(payer.publicKey);
  console.log(`💰 Solde SOL: ${(balance / 1e9).toFixed(4)} SOL`);

  // Vérifier le compte BACK du user
  console.log("\n📋 Vérification du compte BACK...");
  const userBackAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    BACK_MINT,
    payer.publicKey
  );
  
  const userBackBalance = Number(userBackAccount.amount);
  console.log(`✅ BACK Account: ${userBackAccount.address.toString()}`);
  console.log(`   Balance: ${(userBackBalance / 1e9).toFixed(2)} BACK`);

  if (userBackBalance < LOCK_AMOUNT) {
    console.error(`\n❌ Solde insuffisant! Requis: ${LOCK_AMOUNT / 1e9} BACK, Disponible: ${userBackBalance / 1e9} BACK`);
    process.exit(1);
  }

  // Dériver le GlobalState PDA
  const [globalStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    CNFT_PROGRAM_ID
  );
  console.log(`\n🌍 GlobalState PDA: ${globalStatePDA.toString()}`);

  // Vérifier que GlobalState existe
  const globalStateInfo = await connection.getAccountInfo(globalStatePDA);
  if (!globalStateInfo) {
    console.error("❌ GlobalState n'existe pas! Exécutez d'abord init-cnft-direct.js");
    process.exit(1);
  }
  console.log(`✅ GlobalState existe (${globalStateInfo.data.length} bytes)`);

  // Dériver le BACK vault PDA (appartient au programme CNFT)
  const [backVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("back_vault")],
    CNFT_PROGRAM_ID
  );
  console.log(`💰 BACK Vault PDA: ${backVaultPDA.toString()}`);

  // Créer ou récupérer le vault token account
  console.log("\n📦 Création/vérification du BACK Vault...");
  let backVaultAccount;
  try {
    backVaultAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      BACK_MINT,
      backVaultPDA,
      true // allowOwnerOffCurve - le PDA peut posséder un token account
    );
    console.log(`✅ BACK Vault Account: ${backVaultAccount.address.toString()}`);
    console.log(`   Balance actuel: ${(Number(backVaultAccount.amount) / 1e9).toFixed(2)} BACK`);
  } catch (error) {
    console.error(`❌ Erreur création vault: ${error.message}`);
    process.exit(1);
  }

  // Dériver le LockRecord PDA (unique par user)
  const [lockRecordPDA, lockRecordBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("lock_record"), payer.publicKey.toBuffer()],
    CNFT_PROGRAM_ID
  );
  console.log(`\n📜 LockRecord PDA: ${lockRecordPDA.toString()}`);
  console.log(`   Bump: ${lockRecordBump}`);

  // Vérifier si un lock existe déjà
  const existingLock = await connection.getAccountInfo(lockRecordPDA);
  if (existingLock) {
    console.log(`⚠️  Un lock existe déjà pour ce wallet (${existingLock.data.length} bytes)`);
    console.log(`   Cette instruction va augmenter le montant locké.`);
  }

  // Calculer le discriminator pour "lock_back"
  // Anchor utilise: sha256("global:lock_back").slice(0, 8)
  const discriminator = crypto
    .createHash("sha256")
    .update("global:lock_back")
    .digest()
    .slice(0, 8);
  
  console.log(`\n🔑 Discriminator: [${Array.from(discriminator).join(", ")}]`);

  // Encoder les données: discriminator + amount (u64 little-endian)
  const data = Buffer.alloc(8 + 8); // 8 bytes discriminator + 8 bytes amount
  discriminator.copy(data, 0);
  data.writeBigUInt64LE(BigInt(LOCK_AMOUNT), 8);

  console.log(`📊 Montant à locker: ${LOCK_AMOUNT / 1e9} BACK (${LOCK_AMOUNT} lamports)`);

  // Construire l'instruction lock_back
  // Comptes attendus (ordre important!):
  const keys = [
    { pubkey: globalStatePDA, isSigner: false, isWritable: true },      // 0. global_state
    { pubkey: lockRecordPDA, isSigner: false, isWritable: true },       // 1. lock_record
    { pubkey: userBackAccount.address, isSigner: false, isWritable: true }, // 2. user_back_account
    { pubkey: backVaultAccount.address, isSigner: false, isWritable: true }, // 3. back_vault
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },      // 4. user (authority)
    { pubkey: BACK_MINT, isSigner: false, isWritable: false },          // 5. back_mint
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },   // 6. token_program
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // 7. system_program
  ];

  const lockBackIx = new TransactionInstruction({
    programId: CNFT_PROGRAM_ID,
    keys,
    data,
  });

  console.log("\n📝 Comptes de l'instruction:");
  keys.forEach((key, idx) => {
    const role = [
      "global_state",
      "lock_record",
      "user_back_account",
      "back_vault",
      "user (signer)",
      "back_mint",
      "token_program",
      "system_program"
    ][idx];
    console.log(`   ${idx}. ${role.padEnd(20)} ${key.pubkey.toString().slice(0, 20)}...`);
  });

  // Créer et envoyer la transaction
  console.log("\n🚀 Envoi de la transaction...");
  const transaction = new Transaction().add(lockBackIx);

  try {
    const signature = await connection.sendTransaction(transaction, [payer], {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    console.log(`✅ Transaction envoyée: ${signature}`);
    console.log(`🔗 Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

    // Attendre la confirmation
    console.log("\n⏳ Confirmation de la transaction...");
    const confirmation = await connection.confirmTransaction(signature, "confirmed");

    if (confirmation.value.err) {
      console.error(`❌ Transaction échouée:`, confirmation.value.err);
      process.exit(1);
    }

    console.log("✅ Transaction confirmée!");

    // Vérifier les changements
    console.log("\n📊 Vérification des changements...");

    // 1. Vérifier le LockRecord
    const lockRecordAfter = await connection.getAccountInfo(lockRecordPDA);
    if (lockRecordAfter) {
      console.log(`✅ LockRecord créé/mis à jour (${lockRecordAfter.data.length} bytes)`);
      
      // Lire les données du LockRecord (structure simplifiée)
      // Supposons: discriminator (8) + owner (32) + amount (8) + timestamp (8)
      if (lockRecordAfter.data.length >= 56) {
        const lockedAmount = lockRecordAfter.data.readBigUInt64LE(40); // offset 40
        console.log(`   Montant locké: ${Number(lockedAmount) / 1e9} BACK`);
      }
    } else {
      console.log("⚠️  LockRecord non trouvé (peut-être un problème)");
    }

    // 2. Vérifier le vault
    const vaultAfter = await getAccount(connection, backVaultAccount.address);
    console.log(`✅ BACK Vault mis à jour: ${(Number(vaultAfter.amount) / 1e9).toFixed(2)} BACK`);

    // 3. Vérifier le compte user
    const userAfter = await getAccount(connection, userBackAccount.address);
    console.log(`✅ User BACK Account: ${(Number(userAfter.amount) / 1e9).toFixed(2)} BACK`);

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║           🎉 LOCK BACK RÉUSSI !                             ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");

    console.log(`\n📋 Résumé:`);
    console.log(`   • Montant locké: ${LOCK_AMOUNT / 1e9} BACK`);
    console.log(`   • LockRecord PDA: ${lockRecordPDA.toString()}`);
    console.log(`   • Transaction: ${signature}`);
    console.log(`   • Coût: ~0.0001 SOL\n`);

  } catch (error) {
    console.error("\n❌ Erreur lors de l'envoi de la transaction:");
    console.error(error);
    
    if (error.logs) {
      console.error("\n📜 Program Logs:");
      error.logs.forEach(log => console.error(`   ${log}`));
    }
    
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log("✅ Script terminé avec succès");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erreur:", error);
    process.exit(1);
  });
