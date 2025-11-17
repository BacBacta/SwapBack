#!/usr/bin/env node

/**
 * Test le flux de unlock anticipé (early unlock) avec pénalité de 2%
 * redirigée vers le buyback wallet.
 *
 * Ce script :
 * 1. Vérifie qu'un lock actif existe pour le wallet
 * 2. Construit une transaction unlock_tokens avec tous les comptes requis
 * 3. Affiche les détails de la pénalité (2% → buyback)
 * 4. Soumet la transaction et confirme le résultat
 * 5. Vérifie que le buyback wallet a reçu la pénalité
 *
 * Usage:
 *   node scripts/test-early-unlock.js [path_to_keypair.json]
 *
 * Variables d'environnement :
 *   SOLANA_RPC_URL          RPC endpoint (default: https://api.devnet.solana.com)
 *   CNFT_PROGRAM_ID         Program ID du cNFT (default: from IDL)
 *   BACK_MINT               Mint address du token BACK
 */

const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} = require("@solana/web3.js");
const {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");
const bs58 = require("bs58");

// Charger l'IDL
const IDL = require("../app/public/idl/swapback_cnft.json");

// Configuration par défaut
const PROGRAM_ID = new PublicKey(process.env.CNFT_PROGRAM_ID || IDL.address);
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const BACK_MINT = new PublicKey(
  process.env.BACK_MINT || "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux"
);
const DEFAULT_KEYPAIR_PATH = path.join(__dirname, "..", "devnet-keypair.json");

const LAMPORTS_PER_BACK = 1_000_000; // BACK has 6 decimals
const PENALTY_BPS = 200; // 2%
const BASIS_POINTS = 10_000;

// Charger le discriminator pour unlock_tokens
const instructionMap = new Map(IDL.instructions.map((ix) => [ix.name, ix]));

function getDiscriminator(name) {
  const ix = instructionMap.get(name);
  if (!ix) {
    throw new Error(`Instruction ${name} non trouvée dans l'IDL`);
  }
  return Buffer.from(ix.discriminator);
}

function loadKeypair(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Keypair introuvable: ${resolved}`);
  }

  const content = fs.readFileSync(resolved, "utf8");
  let secretKey;

  try {
    // Essayer format JSON (array de bytes)
    const parsed = JSON.parse(content);
    secretKey = Uint8Array.from(parsed);
  } catch {
    // Essayer format base58
    try {
      secretKey = bs58.decode(content.trim());
    } catch {
      throw new Error(`Format de keypair invalide dans ${resolved}`);
    }
  }

  if (secretKey.length !== 64) {
    throw new Error(`Keypair doit avoir 64 bytes, reçu ${secretKey.length}`);
  }

  return Keypair.fromSecretKey(secretKey);
}

function parseGlobalState(data) {
  if (!data || data.length < 8 + 32 * 5) {
    throw new Error("GlobalState data trop courte");
  }

  let offset = 8; // skip discriminator
  const authority = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  const treasuryWallet = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  const boostVaultWallet = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  const buybackWallet = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  const npiVaultWallet = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  return {
    authority,
    treasuryWallet,
    boostVaultWallet,
    buybackWallet,
    npiVaultWallet,
  };
}

function parseUserLock(data) {
  if (!data || data.length < 69) {
    throw new Error("UserLock data trop courte");
  }

  let offset = 8; // skip discriminator
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
  const lockTime = data.readBigInt64LE(offset);
  offset += 8;
  const isActive = data.readUInt8(offset) === 1;

  return {
    user,
    levelIndex,
    amountLocked,
    lockDuration: Number(lockDuration),
    boost,
    lockTime: Number(lockTime),
    isActive,
  };
}

async function main() {
  // Charger le keypair
  const keypairPath = process.argv[2] || DEFAULT_KEYPAIR_PATH;
  console.log(`\n🔑 Chargement du keypair: ${keypairPath}`);
  const payer = loadKeypair(keypairPath);
  console.log(`   Wallet: ${payer.publicKey.toBase58()}`);

  // Connexion
  console.log(`\n🌐 Connexion au RPC: ${RPC_URL}`);
  const connection = new Connection(RPC_URL, "confirmed");

  // Vérifier le solde
  const balance = await connection.getBalance(payer.publicKey);
  console.log(`   Solde SOL: ${(balance / 1e9).toFixed(4)} SOL`);

  if (balance < 10_000_000) {
    throw new Error("⚠️  Solde SOL insuffisant (min 0.01 SOL requis)");
  }

  // Dériver les PDAs
  console.log(`\n📍 Calcul des PDAs...`);
  console.log(`   Program ID: ${PROGRAM_ID.toBase58()}`);

  const [globalState] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    PROGRAM_ID
  );
  console.log(`   global_state: ${globalState.toBase58()}`);

  const [userLock] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_lock"), payer.publicKey.toBuffer()],
    PROGRAM_ID
  );
  console.log(`   user_lock: ${userLock.toBase58()}`);

  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority")],
    PROGRAM_ID
  );
  console.log(`   vault_authority: ${vaultAuthority.toBase58()}`);

  // Lire le GlobalState pour obtenir le buyback wallet
  console.log(`\n📖 Lecture du GlobalState...`);
  const globalStateInfo = await connection.getAccountInfo(globalState);
  if (!globalStateInfo) {
    throw new Error("❌ GlobalState non initialisé");
  }

  const globalData = parseGlobalState(globalStateInfo.data);
  console.log(`   ✅ Authority: ${globalData.authority.toBase58()}`);
  console.log(`   ✅ Treasury: ${globalData.treasuryWallet.toBase58()}`);
  console.log(`   ✅ Boost Vault: ${globalData.boostVaultWallet.toBase58()}`);
  console.log(`   ✅ Buyback Wallet: ${globalData.buybackWallet.toBase58()}`);
  console.log(`   ✅ NPI Vault: ${globalData.npiVaultWallet.toBase58()}`);

  // Lire le UserLock
  console.log(`\n🔒 Lecture du UserLock...`);
  const userLockInfo = await connection.getAccountInfo(userLock);
  if (!userLockInfo) {
    throw new Error("❌ Aucun lock trouvé pour ce wallet. Créez d'abord un lock.");
  }

  const lockData = parseUserLock(userLockInfo.data);
  if (!lockData.isActive) {
    throw new Error("❌ Le lock n'est pas actif. Impossible de unlock.");
  }

  const amountBackTokens = Number(lockData.amountLocked) / LAMPORTS_PER_BACK;
  const penaltyAmount = (Number(lockData.amountLocked) * PENALTY_BPS) / BASIS_POINTS;
  const penaltyBackTokens = penaltyAmount / LAMPORTS_PER_BACK;
  const receivedAmount = Number(lockData.amountLocked) - penaltyAmount;
  const receivedBackTokens = receivedAmount / LAMPORTS_PER_BACK;

  const now = Math.floor(Date.now() / 1000);
  const unlockTime = lockData.lockTime + lockData.lockDuration;
  const isEarly = now < unlockTime;

  console.log(`   ✅ Montant verrouillé: ${amountBackTokens.toFixed(6)} BACK`);
  console.log(`   ✅ Boost: ${lockData.boost / 100}%`);
  console.log(`   ✅ Unlock time: ${new Date(unlockTime * 1000).toLocaleString()}`);
  console.log(`   ${isEarly ? "⚠️  EARLY UNLOCK" : "✅ Mature unlock"}`);

  if (isEarly) {
    console.log(`\n💰 Calcul de la pénalité (2%):`);
    console.log(`   • Montant verrouillé: ${amountBackTokens.toFixed(6)} BACK`);
    console.log(`   • Pénalité (2%): ${penaltyBackTokens.toFixed(6)} BACK`);
    console.log(`   • Vous recevrez: ${receivedBackTokens.toFixed(6)} BACK`);
    console.log(`   • Destination pénalité: Buyback Wallet`);
  } else {
    console.log(`\n✅ Pas de pénalité (unlock à maturité)`);
  }

  // Calculer les ATAs
  console.log(`\n🔗 Calcul des token accounts...`);
  const userTokenAccount = await getAssociatedTokenAddress(
    BACK_MINT,
    payer.publicKey,
    false,
    TOKEN_PROGRAM_ID
  );
  console.log(`   user_token_account: ${userTokenAccount.toBase58()}`);

  const vaultTokenAccount = await getAssociatedTokenAddress(
    BACK_MINT,
    vaultAuthority,
    true,
    TOKEN_PROGRAM_ID
  );
  console.log(`   vault_token_account: ${vaultTokenAccount.toBase58()}`);

  const buybackWalletTokenAccount = await getAssociatedTokenAddress(
    BACK_MINT,
    globalData.buybackWallet,
    false,
    TOKEN_PROGRAM_ID
  );
  console.log(`   buyback_wallet_token_account: ${buybackWalletTokenAccount.toBase58()}`);

  // Vérifier les balances avant
  console.log(`\n💼 Balances avant unlock:`);
  const userBalanceBefore = await connection.getTokenAccountBalance(userTokenAccount).catch(() => ({ value: { uiAmount: 0 } }));
  const buybackBalanceBefore = await connection.getTokenAccountBalance(buybackWalletTokenAccount).catch(() => ({ value: { uiAmount: 0 } }));
  
  console.log(`   User: ${userBalanceBefore.value.uiAmount || 0} BACK`);
  console.log(`   Buyback: ${buybackBalanceBefore.value.uiAmount || 0} BACK`);

  // Construire l'instruction unlock_tokens
  console.log(`\n🔨 Construction de la transaction unlock_tokens...`);
  const discriminator = getDiscriminator("unlockTokens");

  const keys = [
    { pubkey: userLock, isSigner: false, isWritable: true },
    { pubkey: globalState, isSigner: false, isWritable: true },
    { pubkey: userTokenAccount, isSigner: false, isWritable: true },
    { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
    { pubkey: buybackWalletTokenAccount, isSigner: false, isWritable: true },
    { pubkey: vaultAuthority, isSigner: false, isWritable: false },
    { pubkey: BACK_MINT, isSigner: false, isWritable: false },
    { pubkey: payer.publicKey, isSigner: true, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  console.log(`   ✅ Comptes configurés (${keys.length}):`);
  keys.forEach((key, idx) => {
    console.log(`      ${idx + 1}. ${key.pubkey.toBase58()} ${key.isSigner ? '(signer)' : ''} ${key.isWritable ? '(writable)' : ''}`);
  });

  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data: discriminator,
  });

  const transaction = new Transaction().add(instruction);

  // Demander confirmation
  console.log(`\n⚠️  CONFIRMATION REQUISE`);
  console.log(`   Vous allez unlock ${amountBackTokens.toFixed(6)} BACK`);
  if (isEarly) {
    console.log(`   Pénalité de 2% (${penaltyBackTokens.toFixed(6)} BACK) sera envoyée au buyback wallet`);
  }
  console.log(`\n   Appuyez sur Entrée pour continuer, Ctrl+C pour annuler...`);
  
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });

  // Envoyer la transaction
  console.log(`\n📤 Envoi de la transaction...`);
  try {
    const signature = await connection.sendTransaction(transaction, [payer], {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    console.log(`   🚀 Transaction envoyée: ${signature}`);
    console.log(`   🔗 Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

    console.log(`\n⏳ Confirmation en cours...`);
    await connection.confirmTransaction(signature, "confirmed");
    console.log(`   ✅ Transaction confirmée!`);

    // Vérifier les balances après
    console.log(`\n💼 Balances après unlock:`);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Attendre la propagation
    
    const userBalanceAfter = await connection.getTokenAccountBalance(userTokenAccount).catch(() => ({ value: { uiAmount: 0 } }));
    const buybackBalanceAfter = await connection.getTokenAccountBalance(buybackWalletTokenAccount).catch(() => ({ value: { uiAmount: 0 } }));
    
    console.log(`   User: ${userBalanceAfter.value.uiAmount || 0} BACK (+${((userBalanceAfter.value.uiAmount || 0) - (userBalanceBefore.value.uiAmount || 0)).toFixed(6)})`);
    console.log(`   Buyback: ${buybackBalanceAfter.value.uiAmount || 0} BACK (+${((buybackBalanceAfter.value.uiAmount || 0) - (buybackBalanceBefore.value.uiAmount || 0)).toFixed(6)})`);

    if (isEarly) {
      const buybackDiff = (buybackBalanceAfter.value.uiAmount || 0) - (buybackBalanceBefore.value.uiAmount || 0);
      const expectedPenalty = penaltyBackTokens;
      const tolerance = 0.000001;
      
      if (Math.abs(buybackDiff - expectedPenalty) < tolerance) {
        console.log(`\n   ✅ Pénalité correctement routée vers le buyback wallet!`);
      } else {
        console.log(`\n   ⚠️  Différence inattendue: reçu ${buybackDiff.toFixed(6)}, attendu ${expectedPenalty.toFixed(6)}`);
      }
    }

    console.log(`\n✅ Test d'unlock anticipé réussi!`);

  } catch (error) {
    console.error(`\n❌ Erreur lors de l'envoi de la transaction:`);
    console.error(error);
    
    if (error.logs) {
      console.error(`\n📋 Logs de la transaction:`);
      error.logs.forEach(log => console.error(`   ${log}`));
    }
    
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n❌ Erreur fatale:");
  console.error(err);
  process.exit(1);
});
