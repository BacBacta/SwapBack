/**
 * Script d'initialisation des programmes SwapBack sur Devnet
 *
 * Ce script:
 * 1. Crée les tokens de test ($BACK et USDC)
 * 2. Initialise le programme swapback_buyback
 * 3. Initialise le programme swapback_cnft (si nécessaire)
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, web3, BN } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import fs from "fs";
import path from "path";

// Configuration
const DEVNET_RPC = "https://api.devnet.solana.com";
const BUYBACK_PROGRAM_ID = new PublicKey(
  "71vALqj3cmQWDmq9bi9GYYDPQqpoRstej3snUbikpCHW"
);
const CNFT_PROGRAM_ID = new PublicKey(
  "HAtZ7hJt2YFZSYnAaVwRg3jGTAbr8u6nze3KkSHfwFrf"
);

async function main() {
  console.log("🚀 Initialisation des programmes SwapBack sur Devnet\n");

  // Setup connection et wallet
  const connection = new Connection(DEVNET_RPC, "confirmed");

  // Charger le wallet depuis ~/.config/solana/id.json
  const walletPath = path.join(
    process.env.HOME || "",
    ".config",
    "solana",
    "id.json"
  );
  const walletKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  console.log("📍 Wallet:", wallet.publicKey.toBase58());
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("💰 Balance:", balance / web3.LAMPORTS_PER_SOL, "SOL\n");

  // Vérifier si on a assez de SOL
  if (balance < 0.5 * web3.LAMPORTS_PER_SOL) {
    console.log("⚠️  Solde faible, demande d'airdrop...");
    const signature = await connection.requestAirdrop(
      wallet.publicKey,
      1 * web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(signature);
    console.log("✅ Airdrop de 1 SOL reçu\n");
  }

  // === ÉTAPE 1: Créer ou récupérer les tokens de test ===
  console.log("📝 Étape 1: Tokens de test\n");

  let backMint: PublicKey;
  let usdcMint: PublicKey;

  // Vérifier si les mints existent déjà (fichier de cache)
  const cacheFile = path.join(__dirname, ".devnet-tokens.json");

  if (fs.existsSync(cacheFile)) {
    const cache = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
    backMint = new PublicKey(cache.backMint);
    usdcMint = new PublicKey(cache.usdcMint);
    console.log("✅ Tokens récupérés depuis le cache:");
    console.log("   $BACK Mint:", backMint.toBase58());
    console.log("   USDC Mint:", usdcMint.toBase58());
  } else {
    console.log("🔨 Création de nouveaux tokens de test...");

    // Créer le token $BACK (9 decimals)
    backMint = await createMint(
      connection,
      walletKeypair,
      walletKeypair.publicKey, // mint authority
      walletKeypair.publicKey, // freeze authority
      9 // decimals
    );
    console.log("✅ Token $BACK créé:", backMint.toBase58());

    // Créer le token USDC (6 decimals)
    usdcMint = await createMint(
      connection,
      walletKeypair,
      walletKeypair.publicKey,
      walletKeypair.publicKey,
      6
    );
    console.log("✅ Token USDC créé:", usdcMint.toBase58());

    // Sauvegarder dans le cache
    fs.writeFileSync(
      cacheFile,
      JSON.stringify(
        {
          backMint: backMint.toBase58(),
          usdcMint: usdcMint.toBase58(),
        },
        null,
        2
      )
    );
    console.log("💾 Tokens sauvegardés dans", cacheFile);
  }

  console.log();

  // Créer des token accounts pour le wallet et mint des tokens de test
  console.log("🪙 Création des token accounts et mint de tokens de test...");

  const backTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    walletKeypair,
    backMint,
    walletKeypair.publicKey
  );

  const usdcTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    walletKeypair,
    usdcMint,
    walletKeypair.publicKey
  );

  // Vérifier les balances et mint si nécessaire
  const backBalance = (await getAccount(connection, backTokenAccount.address))
    .amount;
  const usdcBalance = (await getAccount(connection, usdcTokenAccount.address))
    .amount;

  if (backBalance === 0n) {
    // Mint 1 million $BACK
    await mintTo(
      connection,
      walletKeypair,
      backMint,
      backTokenAccount.address,
      walletKeypair.publicKey,
      1_000_000 * 10 ** 9 // 1M tokens avec 9 decimals
    );
    console.log("✅ Minté 1,000,000 $BACK");
  } else {
    console.log(`✅ Balance $BACK: ${Number(backBalance) / 10 ** 9}`);
  }

  if (usdcBalance === 0n) {
    // Mint 10,000 USDC
    await mintTo(
      connection,
      walletKeypair,
      usdcMint,
      usdcTokenAccount.address,
      walletKeypair.publicKey,
      10_000 * 10 ** 6 // 10K tokens avec 6 decimals
    );
    console.log("✅ Minté 10,000 USDC");
  } else {
    console.log(`✅ Balance USDC: ${Number(usdcBalance) / 10 ** 6}`);
  }

  console.log();

  // === ÉTAPE 2: Initialiser swapback_buyback ===
  console.log("📝 Étape 2: Initialisation swapback_buyback\n");

  try {
    // Charger l'IDL
    const idlPath = path.join(
      __dirname,
      "..",
      "target",
      "idl",
      "swapback_buyback.json"
    );
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

    const program = new Program(idl, BUYBACK_PROGRAM_ID, provider);

    // Dériver les PDAs
    const [buybackState] = PublicKey.findProgramAddressSync(
      [Buffer.from("buyback_state")],
      BUYBACK_PROGRAM_ID
    );

    const [usdcVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("usdc_vault")],
      BUYBACK_PROGRAM_ID
    );

    console.log("   Buyback State PDA:", buybackState.toBase58());
    console.log("   USDC Vault PDA:", usdcVault.toBase58());

    // Vérifier si déjà initialisé
    try {
      const stateAccount =
        await program.account.buybackState.fetch(buybackState);
      console.log("\n✅ Programme déjà initialisé!");
      console.log("   Authority:", stateAccount.authority.toBase58());
      console.log("   BACK Mint:", stateAccount.backMint.toBase58());
      console.log(
        "   Total USDC dépensé:",
        stateAccount.totalUsdcSpent.toString()
      );
      console.log(
        "   Total BACK brûlé:",
        stateAccount.totalBackBurned.toString()
      );
    } catch (e) {
      // Pas encore initialisé, on continue
      console.log("🔨 Initialisation du programme buyback...");

      const minBuybackAmount = new BN(100 * 10 ** 6); // 100 USDC minimum

      const tx = await program.methods
        .initialize(minBuybackAmount)
        .accounts({
          buybackState: buybackState,
          backMint: backMint,
          usdcVault: usdcVault,
          usdcMint: usdcMint,
          authority: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      console.log("✅ Programme buyback initialisé!");
      console.log("   Transaction:", tx);
      console.log("   Explorer:", `https://solscan.io/tx/${tx}?cluster=devnet`);
    }
  } catch (error) {
    console.error("❌ Erreur lors de l'initialisation buyback:", error);
    if (error.logs) {
      console.error("Logs:", error.logs);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Initialisation terminée!\n");
  console.log("📊 Résumé:");
  console.log("   • Token $BACK:", backMint.toBase58());
  console.log("   • Token USDC:", usdcMint.toBase58());
  console.log("   • Programme Buyback:", BUYBACK_PROGRAM_ID.toBase58());
  console.log("   • Programme cNFT:", CNFT_PROGRAM_ID.toBase58());
  console.log("\n🎯 Prochaines étapes:");
  console.log("   1. Mettre à jour les token mints dans le frontend");
  console.log("   2. Tester un dépôt USDC");
  console.log("   3. Tester un buyback");
  console.log("   4. Tester le burn de $BACK");
  console.log("=".repeat(60) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
