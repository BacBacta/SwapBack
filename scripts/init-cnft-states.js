#!/usr/bin/env node
/**
 * Initialisation des états globaux du programme cNFT
 */

const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
} = require("@solana/web3.js");
const fs = require("fs");
const bs58 = require("bs58");
const crypto = require("crypto");

const CNFT_PROGRAM_ID = new PublicKey("AaN2BwpGWbvDo7NHfpyC6zGYxsbg2xtcikToW9xYy4Xq");
const RPC_URL = "https://api.devnet.solana.com";
const KEYPAIR_PATH = "/workspaces/SwapBack/devnet-keypair-base58.txt";

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

function discriminator(name) {
  return crypto.createHash("sha256").update(`global:${name}`).digest().slice(0, 8);
}

function loadKeypair(path) {
  const keyData = fs.readFileSync(path, "utf8").trim();
  const secret = bs58.decode(keyData);
  return Keypair.fromSecretKey(secret);
}

async function main() {
  console.log("\n🔧 Initialisation du programme cNFT\n");
  
  const connection = new Connection(RPC_URL);
  const authority = loadKeypair(KEYPAIR_PATH);
  const walletConfig = buildWalletConfig(authority.publicKey);
  
  console.log("Program ID:", CNFT_PROGRAM_ID.toBase58());
  console.log("Authority:", authority.publicKey.toBase58());
  console.log("🔐 Wallets:");
  console.log("  Treasury:", walletConfig.treasury.toBase58());
  console.log("  Boost:", walletConfig.boost.toBase58());
  console.log("  Buyback:", walletConfig.buyback.toBase58());
  console.log("  NPI Vault:", walletConfig.npiVault.toBase58());
  
  const balance = await connection.getBalance(authority.publicKey);
  console.log("Balance:", balance / 1e9, "SOL\n");
  
  // Dériver les PDAs
  const [collectionConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_config")],
    CNFT_PROGRAM_ID
  );
  
  const [globalState] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    CNFT_PROGRAM_ID
  );
  
  console.log("📍 PDAs:");
  console.log("  Collection Config:", collectionConfig.toBase58());
  console.log("  Global State:", globalState.toBase58());
  console.log("");
  
  // Vérifier si déjà initialisés
  const collectionInfo = await connection.getAccountInfo(collectionConfig);
  const globalInfo = await connection.getAccountInfo(globalState);
  
  if (collectionInfo && globalInfo) {
    console.log("✅ Déjà initialisé!");
    return;
  }
  
  // ÉTAPE 1: Initialize Global State
  if (!globalInfo) {
    console.log("📝 Initialisation GlobalState...");
    
    const disc = discriminator("initialize_global_state");
    const keys = [
      { pubkey: globalState, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
    
    const data = Buffer.concat([
      disc,
      walletConfig.treasury.toBuffer(),
      walletConfig.boost.toBuffer(),
      walletConfig.buyback.toBuffer(),
      walletConfig.npiVault.toBuffer(),
    ]);

    const ix = new TransactionInstruction({
      programId: CNFT_PROGRAM_ID,
      keys,
      data,
    });
    
    const tx = new Transaction().add(ix);
    const sig = await connection.sendTransaction(tx, [authority]);
    await connection.confirmTransaction(sig);
    console.log("   ✅ GlobalState initialisé:", sig);
  } else {
    console.log("   ℹ️  GlobalState déjà initialisé");
  }
  
  // ÉTAPE 2: Initialize Collection
  if (!collectionInfo) {
    console.log("\n📝 Initialisation Collection...");
    
    // Note: Le programme cNFT nécessite un tree_config
    // Pour simplifier, on utilise un keypair temporaire
    const treeConfig = Keypair.generate();
    
    const disc = discriminator("initialize_collection");
    const keys = [
      { pubkey: collectionConfig, isSigner: false, isWritable: true },
      { pubkey: treeConfig.publicKey, isSigner: false, isWritable: false },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
    
    const ix = new TransactionInstruction({
      programId: CNFT_PROGRAM_ID,
      keys,
      data: disc,
    });
    
    const tx = new Transaction().add(ix);
    const sig = await connection.sendTransaction(tx, [authority]);
    await connection.confirmTransaction(sig);
    console.log("   ✅ Collection initialisée:", sig);
    console.log("   Tree Config:", treeConfig.publicKey.toBase58());
  } else {
    console.log("   ℹ️  Collection déjà initialisée");
  }
  
  console.log("\n🎉 Initialisation terminée!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Erreur:", error.message);
    if (error.logs) {
      console.log("\nLogs:");
      error.logs.forEach(log => console.log("  ", log));
    }
    process.exit(1);
  });
