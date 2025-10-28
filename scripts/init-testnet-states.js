#!/usr/bin/env node

/**
 * Initialize SwapBack States on Testnet
 * Simplified version based on working devnet approach
 */

const anchor = require("@coral-xyz/anchor");
const { PublicKey, Keypair, SystemProgram } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");

// Load configuration
const configPath = path.join(
  __dirname,
  "..",
  "testnet_deployment_20251028_085343.json"
);
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const ROUTER_PROGRAM_ID = new PublicKey(config.programs.swapback_router);
const BUYBACK_PROGRAM_ID = new PublicKey(config.programs.swapback_buyback);
const CNFT_PROGRAM_ID = new PublicKey(config.programs.swapback_cnft);
const BACK_MINT = new PublicKey(config.tokens.back_mint);
const USDC_MINT = new PublicKey(config.tokens.usdc_mock);

console.log(
  "\n╔══════════════════════════════════════════════════════════════════════════╗"
);
console.log(
  "║              🚀 Initialize SwapBack States - Testnet                     ║"
);
console.log(
  "╚══════════════════════════════════════════════════════════════════════════╝\n"
);

async function loadProgram(programId, idlFileName, provider) {
  const idlPath = path.join(
    __dirname,
    "..",
    "app",
    "public",
    "idl",
    idlFileName
  );
  let idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));

  // Ensure metadata has valid address
  if (!idl.metadata) {
    idl.metadata = {};
  }
  idl.metadata.address = programId.toString();

  return new anchor.Program(idl, provider);
}

