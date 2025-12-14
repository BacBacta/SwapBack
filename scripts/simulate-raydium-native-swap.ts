#!/usr/bin/env npx tsx
/**
 * Simulate Raydium True Native Swap (Mainnet)
 *
 * Objectif: valider que le swap natif via `swap_toc` + `direct_dex_venue=RAYDIUM_AMM`
 * passe en simulation avec la slice de comptes Raydium (incluant OpenBook/Serum).
 *
 * Usage:
 *   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com \
 *   SOLANA_KEYPAIR=/workspaces/SwapBack/mainnet-deploy-keypair.json \
 *   npx tsx scripts/simulate-raydium-native-swap.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import fs from "fs";

import TrueNativeSwap, {
  DEX_PROGRAM_IDS,
  ROUTER_PROGRAM_ID,
  SOL_MINT,
  USDC_MINT,
} from "../app/src/lib/native-router/true-native-swap";
import { getRaydiumAccounts } from "../app/src/lib/native-router/dex/DEXAccountResolvers";

function loadKeypair(path: string): Keypair {
  const raw = JSON.parse(fs.readFileSync(path, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
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
): Promise<{ ata: PublicKey; ixs: Array<ReturnType<typeof SystemProgram.transfer> | ReturnType<typeof createAssociatedTokenAccountInstruction> | ReturnType<typeof createSyncNativeInstruction>> }> {
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
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const keypairPath =
    process.env.SOLANA_KEYPAIR || "/workspaces/SwapBack/mainnet-deploy-keypair.json";

  const connection = new Connection(rpcUrl, "confirmed");
  const user = loadKeypair(keypairPath);

  const amountInLamports = 1_000_000; // 0.001 SOL
  const minOut = 1; // minimal pour ne pas bloquer sur le min_out

  console.log("RPC:", rpcUrl);
  console.log("User:", user.publicKey.toBase58());

  // 1) Résoudre la slice Raydium (17 comptes)
  const raydiumDex = await getRaydiumAccounts(
    connection,
    SOL_MINT,
    USDC_MINT,
    user.publicKey
  );
  if (!raydiumDex) {
    throw new Error("Raydium accounts resolver returned null");
  }
  console.log("Raydium slice length:", raydiumDex.accounts.length);

  // 2) Construire une route forcée Raydium
  const forcedRoute = {
    venue: "RAYDIUM_AMM" as const,
    venueProgramId: DEX_PROGRAM_IDS.RAYDIUM_AMM,
    inputAmount: amountInLamports,
    outputAmount: 0,
    priceImpactBps: 0,
    platformFeeBps: 0,
    dexAccounts: raydiumDex,
    allQuotes: [],
  };

  const swapper = new TrueNativeSwap(connection);

  // 3) Pré-instructions: WSOL wrap + ATA output
  const instructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
  ];

  const wsol = await ensureWsolFunding(connection, user.publicKey, amountInLamports);
  instructions.push(...wsol.ixs);

  const outAta = await ensureAta(connection, user.publicKey, USDC_MINT);
  if (outAta.ix) instructions.push(outAta.ix);

  // 4) Créer le plan si absent
  const [planPda] = swapper.deriveSwapPlanAddress(user.publicKey);
  const planInfo = await connection.getAccountInfo(planPda);
  if (!planInfo) {
    const expiresAt = Math.floor(Date.now() / 1000) + 120;
    instructions.push(
      await swapper.buildCreatePlanInstruction(user.publicKey, {
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        amountIn: amountInLamports,
        minOut,
        venue: "RAYDIUM_AMM",
        expiresAt,
      })
    );
    console.log("Plan created in tx:", planPda.toBase58());
  } else {
    console.log("Plan exists:", planPda.toBase58());
  }

  // 5) Instruction swap_toc natif (forced Raydium)
  instructions.push(
    await swapper.buildNativeSwapInstruction(user.publicKey, forcedRoute as any, {
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      amountIn: amountInLamports,
      minAmountOut: minOut,
      slippageBps: 50,
      userPublicKey: user.publicKey,
    })
  );

  // 6) Construire + simuler
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
    console.log("--- logs (first 120) ---");
    for (const line of sim.value.logs.slice(0, 120)) {
      console.log(line);
    }
    if (sim.value.logs.length > 120) {
      console.log(`... (${sim.value.logs.length - 120} more)`);
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
