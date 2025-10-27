/**
 * Initialisation Buyback State - Approche directe
 */

const { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

// Discriminator pour l'instruction "initialize"
const INITIALIZE_DISCRIMINATOR = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);

async function main() {
  console.log("\n🔧 Initialisation de Buyback State (Approche directe)\n");

  const network = "https://api.devnet.solana.com";
  const connection = new Connection(network, "confirmed");

  // Charger le wallet
  const walletPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log(`✅ Wallet: ${wallet.publicKey.toString()}`);

  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`💰 Solde: ${(balance / 1e9).toFixed(4)} SOL\n`);

  // Program ID et mints
  const buybackProgramId = new PublicKey("EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf");
  const backMint = new PublicKey("14rtHCJVvU7NKeFJotJsHdbsQGajnNmoQ7MHid41RLTa");
  const usdcMint = new PublicKey("BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR"); // USDC Mock MINT
  const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const RENT_SYSVAR = new PublicKey("SysvarRent111111111111111111111111111111111");

  // Dériver les PDAs
  const [buybackStatePDA, stateBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("buyback_state")],
    buybackProgramId
  );

  const [usdcVaultPDA, vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("usdc_vault")],
    buybackProgramId
  );

  console.log(`📍 Program ID: ${buybackProgramId.toString()}`);
  console.log(`🔑 Buyback State PDA: ${buybackStatePDA.toString()}`);
  console.log(`🪙 BACK Mint: ${backMint.toString()}`);
  console.log(`🪙 USDC Mint: ${usdcMint.toString()}`);
  console.log(`💰 USDC Vault PDA: ${usdcVaultPDA.toString()}`);
  console.log(`🔢 Bumps: state=${stateBump}, vault=${vaultBump}\n`);

  // Vérifier si déjà initialisé
  try {
    const accountInfo = await connection.getAccountInfo(buybackStatePDA);
    if (accountInfo) {
      console.log("⚠️  Buyback State déjà initialisé!");
      console.log(`   Taille: ${accountInfo.data.length} bytes\n`);
      process.exit(0);
    }
  } catch (error) {
    // Pas encore initialisé
  }

  console.log("📝 Création de l'instruction initialize...\n");

  // Paramètre: min_buyback_amount (u64 = 8 bytes)
  // Mettons 1 USDC minimum (1_000_000 avec 6 decimals)
  const minBuybackAmount = Buffer.alloc(8);
  minBuybackAmount.writeBigUInt64LE(BigInt(1_000_000));

  const instructionData = Buffer.concat([
    INITIALIZE_DISCRIMINATOR,
    minBuybackAmount
  ]);

  const keys = [
    { pubkey: buybackStatePDA, isSigner: false, isWritable: true }, // buyback_state
    { pubkey: backMint, isSigner: false, isWritable: false }, // back_mint
    { pubkey: usdcVaultPDA, isSigner: false, isWritable: true }, // usdc_vault (PDA à créer)
    { pubkey: usdcMint, isSigner: false, isWritable: false }, // usdc_mint
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // authority
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    { pubkey: RENT_SYSVAR, isSigner: false, isWritable: false }, // rent
  ];

  const instruction = new TransactionInstruction({
    keys,
    programId: buybackProgramId,
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

    console.log("✅ Buyback State initialisé avec succès!");
    console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet\n`);

    const accountInfo = await connection.getAccountInfo(buybackStatePDA);
    if (accountInfo) {
      console.log("📊 Compte créé:");
      console.log(`   Adresse: ${buybackStatePDA.toString()}`);
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
    console.log("🎉 Initialisation Buyback terminée!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
