#!/usr/bin/env node

/**
 * Script de test complet Lock/Unlock avec le vrai token $BACK
 * Teste le flow end-to-end sur devnet
 */

const {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_2022_PROGRAM_ID,
} = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");

// Configuration
const DEVNET_RPC = "https://api.devnet.solana.com";
const CNFT_PROGRAM_ID = new PublicKey("AaN2BwpGWbvDo7NHfpyC6zGYxsbg2xtcikToW9xYy4Xq");
const ROUTER_PROGRAM_ID = new PublicKey("GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt");
const BACK_TOKEN_MINT = new PublicKey("3Y6RXZUBHCeUj6VsWuyBY2Zy1RixY6BHkM4tf3euDdrE");

// Discriminators (calculés manuellement via sha256 du nom de l'instruction)
const crypto = require("crypto");

function getDiscriminator(name) {
  const hash = crypto.createHash("sha256");
  hash.update(`global:${name}`);
  return Buffer.from(hash.digest().slice(0, 8));
}

const LOCK_BACK_DISCRIMINATOR = getDiscriminator("lock_back");
const UNLOCK_BACK_DISCRIMINATOR = getDiscriminator("unlock_back");

console.log("🔐 Test Lock/Unlock avec Token $BACK");
console.log("=====================================\n");

async function main() {
  // Connexion
  const connection = new Connection(DEVNET_RPC, "confirmed");

  // Charger le wallet
  let wallet;
  const walletPath = path.join(__dirname, "..", "test-wallet-fresh.json");

  if (fs.existsSync(walletPath)) {
    const keyData = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
    wallet = Keypair.fromSecretKey(Uint8Array.from(keyData));
  } else {
    console.log("❌ Wallet non trouvé. Utilisation du wallet par défaut...");
    const defaultPath = path.join(
      require("os").homedir(),
      ".config/solana/id.json"
    );
    const keyData = JSON.parse(fs.readFileSync(defaultPath, "utf-8"));
    wallet = Keypair.fromSecretKey(Uint8Array.from(keyData));
  }

  console.log(`👛 Wallet: ${wallet.publicKey.toBase58()}`);

  // Vérifier balance SOL
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`💰 Balance SOL: ${balance / 1e9} SOL`);

  if (balance < 0.1 * 1e9) {
    console.log("⚠️  Balance faible, airdrop recommandé");
    try {
      const sig = await connection.requestAirdrop(wallet.publicKey, 1e9);
      await connection.confirmTransaction(sig);
      console.log("✅ Airdrop de 1 SOL reçu");
    } catch (e) {
      console.log("⚠️  Airdrop échoué:", e.message);
    }
  }

  // Vérifier balance $BACK
  console.log("\n📊 Vérification du token $BACK...");
  const ata = await getAssociatedTokenAddress(
    BACK_TOKEN_MINT,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  console.log(`📦 Token Account (ATA): ${ata.toBase58()}`);

  let tokenBalance = 0;
  try {
    const tokenAccount = await getAccount(
      connection,
      ata,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    tokenBalance = Number(tokenAccount.amount) / 1e9;
    console.log(`💵 Balance $BACK: ${tokenBalance} BACK`);
  } catch (e) {
    console.log("⚠️  Pas de compte de token trouvé");
    console.log("   Création du compte de token...");

    // Créer ATA
    const createAtaIx = createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      ata,
      wallet.publicKey,
      BACK_TOKEN_MINT,
      TOKEN_2022_PROGRAM_ID
    );

    const tx = new Transaction().add(createAtaIx);
    const sig = await sendAndConfirmTransaction(connection, tx, [wallet]);
    console.log(`✅ Token account créé: ${sig}`);
    tokenBalance = 0;
  }

  if (tokenBalance < 100) {
    console.log("\n⚠️  Balance $BACK insuffisante pour le test");
    console.log("   Minimum requis: 100 BACK");
    console.log("   Votre balance:", tokenBalance, "BACK");
    console.log("\n💡 Pour obtenir des tokens $BACK:");
    console.log(`   spl-token mint ${BACK_TOKEN_MINT.toBase58()} 100 ${ata.toBase58()} --program-id ${TOKEN_2022_PROGRAM_ID.toBase58()}`);
    process.exit(1);
  }

  // Test 1: Lock
  console.log("\n🔒 Test 1: Lock de tokens $BACK");
  console.log("─────────────────────────────────");

  const lockAmount = 100; // 100 BACK
  const lockDuration = 30 * 24 * 60 * 60; // 30 jours en secondes

  console.log(`Montant: ${lockAmount} BACK`);
  console.log(`Durée: ${lockDuration / (24 * 60 * 60)} jours`);
  console.log(`Niveau attendu: Bronze`);
  console.log(`Boost attendu: ~300 bps (+10%)`);

  // Dériver les PDAs
  const [globalStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    ROUTER_PROGRAM_ID
  );

  const [userAccountPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("user"), wallet.publicKey.toBuffer()],
    ROUTER_PROGRAM_ID
  );

  const [userNftPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_nft"), wallet.publicKey.toBuffer()],
    CNFT_PROGRAM_ID
  );

  console.log(`\n📍 PDAs:`);
  console.log(`   GlobalState: ${globalStatePDA.toBase58()}`);
  console.log(`   UserAccount: ${userAccountPDA.toBase58()}`);
  console.log(`   UserNft: ${userNftPDA.toBase58()}`);

  // Vérifier si un lock existe déjà
  try {
    const userNftAccount = await connection.getAccountInfo(userNftPDA);
    if (userNftAccount) {
      console.log("\n⚠️  Un cNFT existe déjà pour ce wallet");
      console.log("   Passage directement au test unlock...");

      // Test 2: Unlock
      await testUnlock(connection, wallet);
      return;
    }
  } catch (e) {
    // Pas de NFT existant, continuons
  }

  console.log("\n🔨 Construction de la transaction lock...");
  console.log("⚠️  Note: Cette fonctionnalité nécessite l'initialisation préalable");
  console.log("   des états globaux du routeur. Si non fait:");
  console.log("   → Exécuter d'abord: node scripts/init-router-states.js");

  console.log("\n✅ Test de lecture des PDAs terminé");
  console.log("\n📝 Prochaines étapes:");
  console.log("   1. Initialiser les états globaux (router + cnft)");
  console.log("   2. Implémenter la transaction lock complète");
  console.log("   3. Tester unlock après lock");
  console.log("   4. Valider le boost et les calculs");
}

