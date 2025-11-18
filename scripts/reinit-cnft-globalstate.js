#!/usr/bin/env node
/**
 * Réinitialisation du GlobalState CNFT avec la nouvelle structure
 * Ce script ferme l'ancien compte et en crée un nouveau avec les 4 wallets
 */

const { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

// Discriminator pour "initialize_global_state"
const INITIALIZE_DISCRIMINATOR = Buffer.from([232, 254, 209, 244, 123, 89, 154, 207]);

const CNFT_PROGRAM_ID = process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID || "DGDipfpHGVAnWXj7yPEBc3JYFWghQN76tEBzuK2Nojw3";
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

function resolveWallet(envVar, fallbackPubkey) {
  const raw = process.env[envVar];
  if (!raw) {
    console.log(`⚠️  ${envVar} non défini, utilisation du fallback`);
    return fallbackPubkey;
  }
  try {
    return new PublicKey(raw);
  } catch (error) {
    throw new Error(`Adresse invalide pour ${envVar}: ${raw}`);
  }
}

async function main() {
  console.log("\n🔧 Réinitialisation de CNFT GlobalState\n");

  const connection = new Connection(RPC_URL, "confirmed");
  const cnftProgramId = new PublicKey(CNFT_PROGRAM_ID);

  // Charger le keypair
  const walletPath = process.env.WALLET_PATH || path.join(process.env.HOME || "", ".config/solana/id.json");
  
  if (!fs.existsSync(walletPath)) {
    console.error(`❌ Wallet non trouvé: ${walletPath}`);
    console.log("\n💡 Définissez WALLET_PATH ou placez votre keypair dans ~/.config/solana/id.json\n");
    process.exit(1);
  }

  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log(`✅ Wallet: ${wallet.publicKey.toString()}`);

  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`💰 Solde: ${(balance / 1e9).toFixed(4)} SOL`);

  if (balance < 0.1e9) {
    console.error("\n❌ Solde insuffisant (minimum 0.1 SOL recommandé)\n");
    process.exit(1);
  }

  // Configuration des wallets
  const walletConfig = {
    treasury: resolveWallet("SWAPBACK_TREASURY_WALLET", wallet.publicKey),
    boost: resolveWallet("SWAPBACK_BOOST_WALLET", wallet.publicKey),
    buyback: resolveWallet("SWAPBACK_BUYBACK_WALLET", wallet.publicKey),
    npiVault: resolveWallet("SWAPBACK_NPI_VAULT_WALLET", wallet.publicKey),
  };

  // Dériver le PDA GlobalState
  const [globalStatePDA, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    cnftProgramId
  );

  console.log(`\n📍 Program ID: ${cnftProgramId.toString()}`);
  console.log(`🔑 Global State PDA: ${globalStatePDA.toString()}`);
  console.log(`🔢 Bump: ${bump}`);
  console.log("\n🔐 Configuration des wallets:");
  console.log(`   Treasury:  ${walletConfig.treasury.toBase58()}`);
  console.log(`   Boost:     ${walletConfig.boost.toBase58()}`);
  console.log(`   Buyback:   ${walletConfig.buyback.toBase58()}`);
  console.log(`   NPI Vault: ${walletConfig.npiVault.toBase58()}`);

  // Vérifier l'état actuel
  console.log("\n🔍 Vérification du compte GlobalState...");
  const accountInfo = await connection.getAccountInfo(globalStatePDA);
  
  if (accountInfo) {
    console.log(`⚠️  GlobalState existe déjà`);
    console.log(`   Taille actuelle: ${accountInfo.data.length} bytes`);
    console.log(`   Lamports: ${accountInfo.lamports}`);
    console.log(`   Owner: ${accountInfo.owner.toString()}`);
    
    // Vérifier si c'est l'ancien format (sans les 4 wallets)
    const DISCRIMINATOR_BYTES = 8;
    const PUBKEY_BYTES = 32;
    const U64_BYTES = 8;
    const GLOBAL_STATE_PUBKEYS = 5;
    const GLOBAL_STATE_COUNTERS = 13;
    const expectedSize =
      DISCRIMINATOR_BYTES +
      GLOBAL_STATE_PUBKEYS * PUBKEY_BYTES +
      GLOBAL_STATE_COUNTERS * U64_BYTES;
    console.log(`   Taille attendue (nouveau format): ${expectedSize} bytes`);
    
    if (accountInfo.data.length < expectedSize) {
      console.log("\n⚠️  L'ancien format détecté! Ce compte doit être fermé et réinitialisé.");
      console.log("\n❌ IMPOSSIBLE de mettre à jour automatiquement.");
      console.log("\n📋 Actions requises:");
      console.log("   1. Fermer manuellement le compte via 'anchor close'");
      console.log("   2. Redéployer le programme avec 'anchor deploy'");
      console.log("   3. Relancer ce script pour réinitialiser");
      console.log("\n💡 Commandes:");
      console.log(`   anchor idl close --provider.cluster devnet --provider.wallet ${walletPath} ${cnftProgramId.toString()}`);
      console.log(`   anchor deploy --provider.cluster devnet --provider.wallet ${walletPath}`);
      console.log(`   node scripts/reinit-cnft-globalstate.js`);
      process.exit(1);
    }
    
    console.log("\n✅ Le compte a déjà la bonne taille (nouveau format)");
    console.log("   Aucune action nécessaire.\n");
    process.exit(0);
  }

  console.log("✅ GlobalState non initialisé, création...\n");

  // Créer l'instruction d'initialisation
  const instructionData = Buffer.concat([
    INITIALIZE_DISCRIMINATOR,
    walletConfig.treasury.toBuffer(),
    walletConfig.boost.toBuffer(),
    walletConfig.buyback.toBuffer(),
    walletConfig.npiVault.toBuffer(),
  ]);

  const keys = [
    { pubkey: globalStatePDA, isSigner: false, isWritable: true },
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const instruction = new TransactionInstruction({
    keys,
    programId: cnftProgramId,
    data: instructionData,
  });

  const transaction = new Transaction().add(instruction);

  console.log("📤 Envoi de la transaction...");

  try {
    const signature = await connection.sendTransaction(transaction, [wallet], {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    console.log(`✅ Transaction envoyée: ${signature}`);
    console.log(`🔗 Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet\n`);

    console.log("⏳ Attente de confirmation...");
    await connection.confirmTransaction(signature, "confirmed");

    console.log("✅ Transaction confirmée!\n");

    // Vérifier le compte créé
    const newAccountInfo = await connection.getAccountInfo(globalStatePDA);
    if (newAccountInfo) {
      console.log("✅ GlobalState initialisé avec succès!");
      console.log(`   Taille: ${newAccountInfo.data.length} bytes`);
      console.log(`   Lamports: ${newAccountInfo.lamports}\n`);
    }

    console.log("🎉 Initialisation terminée!\n");

  } catch (error) {
    console.error("\n❌ Erreur lors de l'initialisation:");
    console.error(error);
    
    if (error.logs) {
      console.log("\n📋 Logs de transaction:");
      error.logs.forEach(log => console.log(`   ${log}`));
    }
    
    process.exit(1);
  }
}

main().catch(console.error);
