#!/usr/bin/env node

/**
 * Verify the lock/unlock flow for the SwapBack cNFT program on devnet.
 *
 * Steps:
 * 1. Derive PDAs (collection_config, global_state, user_nft)
 * 2. Ensure collection/global state accounts exist (initialise via program instructions if missing)
 * 3. Mint a lock record when none exists
 * 4. Toggle the lock status between active/inactive to exercise unlock logic
 * 5. Print snapshots to confirm PDAs and counters update as expected
 *
 * Usage:
 *   node scripts/verify-cnft-lock-flow.js [base58_keypair_path]
 *
 * Environment overrides:
 *   SOLANA_RPC_URL        Custom RPC endpoint (default: https://api.devnet.solana.com)
 *   LOCK_AMOUNT_BACK      BACK amount to lock when minting (default: 50)
 *   LOCK_DURATION_DAYS    Lock duration in days (default: 30)
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

const IDL = require("../app/public/idl/swapback_cnft.json");

const PROGRAM_ID = new PublicKey("9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw");
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const DEFAULT_KEY_BASE58 = path.join(__dirname, "..", "devnet-keypair-base58.txt");
const LOCK_AMOUNT_BACK = Number(process.env.LOCK_AMOUNT_BACK || 50);
const LOCK_DURATION_DAYS = Number(process.env.LOCK_DURATION_DAYS || 30);
const LAMPORTS_PER_BACK = 1_000_000_000n;

const instructionMap = new Map(IDL.instructions.map((ix) => [ix.name, ix]));

function discriminator(name) {
  const ix = instructionMap.get(name);
  if (!ix) {
    throw new Error(`Missing instruction ${name} in IDL`);
  }
  return Buffer.from(ix.discriminator);
}

function resolveWallet(envVar, fallbackPubkey) {
  const raw = process.env[envVar];
  if (!raw) {
    return fallbackPubkey;
  }
  try {
    return new PublicKey(raw);
  } catch (error) {
    throw new Error(`Invalid ${envVar} value: ${raw}`);
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

function loadKeypair(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Keypair file not found: ${resolved}`);
  }
  const content = fs.readFileSync(resolved, "utf8").trim();
  if (!content) {
    throw new Error(`Keypair file ${resolved} is empty`);
  }
  const secret = bs58.decode(content);
  if (secret.length !== 64) {
    throw new Error(`Expected 64-byte base58 secret, got ${secret.length} bytes`);
  }
  return Keypair.fromSecretKey(secret);
}

function formatLamports(value) {
  const big = BigInt(value);
  const whole = big / LAMPORTS_PER_BACK;
  const fractional = (big % LAMPORTS_PER_BACK).toString().padStart(9, "0").replace(/0+$/, "");
  return fractional ? `${whole}.${fractional}` : whole.toString();
}

function parseGlobalState(accountInfo) {
  if (!accountInfo) return null;
  const data = accountInfo.data;
  const minSize = 8 + 32 * 5 + 8 * 12;
  if (data.length < minSize) {
    throw new Error(`Unexpected global_state size: ${data.length}`);
  }
  let offset = 8; // skip discriminator
  const authority = new PublicKey(data.slice(offset, offset + 32)).toBase58();
  offset += 32;
  const treasuryWallet = new PublicKey(data.slice(offset, offset + 32)).toBase58();
  offset += 32;
  const boostWallet = new PublicKey(data.slice(offset, offset + 32)).toBase58();
  offset += 32;
  const buybackWallet = new PublicKey(data.slice(offset, offset + 32)).toBase58();
  offset += 32;
  const npiVaultWallet = new PublicKey(data.slice(offset, offset + 32)).toBase58();
  offset += 32;

  const readU64 = () => {
    const value = data.readBigUInt64LE(offset);
    offset += 8;
    return value;
  };

  const totalCommunityBoost = readU64();
  const activeLocksCount = readU64();
  const totalValueLocked = readU64();
  const totalSwapVolume = readU64();
  const totalSwapFees = readU64();
  const swapTreasuryAccrued = readU64();
  const swapBuybackAccrued = readU64();
  const totalNpiVolume = readU64();
  const npiUserDistributed = readU64();
  const npiTreasuryAccrued = readU64();
  const npiBoostVaultAccrued = readU64();
  const npiBoostVaultDistributed = readU64();

  return {
    authority,
    treasuryWallet,
    boostWallet,
    buybackWallet,
    npiVaultWallet,
    totalCommunityBoost,
    activeLocksCount,
    totalValueLocked,
    totalSwapVolume,
    totalSwapFees,
    swapTreasuryAccrued,
    swapBuybackAccrued,
    totalNpiVolume,
    npiUserDistributed,
    npiTreasuryAccrued,
    npiBoostVaultAccrued,
    npiBoostVaultDistributed,
  };
}

const LOCK_LEVELS = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];

function parseUserNft(accountInfo) {
  if (!accountInfo) return null;
  const data = accountInfo.data;
  if (data.length < 69) {
    throw new Error(`Unexpected user_nft size: ${data.length}`);
  }
  let offset = 8;
  const user = new PublicKey(data.slice(offset, offset + 32)).toBase58();
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

  return {
    user,
    levelIndex,
    levelName: LOCK_LEVELS[levelIndex] || `Unknown(${levelIndex})`,
    amountLocked,
    lockDuration,
    boost,
    mintTime,
    isActive,
    bump,
  };
}

async function sendInstruction(connection, payer, instruction, label) {
  const tx = new Transaction().add(instruction);
  const signature = await connection.sendTransaction(tx, [payer], {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  await connection.confirmTransaction(signature, "confirmed");
  console.log(`  ↳ ${label} tx: ${signature}`);
  return signature;
}

function buildInitializeCollectionIx(pdas, payer) {
  const data = discriminator("initialize_collection");
  const keys = [
    { pubkey: pdas.collectionConfig, isSigner: false, isWritable: true },
    { pubkey: payer.publicKey, isSigner: false, isWritable: false }, // placeholder tree_config
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
}

function buildInitializeGlobalStateIx(pdas, payer, walletConfig) {
  const data = Buffer.concat([
    discriminator("initialize_global_state"),
    walletConfig.treasury.toBuffer(),
    walletConfig.boost.toBuffer(),
    walletConfig.buyback.toBuffer(),
    walletConfig.npiVault.toBuffer(),
  ]);
  const keys = [
    { pubkey: pdas.globalState, isSigner: false, isWritable: true },
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
}

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
  return new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
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
  return new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
}

async function ensureCollection(connection, payer, pdas) {
  const info = await connection.getAccountInfo(pdas.collectionConfig);
  if (info) {
    console.log(`✅ collection_config exists (${info.data.length} bytes)`);
    return false;
  }
  console.log("⚠️ collection_config missing. Initialising...");
  await sendInstruction(
    connection,
    payer,
    buildInitializeCollectionIx(pdas, payer),
    "initialize_collection"
  );
  return true;
}

async function ensureGlobalState(connection, payer, pdas, walletConfig) {
  const info = await connection.getAccountInfo(pdas.globalState);
  if (info) {
    console.log(`✅ global_state exists (${info.data.length} bytes)`);
    return false;
  }
  console.log("⚠️ global_state missing. Initialising...");
  await sendInstruction(
    connection,
    payer,
    buildInitializeGlobalStateIx(pdas, payer, walletConfig),
    "initialize_global_state"
  );
  return true;
}

function formatGlobalState(state) {
  if (!state) return null;
  return {
    authority: state.authority,
    treasuryWallet: state.treasuryWallet,
    boostWallet: state.boostWallet,
    buybackWallet: state.buybackWallet,
    npiVaultWallet: state.npiVaultWallet,
    totalCommunityBoost: state.totalCommunityBoost.toString(),
    activeLocksCount: state.activeLocksCount.toString(),
    totalValueLocked: `${formatLamports(state.totalValueLocked)} BACK`,
  };
}

(async () => {
  const keyPath = process.argv[2] || DEFAULT_KEY_BASE58;
  const payer = loadKeypair(keyPath);

  console.log("🔑 Wallet:", payer.publicKey.toBase58());
  console.log("🌐 RPC:", RPC_URL);
  const walletConfig = buildWalletConfig(payer.publicKey);
  console.log("🔐 Wallet config:");
  console.log("  Treasury:", walletConfig.treasury.toBase58());
  console.log("  Boost:", walletConfig.boost.toBase58());
  console.log("  Buyback:", walletConfig.buyback.toBase58());
  console.log("  NPI Vault:", walletConfig.npiVault.toBase58());

  const connection = new Connection(RPC_URL, "confirmed");

  const pdas = {
    collectionConfig: PublicKey.findProgramAddressSync(
      [Buffer.from("collection_config")],
      PROGRAM_ID
    )[0],
    globalState: PublicKey.findProgramAddressSync([Buffer.from("global_state")], PROGRAM_ID)[0],
    userNft: PublicKey.findProgramAddressSync(
      [Buffer.from("user_nft"), payer.publicKey.toBuffer()],
      PROGRAM_ID
    )[0],
  };

  console.log("\n📌 PDAs:");
  console.log("  collection_config:", pdas.collectionConfig.toBase58());
  console.log("  global_state:     ", pdas.globalState.toBase58());
  console.log("  user_nft:         ", pdas.userNft.toBase58());

  const solBalance = await connection.getBalance(payer.publicKey);
  console.log(`💰 Wallet balance: ${(solBalance / 1e9).toFixed(4)} SOL`);

  await ensureCollection(connection, payer, pdas);
  await ensureGlobalState(connection, payer, pdas, walletConfig);

  const globalBefore = parseGlobalState(await connection.getAccountInfo(pdas.globalState));
  console.log("\n🌍 Global state (before):", formatGlobalState(globalBefore));

  let userNft = parseUserNft(await connection.getAccountInfo(pdas.userNft));
  if (!userNft) {
    console.log("\n🆕 No user NFT found. Minting lock...");
    const amountLamports = BigInt(Math.round(LOCK_AMOUNT_BACK * 1e9));
    const durationSeconds = BigInt(Math.round(LOCK_DURATION_DAYS * 24 * 60 * 60));
    await sendInstruction(
      connection,
      payer,
      buildMintLevelNftIx(pdas, payer, amountLamports, durationSeconds),
      "mint_level_nft"
    );
    userNft = parseUserNft(await connection.getAccountInfo(pdas.userNft));
  } else {
    console.log("\n✅ Existing user NFT found. Skipping mint.");
  }

  if (!userNft) {
    throw new Error("Failed to fetch user NFT after minting.");
  }

  console.log("\n🔒 User lock snapshot:");
  console.log("  level:", userNft.levelName);
  console.log("  active:", userNft.isActive);
  console.log("  amountLocked:", `${formatLamports(userNft.amountLocked)} BACK`);
  console.log("  lockDuration:", `${Number(userNft.lockDuration) / 86400} days`);
  console.log("  boost:", `${userNft.boost} bps`);
  const [, expectedBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_nft"), payer.publicKey.toBuffer()],
    PROGRAM_ID
  );
  console.log("  bump (stored vs expected):", userNft.bump, "vs", expectedBump);

  const originalStatus = userNft.isActive;
  const toggles = originalStatus ? [false, true] : [true, false];

  for (const status of toggles) {
    console.log(`\n🚦 Setting NFT status → ${status ? "active" : "inactive"}`);
    await sendInstruction(
      connection,
      payer,
      buildUpdateNftStatusIx(pdas, payer, status),
      "update_nft_status"
    );

    const globalState = parseGlobalState(await connection.getAccountInfo(pdas.globalState));
    const userState = parseUserNft(await connection.getAccountInfo(pdas.userNft));
    console.log("  Global state:", formatGlobalState(globalState));
    console.log("  User isActive:", userState ? userState.isActive : null);
  }

  console.log("\n✅ Lock/unlock flow exercised successfully.");
})().catch((err) => {
  console.error("\n❌ Error during lock/unlock verification:");
  console.error(err);
  process.exit(1);
});
