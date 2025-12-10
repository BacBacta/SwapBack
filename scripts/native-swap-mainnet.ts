#!/usr/bin/env -S npx tsx
import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
  Transaction,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import fs from "fs";
import path from "path";
import {
  getNativeRouter,
  SOL_MINT,
  USDC_MINT,
  SLIPPAGE_CONFIG,
  type NativeSwapParams,
  type NativeRouteQuote,
} from "../app/src/lib/native-router/headless/router";

const ROOT_DIR = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "app", "public");
const fsp = fs.promises;

const originalFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
  if (typeof input === "string" && input.startsWith("/")) {
    const relativePath = input.replace(/^\//, "");
    const filePath = path.join(PUBLIC_DIR, relativePath);
    const data = await fsp.readFile(filePath);
    return new Response(data, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return originalFetch(input, init);
};

function loadKeypair(): Keypair {
  const keypairPath = process.env.WALLET_FILE
    ? path.resolve(process.env.WALLET_FILE)
    : path.join(process.env.HOME || "", ".config", "solana", "id.json");
  const secret = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

async function getOrCreateTokenAccount(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey,
  payer: Keypair,
  wrapAmountLamports = 0n
): Promise<PublicKey> {
  const ata = await getAssociatedTokenAddress(mint, owner);
  const instructions: TransactionInstruction[] = [];
  const accountInfo = await connection.getAccountInfo(ata);

  if (!accountInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(payer.publicKey, ata, owner, mint)
    );
  }

  if (mint.equals(SOL_MINT) && wrapAmountLamports > 0n) {
    const balanceResp = await connection.getTokenAccountBalance(ata).catch(() => null);
    const currentLamports = balanceResp ? BigInt(balanceResp.value.amount) : 0n;
    if (currentLamports < wrapAmountLamports) {
      const delta = Number(wrapAmountLamports - currentLamports);
      instructions.push(
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: ata,
          lamports: delta,
        })
      );
      instructions.push(createSyncNativeInstruction(ata));
    }
  }

  if (instructions.length > 0) {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const tx = new Transaction({ feePayer: payer.publicKey, recentBlockhash: blockhash });
    tx.add(...instructions);
    tx.sign(payer);
    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  }

  return ata;
}

async function main(): Promise<void> {
  const amountSol = Number(process.env.SWAP_SOL || "0.01");
  if (!Number.isFinite(amountSol) || amountSol <= 0) {
    throw new Error("SWAP_SOL must be a positive number");
  }

  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const wallet = loadKeypair();

  console.log("🔌 RPC URL:", rpcUrl);
  console.log("👛 Wallet:", wallet.publicKey.toBase58());
  console.log("💰 Amount (SOL):", amountSol);

  const amountInLamports = Math.floor(amountSol * 1e9);

  await getOrCreateTokenAccount(connection, SOL_MINT, wallet.publicKey, wallet, BigInt(amountInLamports));
  await getOrCreateTokenAccount(connection, USDC_MINT, wallet.publicKey, wallet);

  const nativeRouter = getNativeRouter(connection);

  console.log("⏳ Building native route...");
  const route: NativeRouteQuote | null = await nativeRouter.buildNativeRoute(
    SOL_MINT,
    USDC_MINT,
    amountInLamports,
    Number(process.env.SLIPPAGE_BPS || SLIPPAGE_CONFIG.BASE_SLIPPAGE_BPS)
  );

  if (!route) {
    throw new Error("Unable to build a native route. Check liquidity or retry later.");
  }

  const slippageBps = Number(process.env.SLIPPAGE_BPS || 200);
  const minAmountOut = Math.max(1, Math.floor(route.totalOutputAmount * (10000 - slippageBps) / 10000));

  console.log("✅ Route ready:", {
    venue: route.bestVenue,
    expectedOut: route.totalOutputAmount,
    minOut: minAmountOut,
    slippageBps,
  });

  const params: NativeSwapParams = {
    inputMint: SOL_MINT,
    outputMint: USDC_MINT,
    amountIn: amountInLamports,
    minAmountOut,
    slippageBps,
    userPublicKey: wallet.publicKey,
    boostBps: 0,
    useJitoBundle: false,
  };

  const routerAny = nativeRouter as any;
  console.log("🧱 Building transaction...");
  const transaction: VersionedTransaction = await routerAny.buildSwapTransaction(params, route);

  transaction.sign([wallet]);

  console.log("🚀 Sending transaction...");
  const rawTx = transaction.serialize();
  const signature = await connection.sendRawTransaction(rawTx, {
    skipPreflight: false,
    preflightCommitment: "confirmed",
    maxRetries: 3,
  });

  console.log("⌛ Confirming:", signature);
  await connection.confirmTransaction(signature, "confirmed");

  console.log("🎉 Native swap submitted! Explorer:", `https://explorer.solana.com/tx/${signature}`);
}

main().catch((err) => {
  console.error("❌ Native swap failed:", err);
  process.exit(1);
});
