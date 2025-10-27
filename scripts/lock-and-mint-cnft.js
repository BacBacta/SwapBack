/**
 * Script pour Lock BACK + Mint cNFT de niveau
 * 
 * Workflow en 2 étapes:
 * 1. Transférer BACK tokens vers un vault (SPL Token Transfer)
 * 2. Appeler mint_level_nft pour enregistrer le boost et créer le UserNft PDA
 * 
 * Note: L'implémentation actuelle du programme CNFT n'inclut pas le transfert de tokens
 * dans mint_level_nft. Ce script fait le transfert séparément puis appelle l'instruction.
 */

const { Connection, Keypair, PublicKey, Transaction, SystemProgram, TransactionInstruction } = require("@solana/web3.js");
const { createTransferInstruction, getOrCreateAssociatedTokenAccount, getAccount, TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Configuration devnet
const NETWORK = "https://api.devnet.solana.com";
const CNFT_PROGRAM_ID = new PublicKey("9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw");
const BACK_MINT = new PublicKey("14rtHCJVvU7NKeFJotJsHdbsQGajnNmoQ7MHid41RLTa");

// Paramètres du lock
const LOCK_AMOUNT = 100_000_000_000; // 100 BACK (9 decimals)
const LOCK_DURATION_DAYS = 90; // 90 jours
const LOCK_DURATION_SECONDS = LOCK_DURATION_DAYS * 24 * 60 * 60;

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║      🔒 LOCK BACK & MINT cNFT DE NIVEAU - Devnet           ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const connection = new Connection(NETWORK, "confirmed");

  // Charger le wallet
  const walletPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log(`👤 Wallet: ${payer.publicKey.toString()}`);
  
  const balance = await connection.getBalance(payer.publicKey);
  console.log(`💰 Solde SOL: ${(balance / 1e9).toFixed(4)} SOL\n`);

  // Vérifier le compte BACK du user
  console.log("📋 ÉTAPE 1/4: Vérification du compte BACK...");
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

  // Dériver les PDAs
  console.log("\n📋 ÉTAPE 2/4: Dérivation des PDAs...");
  
  const [globalStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    CNFT_PROGRAM_ID
  );
  console.log(`   GlobalState: ${globalStatePDA.toString()}`);

  const [collectionConfigPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_config")],
    CNFT_PROGRAM_ID
  );
  console.log(`   CollectionConfig: ${collectionConfigPDA.toString()}`);

  const [userNftPDA, userNftBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_nft"), payer.publicKey.toBuffer()],
    CNFT_PROGRAM_ID
  );
  console.log(`   UserNft PDA: ${userNftPDA.toString()}`);
  console.log(`   UserNft Bump: ${userNftBump}`);

  // Vérifier que GlobalState et CollectionConfig existent
  const globalStateInfo = await connection.getAccountInfo(globalStatePDA);
  if (!globalStateInfo) {
    console.error("\n❌ GlobalState n'existe pas! Exécutez d'abord init-cnft-direct.js");
    process.exit(1);
  }
  console.log(`   ✅ GlobalState existe (${globalStateInfo.data.length} bytes)`);

  const collectionConfigInfo = await connection.getAccountInfo(collectionConfigPDA);
  if (!collectionConfigInfo) {
    console.error("\n❌ CollectionConfig n'existe pas! Initialisez d'abord la collection.");
    console.log("   Vous devez d'abord appeler initialize_collection.");
    process.exit(1);
  }
  console.log(`   ✅ CollectionConfig existe (${collectionConfigInfo.data.length} bytes)`);

  // Vérifier si un UserNft existe déjà
  const existingUserNft = await connection.getAccountInfo(userNftPDA);
  if (existingUserNft) {
    console.log(`\n⚠️  Un UserNft existe déjà pour ce wallet!`);
    console.log(`   Taille: ${existingUserNft.data.length} bytes`);
    console.log(`   Ce script va échouer car mint_level_nft utilise 'init'.`);
    console.log(`   Pour re-locker, vous devriez appeler update_nft_status ou une autre instruction.`);
    process.exit(1);
  }

  // Créer le vault BACK (ATA avec PDA comme owner - pour recevoir les tokens lockés)
  // Note: Dans une vraie impl, le vault devrait être un PDA contrôlé par le programme
  // Pour simplifier, on va créer un ATA pour globalStatePDA
  console.log("\n📋 ÉTAPE 3/4: Préparation du vault BACK...");
  
  // Utilisons un simple ATA pour globalStatePDA comme vault temporaire
  let backVaultAccount;
  try {
    backVaultAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      BACK_MINT,
      globalStatePDA,
      true // allowOwnerOffCurve
    );
    console.log(`✅ BACK Vault (ATA pour GlobalState): ${backVaultAccount.address.toString()}`);
    console.log(`   Balance actuel: ${(Number(backVaultAccount.amount) / 1e9).toFixed(2)} BACK`);
  } catch (error) {
    console.error(`❌ Erreur création vault: ${error.message}`);
    process.exit(1);
  }

  // Calculer le discriminator pour "mint_level_nft"
  const discriminator = crypto
    .createHash("sha256")
    .update("global:mint_level_nft")
    .digest()
    .slice(0, 8);
  
  console.log(`\n🔑 Discriminator mint_level_nft: [${Array.from(discriminator).join(", ")}]`);

  // Encoder les paramètres: amount_locked (u64) + lock_duration (i64)
  const instructionData = Buffer.alloc(8 + 8 + 8); // discriminator + amount + duration
  discriminator.copy(instructionData, 0);
  instructionData.writeBigUInt64LE(BigInt(LOCK_AMOUNT), 8); // amount_locked
  instructionData.writeBigInt64LE(BigInt(LOCK_DURATION_SECONDS), 16); // lock_duration (i64)

  console.log(`\n📊 Paramètres:`);
  console.log(`   Montant: ${LOCK_AMOUNT / 1e9} BACK (${LOCK_AMOUNT} lamports)`);
  console.log(`   Durée: ${LOCK_DURATION_DAYS} jours (${LOCK_DURATION_SECONDS} secondes)`);

  // Calculer le boost estimé (même logique que le programme)
  const estimatedBoost = calculateBoost(LOCK_AMOUNT, LOCK_DURATION_SECONDS);
  console.log(`   Boost estimé: ${estimatedBoost} basis points (${(estimatedBoost / 100).toFixed(2)}%)`);

  // Construire l'instruction mint_level_nft
  // Comptes selon MintLevelNft context:
  const mintKeys = [
    { pubkey: collectionConfigPDA, isSigner: false, isWritable: true },  // 0. collection_config
    { pubkey: globalStatePDA, isSigner: false, isWritable: true },        // 1. global_state
    { pubkey: userNftPDA, isSigner: false, isWritable: true },            // 2. user_nft (init)
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },        // 3. user (signer + payer)
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // 4. system_program
  ];

  const mintLevelNftIx = new TransactionInstruction({
    programId: CNFT_PROGRAM_ID,
    keys: mintKeys,
    data: instructionData,
  });

  // Créer l'instruction de transfert BACK vers le vault
  const transferBackIx = createTransferInstruction(
    userBackAccount.address,  // source
    backVaultAccount.address, // destination
    payer.publicKey,          // owner
    LOCK_AMOUNT,              // amount
    [],                       // multisigners
    TOKEN_PROGRAM_ID
  );

  console.log("\n📋 ÉTAPE 4/4: Construction de la transaction...");
  console.log("\n   Instructions:");
  console.log("   1. Transfer BACK → vault");
  console.log("   2. Mint Level NFT (enregistrement boost)");

  // Créer la transaction combinée
  const transaction = new Transaction()
    .add(transferBackIx)
    .add(mintLevelNftIx);

  console.log("\n🚀 Envoi de la transaction...");

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
    console.log("\n📊 Vérification des résultats...");

    // 1. Vérifier le UserNft
    const userNftAfter = await connection.getAccountInfo(userNftPDA);
    if (userNftAfter) {
      console.log(`✅ UserNft créé (${userNftAfter.data.length} bytes)`);
      
      // Lire les données (structure UserNft)
      // Approximation: discriminator (8) + user (32) + level (1) + amount (8) + duration (8) + boost (2) + timestamp (8) + is_active (1) + bump (1)
      if (userNftAfter.data.length >= 69) {
        try {
          const lockedAmount = userNftAfter.data.readBigUInt64LE(41); // après discriminator + user + level
          const lockDuration = userNftAfter.data.readBigInt64LE(49);
          const boost = userNftAfter.data.readUInt16LE(57);
          const isActive = userNftAfter.data.readUInt8(65);
          
          console.log(`   • Montant locké: ${Number(lockedAmount) / 1e9} BACK`);
          console.log(`   • Durée: ${Number(lockDuration) / 86400} jours`);
          console.log(`   • Boost: ${boost} basis points (${(boost / 100).toFixed(2)}%)`);
          console.log(`   • Active: ${isActive === 1 ? 'Oui' : 'Non'}`);
        } catch (err) {
          console.log(`   ⚠️  Impossible de parser les données: ${err.message}`);
        }
      }
    } else {
      console.log("❌ UserNft non créé (erreur)");
    }

    // 2. Vérifier le vault
    const vaultAfter = await getAccount(connection, backVaultAccount.address);
    console.log(`✅ BACK Vault mis à jour: ${(Number(vaultAfter.amount) / 1e9).toFixed(2)} BACK`);

    // 3. Vérifier le compte user
    const userAfter = await getAccount(connection, userBackAccount.address);
    console.log(`✅ User BACK Account: ${(Number(userAfter.amount) / 1e9).toFixed(2)} BACK`);

    // 4. Vérifier GlobalState
    const globalStateAfter = await connection.getAccountInfo(globalStatePDA);
    if (globalStateAfter) {
      try {
        // GlobalState: discriminator (8) + authority (32) + total_community_boost (8) + active_locks_count (8) + total_value_locked (8)
        const totalCommunityBoost = globalStateAfter.data.readBigUInt64LE(40);
        const activeLocksCount = globalStateAfter.data.readBigUInt64LE(48);
        const totalValueLocked = globalStateAfter.data.readBigUInt64LE(56);
        
        console.log(`✅ GlobalState mis à jour:`);
        console.log(`   • Total Community Boost: ${Number(totalCommunityBoost)} bp`);
        console.log(`   • Active Locks: ${Number(activeLocksCount)}`);
        console.log(`   • Total Value Locked: ${(Number(totalValueLocked) / 1e9).toFixed(2)} BACK`);
      } catch (err) {
        console.log(`   ⚠️  Impossible de parser GlobalState: ${err.message}`);
      }
    }

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║      🎉 LOCK & MINT cNFT RÉUSSI !                           ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");

    console.log(`\n📋 Résumé:`);
    console.log(`   • Montant locké: ${LOCK_AMOUNT / 1e9} BACK`);
    console.log(`   • Durée: ${LOCK_DURATION_DAYS} jours`);
    console.log(`   • Boost estimé: ${estimatedBoost} bp (${(estimatedBoost / 100).toFixed(2)}%)`);
    console.log(`   • UserNft PDA: ${userNftPDA.toString()}`);
    console.log(`   • Transaction: ${signature}`);
    console.log(`   • Coût: ~0.001 SOL\n`);

    // Sauvegarder les infos pour usage futur
    const lockInfo = {
      wallet: payer.publicKey.toString(),
      userNftPDA: userNftPDA.toString(),
      lockAmount: LOCK_AMOUNT,
      lockDuration: LOCK_DURATION_SECONDS,
      boost: estimatedBoost,
      transaction: signature,
      timestamp: new Date().toISOString(),
      network: "devnet",
    };

    const lockInfoPath = path.join(__dirname, "../user-lock-info.json");
    fs.writeFileSync(lockInfoPath, JSON.stringify(lockInfo, null, 2));
    console.log(`💾 Infos sauvegardées: ${lockInfoPath}\n`);

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

