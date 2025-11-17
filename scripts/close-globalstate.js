#!/usr/bin/env node
/**
 * Ferme l'ancien compte GlobalState et récupère les lamports
 */

const { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

const CNFT_PROGRAM_ID = process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID || "GEkXCcq87yUjQSp5EqcWf7bw9GKrB39A1LWdsE7V3V2E";
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

async function main() {
  console.log("\n🗑️  Fermeture de l'ancien GlobalState\n");

  const connection = new Connection(RPC_URL, "confirmed");
  const cnftProgramId = new PublicKey(CNFT_PROGRAM_ID);

  const walletPath = process.env.WALLET_PATH || path.join(process.env.HOME || "", ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log(`✅ Wallet: ${wallet.publicKey.toString()}`);

  const [globalStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    cnftProgramId
  );

  console.log(`🔑 Global State PDA: ${globalStatePDA.toString()}\n`);

  // Vérifier que le compte existe
  const accountInfo = await connection.getAccountInfo(globalStatePDA);
  if (!accountInfo) {
    console.log("✅ GlobalState n'existe pas, rien à fermer.\n");
    return;
  }

  console.log(`📊 Compte existant:`);
  console.log(`   Taille: ${accountInfo.data.length} bytes`);
  console.log(`   Lamports: ${accountInfo.lamports}\n`);

  // Créer une transaction pour transférer les lamports et fermer le compte
  // En réalité, seul le programme peut fermer son propre compte PDA
  // On va simplement le recréer avec la bonne taille
  
  console.log("⚠️  Note: Les PDAs ne peuvent être fermés que par leur programme.");
  console.log("   La solution est de redéployer le programme avec une migration.\n");
  console.log("💡 Solution alternative: Réinitialiser avec realloc\n");

  process.exit(0);
}

main().catch(console.error);
