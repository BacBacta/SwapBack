#!/usr/bin/env -S npx tsx
/**
 * Swap WSOL -> USDC on mainnet via the native SwapBack router.
 *
 * - Forces venue: METEORA_DLMM (avoids Orca until on-chain fix is deployed)
 * - Uses on-chain simulation safety via slippage minOut
 *
 * Usage:
 *   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com \
 *   WALLET_FILE=/path/to/keypair.json \
 *   AMOUNT_WSOL=0.05 \
 *   SLIPPAGE_BPS=50 \
 *   npx tsx scripts/swap-wsol-to-usdc.mainnet.ts
 */

import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import fs from "fs";

import BN from "bn.js";

import TrueNativeSwap, {
  SOL_MINT,
  USDC_MINT,
  DEX_PROGRAM_IDS,
} from "../app/src/lib/native-router/true-native-swap";
import { getDEXAccounts } from "../app/src/lib/native-router/dex/DEXAccountResolvers";

function loadKeypair(): Keypair {
  const keypairPath = process.env.WALLET_FILE || process.env.SOLANA_KEYPAIR || "";
  if (!keypairPath) {
    throw new Error(
      "Missing WALLET_FILE (or SOLANA_KEYPAIR). Provide a keypair JSON to sign the swap."
    );
  }
  const secret = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

async function ensureAtaIx(
  connection: Connection,
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey
): Promise<{ ata: PublicKey; ix: TransactionInstruction | null }> {
  const ata = await getAssociatedTokenAddress(mint, owner);
  const info = await connection.getAccountInfo(ata);
  if (info) return { ata, ix: null };
  return { ata, ix: createAssociatedTokenAccountInstruction(payer, ata, owner, mint) };
}

async function quoteMeteoraOutAmount(params: {
  connection: Connection;
  pairAddress: PublicKey;
  inputMint: PublicKey;
  amountIn: bigint;
  slippageBps: number;
}): Promise<bigint> {
  const { connection, pairAddress, inputMint, amountIn, slippageBps } = params;

  // Load @meteora-ag/dlmm with Node-friendly require fallback.
  let dlmmMod: any;
  try {
    const nodeModule: any = await import(/* webpackIgnore: true */ "node:module");
    const createRequire = nodeModule?.createRequire;
    if (typeof createRequire === "function") {
      const req = createRequire(import.meta.url);
      dlmmMod = req("@meteora-ag/dlmm");
    } else {
      dlmmMod = await import("@meteora-ag/dlmm");
    }
  } catch {
    dlmmMod = await import("@meteora-ag/dlmm");
  }

  const DLMM: any = dlmmMod?.DLMM ?? dlmmMod?.default ?? dlmmMod;
  const dlmm = await DLMM.create(connection, pairAddress);

  const tokenXMint: PublicKey =
    dlmm?.tokenX?.mint?.address ?? dlmm?.tokenX?.mint?.publicKey ?? dlmm?.tokenX?.publicKey;
  const tokenYMint: PublicKey =
    dlmm?.tokenY?.mint?.address ?? dlmm?.tokenY?.mint?.publicKey ?? dlmm?.tokenY?.publicKey;
  if (!tokenXMint || !tokenYMint) throw new Error("Failed to read Meteora tokenX/tokenY mints");

  const swapForY = inputMint.equals(tokenXMint);

  let binArrayAccounts: Array<{ publicKey: PublicKey }> = [];
  for (const depth of [5, 20, 60]) {
    // eslint-disable-next-line no-await-in-loop
    binArrayAccounts = await dlmm.getBinArrayForSwap(swapForY, depth);
    if (binArrayAccounts.length > 0) break;
  }
  if (binArrayAccounts.length === 0) throw new Error("No bin arrays for swap");

  const quote = await dlmm.swapQuote(
    new BN(amountIn.toString()),
    swapForY,
    new BN(String(Math.max(0, Math.min(10_000, Math.floor(slippageBps))))),
    binArrayAccounts
  );

  const outAmountStr = quote?.outAmount?.toString?.() ?? "0";
  const outAmount = BigInt(outAmountStr);
  if (outAmount <= 0n) throw new Error("Meteora quote returned 0 output");

  // Some SDK versions may already account for slippage; we keep an extra conservative floor.
  const extraMinOut = (outAmount * BigInt(10_000 - Math.min(10_000, Math.max(0, Math.floor(slippageBps))))) / 10_000n;
  return extraMinOut > 0n ? extraMinOut : 1n;
}

async function main(): Promise<void> {
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const wallet = loadKeypair();

  const amountWsol = Number(process.env.AMOUNT_WSOL || "");
  if (!Number.isFinite(amountWsol) || amountWsol <= 0) {
    throw new Error("Set AMOUNT_WSOL (e.g. 0.05) to specify how much WSOL to swap.");
  }

  const slippageBps = Number(process.env.SLIPPAGE_BPS || "50");
  if (!Number.isFinite(slippageBps) || slippageBps < 0 || slippageBps > 10_000) {
    throw new Error("Invalid SLIPPAGE_BPS (expected 0..10000)");
  }

  const amountInLamports = BigInt(Math.floor(amountWsol * 1e9));

  console.log("🔌 RPC:", rpcUrl);
  console.log("👛 Wallet:", wallet.publicKey.toBase58());
  console.log("💱 Swap:", `${amountWsol} WSOL -> USDC`);
  console.log("🎯 Venue:", "METEORA_DLMM");
  console.log("🧷 Slippage (bps):", slippageBps);

  // Ensure ATAs exist (do NOT wrap; we consume existing WSOL in ATA).
  const inAta = await ensureAtaIx(connection, wallet.publicKey, wallet.publicKey, SOL_MINT);
  const outAta = await ensureAtaIx(connection, wallet.publicKey, wallet.publicKey, USDC_MINT);

  // Safety: check WSOL balance.
  const inBal = await connection.getTokenAccountBalance(inAta.ata).catch(() => null);
  const inBalLamports = inBal ? BigInt(inBal.value.amount) : 0n;
  console.log("🏦 WSOL ATA:", inAta.ata.toBase58(), "balance:", Number(inBalLamports) / 1e9);
  if (inBalLamports < amountInLamports) {
    throw new Error(
      `Insufficient WSOL. Have ${(Number(inBalLamports) / 1e9).toFixed(9)} WSOL, need ${amountWsol}.`
    );
  }

  // Resolve DEX accounts (Meteora DLMM).
  const venue = "METEORA_DLMM" as const;
  const dexAccounts = await getDEXAccounts(connection, venue, SOL_MINT, USDC_MINT, wallet.publicKey);
  if (!dexAccounts?.meta?.poolAddress) {
    throw new Error("Failed to resolve Meteora DLMM pool for SOL/USDC");
  }

  const pairAddress = new PublicKey(dexAccounts.meta.poolAddress);
  console.log("🏊 Meteora pair:", pairAddress.toBase58());

  // Quote + minOut.
  const minOut = await quoteMeteoraOutAmount({
    connection,
    pairAddress,
    inputMint: SOL_MINT,
    amountIn: amountInLamports,
    slippageBps,
  });

  console.log("📉 minOut (base units):", minOut.toString());

  const swapper = new TrueNativeSwap(connection);

  const forcedRoute = {
    venue,
    venueProgramId: DEX_PROGRAM_IDS.METEORA_DLMM,
    inputAmount: Number(amountInLamports),
    outputAmount: 0,
    priceImpactBps: 0,
    platformFeeBps: 0,
    dexAccounts,
    allQuotes: [],
  };

  const swapIx = await swapper.buildNativeSwapInstruction(wallet.publicKey, forcedRoute as any, {
    inputMint: SOL_MINT,
    outputMint: USDC_MINT,
    amountIn: Number(amountInLamports),
    minAmountOut: Number(minOut),
    slippageBps,
    userPublicKey: wallet.publicKey,
  });

  const ixs: TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 }),
  ];

  // Create missing ATAs if needed.
  if (inAta.ix) ixs.push(inAta.ix);
  if (outAta.ix) ixs.push(outAta.ix);

  ixs.push(swapIx);

  // Build and simulate before send.
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const msg = new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: blockhash,
    instructions: ixs,
  }).compileToV0Message();

  const tx = new VersionedTransaction(msg);
  tx.sign([wallet]);

  console.log("🧪 Simulating...");
  const sim = await connection.simulateTransaction(tx, { sigVerify: false });
  if (sim.value.err) {
    console.error("❌ Simulation failed:", JSON.stringify(sim.value.err));
    console.error("Logs (tail):");
    (sim.value.logs ?? []).slice(-40).forEach((l) => console.error(l));
    process.exitCode = 1;
    return;
  }

  console.log("✅ Simulation OK. Sending...");
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
    maxRetries: 3,
  });

  console.log("⌛ Confirming:", sig);
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");

  console.log("🎉 Swap sent:", `https://explorer.solana.com/tx/${sig}`);
}

main().catch((err) => {
  console.error("❌ Swap failed:", err);
  process.exit(1);
});
