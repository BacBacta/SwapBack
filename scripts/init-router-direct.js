/**
 * Initialisation Router State - Approche directe sans IDL Anchor
 * Utilise web3.js directement pour construire la transaction
 */

const { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Discriminator pour l'instruction "initialize" (calculé manuellement)
// C'est le hash SHA256 des 8 premiers bytes de "global:initialize"
const INITIALIZE_DISCRIMINATOR = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);

async function main() {
  console.log("\n🔧 Initialisation de Router State (Approche directe)\n");

  // Configuration
  const network = "https://api.devnet.solana.com";
  const connection = new Connection(network, "confirmed");

  // Charger le wallet
  const walletPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log(`✅ Wallet: ${wallet.publicKey.toString()}`);

  // Vérifier le solde
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`💰 Solde: ${(balance / 1e9).toFixed(4)} SOL\n`);

  // Program ID
  const routerProgramId = new PublicKey("GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt");

  // Dériver le PDA RouterState
  const [routerStatePDA, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("router_state")],
    routerProgramId
  );

  console.log(`📍 Program ID: ${routerProgramId.toString()}`);
  console.log(`🔑 Router State PDA: ${routerStatePDA.toString()}`);
  console.log(`🔢 Bump: ${bump}\n`);

  // Vérifier si déjà initialisé
  try {
    const accountInfo = await connection.getAccountInfo(routerStatePDA);
    if (accountInfo) {
      console.log("⚠️  Router State déjà initialisé!");
      console.log(`   Taille du compte: ${accountInfo.data.length} bytes`);
      console.log(`   Owner: ${accountInfo.owner.toString()}\n`);
      process.exit(0);
    }
  } catch (error) {
    // Le compte n'existe pas, on continue
  }

  console.log("📝 Création de l'instruction initialize...\n");

  // Créer l'instruction d'initialisation
  // Format: [discriminator (8 bytes)] + [args si nécessaire]
  const instructionData = INITIALIZE_DISCRIMINATOR;

  const keys = [
    { pubkey: routerStatePDA, isSigner: false, isWritable: true }, // state
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // authority
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
  ];

  const instruction = new TransactionInstruction({
    keys,
    programId: routerProgramId,
    data: instructionData,
  });

  // Créer et envoyer la transaction
  const transaction = new Transaction().add(instruction);

  try {
    const signature = await connection.sendTransaction(transaction, [wallet], {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    console.log("📤 Transaction envoyée!");
    console.log(`   Signature: ${signature}\n`);

    // Attendre la confirmation
    console.log("⏳ Attente de la confirmation...\n");
    const confirmation = await connection.confirmTransaction(signature, "confirmed");

    if (confirmation.value.err) {
      console.error("❌ Transaction échouée:", confirmation.value.err);
      process.exit(1);
    }

    console.log("✅ Router State initialisé avec succès!");
    console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet\n`);

    // Vérifier le compte créé
    const accountInfo = await connection.getAccountInfo(routerStatePDA);
    if (accountInfo) {
      console.log("📊 Compte créé:");
      console.log(`   Adresse: ${routerStatePDA.toString()}`);
      console.log(`   Taille: ${accountInfo.data.length} bytes`);
      console.log(`   Owner: ${accountInfo.owner.toString()}`);
      console.log(`   Lamports: ${accountInfo.lamports / 1e9} SOL\n`);
    }
  } catch (error) {
    console.error("❌ Erreur lors de la transaction:");
    console.error(error.message || error);
    if (error.logs) {
      console.error("\nLogs du programme:");
      error.logs.forEach(log => console.error(`  ${log}`));
    }
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log("🎉 Initialisation terminée!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
