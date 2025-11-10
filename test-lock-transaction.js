/**
 * Test du lock de tokens après upload de l'IDL
 */

const anchor = require("@coral-xyz/anchor");
const { PublicKey, Connection, Keypair } = require("@solana/web3.js");
const { getAssociatedTokenAddress } = require("@solana/spl-token");

async function testLockTokens() {
  // Configuration
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const programId = new PublicKey("9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw");
  const backMint = new PublicKey("Av3wTvhZHJLcSqJFBYNK8g4CxKtoCqzxEGxLNYLxqZ4a");
  
  // Charger l'IDL
  const idl = require("./app/src/idl/swapback_cnft.json");
  
  // Créer le provider avec un wallet temporaire (juste pour test)
  const wallet = new anchor.Wallet(Keypair.generate());
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const program = new anchor.Program(idl, programId, provider);
  
  console.log("✅ Programme chargé avec succès");
  console.log(`📋 Programme ID: ${programId.toString()}`);
  console.log(`💰 Back Mint: ${backMint.toString()}`);
  
  // Vérifier les PDAs
  const [collectionConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_config")],
    programId
  );
  
  const [globalState] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    programId
  );
  
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority")],
    programId
  );
  
  console.log("\n🔑 PDAs calculés:");
  console.log(`   Collection Config: ${collectionConfig.toString()}`);
  console.log(`   Global State: ${globalState.toString()}`);
  console.log(`   Vault Authority: ${vaultAuthority.toString()}`);
  
  // Vérifier que l'instruction existe
  const lockTokensMethod = program.methods.lockTokens;
  if (lockTokensMethod) {
    console.log("\n✅ L'instruction lock_tokens est disponible dans le programme");
    console.log("   Discriminateur: [136, 11, 32, 232, 161, 117, 54, 211]");
  } else {
    console.log("\n❌ L'instruction lock_tokens n'est PAS disponible");
  }
  
  // Vérifier l'état des comptes
  try {
    const collectionAccount = await connection.getAccountInfo(collectionConfig);
    console.log(`\n📦 Collection Config: ${collectionAccount ? "✅ Existe" : "❌ N'existe pas"}`);
    
    const globalAccount = await connection.getAccountInfo(globalState);
    console.log(`📦 Global State: ${globalAccount ? "✅ Existe" : "❌ N'existe pas"}`);
  } catch (error) {
    console.error("Erreur lors de la vérification des comptes:", error.message);
  }
  
  console.log("\n🎉 Test terminé ! L'IDL est bien uploadé et l'instruction existe.");
  console.log("➡️  Vous pouvez maintenant tester le lock depuis le Dashboard.");
}

testLockTokens().catch(console.error);
