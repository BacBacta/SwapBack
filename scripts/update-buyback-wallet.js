/**
 * Update buyback_wallet in GlobalState to use the correct ATA
 */

const { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } = require("@solana/web3.js");
const { getAssociatedTokenAddress } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

async function main() {
  console.log("\n🔧 Mise à jour du buyback wallet dans GlobalState");
  console.log("═".repeat(60));

  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const CNFT_PROGRAM_ID = new PublicKey(
    process.env.CNFT_PROGRAM_ID ||
    process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID ||
    "DGDipfpHGVAnWXj7yPEBc3JYFWghQN76tEBzuK2Nojw3"
  );
  const BACK_MINT = new PublicKey("862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux");
  const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

  // Load wallet
  const keypairPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log(`\n👤 Wallet: ${wallet.publicKey.toString()}`);
  console.log(`🆔 Program: ${CNFT_PROGRAM_ID.toString()}`);

  // Calculate buyback wallet ATA
  const buybackWalletAta = await getAssociatedTokenAddress(
    BACK_MINT,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  console.log(`\n💰 Buyback Wallet ATA: ${buybackWalletAta.toString()}`);

  // Verify ATA exists
  const ataInfo = await connection.getAccountInfo(buybackWalletAta);
  if (!ataInfo) {
    console.log("\n❌ L'ATA n'existe pas! Créez-le d'abord:");
    console.log(`   spl-token create-account ${BACK_MINT.toString()} --owner ${wallet.publicKey.toString()} --url devnet --program-id ${TOKEN_2022_PROGRAM_ID.toString()}`);
    process.exit(1);
  }

  console.log("✅ ATA existe");

  // PDAs
  const [globalState] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    CNFT_PROGRAM_ID
  );

  console.log(`\n📋 Global State: ${globalState.toString()}`);

  // Discriminator for update_buyback_wallet
  const discriminator = crypto
    .createHash("sha256")
    .update("global:update_buyback_wallet")
    .digest()
    .slice(0, 8);

  console.log(`🔑 Discriminator: [${Array.from(discriminator).join(", ")}]`);

  // Build instruction
  const keys = [
    { pubkey: globalState, isSigner: false, isWritable: true },
    { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
    { pubkey: buybackWalletAta, isSigner: false, isWritable: true },  // writable required
    { pubkey: BACK_MINT, isSigner: false, isWritable: false },
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  const instruction = new TransactionInstruction({
    programId: CNFT_PROGRAM_ID,
    keys,
    data: discriminator,
  });

  console.log("\n📝 Comptes:");
  keys.forEach((key, idx) => {
    const labels = ["global_state", "authority", "buyback_wallet_token_account", "back_mint", "token_2022_program"];
    console.log(`   ${idx}. ${labels[idx].padEnd(30)} ${key.pubkey.toString()}`);
  });

  // Send transaction
  console.log("\n🚀 Envoi de la transaction...");
  const transaction = new Transaction().add(instruction);

  try {
    const signature = await connection.sendTransaction(transaction, [wallet], {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    console.log(`✅ Transaction envoyée: ${signature}`);
    console.log(`🔗 Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

    // Wait for confirmation
    console.log("\n⏳ Confirmation...");
    const confirmation = await connection.confirmTransaction(signature, "confirmed");

    if (confirmation.value.err) {
      console.error(`❌ Transaction échouée:`, confirmation.value.err);
      process.exit(1);
    }

    console.log("\n✅ Mise à jour réussie!");
    console.log(`   Buyback Wallet mis à jour vers: ${buybackWalletAta.toString()}`);

  } catch (error) {
    console.error("\n❌ Erreur:", error.message);
    if (error.logs) {
      console.error("\nLogs:");
      error.logs.forEach(log => console.error("  ", log));
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
