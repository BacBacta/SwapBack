#!/usr/bin/env node

/**
 * Initialize the rebate vault PDA (USDC) controlled by the router state.
 *
 * Usage: node scripts/init-rebate-vault.js [--program <router_program_id>] [--mint <usdc_mint>]
 */

const anchor = require("@coral-xyz/anchor");
const { Connection, Keypair, PublicKey, SystemProgram } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n🚀 Initialisation du rebate vault USDC\n");

  const args = process.argv.slice(2);
  const programArgIndex = args.indexOf("--program");
  const mintArgIndex = args.indexOf("--mint");

  const routerProgramId = new PublicKey(
    (programArgIndex !== -1 && args[programArgIndex + 1]) ||
      process.env.ROUTER_PROGRAM_ID ||
      process.env.NEXT_PUBLIC_ROUTER_PROGRAM_ID ||
        "9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh"
  );

  const usdcMint = new PublicKey(
    (mintArgIndex !== -1 && args[mintArgIndex + 1]) ||
      process.env.USDC_MINT ||
      process.env.NEXT_PUBLIC_USDC_MINT ||
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  );

  const rpcUrl = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  const walletPath = path.join(process.env.HOME || ".", ".config/solana/id.json");
  const secret = JSON.parse(fs.readFileSync(walletPath, "utf8"));
  const authority = Keypair.fromSecretKey(Uint8Array.from(secret));

  console.log(`🔑 Authority: ${authority.publicKey.toBase58()}`);
  console.log(`📡 RPC: ${rpcUrl}`);
  console.log(`🏦 Router Program: ${routerProgramId.toBase58()}`);
  console.log(`💵 USDC Mint: ${usdcMint.toBase58()}\n`);

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(authority),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  const idlPath = path.join(__dirname, "../target/idl/swapback_router.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
  const program = new anchor.Program(idl, routerProgramId, provider);

  const [routerState] = PublicKey.findProgramAddressSync([
    Buffer.from("router_state"),
  ], routerProgramId);

  const [rebateVault] = PublicKey.findProgramAddressSync([
    Buffer.from("rebate_vault"),
    routerState.toBuffer(),
  ], routerProgramId);

  console.log(`🧠 RouterState PDA: ${routerState.toBase58()}`);
  console.log(`🏛️  Rebate vault PDA: ${rebateVault.toBase58()}`);

  const tx = await program.methods
    .initializeRebateVault()
    .accounts({
      state: routerState,
      rebateVault,
      usdcMint,
      authority: authority.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  console.log("\n✅ Rebate vault initialisé!");
  console.log(`   Transaction: ${tx}`);
  console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);
}

main().catch((err) => {
  console.error("❌ Erreur lors de l'initialisation du rebate vault:", err);
  process.exit(1);
});
