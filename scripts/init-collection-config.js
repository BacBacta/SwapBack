/**
 * Initialiser la Collection Config pour les cNFTs SwapBack
 * 
 * Cette instruction configure la collection de cNFTs de niveau
 * et la lie au Merkle Tree Bubblegum
 * 
 * Prérequis: Merkle Tree créé
 */

const { Connection, Keypair, PublicKey, Transaction, SystemProgram, TransactionInstruction } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Configuration devnet
const NETWORK = "https://api.devnet.solana.com";
const CNFT_PROGRAM_ID = new PublicKey("9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw");
const MERKLE_TREE = new PublicKey("UKwWETzhjGREsYffBNoi6qShiH32hzRu4nRQ3Z8RYoa");

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║        📋 INITIALISER COLLECTION CONFIG - Devnet            ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const connection = new Connection(NETWORK, "confirmed");

  // Charger le wallet
  const walletPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log(`👤 Wallet: ${payer.publicKey.toString()}`);
  
  const balance = await connection.getBalance(payer.publicKey);
  console.log(`💰 Solde SOL: ${(balance / 1e9).toFixed(4)} SOL`);

  // Dériver le CollectionConfig PDA
  const [collectionConfigPDA, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_config")],
    CNFT_PROGRAM_ID
  );

  console.log(`\n📋 CollectionConfig PDA: ${collectionConfigPDA.toString()}`);
  console.log(`   Bump: ${bump}`);

  // Vérifier si déjà initialisé
  const existing = await connection.getAccountInfo(collectionConfigPDA);
  if (existing) {
    console.log(`\n⚠️  CollectionConfig déjà initialisé (${existing.data.length} bytes)`);
    console.log(`   Rien à faire!`);
    
    // Lire les données
    try {
      // discriminator (8) + authority (32) + tree_config (32) + total_minted (8) + bump (1)
      const authority = new PublicKey(existing.data.slice(8, 40));
      const treeConfig = new PublicKey(existing.data.slice(40, 72));
      const totalMinted = existing.data.readBigUInt64LE(72);
      
      console.log(`\n   Authority: ${authority.toString()}`);
      console.log(`   Tree Config: ${treeConfig.toString()}`);
      console.log(`   Total Minted: ${Number(totalMinted)}`);
    } catch (err) {
      console.log(`   ⚠️  Impossible de parser: ${err.message}`);
    }
    
    process.exit(0);
  }

  console.log(`\n🌳 Merkle Tree: ${MERKLE_TREE.toString()}`);

  // Vérifier que le Merkle Tree existe
  const treeInfo = await connection.getAccountInfo(MERKLE_TREE);
  if (!treeInfo) {
    console.error(`\n❌ Merkle Tree n'existe pas!`);
    console.error(`   Exécutez d'abord: node scripts/create-merkle-tree.js`);
    process.exit(1);
  }
  console.log(`✅ Merkle Tree existe (${treeInfo.data.length} bytes)`);

  // Calculer le discriminator pour "initialize_collection"
  const discriminator = crypto
    .createHash("sha256")
    .update("global:initialize_collection")
    .digest()
    .slice(0, 8);

  console.log(`\n🔑 Discriminator: [${Array.from(discriminator).join(", ")}]`);

  // Construire l'instruction initialize_collection
  // Comptes selon InitializeCollection context:
  const keys = [
    { pubkey: collectionConfigPDA, isSigner: false, isWritable: true },    // 0. collection_config (init)
    { pubkey: MERKLE_TREE, isSigner: false, isWritable: false },           // 1. tree_config
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },         // 2. authority (signer + payer)
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // 3. system_program
  ];

  const initCollectionIx = new TransactionInstruction({
    programId: CNFT_PROGRAM_ID,
    keys,
    data: discriminator, // Pas de paramètres supplémentaires
  });

  console.log("\n📝 Comptes de l'instruction:");
  keys.forEach((key, idx) => {
    const role = ["collection_config (init)", "tree_config", "authority", "system_program"][idx];
    console.log(`   ${idx}. ${role.padEnd(25)} ${key.pubkey.toString()}`);
  });

  // Créer et envoyer la transaction
  console.log("\n🚀 Envoi de la transaction...");
  const transaction = new Transaction().add(initCollectionIx);

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

    // Vérifier la création
    console.log("\n📊 Vérification du résultat...");
    const collectionConfigAfter = await connection.getAccountInfo(collectionConfigPDA);
    
    if (collectionConfigAfter) {
      console.log(`✅ CollectionConfig créé (${collectionConfigAfter.data.length} bytes)`);
      console.log(`   Lamports: ${(collectionConfigAfter.lamports / 1e9).toFixed(6)} SOL`);
      console.log(`   Owner: ${collectionConfigAfter.owner.toString()}`);
      
      // Lire les données
      try {
        const authority = new PublicKey(collectionConfigAfter.data.slice(8, 40));
        const treeConfig = new PublicKey(collectionConfigAfter.data.slice(40, 72));
        const totalMinted = collectionConfigAfter.data.readBigUInt64LE(72);
        
        console.log(`\n   📋 Données:`);
        console.log(`      Authority: ${authority.toString()}`);
        console.log(`      Tree Config: ${treeConfig.toString()}`);
        console.log(`      Total Minted: ${Number(totalMinted)}`);
      } catch (err) {
        console.log(`   ⚠️  Impossible de parser: ${err.message}`);
      }
    } else {
      console.error("❌ CollectionConfig non créé!");
      process.exit(1);
    }

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║        🎉 COLLECTION CONFIG INITIALISÉE !                   ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");

    console.log(`\n📋 Résumé:`);
    console.log(`   • CollectionConfig PDA: ${collectionConfigPDA.toString()}`);
    console.log(`   • Merkle Tree: ${MERKLE_TREE.toString()}`);
    console.log(`   • Transaction: ${signature}`);
    console.log(`   • Coût: ~0.001 SOL\n`);

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
