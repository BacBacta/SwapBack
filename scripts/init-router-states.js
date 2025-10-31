#!/usr/bin/env node

/**
 * Script d'initialisation des états globaux du Router
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
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Configuration
const DEVNET_RPC = "https://api.devnet.solana.com";
const ROUTER_PROGRAM_ID = new PublicKey("GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt");
const BACK_TOKEN_MINT = new PublicKey("3Y6RXZUBHCeUj6VsWuyBY2Zy1RixY6BHkM4tf3euDdrE");

function getDiscriminator(name) {
  const hash = crypto.createHash("sha256");
  hash.update(`global:${name}`);
  return Buffer.from(hash.digest().slice(0, 8));
}

const INITIALIZE_DISCRIMINATOR = getDiscriminator("initialize");

console.log("🚀 Initialisation Router Global State");
console.log("=====================================\n");

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
    const sig = await connection.requestAirdrop(authority.publicKey, 1e9);
    await connection.confirmTransaction(sig);
    console.log("✅ Airdrop reçu");
  }

  // Dériver le GlobalState PDA (router_state selon le programme)
  const [globalStatePDA, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("router_state")],
    ROUTER_PROGRAM_ID
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

    // Afficher l'authority stockée (bytes 8-40)
    if (existingAccount.data.length >= 40) {
      const storedAuthority = new PublicKey(existingAccount.data.slice(8, 40));
      console.log(`   Authority stockée: ${storedAuthority.toBase58()}`);

      if (storedAuthority.equals(authority.publicKey)) {
        console.log("   ✅ Vous êtes l'authority");
      } else {
        console.log("   ⚠️  L'authority est différente");
      }
    }

    return;
  }

  console.log("\n🔨 Initialisation du GlobalState...");

  // Construire l'instruction (seulement 3 comptes selon le programme)
  const data = Buffer.concat([INITIALIZE_DISCRIMINATOR]);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: globalStatePDA, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: ROUTER_PROGRAM_ID,
    data,
  });

  const transaction = new Transaction().add(instruction);

  console.log("📤 Envoi de la transaction...");

  try {
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [authority],
      {
        commitment: "confirmed",
      }
    );

    console.log(`\n✅ GlobalState initialisé!`);
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
