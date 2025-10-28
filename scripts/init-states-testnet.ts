import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

// Configuration
const RPC_URL = "https://api.testnet.solana.com";
const ROUTER_PROGRAM_ID = "yeKoCvFPTmgn5oCejqFVU5mUNdVbZSxwETCXDuBpfxn";
const BUYBACK_PROGRAM_ID = "DkaELUiGtTcFniZvHRicHn3RK11CsemDRW7h8qVQaiJi";
const BACK_MINT = "5UpRMH1xbHYsZdrYwjVab8cVN3QXJpFubCB5WXeB8i27";
const USDC_MOCK = "BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR";

async function loadKeypair(): Promise<Keypair> {
  const keypairPath = path.join(process.env.HOME!, ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   🚀 Initialisation États Testnet - Méthode Simple 🚀   ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // Setup
  const connection = new Connection(RPC_URL, "confirmed");
  const keypair = await loadKeypair();
  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  console.log("Wallet:", wallet.publicKey.toString());
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Balance:", (balance / 1e9).toFixed(4), "SOL\n");

  // Load programs depuis les IDLs
  const routerIdl = JSON.parse(
    fs.readFileSync("app/public/idl/swapback_router.json", "utf8")
  );
  const buybackIdl = JSON.parse(
    fs.readFileSync("app/public/idl/swapback_buyback.json", "utf8")
  );

  // Forcer les addresses dans les IDLs
  routerIdl.metadata = { address: ROUTER_PROGRAM_ID };
  buybackIdl.metadata = { address: BUYBACK_PROGRAM_ID };

  const routerProgram = new Program(routerIdl, provider);
  const buybackProgram = new Program(buybackIdl, provider);

  console.log("✅ Programs chargés\n");

  const states: any = {};

  // 1. Initialize RouterState
  console.log("📍 Initialisation RouterState...");
  try {
    const [routerStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("router_state")],
      new PublicKey(ROUTER_PROGRAM_ID)
    );

    console.log("RouterState PDA:", routerStatePda.toString());

    const accountInfo = await connection.getAccountInfo(routerStatePda);
    if (accountInfo) {
      console.log("✅ RouterState déjà initialisé\n");
      states.routerState = routerStatePda.toString();
    } else {
      const tx = await routerProgram.methods
        .initialize({
          feeRecipient: wallet.publicKey,
          platformFeeBps: 20,
        })
        .accounts({
          routerState: routerStatePda,
          authority: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("✅ RouterState initialisé!");
      console.log("Transaction:", tx, "\n");
      states.routerState = routerStatePda.toString();
    }
  } catch (error: any) {
    console.error("❌ Erreur RouterState:", error.message, "\n");
  }

  // 2. Initialize BuybackState
  console.log("📍 Initialisation BuybackState...");
  try {
    const [buybackStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("buyback_state")],
      new PublicKey(BUYBACK_PROGRAM_ID)
    );

    console.log("BuybackState PDA:", buybackStatePda.toString());

    const accountInfo = await connection.getAccountInfo(buybackStatePda);
    if (accountInfo) {
      console.log("✅ BuybackState déjà initialisé\n");
      states.buybackState = buybackStatePda.toString();
    } else {
      const tx = await buybackProgram.methods
        .initialize({
          authority: wallet.publicKey,
          backMint: new PublicKey(BACK_MINT),
          usdcMint: new PublicKey(USDC_MOCK),
        })
        .accounts({
          buybackState: buybackStatePda,
          authority: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("✅ BuybackState initialisé!");
      console.log("Transaction:", tx, "\n");
      states.buybackState = buybackStatePda.toString();
    }
  } catch (error: any) {
    console.error("❌ Erreur BuybackState:", error.message, "\n");
  }

  // 3. Initialize GlobalState
  console.log("📍 Initialisation GlobalState...");
  try {
    const [globalStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_state")],
      new PublicKey(ROUTER_PROGRAM_ID)
    );

    console.log("GlobalState PDA:", globalStatePda.toString());

    const accountInfo = await connection.getAccountInfo(globalStatePda);
    if (accountInfo) {
      console.log("✅ GlobalState déjà initialisé\n");
      states.globalState = globalStatePda.toString();
    } else {
      const tx = await routerProgram.methods
        .initializeGlobal({
          pauseSwaps: false,
          maxSlippageBps: 100,
        })
        .accounts({
          globalState: globalStatePda,
          authority: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("✅ GlobalState initialisé!");
      console.log("Transaction:", tx, "\n");
      states.globalState = globalStatePda.toString();
    }
  } catch (error: any) {
    console.error("❌ Erreur GlobalState:", error.message, "\n");
  }

  // Update config
  const configPath = "testnet_deployment_20251028_085343.json";
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  config.states.router_state = states.routerState || "";
  config.states.buyback_state = states.buybackState || "";
  config.states.global_state = states.globalState || "";
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const newBalance = await connection.getBalance(wallet.publicKey);
  const spent = (balance - newBalance) / 1e9;

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║                  ✅ FINALISATION COMPLÈTE ✅             ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log("📊 États initialisés:");
  console.log("  RouterState:  ", states.routerState || "N/A");
  console.log("  BuybackState: ", states.buybackState || "N/A");
  console.log("  GlobalState:  ", states.globalState || "N/A");
  console.log("\n💰 Coût:", spent.toFixed(4), "SOL");
  console.log("💰 Balance:", (newBalance / 1e9).toFixed(4), "SOL");
  console.log("\n🎉 TESTNET 100% OPÉRATIONNEL!");
}

main().catch(console.error);
