const anchor = require("@coral-xyz/anchor");
const { PublicKey } = require("@solana/web3.js");

async function main() {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SwapbackRouter;

  console.log("Resetting and Initializing Performance Modules...");

  // Seeds: [b"router_state"]
  const [routerStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("router_state")],
    program.programId
  );
  console.log("Router State PDA:", routerStatePda.toString());

  // 1. Reset State (Close old account)
  try {
    console.log("Attempting to reset state...");
    const tx0 = await program.methods
      .resetState()
      .accounts({
        authority: provider.wallet.publicKey,
        state: routerStatePda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log("✅ State Reset! Tx:", tx0);
  } catch (e) {
    console.log("⚠️ Reset failed (maybe account doesn't exist or already closed):", e.message);
  }

  // 2. Initialize Router State (Re-create with new layout)
  try {
    console.log("Initializing Router State...");
    const tx1 = await program.methods
      .initialize()
      .accounts({
        authority: provider.wallet.publicKey,
        state: routerStatePda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log("✅ Router State Initialized! Tx:", tx1);
  } catch (e) {
    if (e.message && e.message.includes("already in use")) {
      console.log("⚠️ Router State already initialized.");
    } else {
      console.error("❌ Error initializing Router State:", e);
    }
  }

  // 3. Initialize Venue Score
  // Seeds: [b"venue_score", state.key().as_ref()]
  const [venueScorePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("venue_score"), routerStatePda.toBuffer()],
    program.programId
  );
  console.log("Venue Score PDA:", venueScorePda.toString());

  try {
    const tx2 = await program.methods
      .initializeVenueScore()
      .accounts({
        authority: provider.wallet.publicKey,
        state: routerStatePda,
        venueScore: venueScorePda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log("✅ Venue Score Initialized! Tx:", tx2);
  } catch (e) {
    if (e.message && e.message.includes("already in use")) {
      console.log("⚠️ Venue Score already initialized.");
    } else {
      console.error("❌ Error initializing Venue Score:", e);
    }
  }

  // 4. Initialize Oracle Cache (SOL/USD Devnet Pyth Feed)
  const SOL_USD_FEED = new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix");
  
  // Seeds: [b"oracle_cache", oracle.key().as_ref()]
  const [oracleCachePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("oracle_cache"), SOL_USD_FEED.toBuffer()],
    program.programId
  );
  console.log("Oracle Cache PDA:", oracleCachePda.toString());

  try {
    const tx3 = await program.methods
      .initializeOracleCache()
      .accounts({
        authority: provider.wallet.publicKey,
        oracleCache: oracleCachePda,
        oracle: SOL_USD_FEED,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log("✅ Oracle Cache Initialized! Tx:", tx3);
  } catch (e) {
    if (e.message && e.message.includes("already in use")) {
      console.log("⚠️ Oracle Cache already initialized.");
    } else {
      console.error("❌ Error initializing Oracle Cache:", e);
    }
  }
}

main().then(
  () => process.exit(),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