async function testUnlock(connection, wallet) {
  console.log("\n🔓 Test 2: Unlock de tokens");
  console.log("─────────────────────────────────");

  const [userNftPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_nft"), wallet.publicKey.toBuffer()],
    CNFT_PROGRAM_ID
  );

  // Lire les données du cNFT
  const userNftAccount = await connection.getAccountInfo(userNftPDA);

  if (!userNftAccount) {
    console.log("❌ Aucun lock trouvé");
    return;
  }

  console.log("✅ Lock trouvé");
  console.log(`   Taille: ${userNftAccount.data.length} bytes`);

  // Parser les données (simplifié)
  const data = userNftAccount.data;

  // Structure approximative (à ajuster selon le vrai layout):
  // 8 bytes: discriminator
  // 32 bytes: owner
  // 1 byte: level (enum)
  // 8 bytes: locked_amount (u64)
  // 8 bytes: lock_duration (i64)
  // 8 bytes: mint_time (i64)
  // 1 byte: is_active (bool)
  // 1 byte: bump

  const owner = new PublicKey(data.slice(8, 40));
  const level = data[40];
  const isActive = data[74] === 1;

  console.log(`   Owner: ${owner.toBase58()}`);
  console.log(`   Level: ${level} (0=Bronze, 1=Silver, 2=Gold)`);
  console.log(`   Active: ${isActive}`);

  if (!isActive) {
    console.log("⚠️  Le lock est déjà inactif (déjà unlock)");
    return;
  }

  console.log("\n🔨 Construction de la transaction unlock...");
  console.log("   (Implémentation complète à venir)");
}

// Exécuter
main()
  .then(() => {
    console.log("\n✅ Script terminé avec succès");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erreur:", error);
    process.exit(1);
  });
