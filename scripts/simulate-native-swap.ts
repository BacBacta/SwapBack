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

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function simulateTransactionWith429Retry(
  connection: Connection,
  tx: VersionedTransaction,
  options: Parameters<Connection["simulateTransaction"]>[1],
  label: string
): Promise<Awaited<ReturnType<Connection["simulateTransaction"]>>> {
  const delaysMs = [500, 1000, 2000, 4000, 8000, 12000];
  let lastErr: unknown;

  for (let i = 0; i < delaysMs.length; i++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await connection.simulateTransaction(tx, options as any);
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      const is429 = msg.includes("429") || msg.toLowerCase().includes("rate limit");
      if (!is429) throw e;
      console.log(`[simulate-native-swap] 429 rate-limited during simulate (${label}). Retrying in ${delaysMs[i]}ms...`);
      // eslint-disable-next-line no-await-in-loop
      await sleep(delaysMs[i]);
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function dumpInnerTokenTransfers(sim: Awaited<ReturnType<Connection["simulateTransaction"]>>, tx: VersionedTransaction): void {
  const value: any = (sim as any)?.value;
  const inner = value?.innerInstructions as
    | Array<{ index: number; instructions: Array<{ programIdIndex: number; accounts: number[]; data: string }> }>
    | undefined;

  if (!inner || inner.length === 0) return;

  const msg = tx.message;
  const keyForIndex = (i: number): string => {
    try {
      // @solana/web3.js: message.getAccountKeys() is available on v0 messages.
      const keys = (msg as any).getAccountKeys?.();
      const pubkey = keys?.get?.(i) ?? keys?.staticAccountKeys?.[i] ?? (msg as any).staticAccountKeys?.[i];
      return pubkey?.toBase58?.() ?? String(pubkey ?? i);
    } catch {
      return String(i);
    }
  };

  const tokenProgramIds = new Set([
    TOKEN_PROGRAM_ID.toBase58(),
    // Token-2022
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  ]);

  const tokenInners: Array<{ parentIx: number; programId: string; accounts: string[]; data: string }> = [];
  for (const group of inner) {
    for (const ix of group.instructions ?? []) {
      const programId = keyForIndex(ix.programIdIndex);
      if (!tokenProgramIds.has(programId)) continue;
      tokenInners.push({
        parentIx: group.index,
        programId,
        accounts: (ix.accounts ?? []).map((a) => keyForIndex(a)),
        data: ix.data,
      });
    }
  }

  if (tokenInners.length === 0) return;

  console.log("--- inner SPL token instructions (debug) ---");
  for (const ix of tokenInners.slice(0, 12)) {
    console.log(JSON.stringify(ix, null, 2));
  }
}

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

function resolveRpcUrl(rpcArg?: string): string {
  const raw = (rpcArg ?? "").trim();
  if (!raw) return "https://api.mainnet-beta.solana.com";

  if (raw.toLowerCase() === "helius") {
    const key =
      process.env.NEXT_PUBLIC_HELIUS_API_KEY ||
      process.env.HELIUS_API_KEY ||
      "";
    if (!key) {
      throw new Error(
        "RPC=helius demandé, mais aucune clé Helius trouvée. " +
          "Définissez NEXT_PUBLIC_HELIUS_API_KEY ou HELIUS_API_KEY, " +
          "ou passez une URL complète via SOLANA_RPC_URL/--rpc."
      );
    }
    return `https://mainnet.helius-rpc.com/?api-key=${key}`;
  }

  return raw;
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

  // Deuxième paire simple (toujours input=SOL pour éviter les problèmes de funding): SOL→USDT.
  // - Phoenix: market SOL/USDT ajouté dans la config.
  // - Meteora DLMM: résolution via API puis fallback on-chain.
  // - Orca: dépend des pools disponibles.
  // - Raydium AMM: fallback on-chain (memcmp) si config statique absente.
  // - Lifinity: le programme est gelé sur mainnet (6034) -> on évite de le mettre dans la matrice par défaut.
  if (["METEORA_DLMM", "PHOENIX", "ORCA_WHIRLPOOL", "RAYDIUM_AMM"].includes(venue)) {
    cases.push({ name: "SOL→USDT", inputMint: SOL_MINT, outputMint: USDT_MINT, amountInLamports });
  }

  return cases;
}

async function ensureAta(
  connection: Connection,
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey
): Promise<{ ata: PublicKey; ix?: ReturnType<typeof createAssociatedTokenAccountInstruction> }> {
  const ata = await getAssociatedTokenAddress(mint, owner);
  const info = await connection.getAccountInfo(ata);
  if (info) return { ata };

  return {
    ata,
    ix: createAssociatedTokenAccountInstruction(payer, ata, owner, mint),
  };
}

async function ensureWsolFunding(
  connection: Connection,
  payer: PublicKey,
  owner: PublicKey,
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
  const { ata, ix } = await ensureAta(connection, payer, owner, SOL_MINT);
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

  // Mode "bestRoute": reproduit le chemin UI (quote -> minOut -> build tx) au lieu de forcer une venue.
  const bestRouteMode = args.bestRoute === "true";

  const rpcUrl = resolveRpcUrl(args.rpc ?? process.env.SOLANA_RPC_URL);
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
  const feePayer = loadKeypair(keypairPath);
  // NOTE: pour simuler fidèlement une tx swap, on doit pouvoir signer en tant que `user`.
  // Ce script n'a accès qu'à la keypair du fee payer; on force donc `user=feePayer`.
  // Si vous voulez simuler un autre user, exécutez le script avec sa keypair.
  const user = feePayer;
  const userPublicKey = feePayer.publicKey;

  const payerInfo = await connection.getAccountInfo(feePayer.publicKey);
  if (!payerInfo) {
    console.error("\n[simulate-native-swap] Fee payer account does not exist on-chain (likely 0 SOL / never funded).\n" +
      `Fund this address with a small amount of SOL, then re-run:\n` +
      `  ${feePayer.publicKey.toBase58()}\n` +
      `Tip: you can set SOLANA_KEYPAIR to an already-funded wallet keypair.\n`
    );
    process.exitCode = 1;
    return;
  }

  const payerLamports = await connection.getBalance(feePayer.publicKey);
  console.log("Payer balance (lamports):", payerLamports);

  console.log("RPC:", rpcUrl);
  console.log("Fee payer:", feePayer.publicKey.toBase58());
  console.log("User:", userPublicKey.toBase58());
  console.log("Venues:", venues.join(","));
  console.log("Mode:", bestRouteMode ? "bestRoute" : matrixMode ? "matrix" : "single");
  if (!matrixMode) {
    console.log("InputMint:", singleInputMint.toBase58());
    console.log("OutputMint:", singleOutputMint.toBase58());
  }

  const swapper = new TrueNativeSwap(connection);

  const summary: Array<{ venue: string; caseName: string; status: "OK" | "FAIL" | "XFAIL"; error?: string }> = [];

  const isProgramFrozen = (err: unknown, logs?: string[] | null): boolean => {
    const errStr = err ? JSON.stringify(err) : "";
    if (errStr.includes("6034") || errStr.includes("0x1792") || errStr.toLowerCase().includes("programisfrozen")) {
      return true;
    }
    const logHit = (logs ?? []).some((l) =>
      l.toLowerCase().includes("program is frozen") || l.toLowerCase().includes("programisfrozen")
    );
    return logHit;
  };

  // En mode bestRoute, on ne force pas une venue: on simule une seule route "best" par case.
  const venuesToRun = bestRouteMode ? (["BEST_ROUTE"] as any as SupportedVenue[]) : venues;

  for (const venue of venuesToRun) {
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

      if (bestRouteMode) {
        // 1) Quote best venue
        const route = await swapper.getBestNativeRoute({
          inputMint: swapCase.inputMint,
          outputMint: swapCase.outputMint,
          amountIn: swapCase.amountInLamports,
          minAmountOut: 0,
          slippageBps,
          userPublicKey,
        });

        if (!route) {
          const msg = "No native route available (pair unsupported or all quotes failed)";
          console.log(msg);
          summary.push({ venue: "BEST_ROUTE", caseName: swapCase.name, status: "FAIL", error: msg });
          process.exitCode = 1;
          continue;
        }

        const minAmountOutUi = Math.floor(route.outputAmount * (10000 - slippageBps) / 10000);
        console.log("Best venue:", route.venue);
        console.log("Quote outputAmount:", route.outputAmount);
        console.log("UI minAmountOut:", minAmountOutUi);
        console.log(
          "All quotes:",
          route.allQuotes.map((q) => ({ venue: q.venue, out: q.outputAmount, pi: q.priceImpactBps }))
        );

        // 2) Build transaction exactly like the app
        const built = await swapper.buildNativeSwapTransaction({
          inputMint: swapCase.inputMint,
          outputMint: swapCase.outputMint,
          amountIn: swapCase.amountInLamports,
          // Comme l'app: minOut est dérivé côté builder à partir de routeOverride + slippage.
          minAmountOut: 0,
          slippageBps,
          userPublicKey: user.publicKey,
          routeOverride: route,
        });

        if (!built) {
          const msg = "Failed to build transaction";
          console.log(msg);
          summary.push({ venue: "BEST_ROUTE", caseName: swapCase.name, status: "FAIL", error: msg });
          process.exitCode = 1;
          continue;
        }

        const tx = built.transaction;
        try {
          tx.sign([user]);
        } catch (e) {
          console.error("Failed to sign/serialize transaction (likely too large):", e);
          summary.push({ venue: "BEST_ROUTE", caseName: swapCase.name, status: "FAIL", error: "sign_failed" });
          process.exitCode = 1;
          continue;
        }

        const sim = await simulateTransactionWith429Retry(connection, tx, {
          sigVerify: false,
          replaceRecentBlockhash: true,
        }, "bestRoute");

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
        }

        if (sim.value.err) {
          dumpInnerTokenTransfers(sim, tx);
        }

        if (sim.value.err) {
          summary.push({ venue: "BEST_ROUTE", caseName: swapCase.name, status: "FAIL", error: JSON.stringify(sim.value.err) });
          process.exitCode = 1;
        } else {
          summary.push({ venue: "BEST_ROUTE", caseName: swapCase.name, status: "OK" });
        }
        continue;
      }

      let dex: Awaited<ReturnType<typeof getDEXAccounts>>;
      try {
        dex = await getDEXAccounts(connection, venue, swapCase.inputMint, swapCase.outputMint, userPublicKey);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`DEX resolver threw for venue=${venue} case=${swapCase.name}: ${msg}`);
        if (venue === "LIFINITY") {
          summary.push({ venue, caseName: swapCase.name, status: "XFAIL", error: msg });
        } else {
          summary.push({ venue, caseName: swapCase.name, status: "FAIL", error: msg });
          process.exitCode = 1;
        }
        continue;
      }
      if (!dex) {
        const msg = "DEX resolver returned null (unsupported pair?)";
        console.log(`${msg} venue=${venue} case=${swapCase.name}`);
        if (venue === "LIFINITY") {
          summary.push({ venue, caseName: swapCase.name, status: "XFAIL", error: msg });
        } else if (venue === "RAYDIUM_AMM" && swapCase.name === "SOL→USDT") {
          summary.push({ venue, caseName: swapCase.name, status: "XFAIL", error: "Raydium AMM SOL/USDT non résolu (pas de config statique + getProgramAccounts souvent désactivé sur RPC public)" });
        } else {
          summary.push({ venue, caseName: swapCase.name, status: "FAIL", error: msg });
          process.exitCode = 1;
        }
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
        const wsol = await ensureWsolFunding(connection, feePayer.publicKey, userPublicKey, swapCase.amountInLamports);
        instructions.push(...wsol.ixs);
      } else {
        const inAta = await ensureAta(connection, feePayer.publicKey, userPublicKey, swapCase.inputMint);
        if (inAta.ix) instructions.push(inAta.ix);

        // Precheck: évite d'interpréter un manque de funds comme un bug router/DEX.
        try {
          const bal = await connection.getTokenAccountBalance(inAta.ata);
          const current = BigInt(bal.value.amount);
          const needed = BigInt(swapCase.amountInLamports);

          const requiredUi = (
            swapCase.amountInLamports / Math.pow(10, bal.value.decimals)
          ).toLocaleString("en-US", { maximumFractionDigits: bal.value.decimals });

          console.log(
            `[precheck] input ATA=${inAta.ata.toBase58()} balance=${bal.value.uiAmountString} required=${requiredUi}`
          );

          if (current < needed) {
            const msg =
              `Insufficient input funds in ATA ${inAta.ata.toBase58()} ` +
              `(have ${bal.value.uiAmountString}, need ${requiredUi}).`;
            console.log(`[simulate-native-swap] FAIL venue=${venue} case=${swapCase.name}: ${msg}`);
            summary.push({ venue, caseName: swapCase.name, status: "FAIL", error: msg });
            process.exitCode = 1;
            continue;
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(
            `[simulate-native-swap] WARN: could not fetch input token balance for ATA=${inAta.ata.toBase58()}: ${msg}`
          );
        }
      }

      // Output ATA
      const outAta = await ensureAta(connection, feePayer.publicKey, userPublicKey, swapCase.outputMint);
      if (outAta.ix) instructions.push(outAta.ix);

    // NOTE: En mode native direct DEX (useDynamicPlan=false), le SwapPlan est optionnel.
    // Éviter de créer un plan dans le simulateur pour limiter la taille de tx (pas d'écriture on-chain).

      let swapIx: TransactionInstruction;
      try {
        swapIx = await swapper.buildNativeSwapInstruction(userPublicKey, forcedRoute as any, {
          inputMint: swapCase.inputMint,
          outputMint: swapCase.outputMint,
          amountIn: swapCase.amountInLamports,
          minAmountOut: minOut,
          slippageBps,
          userPublicKey,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (/Venue native temporairement d[ée]sactiv[ée]e/i.test(message)) {
          console.log(`[simulate-native-swap] SKIP venue=${venue} case=${swapCase.name}: ${message}`);
          summary.push({ venue, caseName: swapCase.name, status: "SKIP", error: message });
          continue;
        }
        throw e;
      }

      // Debug: vérifier quels comptes le router reçoit comme `user_token_account_a/b`.
      // Si ceux-ci sont inversés, Meteora peut swapper dans le mauvais sens et échouer en slippage.
      try {
        const userA = swapIx.keys[4]?.pubkey;
        const userB = swapIx.keys[5]?.pubkey;
        console.log(`[debug] SwapToc user_token_account_a=${userA?.toBase58?.() ?? "?"}`);
        console.log(`[debug] SwapToc user_token_account_b=${userB?.toBase58?.() ?? "?"}`);
      } catch {
        // ignore
      }

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
      payerKey: feePayer.publicKey,
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
      // `sigVerify=false` dans simulateTransaction, on a seulement besoin d'une signature valide
      // pour le fee payer; les autres signers peuvent rester en placeholder.
      tx.sign([feePayer]);
    } catch (e) {
      console.error("Failed to sign/serialize transaction (likely too large):", e);
      process.exitCode = 1;
      continue;
    }

    const sim = await connection.simulateTransaction(tx, {
      sigVerify: false,
      replaceRecentBlockhash: true,
      ...(venue === "METEORA_DLMM"
        ? {
            accounts: {
              encoding: "base64" as const,
              addresses: [
                dex.accounts[2].toBase58(), // reserveX
                dex.accounts[3].toBase58(), // reserveY
                dex.accounts[4].toBase58(), // userTokenX
                dex.accounts[5].toBase58(), // userTokenY
              ],
            },
          }
        : {}),
    });

    console.log("Simulation err:", sim.value.err);
    console.log("Units:", sim.value.unitsConsumed);

    if (venue === "METEORA_DLMM" && (sim.value as any).accounts) {
      try {
        const { AccountLayout } = await import("@solana/spl-token");
        const labels = ["reserveX", "reserveY", "userTokenX", "userTokenY"];
        // `simulateTransaction` renvoie les comptes dans le même ordre que `accounts.addresses`.
        const returned = (sim.value as any).accounts as Array<
          | null
          | {
              data: [string, string];
              owner: string;
              lamports: number;
              executable: boolean;
              rentEpoch: number;
            }
        >;

        console.log("--- post-sim accounts (Meteora) ---");
        for (let i = 0; i < Math.min(labels.length, returned.length); i++) {
          const acc = returned[i];
          const label = labels[i];
          const pk = [dex.accounts[2], dex.accounts[3], dex.accounts[4], dex.accounts[5]][i];
          if (!acc) {
            console.log(`${label}: ${pk.toBase58()} => null`);
            continue;
          }
          const [b64] = acc.data;
          const buf = Buffer.from(b64, "base64");
          let mint = "?";
          let amount = "?";
          try {
            const decoded = AccountLayout.decode(buf);
            mint = new PublicKey(decoded.mint).toBase58();
            amount = decoded.amount.toString();
          } catch {
            // not a token account
          }
          console.log(
            `${label}: ${pk.toBase58()} owner=${acc.owner} len=${buf.length} mint=${mint} amount=${amount}`
          );
        }
      } catch (e) {
        console.log("[debug] Failed to decode post-sim accounts:", e);
      }
    }
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
      dumpInnerTokenTransfers(sim, tx);
    }

      if (sim.value.err) {
        const errMsg = JSON.stringify(sim.value.err);
        if (venue === "LIFINITY" && isProgramFrozen(sim.value.err, sim.value.logs)) {
          summary.push({ venue, caseName: swapCase.name, status: "XFAIL", error: errMsg });
        } else {
          summary.push({ venue, caseName: swapCase.name, status: "FAIL", error: errMsg });
          process.exitCode = 1;
        }
      } else {
        summary.push({ venue, caseName: swapCase.name, status: "OK" });
      }
    }
  }

  console.log("\n================ SUMMARY ================");
  for (const row of summary) {
    console.log(`${row.status} | ${row.venue} | ${row.caseName}${row.error ? ` | ${row.error}` : ""}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