async function initializeStates() {
  try {
    // Setup connection
    const connection = new anchor.web3.Connection(config.rpc_url, "confirmed");

    // Load wallet
    const walletPath = path.join(process.env.HOME, ".config/solana/id.json");
    const walletKeypair = Keypair.fromSecretKey(
      Buffer.from(JSON.parse(fs.readFileSync(walletPath, "utf8")))
    );
    const wallet = new anchor.Wallet(walletKeypair);

    console.log("📋 Configuration:");
    console.log(`   Wallet:         ${wallet.publicKey.toString()}`);
    console.log(`   Router:         ${ROUTER_PROGRAM_ID.toString()}`);
    console.log(`   Buyback:        ${BUYBACK_PROGRAM_ID.toString()}`);
    console.log(`   CNFT:           ${CNFT_PROGRAM_ID.toString()}`);
    console.log(`   BACK Mint:      ${BACK_MINT.toString()}`);
    console.log(`   USDC Mock:      ${USDC_MINT.toString()}\n`);

    // Check balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`💰 Balance: ${(balance / 1e9).toFixed(4)} SOL\n`);

    if (balance < 0.02 * 1e9) {
      throw new Error(
        "Insufficient balance. Need at least 0.02 SOL for initialization."
      );
    }

    // Create provider
    const provider = new anchor.AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });

    // Load programs
    console.log("📦 Loading programs...");
    const routerProgram = await loadProgram(
      ROUTER_PROGRAM_ID,
      "swapback_router.json",
      provider
    );
    const buybackProgram = await loadProgram(
      BUYBACK_PROGRAM_ID,
      "swapback_buyback.json",
      provider
    );
    console.log("   ✅ Programs loaded\n");

    let statesInitialized = 0;
    let totalCost = 0;

    // 1. Initialize Router State
    console.log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );
    console.log("🔄 Step 1/3: Initialize Router State");
    console.log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
    );

    try {
      const [routerState] = PublicKey.findProgramAddressSync(
        [Buffer.from("router_state")],
        ROUTER_PROGRAM_ID
      );

      const routerAccount = await connection.getAccountInfo(routerState);
      if (routerAccount) {
        console.log(`   ℹ️  Router State already initialized`);
        console.log(`   📍 Address: ${routerState.toString()}\n`);
        config.states.router_state = routerState.toString();
      } else {
        console.log(`   📍 PDA Address: ${routerState.toString()}`);
        console.log(`   🔨 Calling initialize()...`);

        const balanceBefore = await connection.getBalance(wallet.publicKey);

        const tx = await routerProgram.methods
          .initialize()
          .accounts({
            authority: wallet.publicKey,
            routerState: routerState,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        const balanceAfter = await connection.getBalance(wallet.publicKey);
        const cost = (balanceBefore - balanceAfter) / 1e9;
        totalCost += cost;

        console.log(`   ✅ Router State initialized!`);
        console.log(`   📝 Transaction: ${tx}`);
        console.log(`   💰 Cost: ${cost.toFixed(6)} SOL\n`);

        config.states.router_state = routerState.toString();
        statesInitialized++;
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }

    // 2. Initialize Buyback State
    console.log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );
    console.log("🔄 Step 2/3: Initialize Buyback State");
    console.log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
    );

    try {
      const [buybackState] = PublicKey.findProgramAddressSync(
        [Buffer.from("buyback_state")],
        BUYBACK_PROGRAM_ID
      );

      const buybackAccount = await connection.getAccountInfo(buybackState);
      if (buybackAccount) {
        console.log(`   ℹ️  Buyback State already initialized`);
        console.log(`   📍 Address: ${buybackState.toString()}\n`);
        config.states.buyback_state = buybackState.toString();
      } else {
        console.log(`   📍 PDA Address: ${buybackState.toString()}`);
        console.log(`   🔨 Calling initialize()...`);

        const balanceBefore = await connection.getBalance(wallet.publicKey);

        const tx = await buybackProgram.methods
          .initialize()
          .accounts({
            authority: wallet.publicKey,
            buybackState: buybackState,
            backMint: BACK_MINT,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        const balanceAfter = await connection.getBalance(wallet.publicKey);
        const cost = (balanceBefore - balanceAfter) / 1e9;
        totalCost += cost;

        console.log(`   ✅ Buyback State initialized!`);
        console.log(`   📝 Transaction: ${tx}`);
        console.log(`   💰 Cost: ${cost.toFixed(6)} SOL\n`);

        config.states.buyback_state = buybackState.toString();
        statesInitialized++;
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }

    // 3. Initialize Global State
    console.log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );
    console.log("🔄 Step 3/3: Initialize Global State");
    console.log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
    );

    try {
      const [globalState] = PublicKey.findProgramAddressSync(
        [Buffer.from("global_state")],
        ROUTER_PROGRAM_ID
      );

      const globalAccount = await connection.getAccountInfo(globalState);
      if (globalAccount) {
        console.log(`   ℹ️  Global State already initialized`);
        console.log(`   📍 Address: ${globalState.toString()}\n`);
        config.states.global_state = globalState.toString();
      } else {
        console.log(`   📍 PDA Address: ${globalState.toString()}`);
        console.log(`   🔨 Calling initializeGlobalState()...`);

        const balanceBefore = await connection.getBalance(wallet.publicKey);

        const tx = await routerProgram.methods
          .initializeGlobalState()
          .accounts({
            authority: wallet.publicKey,
            globalState: globalState,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        const balanceAfter = await connection.getBalance(wallet.publicKey);
        const cost = (balanceBefore - balanceAfter) / 1e9;
        totalCost += cost;

        console.log(`   ✅ Global State initialized!`);
        console.log(`   📝 Transaction: ${tx}`);
        console.log(`   💰 Cost: ${cost.toFixed(6)} SOL\n`);

        config.states.global_state = globalState.toString();
        statesInitialized++;
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }

    // Save updated config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log("💾 Configuration updated and saved!\n");

    // Final status
    console.log(
      "╔══════════════════════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║                    ✅ INITIALIZATION COMPLETE                            ║"
    );
    console.log(
      "╚══════════════════════════════════════════════════════════════════════════╝\n"
    );

    console.log("📊 Initialized States:");
    console.log(
      `   Router State:   ${config.states.router_state || "❌ Not initialized"}`
    );
    console.log(
      `   Buyback State:  ${config.states.buyback_state || "❌ Not initialized"}`
    );
    console.log(
      `   Global State:   ${config.states.global_state || "❌ Not initialized"}`
    );
    console.log(`   Collection:     ${config.states.collection_config}`);
    console.log(`   Merkle Tree:    ${config.merkle_tree}\n`);

    const finalBalance = await connection.getBalance(wallet.publicKey);
    console.log(`💰 States initialized: ${statesInitialized}/3`);
    console.log(`💰 Total cost: ${totalCost.toFixed(6)} SOL`);
    console.log(
      `💰 Remaining balance: ${(finalBalance / 1e9).toFixed(4)} SOL\n`
    );

    if (statesInitialized === 3) {
      console.log("🎉 TESTNET 100% DÉPLOYÉ! 🎉\n");
      console.log("Next steps:");
      console.log("  1. Run tests: npm test");
      console.log("  2. Start UAT: See PHASE_11_UAT_GUIDE.md");
      console.log("  3. Recruit beta testers\n");
    } else {
      console.log(
        `⚠️  Warning: Only ${statesInitialized}/3 states initialized\n`
      );
    }
  } catch (error) {
    console.error("\n❌ Fatal Error:", error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run
initializeStates()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Unhandled Error:", error);
    process.exit(1);
  });
