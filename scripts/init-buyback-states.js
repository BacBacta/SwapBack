#!/usr/bin/env node

/**
 * Script d'initialisation des états globaux du Buyback
 * À exécuter une seule fois après déploiement
 */

const {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddress,
} = require("@solana/spl-token");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Configuration
const DEVNET_RPC = "https://api.devnet.solana.com";
const BUYBACK_PROGRAM_ID = new PublicKey("EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf");
const BACK_TOKEN_MINT = new PublicKey("3Y6RXZUBHCeUj6VsWuyBY2Zy1RixY6BHkM4tf3euDdrE");

// USDC Devnet (Circle) - utilise toujours Token standard
const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

// Programmes token
const TOKEN_PROGRAM_ID_STANDARD = TOKEN_PROGRAM_ID;
const TOKEN_PROGRAM_ID_BACK = TOKEN_2022_PROGRAM_ID; // $BACK utilise Token-2022

function getDiscriminator(name) {
  const hash = crypto.createHash("sha256");
  hash.update(`global:${name}`);
  return Buffer.from(hash.digest().slice(0, 8));
}

const INITIALIZE_DISCRIMINATOR = getDiscriminator("initialize");

console.log("🏦 Initialisation Buyback Global State");
console.log("=======================================\n");

async function main() {
  const connection = new Connection(DEVNET_RPC, "confirmed");

  // Charger l'authority wallet
  const defaultPath = path.join(
    require("os").homedir(),
    ".config/solana/id.json"
  );
  const keyData = JSON.parse(fs.readFileSync(defaultPath, "utf-8"));
  const authority = Keypair.fromSecretKey(Uint8Array.from(keyData));

  console.log(`👤 Authority: ${authority.publicKey.toBase58()}`);

  const balance = await connection.getBalance(authority.publicKey);
  console.log(`💰 Balance: ${balance / 1e9} SOL`);

  if (balance < 0.1 * 1e9) {
    console.log("⚠️  Balance faible, airdrop...");
    try {
      const sig = await connection.requestAirdrop(authority.publicKey, 1e9);
      await connection.confirmTransaction(sig);
      console.log("✅ Airdrop reçu");
    } catch (e) {
      console.log("⚠️  Airdrop échoué, continuons...");
    }
  }

  // Dériver le GlobalState PDA
  const [globalStatePDA, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    BUYBACK_PROGRAM_ID
  );

  console.log(`\n📍 GlobalState PDA: ${globalStatePDA.toBase58()}`);
  console.log(`   Bump: ${bump}`);

  // Vérifier si déjà initialisé
  const existingAccount = await connection.getAccountInfo(globalStatePDA);

  if (existingAccount) {
    console.log("\n✅ GlobalState déjà initialisé!");
    console.log(`   Owner: ${existingAccount.owner.toBase58()}`);
    console.log(`   Size: ${existingAccount.data.length} bytes`);
    console.log(`   Lamports: ${existingAccount.lamports / 1e9} SOL`);

    // Afficher les informations stockées
    if (existingAccount.data.length >= 40) {
      const storedAuthority = new PublicKey(existingAccount.data.slice(8, 40));
      console.log(`   Authority stockée: ${storedAuthority.toBase58()}`);

      if (storedAuthority.equals(authority.publicKey)) {
        console.log("   ✅ Vous êtes l'authority");
      } else {
        console.log("   ⚠️  L'authority est différente");
      }

      // Lire fee_split si disponible (u16 à l'offset ~40)
      if (existingAccount.data.length > 42) {
        const feeSplit = existingAccount.data.readUInt16LE(40);
        console.log(`   Fee split: ${feeSplit} bps (${feeSplit / 100}%)`);
      }
    }

    return;
  }

  console.log("\n🔨 Initialisation du GlobalState Buyback...");

  // Dériver les vaults PDAs
  const [usdcVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("usdc_vault")],
    BUYBACK_PROGRAM_ID
  );

  const [backVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("back_vault")],
    BUYBACK_PROGRAM_ID
  );

  console.log(`📦 USDC Vault PDA: ${usdcVaultPDA.toBase58()}`);
  console.log(`📦 BACK Vault PDA: ${backVaultPDA.toBase58()}`);

  // Min buyback amount: 10 USDC (6 decimals)
  const minBuybackAmount = 10 * 1e6; // 10 USDC minimum pour déclencher un buyback
  const minBuybackBuffer = Buffer.alloc(8);
  minBuybackBuffer.writeBigUInt64LE(BigInt(minBuybackAmount));

  const data = Buffer.concat([INITIALIZE_DISCRIMINATOR, minBuybackBuffer]);

  console.log(`\n⚙️  Configuration:`);
  console.log(`   Min buyback: ${minBuybackAmount / 1e6} USDC`);

  // Construire l'instruction (selon Initialize struct du programme)
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: globalStatePDA, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: BACK_TOKEN_MINT, isSigner: false, isWritable: false },
      { pubkey: usdcVaultPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false }, // Token-2022 pour $BACK
    ],
    programId: BUYBACK_PROGRAM_ID,
    data,
  });

  const transaction = new Transaction().add(instruction);

  console.log("\n📤 Envoi de la transaction...");

  try {
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [authority],
      {
        commitment: "confirmed",
      }
    );

    console.log(`\n✅ GlobalState Buyback initialisé!`);
    console.log(`   Signature: ${signature}`);
    console.log(
      `   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`
    );

    // Vérifier
    const newAccount = await connection.getAccountInfo(globalStatePDA);
    if (newAccount) {
      console.log(`\n📊 Compte créé:`);
      console.log(`   Size: ${newAccount.data.length} bytes`);
      console.log(`   Owner: ${newAccount.owner.toBase58()}`);
      console.log(`   Rent: ${newAccount.lamports / 1e9} SOL`);
    }

    console.log("\n✅ Buyback prêt pour:");
    console.log("   - Recevoir USDC des swaps");
    console.log("   - Exécuter buybacks automatiques");
    console.log("   - Distribuer rebates (70%)");
    console.log("   - Burn de $BACK (30%)");
  } catch (error) {
    console.error("\n❌ Erreur lors de l'initialisation:", error.message);

    if (error.logs) {
      console.error("\n📜 Logs:");
      error.logs.forEach((log) => console.error(`   ${log}`));
    }

    throw error;
  }
}

main()
  .then(() => {
    console.log("\n✅ Script terminé");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erreur:", error);
    process.exit(1);
  });
