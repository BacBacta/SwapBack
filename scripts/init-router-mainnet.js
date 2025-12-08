const { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } = require("@solana/web3.js");
const fs = require("fs");
const anchor = require("@coral-xyz/anchor");

// Configuration Mainnet
const ROUTER_PROGRAM_ID = new PublicKey("GEdKdZRVZHLUKGCX8swwLn7BJUciDFgf2edkjq4M31mJ");
const RPC_URL = "https://api.mainnet-beta.solana.com";

async function main() {
  console.log("🚀 Initializing Router on Mainnet...\n");

  // Load keypair
  const keypairPath = "/workspaces/SwapBack/mainnet-deploy-keypair.json";
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  
  console.log("Authority wallet:", payer.publicKey.toBase58());

  // Setup connection
  const connection = new Connection(RPC_URL, "confirmed");
  
  // Check balance
  const balance = await connection.getBalance(payer.publicKey);
  console.log("Balance:", balance / 1e9, "SOL");

  // Derive RouterState PDA
  const [routerStatePda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("router_state")],
    ROUTER_PROGRAM_ID
  );
  
  console.log("RouterState PDA:", routerStatePda.toBase58());
  console.log("Bump:", bump);

  // Check if already initialized
  const existingAccount = await connection.getAccountInfo(routerStatePda);
  if (existingAccount) {
    console.log("\n⚠️ Router already initialized!");
    console.log("Account size:", existingAccount.data.length, "bytes");
    console.log("Owner:", existingAccount.owner.toBase58());
    return;
  }
  
  console.log("RouterState not found, proceeding with initialization...\n");

  // Build the initialize instruction
  // Anchor discriminator for "initialize" = first 8 bytes of sha256("global:initialize")
  const discriminator = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);
  
  const initializeIx = new TransactionInstruction({
    keys: [
      { pubkey: routerStatePda, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: ROUTER_PROGRAM_ID,
    data: discriminator,
  });

  // Create and send transaction
  const tx = new Transaction().add(initializeIx);
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  try {
    const signature = await connection.sendTransaction(tx, [payer], {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    console.log("Transaction sent:", signature);
    console.log("Waiting for confirmation...");

    await connection.confirmTransaction(signature, "confirmed");

    console.log("\n✅ Router initialized successfully!");
    console.log("Transaction:", signature);
    console.log("Explorer: https://solscan.io/tx/" + signature);
    
    // Verify
    const newAccount = await connection.getAccountInfo(routerStatePda);
    if (newAccount) {
      console.log("\n📊 Router State created:");
      console.log("  Account size:", newAccount.data.length, "bytes");
      console.log("  Owner:", newAccount.owner.toBase58());
    }
    
  } catch (error) {
    console.error("❌ Error initializing router:", error);
    if (error.logs) {
      console.log("\nProgram logs:");
      error.logs.forEach(log => console.log("  ", log));
    }
  }
}

main().catch(console.error);
