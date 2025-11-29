const anchor = require("@coral-xyz/anchor");
const { PublicKey, Keypair, SystemProgram } = require("@solana/web3.js");
const { createMint, createAccount, mintTo, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } = require("@solana/spl-token");

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.SwapbackRouter;
  const connection = provider.connection;
  const wallet = provider.wallet;

  console.log("🚀 Starting Performance Swap Test...");

  // 1. Setup Mints
  console.log("Creating Mock Mints...");
  const usdcMint = await createMint(
    connection,
    wallet.payer,
    wallet.publicKey,
    null,
    6
  );
  console.log("USDC Mint:", usdcMint.toString());

  const tokenAMint = await createMint(
    connection,
    wallet.payer,
    wallet.publicKey,
    null,
    9
  );
  console.log("Token A Mint:", tokenAMint.toString());

  // 2. Initialize Rebate Vault (if needed)
  const [routerStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("router_state")],
    program.programId
  );
  
  const [rebateVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("rebate_vault"), routerStatePda.toBuffer()],
    program.programId
  );

  try {
    await program.methods
      .initializeRebateVault()
      .accounts({
        authority: wallet.publicKey,
        state: routerStatePda,
        rebateVault: rebateVaultPda,
        usdcMint: usdcMint,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    console.log("✅ Rebate Vault Initialized");
  } catch (e) {
    if (e.message.includes("already in use")) {
      console.log("⚠️ Rebate Vault already initialized");
    } else {
      console.error("❌ Error initializing Rebate Vault:", e);
      // If it fails here (e.g. already init with different mint), we might have issues.
      // But since we checked it doesn't exist, it should be fine.
    }
  }

  // 3. Setup User Accounts
  console.log("Setting up User Accounts...");
  const userTokenA = await getOrCreateAssociatedTokenAccount(
    connection,
    wallet.payer,
    tokenAMint,
    wallet.publicKey
  );
  
  const userTokenB = await getOrCreateAssociatedTokenAccount(
    connection,
    wallet.payer,
    usdcMint,
    wallet.publicKey
  );

  // Mint some tokens to user
  await mintTo(
    connection,
    wallet.payer,
    tokenAMint,
    userTokenA.address,
    wallet.payer,
    1000000000 // 1 Token A
  );
  console.log("Minted 1 Token A to user");

  // 4. Prepare Swap Args
  const amountIn = new anchor.BN(1000000); // 0.001 Token A
  const minOut = new anchor.BN(1); // Must be > 0
  
  // PDAs
  const SWITCHBOARD_SOL_USD = new PublicKey("GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR");
  const PYTH_SOL_USD = new PublicKey("H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG");
  const [oracleCachePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("oracle_cache"), SWITCHBOARD_SOL_USD.toBuffer()],
    program.programId
  );
  const [venueScorePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("venue_score"), routerStatePda.toBuffer()],
    program.programId
  );

  // 5. Execute Swap
  console.log("Executing Swap...");
  try {
    const tx = await program.methods
      .swapToc({
        amountIn: amountIn,
        minOut: minOut,
        slippageTolerance: 100, // 1%
        twapSlices: null,
        useDynamicPlan: false,
        planAccount: null,
        useBundle: false,
        primaryOracleAccount: SWITCHBOARD_SOL_USD,
        fallbackOracleAccount: PYTH_SOL_USD,
        jupiterRoute: null
      })
      .accounts({
        state: routerStatePda,
        user: wallet.publicKey,
        primaryOracle: SWITCHBOARD_SOL_USD,
        fallbackOracle: PYTH_SOL_USD,
        userTokenAccountA: userTokenA.address,
        userTokenAccountB: userTokenB.address,
        vaultTokenAccountA: userTokenA.address, // Mock: using user account as vault for now
        vaultTokenAccountB: userTokenB.address, // Mock
        plan: null,
        userNft: null,
        buybackProgram: null,
        buybackUsdcVault: null,
        buybackState: null,
        userRebateAccount: null,
        rebateVault: rebateVaultPda,
        oracleCache: oracleCachePda,
        venueScore: venueScorePda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("✅ Swap Executed! Tx:", tx);
  } catch (e) {
    console.error("❌ Swap Failed:", e);
  }

  // 6. Verify Venue Score Update
  console.log("Verifying Venue Score...");
  try {
    const score = await program.account.venueScore.fetch(venueScorePda);
    console.log("Venue Score Stats:");
    console.log("- Total Swaps:", score.totalSwaps.toString());
    console.log("- Total Volume:", score.totalVolume.toString());
    console.log("- Avg Latency:", score.avgLatencyMs);
  } catch (e) {
    console.error("❌ Error fetching Venue Score:", e);
  }
}

main().then(
  () => process.exit(),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
