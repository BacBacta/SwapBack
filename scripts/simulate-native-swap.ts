#!/usr/bin/env npx tsx
/**
 * Simulate True Native Swap (Mainnet)
 *
 * Objectif:
 * - Valider venue par venue que `swap_toc` + `directDexVenue` passe en `simulateTransaction`.
 * - Ne dépend pas de Jupiter.
 *
 * Exemples:
 *   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com \
 *   SOLANA_KEYPAIR=/workspaces/SwapBack/mainnet-deploy-keypair.json \
 *   npx tsx scripts/simulate-native-swap.ts --venue=RAYDIUM_AMM
 *
 *   # Saber SOL->mSOL (ne nécessite que SOL)
 *   npx tsx scripts/simulate-native-swap.ts --venue=SABER --inputMint=So11111111111111111111111111111111111111112 --outputMint=mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So
 */

import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import fs from "fs";

import TrueNativeSwap, {
  DEX_PROGRAM_IDS,
  SOL_MINT,
  USDC_MINT,
} from "../app/src/lib/native-router/true-native-swap";
import {
  getDEXAccounts,
  type SupportedVenue,
} from "../app/src/lib/native-router/dex/DEXAccountResolvers";

function loadKeypair(path: string): Keypair {
  const raw = JSON.parse(fs.readFileSync(path, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const [k, v] = raw.slice(2).split("=", 2);
    if (!k) continue;
    out[k] = v ?? "true";
  }
  return out;
}

async function ensureAta(
  connection: Connection,
  payer: PublicKey,
  mint: PublicKey
): Promise<{ ata: PublicKey; ix?: ReturnType<typeof createAssociatedTokenAccountInstruction> }> {
  const ata = await getAssociatedTokenAddress(mint, payer);
  const info = await connection.getAccountInfo(ata);
  if (info) return { ata };

  return {
    ata,
    ix: createAssociatedTokenAccountInstruction(payer, ata, payer, mint),
  };
}

async function ensureWsolFunding(
  connection: Connection,
  payer: PublicKey,
  amountLamports: number
): Promise<{
  ata: PublicKey;
  ixs: Array<
    | ReturnType<typeof SystemProgram.transfer>
    | ReturnType<typeof createAssociatedTokenAccountInstruction>
    | ReturnType<typeof createSyncNativeInstruction>
  >;
}> {
  const ixs: Array<any> = [];
  const { ata, ix } = await ensureAta(connection, payer, SOL_MINT);
  if (ix) ixs.push(ix);

  let current = 0;
  try {
    const bal = await connection.getTokenAccountBalance(ata);
    current = Number(bal.value.amount);
  } catch {
    current = 0;
  }

  const deficit = Math.max(0, amountLamports - current);
  if (deficit > 0) {
    ixs.push(
      SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: ata,
        lamports: deficit,
      })
    );
    ixs.push(createSyncNativeInstruction(ata));
  }

  return { ata, ixs };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const venue = (args.venue ?? "RAYDIUM_AMM") as SupportedVenue;
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const keypairPath = process.env.SOLANA_KEYPAIR || "/workspaces/SwapBack/mainnet-deploy-keypair.json";

  const inputMint = new PublicKey(args.inputMint ?? SOL_MINT.toBase58());
  const outputMint = new PublicKey(args.outputMint ?? USDC_MINT.toBase58());

  const amountInLamports = Number(args.amountIn ?? 1_000_000); // default 0.001 SOL (si SOL)
  const minOut = Number(args.minOut ?? 1);
  const slippageBps = Number(args.slippageBps ?? 50);

  const connection = new Connection(rpcUrl, "confirmed");
  const user = loadKeypair(keypairPath);

  console.log("RPC:", rpcUrl);
  console.log("User:", user.publicKey.toBase58());
  console.log("Venue:", venue);
  console.log("InputMint:", inputMint.toBase58());
  console.log("OutputMint:", outputMint.toBase58());

  const dex = await getDEXAccounts(connection, venue, inputMint, outputMint, user.publicKey);
  if (!dex) {
    throw new Error(`DEX resolver returned null for venue=${venue}`);
  }
  console.log("DEX slice length:", dex.accounts.length);

  const forcedRoute = {
    venue,
    venueProgramId: DEX_PROGRAM_IDS[venue] ?? new PublicKey(args.venueProgramId ?? PublicKey.default.toBase58()),
    inputAmount: amountInLamports,
    outputAmount: 0,
    priceImpactBps: 0,
    platformFeeBps: 0,
    dexAccounts: dex,
    allQuotes: [],
  };

  const swapper = new TrueNativeSwap(connection);

  const instructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
  ];

  // Input prep
  if (inputMint.equals(SOL_MINT)) {
    const wsol = await ensureWsolFunding(connection, user.publicKey, amountInLamports);
    instructions.push(...wsol.ixs);
  } else {
    // ensure input ATA exists (cannot auto-fund)
    const inAta = await ensureAta(connection, user.publicKey, inputMint);
    if (inAta.ix) instructions.push(inAta.ix);
  }

  // Output ATA
  const outAta = await ensureAta(connection, user.publicKey, outputMint);
  if (outAta.ix) instructions.push(outAta.ix);

  // Plan
  const [planPda] = swapper.deriveSwapPlanAddress(user.publicKey);
  const planInfo = await connection.getAccountInfo(planPda);
  if (!planInfo) {
    const expiresAt = Math.floor(Date.now() / 1000) + 120;
    instructions.push(
      await swapper.buildCreatePlanInstruction(user.publicKey, {
        inputMint,
        outputMint,
        amountIn: amountInLamports,
        minOut,
        venue,
        expiresAt,
      })
    );
    console.log("Plan created in tx:", planPda.toBase58());
  } else {
    console.log("Plan exists:", planPda.toBase58());
  }

  // Swap
  const swapIx = await swapper.buildNativeSwapInstruction(user.publicKey, forcedRoute as any, {
    inputMint,
    outputMint,
    amountIn: amountInLamports,
    minAmountOut: minOut,
    slippageBps,
    userPublicKey: user.publicKey,
  });
  instructions.push(swapIx);

  // Debug (Lifinity): vérifier si `configAccount` est bien writable dans l'instruction outer (SwapToc).
  if (venue === "LIFINITY") {
    const configPk = dex.accounts[12];
    const meta = swapIx.keys.find((k) => k.pubkey.equals(configPk));
    console.log("[debug] Lifinity configAccount:", configPk.toBase58());
    console.log("[debug] Lifinity configAccount meta in swapIx:", meta ?? null);
    console.log("[debug] Lifinity slice (first 13) metas:");
    for (let i = 0; i < 13; i++) {
      const pk = dex.accounts[i];
      const m = swapIx.keys.find((k) => k.pubkey.equals(pk));
      console.log(`  [${i}] ${pk.toBase58()} writable=${m?.isWritable ?? "?"} signer=${m?.isSigner ?? "?"}`);
    }
  }

  const { blockhash } = await connection.getLatestBlockhash();
  const msg = new TransactionMessage({
    payerKey: user.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const tx = new VersionedTransaction(msg);
  tx.sign([user]);

  const sim = await connection.simulateTransaction(tx, {
    sigVerify: false,
    replaceRecentBlockhash: true,
  });

  console.log("Simulation err:", sim.value.err);
  console.log("Units:", sim.value.unitsConsumed);
  if (sim.value.logs) {
    const head = 400;
    console.log(`--- logs (first ${head}) ---`);
    for (const line of sim.value.logs.slice(0, head)) {
      console.log(line);
    }
    if (sim.value.logs.length > head) {
      console.log(`... (${sim.value.logs.length - head} more)`);
    }

    const lifinityLines = sim.value.logs.filter((l) => l.includes("Lifinity:"));
    if (lifinityLines.length > 0) {
      console.log("--- logs (Lifinity:) ---");
      for (const line of lifinityLines) {
        console.log(line);
      }
    }
  }

  if (sim.value.err) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
