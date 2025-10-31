#!/usr/bin/env node

/**
 * 🧪 SCRIPT LOCK → UNLOCK → CLAIM DEVNET
 * 
 * Flux complet automatisé sur devnet :
 * 1. Lock de BACK tokens (mint un cNFT avec boost)
 * 2. Unlock du cNFT (désactive le lock, libère les tokens)
 * 3. Claim du buyback (réclame les récompenses accumulées)
 * 
 * Usage:
 *   node scripts/devnet-lock-unlock-claim.js [keypair_path]
 * 
 * Variables d'environnement:
 *   SOLANA_RPC_URL         RPC endpoint (default: https://api.devnet.solana.com)
 *   LOCK_AMOUNT            BACK à locker (default: 100)
 *   LOCK_DURATION_DAYS     Durée du lock en jours (default: 30)
 */

const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");
const bs58 = require("bs58");

// ============================
// 🎯 CONFIGURATION
// ============================

const CNFT_PROGRAM_ID = new PublicKey("2VB6D8Qqdo1gxqYDAxEMYkV4GcarAMATKHcbroaFPz8G");
const BUYBACK_PROGRAM_ID = new PublicKey("EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf");
const BACK_TOKEN_MINT = new PublicKey("862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux");

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const DEFAULT_KEY_PATH = path.join(__dirname, "..", "devnet-keypair-base58.txt");
const LOCK_AMOUNT = Number(process.env.LOCK_AMOUNT || 100);
const LOCK_DURATION_DAYS = Number(process.env.LOCK_DURATION_DAYS || 30);

const LAMPORTS_PER_BACK = 1_000_000_000n;

// ============================
// 📚 HELPERS
// ============================

