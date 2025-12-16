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
 *
 *   # Matrice: plusieurs paires par venue (simulateTransaction)
 *   npx tsx scripts/simulate-native-swap.ts --matrix=true --venues=METEORA_DLMM,PHOENIX,LIFINITY
 *
 *   # Override: forcer les paires (format: MINT_IN:MINT_OUT[,MINT_IN:MINT_OUT])
 *   npx tsx scripts/simulate-native-swap.ts --matrix=true --venues=PHOENIX --pairs=So11111111111111111111111111111111111111112:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v,So11111111111111111111111111111111111111112:Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
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
import os from "os";
import path from "path";

import TrueNativeSwap, {
  DEX_PROGRAM_IDS,
  SOL_MINT,
  USDC_MINT,
} from "../app/src/lib/native-router/true-native-swap";
import {
  getDEXAccounts,
  type SupportedVenue,
} from "../app/src/lib/native-router/dex/DEXAccountResolvers";

const USDT_MINT = new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");

type SwapCase = {
  name: string;
  inputMint: PublicKey;
  outputMint: PublicKey;
  amountInLamports: number;
};

function tryAutoCreateDefaultKeypair(defaultPath: string): boolean {
  try {
    const dir = path.dirname(defaultPath);
    fs.mkdirSync(dir, { recursive: true });
    const kp = Keypair.generate();
    fs.writeFileSync(defaultPath, JSON.stringify(Array.from(kp.secretKey)), {
      encoding: "utf-8",
      mode: 0o600,
    });
    console.log(`[simulate-native-swap] Created keypair: ${defaultPath}`);
    console.log(`[simulate-native-swap] New address: ${kp.publicKey.toBase58()}`);
    return true;
  } catch (e) {
    console.warn(`[simulate-native-swap] Failed to auto-create keypair at ${defaultPath}:`, e);
    return false;
  }
}

function resolveKeypairPath(options?: { autoCreate?: boolean }): string {
  const home = os.homedir();
  const rawEnvPath = process.env.SOLANA_KEYPAIR;
  const envPath = rawEnvPath?.startsWith("~/")
    ? path.join(home, rawEnvPath.slice(2))
    : rawEnvPath;

  if (envPath && fs.existsSync(envPath)) return envPath;
  if (envPath && !fs.existsSync(envPath)) {
    console.warn(`[simulate-native-swap] SOLANA_KEYPAIR not found at: ${envPath}`);
  }

  const defaultKeypair = path.join(home, ".config/solana/id.json");

  const candidates = [
    defaultKeypair,
    "/home/codespace/.config/solana/id.json",
    "/root/.config/solana/id.json",
    path.join(process.cwd(), "id.json"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      console.log(`[simulate-native-swap] Using keypair: ${candidate}`);
      return candidate;
    }
  }

  if (options?.autoCreate) {
    const created = tryAutoCreateDefaultKeypair(defaultKeypair);
    if (created && fs.existsSync(defaultKeypair)) return defaultKeypair;
  }

  throw new Error(
    `No Solana keypair found. Set SOLANA_KEYPAIR to a keypair JSON path (you can use ~/...), or create ~/.config/solana/id.json.`
  );
}

