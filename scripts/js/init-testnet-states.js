#!/usr/bin/env node

/**
 * Script d'initialisation des états pour le testnet SwapBack
 * Initialise RouterState, BuybackState, et GlobalState
 */

const { Connection, PublicKey, Keypair } = require("@solana/web3.js");
const { Program, AnchorProvider, Wallet, web3 } = require("@coral-xyz/anchor");
const fs = require("fs");
const path = require("path");

// Configuration
const CONFIG = {
  network: "testnet",
  rpcUrl: "https://api.testnet.solana.com",
  programs: {
    router: "GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt",
    buyback: "EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf",
  },
  tokens: {
    backMint: "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux",
    usdcMock: "BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR",
  },
};

async function loadKeypair() {
  const keypairPath = path.join(process.env.HOME, ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

async function loadIDL(programName) {
  const idlPath = path.join(
    __dirname,
    "app/public/idl",
    `swapback_${programName}.json`
  );
  return JSON.parse(fs.readFileSync(idlPath, "utf8"));
}

async function initializeRouterState(provider, routerProgram) {
  console.log("\n📍 Initialisation de RouterState...");

  try {
    const [routerStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("router_state")],
      new PublicKey(CONFIG.programs.router)
    );

    console.log("RouterState PDA:", routerStatePda.toString());

    // Vérifier si déjà initialisé
    try {
      const accountInfo =
        await provider.connection.getAccountInfo(routerStatePda);
      if (accountInfo) {
        console.log("✅ RouterState déjà initialisé");
        return routerStatePda;
      }
    } catch (e) {
      // Pas encore initialisé, on continue
    }

    const tx = await routerProgram.methods
      .initialize({
        feeRecipient: provider.wallet.publicKey,
        platformFeeBps: 20, // 0.20%
      })
      .accounts({
        routerState: routerStatePda,
        authority: provider.wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    console.log("✅ RouterState initialisé!");
    console.log("Transaction:", tx);
    return routerStatePda;
  } catch (error) {
    console.error("❌ Erreur RouterState:", error.message);
    throw error;
  }
}

async function initializeBuybackState(provider, buybackProgram) {
  console.log("\n📍 Initialisation de BuybackState...");

  try {
    const [buybackStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("buyback_state")],
      new PublicKey(CONFIG.programs.buyback)
    );

    console.log("BuybackState PDA:", buybackStatePda.toString());

    // Vérifier si déjà initialisé
    try {
      const accountInfo =
        await provider.connection.getAccountInfo(buybackStatePda);
      if (accountInfo) {
        console.log("✅ BuybackState déjà initialisé");
        return buybackStatePda;
      }
    } catch (e) {
      // Pas encore initialisé, on continue
    }

    const tx = await buybackProgram.methods
      .initialize({
        authority: provider.wallet.publicKey,
        backMint: new PublicKey(CONFIG.tokens.backMint),
        usdcMint: new PublicKey(CONFIG.tokens.usdcMock),
      })
      .accounts({
        buybackState: buybackStatePda,
        authority: provider.wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    console.log("✅ BuybackState initialisé!");
    console.log("Transaction:", tx);
    return buybackStatePda;
  } catch (error) {
    console.error("❌ Erreur BuybackState:", error.message);
    throw error;
  }
}

async function initializeGlobalState(provider, routerProgram) {
  console.log("\n📍 Initialisation de GlobalState...");

  try {
    const [globalStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_state")],
      new PublicKey(CONFIG.programs.router)
    );

    console.log("GlobalState PDA:", globalStatePda.toString());

    // Vérifier si déjà initialisé
    try {
      const accountInfo =
        await provider.connection.getAccountInfo(globalStatePda);
      if (accountInfo) {
        console.log("✅ GlobalState déjà initialisé");
        return globalStatePda;
      }
    } catch (e) {
      // Pas encore initialisé, on continue
    }

    const tx = await routerProgram.methods
      .initializeGlobal({
        pauseSwaps: false,
        maxSlippageBps: 100, // 1%
      })
      .accounts({
        globalState: globalStatePda,
        authority: provider.wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    console.log("✅ GlobalState initialisé!");
    console.log("Transaction:", tx);
    return globalStatePda;
  } catch (error) {
    console.error("❌ Erreur GlobalState:", error.message);
    throw error;
  }
}

async function updateConfigFile(states) {
  const configPath = path.join(
    __dirname,
    "testnet_deployment_20251028_085343.json"
  );
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

  config.states.router_state = states.routerState?.toString() || "";
  config.states.buyback_state = states.buybackState?.toString() || "";
  config.states.global_state = states.globalState?.toString() || "";

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log("\n✅ Configuration mise à jour:", configPath);
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   🚀 Initialisation des États - Testnet SwapBack 🚀     ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  try {
    // Setup connection
    const connection = new Connection(CONFIG.rpcUrl, "confirmed");
    const keypair = await loadKeypair();
    const wallet = new Wallet(keypair);
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });

    console.log("Wallet:", wallet.publicKey.toString());

    const balance = await connection.getBalance(wallet.publicKey);
    console.log("Balance:", (balance / 1e9).toFixed(4), "SOL\n");

    if (balance < 0.01 * 1e9) {
      throw new Error("Balance insuffisante (min 0.01 SOL requis)");
    }

    // Load IDLs et créer les programs
    console.log("Chargement des IDLs...");
    const routerIdl = await loadIDL("router");
    const buybackIdl = await loadIDL("buyback");

    const routerProgram = new Program(
      routerIdl,
      new PublicKey(CONFIG.programs.router),
      provider
    );

    const buybackProgram = new Program(
      buybackIdl,
      new PublicKey(CONFIG.programs.buyback),
      provider
    );

    console.log("✅ IDLs chargés\n");

    // Initialiser les états
    const states = {};

    // 1. RouterState
    states.routerState = await initializeRouterState(provider, routerProgram);

    // 2. BuybackState
    states.buybackState = await initializeBuybackState(
      provider,
      buybackProgram
    );

    // 3. GlobalState
    states.globalState = await initializeGlobalState(provider, routerProgram);

    // Mettre à jour le fichier de configuration
    await updateConfigFile(states);

    // Vérifier le nouveau balance
    const newBalance = await connection.getBalance(wallet.publicKey);
    const spent = (balance - newBalance) / 1e9;

    console.log(
      "\n╔══════════════════════════════════════════════════════════╗"
    );
    console.log("║                  ✅ SUCCÈS COMPLET ✅                    ║");
    console.log(
      "╚══════════════════════════════════════════════════════════╝\n"
    );

    console.log("📊 Résumé:");
    console.log("  RouterState:  ", states.routerState?.toString() || "N/A");
    console.log("  BuybackState: ", states.buybackState?.toString() || "N/A");
    console.log("  GlobalState:  ", states.globalState?.toString() || "N/A");
    console.log("\n💰 Coût:", spent.toFixed(4), "SOL");
    console.log("💰 Balance restant:", (newBalance / 1e9).toFixed(4), "SOL");

    console.log("\n🎉 Testnet finalisé à 100%!");
    console.log("🚀 Prêt pour les tests UAT!");
  } catch (error) {
    console.error("\n❌ Erreur fatale:", error);
    process.exit(1);
  }
}

main();