function loadKeypair(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Keypair introuvable: ${resolved}`);
  }
  const content = fs.readFileSync(resolved, "utf8").trim();
  const secret = bs58.decode(content);
  if (secret.length !== 64) {
    throw new Error(`Secret base58 invalide (attendu 64 bytes, reçu ${secret.length})`);
  }
  return Keypair.fromSecretKey(secret);
}

function formatLamports(value) {
  const big = BigInt(value);
  const whole = big / LAMPORTS_PER_BACK;
  const fractional = (big % LAMPORTS_PER_BACK).toString().padStart(9, "0").replace(/0+$/, "");
  return fractional ? `${whole}.${fractional}` : whole.toString();
}

async function sendTx(connection, payer, instructions, label) {
  const tx = new Transaction().add(...instructions);
  const signature = await connection.sendTransaction(tx, [payer], {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  await connection.confirmTransaction(signature, "confirmed");
  console.log(`  ✅ ${label}: ${signature}`);
  return signature;
}

function sha256(data) {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(data).digest();
}

function discriminator(name) {
  const prefixed = name.startsWith("global:") ? name : `global:${name}`;
  return sha256(Buffer.from(prefixed)).slice(0, 8);
}

// ============================
// 🔑 DERIVATION PDA
// ============================

function deriveCnftPdas(user) {
  const [collectionConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_config")],
    CNFT_PROGRAM_ID
  );

  const [globalState] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    CNFT_PROGRAM_ID
  );

  const [userNft] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_nft"), user.toBuffer()],
    CNFT_PROGRAM_ID
  );

  return { collectionConfig, globalState, userNft };
}

function deriveBuybackPdas(user) {
  const [globalState] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    BUYBACK_PROGRAM_ID
  );

  const [userAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("user"), user.toBuffer()],
    BUYBACK_PROGRAM_ID
  );

  return { globalState, userAccount };
}

// ============================
// 📦 INSTRUCTIONS cNFT
// ============================

function buildMintLevelNftIx(pdas, payer, amountLamports, durationSeconds) {
  const data = Buffer.alloc(8 + 8 + 8);
  discriminator("mint_level_nft").copy(data, 0);
  data.writeBigUInt64LE(amountLamports, 8);
  data.writeBigInt64LE(durationSeconds, 16);

  const keys = [
    { pubkey: pdas.collectionConfig, isSigner: false, isWritable: true },
    { pubkey: pdas.globalState, isSigner: false, isWritable: true },
    { pubkey: pdas.userNft, isSigner: false, isWritable: true },
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    programId: CNFT_PROGRAM_ID,
    keys,
    data,
  });
}

function buildUpdateNftStatusIx(pdas, payer, isActive) {
  const data = Buffer.alloc(9);
  discriminator("update_nft_status").copy(data, 0);
  data.writeUInt8(isActive ? 1 : 0, 8);

  const keys = [
    { pubkey: pdas.userNft, isSigner: false, isWritable: true },
    { pubkey: pdas.globalState, isSigner: false, isWritable: true },
    { pubkey: payer.publicKey, isSigner: true, isWritable: false },
  ];

  return new TransactionInstruction({
    programId: CNFT_PROGRAM_ID,
    keys,
    data,
  });
}

// ============================
// 📦 INSTRUCTIONS BUYBACK
// ============================

function buildClaimBuybackIx(pdas, payer) {
  const data = discriminator("claim");

  const keys = [
    { pubkey: pdas.globalState, isSigner: false, isWritable: true },
    { pubkey: pdas.userAccount, isSigner: false, isWritable: true },
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
    { pubkey: BACK_TOKEN_MINT, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    programId: BUYBACK_PROGRAM_ID,
    keys,
    data,
  });
}

// ============================
// 🔍 PARSING ACCOUNTS
// ============================

function parseUserNft(accountInfo) {
  if (!accountInfo) return null;
  const data = accountInfo.data;
  if (data.length < 69) {
    throw new Error(`user_nft trop petit: ${data.length} bytes`);
  }

  let offset = 8; // discriminator
  const user = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  const levelIndex = data.readUInt8(offset);
  offset += 1;
  const amountLocked = data.readBigUInt64LE(offset);
  offset += 8;
  const lockDuration = data.readBigInt64LE(offset);
  offset += 8;
  const boost = data.readUInt16LE(offset);
  offset += 2;
  const mintTime = data.readBigInt64LE(offset);
  offset += 8;
  const isActive = data.readUInt8(offset) === 1;
  offset += 1;
  const bump = data.readUInt8(offset);

  const LEVELS = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];

  return {
    user: user.toBase58(),
    level: LEVELS[levelIndex] || `Unknown(${levelIndex})`,
    amountLocked,
    lockDuration,
    boost,
    mintTime,
    isActive,
    bump,
  };
}

function parseBuybackUserAccount(accountInfo) {
  if (!accountInfo) return null;
  const data = accountInfo.data;
  if (data.length < 8 + 32 + 8) {
    throw new Error(`buyback user account trop petit: ${data.length} bytes`);
  }

  let offset = 8; // discriminator
  const user = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  const claimableAmount = data.readBigUInt64LE(offset);

  return {
    user: user.toBase58(),
    claimableAmount,
  };
}

// ============================
// 🎬 MAIN FLOW
// ============================

async function main() {
  console.log("\n🚀 SwapBack Lock → Unlock → Claim (Devnet)\n");

  // 1. Charger keypair
  const keypairPath = process.argv[2] || DEFAULT_KEY_PATH;
  const payer = loadKeypair(keypairPath);
  console.log(`👤 Wallet: ${payer.publicKey.toBase58()}`);

  // 2. Connexion RPC
  const connection = new Connection(RPC_URL, "confirmed");
  const balance = await connection.getBalance(payer.publicKey);
  console.log(`💰 Balance SOL: ${(balance / 1e9).toFixed(4)} SOL\n`);

  // 3. Dériver PDAs
  const cnftPdas = deriveCnftPdas(payer.publicKey);
  const buybackPdas = deriveBuybackPdas(payer.publicKey);

  console.log("📍 PDAs cNFT:");
  console.log(`   Collection Config: ${cnftPdas.collectionConfig.toBase58()}`);
  console.log(`   Global State:      ${cnftPdas.globalState.toBase58()}`);
  console.log(`   User NFT:          ${cnftPdas.userNft.toBase58()}`);

  console.log("\n📍 PDAs Buyback:");
  console.log(`   Global State:      ${buybackPdas.globalState.toBase58()}`);
  console.log(`   User Account:      ${buybackPdas.userAccount.toBase58()}\n`);

  // ============================
  // ÉTAPE 1: LOCK (Mint cNFT)
  // ============================

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📌 ÉTAPE 1: LOCK BACK TOKENS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const amountLamports = BigInt(LOCK_AMOUNT) * LAMPORTS_PER_BACK;
  const durationSeconds = BigInt(LOCK_DURATION_DAYS * 86400);

  console.log(`🔒 Lock de ${LOCK_AMOUNT} BACK pour ${LOCK_DURATION_DAYS} jours...`);

  const userNftBefore = await connection.getAccountInfo(cnftPdas.userNft);
  if (userNftBefore) {
    console.log("⚠️  Un cNFT existe déjà pour cet utilisateur.");
    const nft = parseUserNft(userNftBefore);
    console.log(`   Niveau: ${nft.level}`);
    console.log(`   Montant: ${formatLamports(nft.amountLocked)} BACK`);
    console.log(`   Boost: ${nft.boost} bps`);
    console.log(`   Actif: ${nft.isActive ? "✅ OUI" : "❌ NON"}\n`);
  } else {
    const mintIx = buildMintLevelNftIx(cnftPdas, payer, amountLamports, durationSeconds);
    await sendTx(connection, payer, [mintIx], "Mint cNFT (lock)");

    const userNftAfter = await connection.getAccountInfo(cnftPdas.userNft);
    const nft = parseUserNft(userNftAfter);
    console.log(`\n   ✅ cNFT créé!`);
    console.log(`   Niveau: ${nft.level}`);
    console.log(`   Montant: ${formatLamports(nft.amountLocked)} BACK`);
    console.log(`   Boost: ${nft.boost} bps`);
    console.log(`   Actif: ${nft.isActive ? "✅ OUI" : "❌ NON"}\n`);
  }

  // ============================
  // ÉTAPE 2: UNLOCK (Désactiver le cNFT)
  // ============================

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📌 ÉTAPE 2: UNLOCK cNFT");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const userNftCurrent = await connection.getAccountInfo(cnftPdas.userNft);
  const nftCurrent = parseUserNft(userNftCurrent);

  if (!nftCurrent.isActive) {
    console.log("⚠️  Le cNFT est déjà désactivé (unlock déjà fait).\n");
  } else {
    console.log("🔓 Unlock du cNFT...");
    const unlockIx = buildUpdateNftStatusIx(cnftPdas, payer, false);
    await sendTx(connection, payer, [unlockIx], "Unlock cNFT");

    const userNftAfterUnlock = await connection.getAccountInfo(cnftPdas.userNft);
    const nftUnlocked = parseUserNft(userNftAfterUnlock);
    console.log(`\n   ✅ cNFT désactivé!`);
    console.log(`   Actif: ${nftUnlocked.isActive ? "✅ OUI" : "❌ NON"}\n`);
  }

  // ============================
  // ÉTAPE 3: CLAIM BUYBACK
  // ============================

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📌 ÉTAPE 3: CLAIM BUYBACK REWARDS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const buybackUserBefore = await connection.getAccountInfo(buybackPdas.userAccount);
  
  if (!buybackUserBefore) {
    console.log("⚠️  Aucun compte buyback trouvé pour cet utilisateur.");
    console.log("   (Aucun swap effectué via le router, donc pas de récompenses à claim)\n");
  } else {
    const buybackBefore = parseBuybackUserAccount(buybackUserBefore);
    console.log(`💰 Montant claimable: ${formatLamports(buybackBefore.claimableAmount)} BACK`);

    if (buybackBefore.claimableAmount === 0n) {
      console.log("⚠️  Aucune récompense à claim pour le moment.\n");
    } else {
      console.log("🎁 Claim des récompenses...");
      const claimIx = buildClaimBuybackIx(buybackPdas, payer);
      await sendTx(connection, payer, [claimIx], "Claim buyback");

      const buybackUserAfter = await connection.getAccountInfo(buybackPdas.userAccount);
      const buybackAfter = parseBuybackUserAccount(buybackUserAfter);
      console.log(`\n   ✅ Claim réussi!`);
      console.log(`   Nouveau montant claimable: ${formatLamports(buybackAfter.claimableAmount)} BACK\n`);
    }
  }

  // ============================
  // RÉSUMÉ FINAL
  // ============================

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 RÉSUMÉ FINAL");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const finalNft = parseUserNft(await connection.getAccountInfo(cnftPdas.userNft));
  console.log("🎴 cNFT Status:");
  console.log(`   Niveau: ${finalNft.level}`);
  console.log(`   Montant: ${formatLamports(finalNft.amountLocked)} BACK`);
  console.log(`   Boost: ${finalNft.boost} bps`);
  console.log(`   Actif: ${finalNft.isActive ? "✅ OUI" : "❌ NON"}`);

  const finalBuyback = await connection.getAccountInfo(buybackPdas.userAccount);
  if (finalBuyback) {
    const buybackData = parseBuybackUserAccount(finalBuyback);
    console.log(`\n💰 Buyback claimable: ${formatLamports(buybackData.claimableAmount)} BACK`);
  }

  console.log("\n✅ Script terminé avec succès!\n");
}

// ============================
// 🎯 EXÉCUTION
// ============================

main().catch((error) => {
  console.error("\n❌ Erreur fatale:");
  console.error(error);
  process.exit(1);
});
