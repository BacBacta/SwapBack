/**
 * Script JavaScript pur - Initialisation Router State
 * Évite les problèmes de types TypeScript
 */

const anchor = require("@coral-xyz/anchor");
const { PublicKey, Keypair, SystemProgram, Connection } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n🔧 Initialisation de Router State sur Devnet (JS pur)\n");

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

  // Créer le provider
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed" }
  );

  anchor.setProvider(provider);

  // Charger le programme Router
  const routerProgramId = new PublicKey("GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt");
  const routerIdl = JSON.parse(
    fs.readFileSync("target/idl/swapback_router.json", "utf-8")
  );

  console.log(`📍 Program ID: ${routerProgramId.toString()}`);
  console.log(`✅ IDL chargé (version ${routerIdl.version})\n`);

  try {
    const routerProgram = new anchor.Program(routerIdl, routerProgramId, provider);

    // Dériver le PDA
    const [routerState] = PublicKey.findProgramAddressSync(
      [Buffer.from("router_state")],
      routerProgramId
    );

    console.log(`🔑 Router State PDA: ${routerState.toString()}\n`);

    // Initialiser
    console.log("📝 Envoi de la transaction d'initialisation...\n");

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
    console.error("❌ Erreur:", error.message || error);
    if (error.logs) {
      console.error("\nLogs du programme:");
      error.logs.forEach(log => console.error(`  ${log}`));
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