// Fonction pour calculer le boost (même logique que le programme Rust)
// Base: 200 bp (2%)
// +amount bonus: jusqu'à 300 bp
// +duration bonus: jusqu'à 300 bp
// Total max: 800 bp (8%)
function calculateBoost(amountLocked, lockDurationSeconds) {
  const BASE_BOOST = 200; // 2% en basis points

  // Amount bonus (échelle logarithmique)
  // 1M BACK = +100 bp, 10M = +200 bp, 100M = +300 bp
  const amountInBACK = amountLocked / 1e9;
  let amountBonus = 0;
  if (amountInBACK >= 100_000_000) {
    amountBonus = 300;
  } else if (amountInBACK >= 10_000_000) {
    amountBonus = 200;
  } else if (amountInBACK >= 1_000_000) {
    amountBonus = 100;
  } else if (amountInBACK >= 100_000) {
    amountBonus = 50;
  } else if (amountInBACK >= 10_000) {
    amountBonus = 25;
  } else if (amountInBACK >= 1_000) {
    amountBonus = 10;
  }

  // Duration bonus (linéaire)
  // 30 jours = +100 bp, 90 jours = +200 bp, 180+ jours = +300 bp
  const durationDays = lockDurationSeconds / 86400;
  let durationBonus = 0;
  if (durationDays >= 180) {
    durationBonus = 300;
  } else if (durationDays >= 90) {
    durationBonus = 200;
  } else if (durationDays >= 30) {
    durationBonus = 100;
  } else if (durationDays >= 7) {
    durationBonus = 50;
  }

  const totalBoost = BASE_BOOST + amountBonus + durationBonus;
  return Math.min(totalBoost, 800); // Cap à 800 bp (8%)
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
