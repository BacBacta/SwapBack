/**
 * Script simple d'initialisation de Router State
 * Basé sur initialize-states.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("\n🔧 Initialisation de Router State sur Devnet\n");

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

  if (balance < 0.01 * 1e9) {
    console.log("❌ Solde insuffisant");
    process.exit(1);
  }

  // Créer le provider
  const provider = new AnchorProvider(connection, new Wallet(wallet), {
    commitment: "confirmed",
  });

  anchor.setProvider(provider);

  // Charger le programme Router
  const routerProgramId = new PublicKey("GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt");
  const routerIdl = JSON.parse(
    fs.readFileSync("target/idl/swapback_router.json", "utf-8")
  );

  console.log(`📍 Program ID: ${routerProgramId.toString()}`);
  console.log(`✅ IDL chargé\n`);

  const routerProgram = new Program(routerIdl, routerProgramId, provider);

  // Dériver le PDA
  const [routerState] = PublicKey.findProgramAddressSync(
    [Buffer.from("router_state")],
    routerProgramId
  );

  console.log(`🔑 Router State PDA: ${routerState.toString()}\n`);

  // Vérifier si déjà initialisé
  try {
    // @ts-ignore
    const existingState = await routerProgram.account.routerState.fetch(routerState);
    console.log("⚠️  RouterState déjà initialisé");
    console.log(`   Authority: ${existingState.authority.toString()}`);
    process.exit(0);
  } catch (error) {
    // Pas encore initialisé, continuer
    console.log("📝 RouterState pas encore initialisé, création...\n");
  }

  // Initialiser
  try {
    // @ts-ignore
    const tx = await routerProgram.methods
      .initialize()
      .accounts({
        state: routerState,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ RouterState initialisé avec succès!");
    console.log(`   Transaction: ${tx}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);
  } catch (error) {
    console.error("❌ Erreur lors de l'initialisation:");
    console.error(error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
