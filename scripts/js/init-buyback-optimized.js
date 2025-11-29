#!/usr/bin/env node

/**
 * Initialisation optimisée des états buyback
 * Estime les coûts et tente l'initialisation avec le solde disponible
 */

const {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } = require("@solana/spl-token");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Configuration
const DEVNET_RPC = "https://api.devnet.solana.com";
const BUYBACK_PROGRAM_ID = new PublicKey("92znK8METYTFW5dGDJUnHUMqubVGnPBTyjZ4HzjWQzir");
const BACK_TOKEN_MINT = new PublicKey("3Y6RXZUBHCeUj6VsWuyBY2Zy1RixY6BHkM4tf3euDdrE");
const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

function getDiscriminator(name) {
  const hash = crypto.createHash("sha256");
  hash.update(`global:${name}`);
  return Buffer.from(hash.digest().slice(0, 8));
}

const INITIALIZE_DISCRIMINATOR = getDiscriminator("initialize");

console.log("🚀 Initialisation optimisée Buyback States");
console.log("==========================================\n");

async function estimateCosts(connection, authority) {
  console.log("💰 Estimation des coûts...\n");
  
  // Rent pour buyback_state (137 bytes estimé)
  const buybackStateRent = await connection.getMinimumBalanceForRentExemption(137);
  
  // Rent pour USDC vault (165 bytes pour TokenAccount)
  const usdcVaultRent = await connection.getMinimumBalanceForRentExemption(165);
  
  // Frais de transaction estimés (signature + compute)
  const txFee = 5000; // 5000 lamports
  
  const total = buybackStateRent + usdcVaultRent + txFee;
  
  console.log("📊 Coûts estimés:");
  console.log(`   Buyback State: ${(buybackStateRent / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
  console.log(`   USDC Vault: ${(usdcVaultRent / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
  console.log(`   Tx Fee: ${(txFee / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
  console.log(`   TOTAL: ${(total / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
  
  return total;
}

async function initializeOptimized() {
  const connection = new Connection(DEVNET_RPC, "confirmed");

  // Charger l'authority
  const defaultPath = path.join(require("os").homedir(), ".config/solana/id.json");
  let authority;
  try {
    const walletData = JSON.parse(fs.readFileSync(defaultPath, "utf8"));
    authority = Keypair.fromSecretKey(new Uint8Array(walletData));
    console.log(`👤 Authority: ${authority.publicKey.toBase58()}`);
  } catch (error) {
    console.error("❌ Erreur chargement wallet:", error.message);
    process.exit(1);
  }

  // Vérifier le solde
  const balance = await connection.getBalance(authority.publicKey);
  console.log(`💰 Solde actuel: ${(balance / LAMPORTS_PER_SOL).toFixed(8)} SOL\n`);

  // Estimer les coûts
  const estimatedCost = await estimateCosts(connection, authority);
  
  console.log();
  if (balance < estimatedCost) {
    console.log("⚠️  SOLDE INSUFFISANT");
    console.log(`   Requis: ${(estimatedCost / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
    console.log(`   Disponible: ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
    console.log(`   Manque: ${((estimatedCost - balance) / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
    console.log("\n💡 Solutions:");
    console.log("   1. Attendez ~2h pour le rate limit airdrop");
    console.log("   2. Utilisez https://faucet.solana.com");
    console.log("   3. Transférez des SOL depuis un autre wallet");
    return;
  }

  console.log("✅ Solde suffisant pour l'initialisation\n");

  // Calculer les PDAs
  const [buybackStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("buyback_state")],
    BUYBACK_PROGRAM_ID
  );

  const [usdcVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("usdc_vault")],
    BUYBACK_PROGRAM_ID
  );

  console.log("📍 PDAs:");
  console.log(`   Buyback State: ${buybackStatePDA.toBase58()}`);
  console.log(`   USDC Vault: ${usdcVaultPDA.toBase58()}`);
  console.log();

  // Vérifier si déjà initialisé
  const existingState = await connection.getAccountInfo(buybackStatePDA);
  if (existingState) {
    console.log("✅ Buyback state déjà initialisé!");
    console.log(`   Taille: ${existingState.data.length} bytes`);
    return;
  }

  // Créer l'instruction d'initialisation
  const minBuybackAmount = 10 * 1e6; // 10 USDC
  const data = Buffer.concat([
    INITIALIZE_DISCRIMINATOR,
    Buffer.alloc(8)
  ]);
  data.writeBigUInt64LE(BigInt(minBuybackAmount), 8);

  const SYSVAR_RENT_PUBKEY = new PublicKey('SysvarRent111111111111111111111111111111111');

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: buybackStatePDA, isSigner: false, isWritable: true },
      { pubkey: BACK_TOKEN_MINT, isSigner: false, isWritable: false },
      { pubkey: usdcVaultPDA, isSigner: false, isWritable: true },
      { pubkey: USDC_MINT, isSigner: false, isWritable: false },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId: BUYBACK_PROGRAM_ID,
    data,
  });

  const transaction = new Transaction().add(instruction);

  console.log("📤 Envoi de la transaction d'initialisation...\n");

  try {
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [authority],
      {
        commitment: "confirmed",
        skipPreflight: false,
      }
    );

    console.log("✅ INITIALISATION RÉUSSIE !");
    console.log("==========================");
    console.log(`Signature: ${signature}`);
    console.log(`Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    console.log();
    console.log("🎯 États initialisés:");
    console.log(`   ✅ Buyback State: ${buybackStatePDA.toBase58()}`);
    console.log(`   ✅ USDC Vault: ${usdcVaultPDA.toBase58()}`);
    console.log();
    console.log("🎉 Prochaine étape:");
    console.log("   node test-buyback-compatibility.js");

  } catch (error) {
    console.error("\n❌ ERREUR LORS DE L'INITIALISATION");
    console.error("===================================");
    
    if (error.logs) {
      console.log("\n📜 Logs:");
      error.logs.forEach(log => console.log("  ", log));
    }
    
    console.error("\n🔴 Message:", error.message);
    
    if (error.message.includes("0x1")) {
      console.log("\n💡 L'account existe déjà. Vérifiez avec:");
      console.log("   solana account", buybackStatePDA.toBase58());
    } else if (error.message.includes("0x1004")) {
      console.log("\n💡 Programme ID mismatch. Vérifiez que le programme est bien:");
      console.log("   92znK8METYTFW5dGDJUnHUMqubVGnPBTyjZ4HzjWQzir");
    }
  }
}

initializeOptimized().catch(console.error);
