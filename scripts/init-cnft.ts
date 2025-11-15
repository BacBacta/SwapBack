import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SwapbackCnft } from "../target/types/swapback_cnft";
import { PublicKey, SystemProgram } from "@solana/web3.js";

/**
 * Script d'initialisation du programme cNFT SwapBack
 * Initialise GlobalState et CollectionConfig
 */
async function initializeCnftProgram() {
  console.log("🚀 Initialisation du programme cNFT SwapBack");
  console.log("==============================================\n");

  // Configuration du provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SwapbackCnft as Program<SwapbackCnft>;
  const wallet = provider.wallet as anchor.Wallet;

  console.log("📋 Configuration:");
  console.log(`   Program ID: ${program.programId.toBase58()}`);
  console.log(`   Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`   Cluster: ${provider.connection.rpcEndpoint}\n`);

  // Vérifier le solde
  const balance = await provider.connection.getBalance(wallet.publicKey);
  console.log(`💰 Solde: ${balance / 1e9} SOL`);
  
  if (balance < 0.1 * 1e9) {
    console.warn("⚠️  Attention: Solde faible (< 0.1 SOL)");
    console.log("   Pour obtenir des SOL devnet: solana airdrop 2\n");
  } else {
    console.log("   ✅ Solde suffisant\n");
  }

  // 1. Initialiser GlobalState
  console.log("📝 Étape 1/2: Initialisation du GlobalState...");
  
  const [globalStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    program.programId
  );
  
  console.log(`   PDA: ${globalStatePda.toBase58()}`);

  try {
    const tx = await program.methods
      .initializeGlobalState()
      .accounts({
        globalState: globalStatePda,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("   ✅ GlobalState initialisé!");
    console.log(`   Transaction: ${tx}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);
  } catch (error: any) {
    if (error.toString().includes("already in use")) {
      console.log("   ℹ️  GlobalState déjà initialisé (compte existe)\n");
    } else {
      console.error("   ❌ Erreur lors de l'initialisation du GlobalState:");
      console.error(`   ${error}\n`);
      throw error;
    }
  }

  // 2. Initialiser CollectionConfig
  console.log("📝 Étape 2/2: Initialisation du CollectionConfig...");
  
  const [collectionConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_config")],
    program.programId
  );
  
  console.log(`   PDA: ${collectionConfigPda.toBase58()}`);

  try {
    const tx = await program.methods
      .initializeCollection()
      .accounts({
        collectionConfig: collectionConfigPda,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("   ✅ CollectionConfig initialisé!");
    console.log(`   Transaction: ${tx}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);
  } catch (error: any) {
    if (error.toString().includes("already in use")) {
      console.log("   ℹ️  CollectionConfig déjà initialisé (compte existe)\n");
    } else {
      console.error("   ❌ Erreur lors de l'initialisation du CollectionConfig:");
      console.error(`   ${error}\n`);
      throw error;
    }
  }

  // Récapitulatif
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║           ✅ INITIALISATION TERMINÉE ✅                 ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("\n📋 Comptes créés:");
  console.log(`   • GlobalState: ${globalStatePda.toBase58()}`);
  console.log(`   • CollectionConfig: ${collectionConfigPda.toBase58()}`);
  console.log("\n🎯 Prochaines étapes:");
  console.log("   1. Tester le lock: anchor test");
  console.log("   2. Lancer le frontend: cd app && npm run dev");
  console.log("   3. Vérifier sur l'explorer Solana");
  console.log("\n✨ Le programme cNFT est prêt à l'emploi!");
}

// Exécution
initializeCnftProgram()
  .then(() => {
    console.log("\n✅ Script terminé avec succès");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erreur fatale:");
    console.error(error);
    process.exit(1);
  });
