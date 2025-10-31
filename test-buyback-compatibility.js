#!/usr/bin/env node

/**
 * Test rapide du buyback après déploiement
 * Vérifie que le programme accepte maintenant Token-2022
 */

const {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddress,
} = require("@solana/spl-token");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Configuration
const DEVNET_RPC = "https://api.devnet.solana.com";
const BUYBACK_PROGRAM_ID = new PublicKey("EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf");
const BACK_TOKEN_MINT = new PublicKey("3Y6RXZUBHCeUj6VsWuyBY2Zy1RixY6BHkM4tf3euDdrE");
const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

function getDiscriminator(name) {
  const hash = crypto.createHash("sha256");
  hash.update(`global:${name}`);
  return Buffer.from(hash.digest().slice(0, 8));
}

const INITIALIZE_DISCRIMINATOR = getDiscriminator("initialize");

console.log("🧪 Test Rapide Buyback Token-2022");
console.log("=================================\n");

async function testBuybackCompatibility() {
  const connection = new Connection(DEVNET_RPC, "confirmed");

  // Charger l'authority wallet
  const defaultPath = path.join(
    require("os").homedir(),
    ".config/solana/id.json"
  );

  let authority;
  try {
    const walletData = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
    authority = Keypair.fromSecretKey(new Uint8Array(walletData));
  } catch (error) {
    console.error("❌ Wallet non trouvé:", defaultPath);
    console.log("   Créez un wallet: solana-keygen new --outfile ~/.config/solana/id.json");
    return;
  }

  console.log(`👤 Authority: ${authority.publicKey.toBase58()}`);

  // Vérifier le solde
  const balance = await connection.getBalance(authority.publicKey);
  console.log(`💰 Solde: ${balance / 1e9} SOL\n`);

  // Dériver les adresses PDA
  const [globalStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("buyback_state")],
    BUYBACK_PROGRAM_ID
  );

  const [usdcVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("usdc_vault")],
    BUYBACK_PROGRAM_ID
  );

  console.log(`📍 GlobalState PDA: ${globalStatePDA.toBase58()}`);
  console.log(`📦 USDC Vault PDA: ${usdcVaultPDA.toBase58()}\n`);

  // Vérifier si déjà initialisé
  const existingAccount = await connection.getAccountInfo(globalStatePDA);

  if (existingAccount) {
    console.log("✅ Buyback states déjà initialisés!");
    console.log(`   Owner: ${existingAccount.owner.toBase58()}`);
    console.log(`   Size: ${existingAccount.data.length} bytes\n`);

    // Tester une petite transaction pour vérifier la compatibilité
    console.log("🔍 Test de compatibilité Token-2022...");

    // Créer une instruction de test (initialize avec min_buyback_amount différent)
    const testMinAmount = 5 * 1e6; // 5 USDC
    const data = Buffer.concat([INITIALIZE_DISCRIMINATOR, Buffer.alloc(8)]);
    data.writeBigUInt64LE(BigInt(testMinAmount), 8);

    const testInstruction = new TransactionInstruction({
      keys: [
        { pubkey: globalStatePDA, isSigner: false, isWritable: true },
        { pubkey: authority.publicKey, isSigner: true, isWritable: true },
        { pubkey: BACK_TOKEN_MINT, isSigner: false, isWritable: false },
        { pubkey: usdcVaultPDA, isSigner: false, isWritable: true },
        { pubkey: require("@solana/web3.js").SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: BUYBACK_PROGRAM_ID,
      data,
    });

    const testTransaction = new Transaction().add(testInstruction);

    try {
      // Ne pas envoyer, juste simuler
      const simulation = await connection.simulateTransaction(testTransaction, [authority]);

      if (simulation.value.err) {
        console.log("❌ Simulation échouée:", simulation.value.err);
        console.log("   Logs:", simulation.value.logs);

        if (simulation.value.err.toString().includes("AccountOwnedByWrongProgram")) {
          console.log("\n🔴 PROBLÈME: Programme toujours incompatible Token-2022");
          console.log("   Solution: Redéployez le programme buyback");
        }
      } else {
        console.log("✅ Simulation réussie - Programme compatible Token-2022!");
        console.log("   Logs:", simulation.value.logs?.slice(-3)); // Derniers logs
      }
    } catch (error) {
      console.log("❌ Erreur simulation:", error.message);
    }

  } else {
    console.log("❌ Buyback states non initialisés");
    console.log("   Exécutez d'abord: node scripts/init-buyback-states.js\n");

    // Tester quand même la compatibilité avec une simulation d'initialize
    console.log("🔍 Test simulation initialize...");

    const minBuybackAmount = 10 * 1e6; // 10 USDC
    const data = Buffer.concat([INITIALIZE_DISCRIMINATOR, Buffer.alloc(8)]);
    data.writeBigUInt64LE(BigInt(minBuybackAmount), 8);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: globalStatePDA, isSigner: false, isWritable: true },
        { pubkey: authority.publicKey, isSigner: true, isWritable: true },
        { pubkey: BACK_TOKEN_MINT, isSigner: false, isWritable: false },
        { pubkey: usdcVaultPDA, isSigner: false, isWritable: true },
        { pubkey: require("@solana/web3.js").SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: BUYBACK_PROGRAM_ID,
      data,
    });

    const transaction = new Transaction().add(instruction);

    try {
      const simulation = await connection.simulateTransaction(transaction, [authority]);

      if (simulation.value.err) {
        console.log("❌ Simulation initialize échouée:", simulation.value.err);

        if (simulation.value.err.toString().includes("AccountOwnedByWrongProgram")) {
          console.log("\n🔴 PROBLÈME: Programme buyback incompatible Token-2022");
          console.log("   Action requise: Redéployez le programme buyback");
          console.log("   Commande: solana program deploy --program-id target/deploy/swapback_buyback-keypair.json target/deploy/swapback_buyback.so");
        }
      } else {
        console.log("✅ Simulation initialize réussie!");
        console.log("   Programme compatible Token-2022 - Prêt pour initialisation");
        console.log("\n🚀 Vous pouvez maintenant exécuter:");
        console.log("   node scripts/init-buyback-states.js");
      }
    } catch (error) {
      console.log("❌ Erreur simulation:", error.message);
    }
  }
}

testBuybackCompatibility().catch(console.error);