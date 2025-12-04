import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";

// Configuration Mainnet
const ROUTER_PROGRAM_ID = new PublicKey("4z1BtCBn7mCx6A2odpg51TGjdaxzQBXsAFQ5654zxjSu");
const RPC_URL = "https://api.mainnet-beta.solana.com";

async function main() {
  console.log("🚀 Initializing Router on Mainnet...\n");

  // Load keypair
  const keypairPath = "/workspaces/SwapBack/mainnet-deploy-keypair.json";
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  
  console.log("Authority wallet:", payer.publicKey.toBase58());

  // Setup connection and provider
  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new Wallet(payer);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });

  // Load IDL
  const idlPath = "/workspaces/SwapBack/target/idl/swapback_router.json";
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  
  // Create program instance
  const program = new Program(idl, ROUTER_PROGRAM_ID, provider);

  // Derive RouterState PDA
  const [routerStatePda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("router_state")],
    ROUTER_PROGRAM_ID
  );
  
  console.log("RouterState PDA:", routerStatePda.toBase58());
  console.log("Bump:", bump);

  // Check if already initialized
  try {
    const existingState = await (program.account as any).routerState.fetch(routerStatePda);
    console.log("\n⚠️ Router already initialized!");
    console.log("Current authority:", existingState.authority.toBase58());
    return;
  } catch (e) {
    console.log("RouterState not found, proceeding with initialization...\n");
  }

  // Initialize
  try {
    const tx = await program.methods
      .initialize()
      .accounts({
        state: routerStatePda,
        authority: payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([payer])
      .rpc();

    console.log("✅ Router initialized successfully!");
    console.log("Transaction:", tx);
    console.log("Explorer: https://solscan.io/tx/" + tx);
    
    // Fetch and display state
    const state = await (program.account as any).routerState.fetch(routerStatePda);
    console.log("\n📊 Router State:");
    console.log("  Authority:", state.authority.toBase58());
    console.log("  Is Paused:", state.isPaused);
    console.log("  Rebate %:", state.rebatePercentage);
    
  } catch (error) {
    console.error("❌ Error initializing router:", error);
  }
}

main().catch(console.error);
