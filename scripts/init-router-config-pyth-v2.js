/**
 * Initialisation Router Config pour le nouveau programme Pyth V2
 * Program ID: APHj6L2b2bA2q62jwYZp38dqbTxQUqwatqdUum1trPnN
 */

const { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } = require("@solana/web3.js");
const fs = require("fs");
const BN = require("bn.js");

// Nouveau Program ID (déployé le 9 Dec 2025)
const ROUTER_PROGRAM_ID = new PublicKey("APHj6L2b2bA2q62jwYZp38dqbTxQUqwatqdUum1trPnN");

// Discriminator pour "initialize_config"
// SHA256("global:initialize_config")[0:8]
const INIT_CONFIG_DISCRIMINATOR = Buffer.from([208, 127, 21, 1, 194, 190, 196, 70]);

async function main() {
  console.log("\n🚀 Initialisation Router Config (Programme Pyth V2)\n");
  console.log(`📍 Program ID: ${ROUTER_PROGRAM_ID.toString()}`);

  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

  // Charger le wallet
  const walletPath = "./mainnet-deploy-keypair.json";
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log(`✅ Wallet: ${wallet.publicKey.toString()}`);

  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`💰 Solde: ${(balance / 1e9).toFixed(4)} SOL\n`);

  // Dériver les PDAs
  const [routerStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("router_state")],
    ROUTER_PROGRAM_ID
  );

  const [routerConfigPDA, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("router_config")],
    ROUTER_PROGRAM_ID
  );

  console.log(`🔑 Router State PDA: ${routerStatePDA.toString()}`);
  console.log(`🔑 Router Config PDA: ${routerConfigPDA.toString()}`);
  console.log(`🔢 Bump: ${bump}\n`);

  // Vérifier si déjà initialisé
  const configInfo = await connection.getAccountInfo(routerConfigPDA);
  if (configInfo) {
    console.log("✅ Router Config déjà initialisé!");
    console.log(`   Taille: ${configInfo.data.length} bytes`);
    return;
  }

  console.log("📝 Création de l'instruction initialize_config...\n");

  // Paramètres de configuration
  const feeBps = 30; // 0.30% de frais
  const rebateBps = 50; // 50% des frais en rebate
  const minSwapAmount = new BN(1000); // 1000 lamports minimum

  // Construire les données de l'instruction
  const data = Buffer.alloc(8 + 2 + 2 + 8); // discriminator + fee_bps + rebate_bps + min_swap
  INIT_CONFIG_DISCRIMINATOR.copy(data, 0);
  data.writeUInt16LE(feeBps, 8);
  data.writeUInt16LE(rebateBps, 10);
  data.writeBigUInt64LE(BigInt(minSwapAmount.toString()), 12);

  const keys = [
    { pubkey: routerConfigPDA, isSigner: false, isWritable: true },
    { pubkey: routerStatePDA, isSigner: false, isWritable: true }, // Must be mutable
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const instruction = new TransactionInstruction({
    keys,
    programId: ROUTER_PROGRAM_ID,
    data,
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

    console.log(`✅ Transaction: ${signature}`);
    console.log(`🔗 https://solscan.io/tx/${signature}`);

    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    if (confirmation.value.err) {
      console.error("❌ Transaction échouée:", confirmation.value.err);
    } else {
      console.log("\n🎉 Router Config initialisé avec succès!");
      console.log(`   Fee: ${feeBps/100}%`);
      console.log(`   Rebate: ${rebateBps}%`);
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
