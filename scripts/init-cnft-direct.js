/**
 * Initialisation CNFT GlobalState - Approche directe
 */

const { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

// Discriminator pour "initialize_global_state"
const INITIALIZE_DISCRIMINATOR = Buffer.from([232, 254, 209, 244, 123, 89, 154, 207]);

function resolveWallet(envVar, fallbackPubkey) {
  const raw = process.env[envVar];
  if (!raw) {
    return fallbackPubkey;
  }
  try {
    return new PublicKey(raw);
  } catch (error) {
    throw new Error(`Adresse invalide pour ${envVar}: ${raw}`);
  }
}

function buildWalletConfig(defaultPubkey) {
  return {
    treasury: resolveWallet("SWAPBACK_TREASURY_WALLET", defaultPubkey),
    boost: resolveWallet("SWAPBACK_BOOST_WALLET", defaultPubkey),
    buyback: resolveWallet("SWAPBACK_BUYBACK_WALLET", defaultPubkey),
    npiVault: resolveWallet("SWAPBACK_NPI_VAULT_WALLET", defaultPubkey),
  };
}

async function main() {
  console.log("\n🔧 Initialisation de CNFT GlobalState (Approche directe)\n");

  const network = "https://api.devnet.solana.com";
  const connection = new Connection(network, "confirmed");

  const walletPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log(`✅ Wallet: ${wallet.publicKey.toString()}`);

  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`💰 Solde: ${(balance / 1e9).toFixed(4)} SOL\n`);

  const cnftProgramId = new PublicKey("9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw");
  const walletConfig = buildWalletConfig(wallet.publicKey);

  // Dériver le PDA GlobalState
  const [globalStatePDA, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    cnftProgramId
  );

  console.log(`📍 Program ID: ${cnftProgramId.toString()}`);
  console.log(`🔑 Global State PDA: ${globalStatePDA.toString()}`);
  console.log(`🔢 Bump: ${bump}`);
  console.log("🔐 Wallets:");
  console.log(`   Treasury: ${walletConfig.treasury.toBase58()}`);
  console.log(`   Boost:    ${walletConfig.boost.toBase58()}`);
  console.log(`   Buyback:  ${walletConfig.buyback.toBase58()}`);
  console.log(`   NPI Vault: ${walletConfig.npiVault.toBase58()}\n`);

  // Vérifier si déjà initialisé
  try {
    const accountInfo = await connection.getAccountInfo(globalStatePDA);
    if (accountInfo) {
      console.log("⚠️  Global State déjà initialisé!");
      console.log(`   Taille: ${accountInfo.data.length} bytes\n`);
      process.exit(0);
    }
  } catch (error) {
    // Pas encore initialisé
  }

  console.log("📝 Création de l'instruction initialize_global_state...\n");

  const instructionData = Buffer.concat([
    INITIALIZE_DISCRIMINATOR,
    walletConfig.treasury.toBuffer(),
    walletConfig.boost.toBuffer(),
    walletConfig.buyback.toBuffer(),
    walletConfig.npiVault.toBuffer(),
  ]);

  const keys = [
    { pubkey: globalStatePDA, isSigner: false, isWritable: true }, // global_state
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // authority
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
  ];

  const instruction = new TransactionInstruction({
    keys,
    programId: cnftProgramId,
    data: instructionData,
  });

  const transaction = new Transaction().add(instruction);

  try {
    const signature = await connection.sendTransaction(transaction, [wallet], {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    console.log("📤 Transaction envoyée!");
    console.log(`   Signature: ${signature}\n`);

    console.log("⏳ Attente de la confirmation...\n");
    const confirmation = await connection.confirmTransaction(signature, "confirmed");

    if (confirmation.value.err) {
      console.error("❌ Transaction échouée:", confirmation.value.err);
      process.exit(1);
    }

    console.log("✅ Global State initialisé avec succès!");
    console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet\n`);

    const accountInfo = await connection.getAccountInfo(globalStatePDA);
    if (accountInfo) {
      console.log("📊 Compte créé:");
      console.log(`   Adresse: ${globalStatePDA.toString()}`);
      console.log(`   Taille: ${accountInfo.data.length} bytes`);
      console.log(`   Lamports: ${accountInfo.lamports / 1e9} SOL\n`);
    }
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
  .then(() => {
    console.log("🎉 Initialisation CNFT GlobalState terminée!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
