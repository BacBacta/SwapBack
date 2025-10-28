#!/usr/bin/env node

/**
 * Initialize SwapBack States on Testnet
 * Initializes Router, Buyback, and Global states
 */

const anchor = require("@coral-xyz/anchor");
const { PublicKey, Keypair } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

// Load configuration
const configPath = path.join(
  __dirname,
  "testnet_deployment_20251028_085343.json"
);
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const ROUTER_PROGRAM_ID = new PublicKey(config.programs.swapback_router);
const BUYBACK_PROGRAM_ID = new PublicKey(config.programs.swapback_buyback);
const BACK_MINT = new PublicKey(config.tokens.back_mint);
const USDC_MINT = new PublicKey(config.tokens.usdc_mock);

console.log(
  "╔══════════════════════════════════════════════════════════════════════════╗"
);
console.log(
  "║              🚀 Initialize SwapBack States - Testnet                     ║"
);
console.log(
  "╚══════════════════════════════════════════════════════════════════════════╝"
);
console.log("");

async function initializeStates() {
  try {
    // Setup connection
    const connection = new anchor.web3.Connection(
      "https://api.testnet.solana.com",
      "confirmed"
    );

    // Load wallet
    const walletPath = path.join(process.env.HOME, ".config/solana/id.json");
    const walletKeypair = Keypair.fromSecretKey(
      Buffer.from(JSON.parse(fs.readFileSync(walletPath, "utf8")))
    );
    const wallet = new anchor.Wallet(walletKeypair);

    console.log("📋 Configuration:");
    console.log(`   Wallet: ${wallet.publicKey.toString()}`);
    console.log(`   Router Program: ${ROUTER_PROGRAM_ID.toString()}`);
    console.log(`   Buyback Program: ${BUYBACK_PROGRAM_ID.toString()}`);
    console.log("");

    // Check balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`💰 Balance: ${(balance / 1e9).toFixed(4)} SOL`);

    if (balance < 0.5 * 1e9) {
      console.log(
        "⚠️  Warning: Low balance. You may need more SOL for initialization."
      );
    }
    console.log("");

    // Load IDLs
    const routerIdlPath = path.join(
      __dirname,
      "app/public/idl/swapback_router.json"
    );
    const buybackIdlPath = path.join(
      __dirname,
      "app/public/idl/swapback_buyback.json"
    );

    const routerIdl = JSON.parse(fs.readFileSync(routerIdlPath, "utf8"));
    const buybackIdl = JSON.parse(fs.readFileSync(buybackIdlPath, "utf8"));

    const provider = new anchor.AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });

    // Manually set program IDs since IDL metadata may be outdated
    routerIdl.metadata = { address: ROUTER_PROGRAM_ID.toString() };
    buybackIdl.metadata = { address: BUYBACK_PROGRAM_ID.toString() };

    const routerProgram = new anchor.Program(
      routerIdl,
      ROUTER_PROGRAM_ID,
      provider
    );
    const buybackProgram = new anchor.Program(
      buybackIdl,
      BUYBACK_PROGRAM_ID,
      provider
    );

    // 1. Initialize Router State
    console.log("🔄 Step 1: Initialize Router State...");
    try {
      const [routerState] = PublicKey.findProgramAddressSync(
        [Buffer.from("router_state")],
        ROUTER_PROGRAM_ID
      );

      const routerAccount = await connection.getAccountInfo(routerState);
      if (routerAccount) {
        console.log(
          `   ✅ Router State already initialized: ${routerState.toString()}`
        );
      } else {
        const tx = await routerProgram.methods
          .initialize()
          .accounts({
            authority: wallet.publicKey,
            routerState: routerState,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();

        console.log(
          `   ✅ Router State initialized: ${routerState.toString()}`
        );
        console.log(`   📝 Transaction: ${tx}`);

        // Update config
        config.states.router_state = routerState.toString();
      }
    } catch (error) {
      console.log(`   ⚠️  Router State: ${error.message}`);
    }
    console.log("");

    // 2. Initialize Buyback State
    console.log("🔄 Step 2: Initialize Buyback State...");
    try {
      const [buybackState] = PublicKey.findProgramAddressSync(
        [Buffer.from("buyback_state")],
        BUYBACK_PROGRAM_ID
      );

      const buybackAccount = await connection.getAccountInfo(buybackState);
      if (buybackAccount) {
        console.log(
          `   ✅ Buyback State already initialized: ${buybackState.toString()}`
        );
      } else {
        const tx = await buybackProgram.methods
          .initialize()
          .accounts({
            authority: wallet.publicKey,
            buybackState: buybackState,
            backMint: BACK_MINT,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();

        console.log(
          `   ✅ Buyback State initialized: ${buybackState.toString()}`
        );
        console.log(`   📝 Transaction: ${tx}`);

        // Update config
        config.states.buyback_state = buybackState.toString();
      }
    } catch (error) {
      console.log(`   ⚠️  Buyback State: ${error.message}`);
    }
    console.log("");

    // 3. Initialize Global State
    console.log("🔄 Step 3: Initialize Global State...");
    try {
      const [globalState] = PublicKey.findProgramAddressSync(
        [Buffer.from("global_state")],
        ROUTER_PROGRAM_ID
      );

      const globalAccount = await connection.getAccountInfo(globalState);
      if (globalAccount) {
        console.log(
          `   ✅ Global State already initialized: ${globalState.toString()}`
        );
      } else {
        const tx = await routerProgram.methods
          .initializeGlobalState()
          .accounts({
            authority: wallet.publicKey,
            globalState: globalState,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();

        console.log(
          `   ✅ Global State initialized: ${globalState.toString()}`
        );
        console.log(`   📝 Transaction: ${tx}`);

        // Update config
        config.states.global_state = globalState.toString();
      }
    } catch (error) {
      console.log(`   ⚠️  Global State: ${error.message}`);
    }
    console.log("");

    // Save updated config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log("💾 Configuration updated and saved!");
    console.log("");

    // Final status
    console.log(
      "╔══════════════════════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║                    ✅ INITIALIZATION COMPLETE                            ║"
    );
    console.log(
      "╚══════════════════════════════════════════════════════════════════════════╝"
    );
    console.log("");
    console.log("📊 Initialized States:");
    console.log(
      `   Router State:   ${config.states.router_state || "Pending"}`
    );
    console.log(
      `   Buyback State:  ${config.states.buyback_state || "Pending"}`
    );
    console.log(
      `   Global State:   ${config.states.global_state || "Pending"}`
    );
    console.log(`   Collection:     ${config.states.collection_config}`);
    console.log(`   Merkle Tree:    ${config.merkle_tree}`);
    console.log("");

    const finalBalance = await connection.getBalance(wallet.publicKey);
    const costSOL = (balance - finalBalance) / 1e9;
    console.log(`💰 Cost: ${costSOL.toFixed(6)} SOL`);
    console.log(`💰 Remaining Balance: ${(finalBalance / 1e9).toFixed(4)} SOL`);
    console.log("");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

initializeStates();
