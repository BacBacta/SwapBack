#!/usr/bin/env node

/**
 * Crée les token vaults (ATAs) appartenant au RouterState pour chaque mint fourni.
 *
 * Usage: node scripts/init-router-vaults.js <mintA> <mintB> [...]
 */

const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");

async function main() {
  const mints = process.argv.slice(2);
  if (mints.length === 0) {
    console.error("❌ Merci de fournir au moins un mint: node scripts/init-router-vaults.js <mintA> <mintB> ...");
    process.exit(1);
  }

  const rpcUrl = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  // Try mainnet keypair first, fallback to default
  let walletPath = path.join(process.cwd(), "mainnet-deploy-keypair.json");
  if (!fs.existsSync(walletPath)) {
    walletPath = path.join(process.env.HOME || ".", ".config/solana/id.json");
  }
  const secret = JSON.parse(fs.readFileSync(walletPath, "utf8"));
  const authority = Keypair.fromSecretKey(Uint8Array.from(secret));

  const routerProgramId = new PublicKey(
    process.env.ROUTER_PROGRAM_ID ||
      process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID ||
      "FuzLkp1G7v39XXxobvr5pnGk7xZucBUroa215LrCjsAg"
  );

  const [routerState] = PublicKey.findProgramAddressSync([
    Buffer.from("router_state"),
  ], routerProgramId);

  console.log("\n🏗️  Création des vaults pour le RouterState");
  console.log(`🔑 Authority: ${authority.publicKey.toBase58()}`);
  console.log(`🧠 RouterState: ${routerState.toBase58()}`);
  console.log(`📡 RPC: ${rpcUrl}\n`);

  for (const mintStr of mints) {
    const mint = new PublicKey(mintStr);
    const ata = getAssociatedTokenAddressSync(
      mint,
      routerState,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const info = await connection.getAccountInfo(ata);
    if (info) {
      console.log(`✅ ATA existe déjà pour ${mint.toBase58()} → ${ata.toBase58()}`);
      continue;
    }

    console.log(`🆕 Création ATA pour ${mint.toBase58()} ...`);
    const ix = createAssociatedTokenAccountInstruction(
      authority.publicKey,
      ata,
      routerState,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(connection, tx, [authority]);
    console.log(`   ➜ TX: https://explorer.solana.com/tx/${sig}`);
  }

  console.log("\n🎉 Tous les vaults sont prêts!\n");
}

main().catch((err) => {
  console.error("❌ Erreur lors de la création des vaults:", err);
  process.exit(1);
});
