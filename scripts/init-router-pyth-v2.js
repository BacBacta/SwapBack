/**
 * Initialisation Router State pour le nouveau programme Pyth V2
 * Program ID: APHj6L2b2bA2q62jwYZp38dqbTxQUqwatqdUum1trPnN
 */

const { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } = require("@solana/web3.js");
const fs = require("fs");

// Nouveau Program ID (déployé le 9 Dec 2025)
const ROUTER_PROGRAM_ID = new PublicKey("APHj6L2b2bA2q62jwYZp38dqbTxQUqwatqdUum1trPnN");

// Discriminator pour l'instruction "initialize" 
// Hash SHA256 des 8 premiers bytes de "global:initialize"
const INITIALIZE_DISCRIMINATOR = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);

async function main() {
  console.log("\n🚀 Initialisation Router State (Programme Pyth V2)\n");
  console.log(`📍 Program ID: ${ROUTER_PROGRAM_ID.toString()}`);

  // Configuration Mainnet
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

  // Charger le wallet
  const walletPath = "./mainnet-deploy-keypair.json";
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log(`✅ Wallet: ${wallet.publicKey.toString()}`);

  // Vérifier le solde
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`💰 Solde: ${(balance / 1e9).toFixed(4)} SOL\n`);

  // Dériver le PDA RouterState
  const [routerStatePDA, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("router_state")],
    ROUTER_PROGRAM_ID
  );

  console.log(`🔑 Router State PDA: ${routerStatePDA.toString()}`);
  console.log(`🔢 Bump: ${bump}\n`);

  // Vérifier si déjà initialisé
  const accountInfo = await connection.getAccountInfo(routerStatePDA);
  if (accountInfo) {
    console.log("✅ Router State déjà initialisé!");
    console.log(`   Taille: ${accountInfo.data.length} bytes`);
    console.log(`   Owner: ${accountInfo.owner.toString()}`);
    return;
  }

  console.log("📝 Création de l'instruction initialize...\n");

  // Créer l'instruction d'initialisation
  const instructionData = INITIALIZE_DISCRIMINATOR;

  const keys = [
    { pubkey: routerStatePDA, isSigner: false, isWritable: true },
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const instruction = new TransactionInstruction({
    keys,
    programId: ROUTER_PROGRAM_ID,
    data: instructionData,
  });

  const transaction = new Transaction().add(instruction);

  try {
    console.log("📤 Envoi de la transaction...");
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    const signature = await connection.sendTransaction(transaction, [wallet], {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    console.log(`✅ Transaction envoyée: ${signature}`);
    console.log(`🔗 https://solscan.io/tx/${signature}`);

    // Attendre la confirmation
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    if (confirmation.value.err) {
      console.error("❌ Transaction échouée:", confirmation.value.err);
    } else {
      console.log("\n🎉 Router State initialisé avec succès!");
    }
  } catch (error) {
    console.error("❌ Erreur:", error.message);
    if (error.logs) {
      console.log("\nLogs:");
      error.logs.forEach(log => console.log("  ", log));
    }
  }
}

main().catch(console.error);