function loadKeypair(keypairPath: string): Keypair {
  const raw = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
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

function parsePairsArg(pairsArg: string): SwapCase[] {
  // Format: MINT_IN:MINT_OUT[,MINT_IN:MINT_OUT]
  const rawPairs = pairsArg
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  return rawPairs.map((p) => {
    const [a, b] = p.split(":", 2);
    if (!a || !b) throw new Error(`Invalid --pairs entry: ${p} (expected MINT_IN:MINT_OUT)`);
    const inputMint = new PublicKey(a);
    const outputMint = new PublicKey(b);
    return {
      name: `${inputMint.toBase58().slice(0, 8)}…/${outputMint.toBase58().slice(0, 8)}…`,
      inputMint,
      outputMint,
      amountInLamports: 0, // injected later
    };
  });
}

function defaultMatrixCasesForVenue(venue: SupportedVenue, amountInLamports: number): SwapCase[] {
  // Objectif: au moins 1–2 paires supplémentaires par venue.
  // On utilise des tokens avec oracles sponsorisés (cf app/src/config/oracles.ts).
  const cases: SwapCase[] = [
    { name: "SOL→USDC", inputMint: SOL_MINT, outputMint: USDC_MINT, amountInLamports },
  ];

  // Lifinity : SOL/USDT est généralement disponible dans le pool list.
  // Meteora DLMM : SOL/USDT n'existe pas en DLMM API, donc on ne l'ajoute pas par défaut.
  // Phoenix : nécessite un market address explicite; on évite SOL/USDT par défaut.
  if (venue === "LIFINITY") {
    cases.push({ name: "SOL→USDT", inputMint: SOL_MINT, outputMint: USDT_MINT, amountInLamports });
  }

  return cases;
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

  const autoCreateKeypair =
    process.env.SWAPBACK_AUTO_CREATE_KEYPAIR === "1" || args.autoCreateKeypair === "true";

  const venuesArg = args.venues ?? args.venue ?? "RAYDIUM_AMM";
  const venues = venuesArg
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean) as SupportedVenue[];
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const keypairPath = resolveKeypairPath({ autoCreate: autoCreateKeypair });

  const matrixMode = args.matrix === "true";
  const pairsOverride = args.pairs ? parsePairsArg(args.pairs) : null;

  const amountInLamports = Number(args.amountIn ?? 1_000_000); // default 0.001 SOL (si SOL)
  const minOut = Number(args.minOut ?? 1);
  const slippageBps = Number(args.slippageBps ?? 50);

  // Single-mode default mints (backwards compatible)
  const singleInputMint = new PublicKey(args.inputMint ?? SOL_MINT.toBase58());
  const singleOutputMint = new PublicKey(args.outputMint ?? USDC_MINT.toBase58());

  const connection = new Connection(rpcUrl, "confirmed");
  const user = loadKeypair(keypairPath);

  const payerInfo = await connection.getAccountInfo(user.publicKey);
  if (!payerInfo) {
    console.error("\n[simulate-native-swap] Fee payer account does not exist on-chain (likely 0 SOL / never funded).\n" +
      `Fund this address with a small amount of SOL, then re-run:\n` +
      `  ${user.publicKey.toBase58()}\n` +
      `Tip: you can set SOLANA_KEYPAIR to an already-funded wallet keypair.\n`
    );
    process.exitCode = 1;
    return;
  }

  const payerLamports = await connection.getBalance(user.publicKey);
  console.log("Payer balance (lamports):", payerLamports);

  console.log("RPC:", rpcUrl);
  console.log("User:", user.publicKey.toBase58());
  console.log("Venues:", venues.join(","));
  console.log("Mode:", matrixMode ? "matrix" : "single");
  if (!matrixMode) {
    console.log("InputMint:", singleInputMint.toBase58());
    console.log("OutputMint:", singleOutputMint.toBase58());
  }

  const swapper = new TrueNativeSwap(connection);

  const summary: Array<{ venue: string; caseName: string; ok: boolean; error?: string }> = [];

  for (const venue of venues) {
    const cases: SwapCase[] = matrixMode
      ? (pairsOverride
          ? pairsOverride.map((c) => ({ ...c, amountInLamports }))
          : defaultMatrixCasesForVenue(venue, amountInLamports))
      : [{ name: "single", inputMint: singleInputMint, outputMint: singleOutputMint, amountInLamports }];

    for (const swapCase of cases) {
      console.log("\n============================================================");
      console.log("Venue:", venue, "| Case:", swapCase.name);
      console.log("InputMint:", swapCase.inputMint.toBase58());
      console.log("OutputMint:", swapCase.outputMint.toBase58());

      let dex: Awaited<ReturnType<typeof getDEXAccounts>>;
      try {
        dex = await getDEXAccounts(connection, venue, swapCase.inputMint, swapCase.outputMint, user.publicKey);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`DEX resolver threw for venue=${venue} case=${swapCase.name}: ${msg}`);
        summary.push({ venue, caseName: swapCase.name, ok: false, error: msg });
        process.exitCode = 1;
        continue;
      }
      if (!dex) {
        const msg = "DEX resolver returned null (unsupported pair?)";
        console.log(`${msg} venue=${venue} case=${swapCase.name}`);
        summary.push({ venue, caseName: swapCase.name, ok: false, error: msg });
        process.exitCode = 1;
        continue;
      }

      console.log("DEX slice length:", dex.accounts.length);

    const forcedRoute = {
      venue,
      venueProgramId:
        DEX_PROGRAM_IDS[venue] ??
        new PublicKey(args.venueProgramId ?? PublicKey.default.toBase58()),
      inputAmount: amountInLamports,
      outputAmount: 0,
      priceImpactBps: 0,
      platformFeeBps: 0,
      dexAccounts: dex,
      allQuotes: [],
    };

    const instructions = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
    ];

      // Input prep
      if (swapCase.inputMint.equals(SOL_MINT)) {
        const wsol = await ensureWsolFunding(connection, user.publicKey, swapCase.amountInLamports);
        instructions.push(...wsol.ixs);
      } else {
        const inAta = await ensureAta(connection, user.publicKey, swapCase.inputMint);
        if (inAta.ix) instructions.push(inAta.ix);
      }

      // Output ATA
      const outAta = await ensureAta(connection, user.publicKey, swapCase.outputMint);
      if (outAta.ix) instructions.push(outAta.ix);

    // NOTE: En mode native direct DEX (useDynamicPlan=false), le SwapPlan est optionnel.
    // Éviter de créer un plan dans le simulateur pour limiter la taille de tx (pas d'écriture on-chain).

      const swapIx = await swapper.buildNativeSwapInstruction(user.publicKey, forcedRoute as any, {
        inputMint: swapCase.inputMint,
        outputMint: swapCase.outputMint,
        amountIn: swapCase.amountInLamports,
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

    console.log("Message staticAccountKeys:", msg.staticAccountKeys.length);
    console.log("Message addressTableLookups:", msg.addressTableLookups.length);
    console.log(
      "Instructions:",
      msg.compiledInstructions.map((ix) => ({
        accounts: ix.accountKeyIndexes.length,
        data: ix.data.length,
      }))
    );

    const tx = new VersionedTransaction(msg);
    try {
      tx.sign([user]);
    } catch (e) {
      console.error("Failed to sign/serialize transaction (likely too large):", e);
      process.exitCode = 1;
      continue;
    }

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
        summary.push({ venue, caseName: swapCase.name, ok: false, error: JSON.stringify(sim.value.err) });
        process.exitCode = 1;
      } else {
        summary.push({ venue, caseName: swapCase.name, ok: true });
      }
    }
  }

  console.log("\n================ SUMMARY ================");
  for (const row of summary) {
    console.log(`${row.ok ? "OK" : "FAIL"} | ${row.venue} | ${row.caseName}${row.error ? ` | ${row.error}` : ""}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
