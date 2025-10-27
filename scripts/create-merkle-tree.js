/**
 * Création d'un Merkle Tree Bubblegum pour les cNFTs
 * 
 * Configuration:
 * - maxDepth: 14 (16,384 NFTs capacity)
 * - maxBufferSize: 64
 */

const { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction, SystemProgram } = require("@solana/web3.js");
const { 
  createAllocTreeIx,
  SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  SPL_NOOP_PROGRAM_ID,
  getConcurrentMerkleTreeAccountSize,
  createInitEmptyMerkleTreeIx
} = require("@solana/spl-account-compression");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n🌳 Création du Merkle Tree Bubblegum pour cNFTs\n");

  // Configuration
  const network = "https://api.devnet.solana.com";
  const connection = new Connection(network, "confirmed");

  // Charger le wallet
  const walletPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log(`✅ Wallet: ${payer.publicKey.toString()}`);

  const balance = await connection.getBalance(payer.publicKey);
  console.log(`💰 Solde: ${(balance / 1e9).toFixed(4)} SOL\n`);

  if (balance < 0.1 * 1e9) {
    console.error("❌ Solde insuffisant (minimum 0.1 SOL requis)");
    process.exit(1);
  }

  // Configuration du Merkle Tree
  const maxDepth = 14; // 2^14 = 16,384 NFTs
  const maxBufferSize = 64;
  const canopyDepth = 0; // Pas de canopy pour économiser de l'espace

  console.log("📊 Configuration du Merkle Tree:");
  console.log(`   Max Depth: ${maxDepth} (capacité: ${2 ** maxDepth} NFTs)`);
  console.log(`   Max Buffer Size: ${maxBufferSize}`);
  console.log(`   Canopy Depth: ${canopyDepth}\n`);

  // Générer un nouveau keypair pour le Merkle Tree
  const merkleTree = Keypair.generate();
  console.log(`🔑 Merkle Tree Address: ${merkleTree.publicKey.toString()}\n`);

  // Calculer la taille du compte
  const space = getConcurrentMerkleTreeAccountSize(maxDepth, maxBufferSize, canopyDepth);
  const cost = await connection.getMinimumBalanceForRentExemption(space);

  console.log(`💾 Taille du compte: ${space} bytes`);
  console.log(`💰 Coût (rent exempt): ${(cost / 1e9).toFixed(6)} SOL\n`);

  try {
    console.log("📝 Création de la transaction...\n");

    const transaction = new Transaction();

    // 1. Allouer l'espace pour le Merkle Tree
    const allocTreeIx = await createAllocTreeIx(
      connection,
      merkleTree.publicKey,
      payer.publicKey,
      { maxDepth, maxBufferSize },
      canopyDepth
    );
    transaction.add(allocTreeIx);

    // 2. Initialiser le Merkle Tree vide
    const initTreeIx = createInitEmptyMerkleTreeIx(
      merkleTree.publicKey,
      payer.publicKey,
      { maxDepth, maxBufferSize }
    );
    transaction.add(initTreeIx);

    console.log("📤 Envoi de la transaction...\n");

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer, merkleTree],
      {
        commitment: "confirmed",
        skipPreflight: false,
      }
    );

    console.log("✅ Merkle Tree créé avec succès!");
    console.log(`   Signature: ${signature}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet\n`);

    // Vérifier le compte créé
    const accountInfo = await connection.getAccountInfo(merkleTree.publicKey);
    if (accountInfo) {
      console.log("📊 Compte Merkle Tree:");
      console.log(`   Adresse: ${merkleTree.publicKey.toString()}`);
      console.log(`   Taille: ${accountInfo.data.length} bytes`);
      console.log(`   Owner: ${accountInfo.owner.toString()}`);
      console.log(`   Lamports: ${(accountInfo.lamports / 1e9).toFixed(6)} SOL\n`);
    }

    // Sauvegarder les informations
    const treeInfo = {
      address: merkleTree.publicKey.toString(),
      maxDepth,
      maxBufferSize,
      capacity: 2 ** maxDepth,
      signature,
      createdAt: new Date().toISOString(),
      network: "devnet",
      explorer: `https://explorer.solana.com/address/${merkleTree.publicKey.toString()}?cluster=devnet`,
    };

    const outputPath = path.join(__dirname, "../merkle-tree-info.json");
    fs.writeFileSync(outputPath, JSON.stringify(treeInfo, null, 2));
    console.log(`📝 Informations sauvegardées: ${outputPath}\n`);

    console.log("🎉 Merkle Tree prêt pour les cNFTs!\n");

    // Instructions pour la suite
    console.log("📋 Prochaines étapes:");
    console.log("   1. Mettre à jour le CNFT program avec cette adresse");
    console.log("   2. Initialiser la collection Metaplex");
    console.log("   3. Tester le mint de cNFT");

  } catch (error) {
    console.error("❌ Erreur:", error.message || error);
    if (error.logs) {
      console.error("\nLogs:");
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
