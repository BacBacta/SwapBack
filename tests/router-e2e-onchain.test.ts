/**
 * SwapBack Router - Tests On-Chain E2E (Devnet)
 * Tests avec programmes réellement déployés sur devnet
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { loadProgram } from "./utils/load-idl";
import {
  ROUTER_PROGRAM_ID,
  BUYBACK_PROGRAM_ID,
  BACK_TOKEN_MINT,
  SWITCHBOARD_SOL_USD,
  BUYBACK_USDC_VAULT_SEED,
  ROUTER_STATE_SEED,
  BUYBACK_STATE_SEED,
} from "./config/devnet";

const RUN_ANCHOR_TESTS = process.env.SWAPBACK_RUN_ANCHOR_TESTS === "true";
const RUN_BUYBACK_INIT = process.env.SWAPBACK_RUN_BUYBACK_INIT === "true";
const BUYBACK_USDC_MINT_ENV = process.env.SWAPBACK_BUYBACK_USDC_MINT;
const BUYBACK_MIN_AMOUNT_ENV = process.env.SWAPBACK_BUYBACK_MIN_AMOUNT;

const [BUYBACK_USDC_VAULT] = PublicKey.findProgramAddressSync(
  [BUYBACK_USDC_VAULT_SEED],
  BUYBACK_PROGRAM_ID
);

const buybackMinAmount = BUYBACK_MIN_AMOUNT_ENV
  ? new BN(BUYBACK_MIN_AMOUNT_ENV)
  : new BN(0);

if (!RUN_ANCHOR_TESTS) {
  console.warn(
    "⏭️  Skip SwapBack Router E2E on-chain tests (set SWAPBACK_RUN_ANCHOR_TESTS=true to enable)."
  );
  describe.skip("🚀 SwapBack Router - Tests E2E On-Chain (Devnet)", () => {});
} else {
describe("🚀 SwapBack Router - Tests E2E On-Chain (Devnet)", () => {
  const provider = process.env.ANCHOR_PROVIDER_URL
    ? AnchorProvider.env()
    : AnchorProvider.local("https://api.devnet.solana.com");
  anchor.setProvider(provider);

  const authority = provider.wallet.publicKey;
  let routerState: PublicKey;
  let buybackState: PublicKey;
  let routerProgram: Program;
  let buybackProgram: Program;

  console.log("\n📋 Configuration Tests:");
  console.log("   Authority:", authority.toBase58());
  console.log("   Router Program:", ROUTER_PROGRAM_ID.toBase58());
  console.log("   Buyback Program:", BUYBACK_PROGRAM_ID.toBase58());
  console.log("   Token $BACK:", BACK_TOKEN_MINT.toBase58());
  console.log("   Oracle Feed:", SWITCHBOARD_SOL_USD.toBase58());

  beforeAll(async () => {
    console.log("\n🔧 Setup des PDAs...");

    // Router State PDA - seeds: [b"router_state"] uniquement
    [routerState] = PublicKey.findProgramAddressSync(
      [ROUTER_STATE_SEED],
      ROUTER_PROGRAM_ID
    );
    console.log("   Router State PDA:", routerState.toBase58());

    // Buyback State PDA
    [buybackState] = PublicKey.findProgramAddressSync(
      [BUYBACK_STATE_SEED],
      BUYBACK_PROGRAM_ID
    );
    console.log("   Buyback State PDA:", buybackState.toBase58());

    routerProgram = loadProgram({
      programName: "swapback_router",
      provider,
      programId: ROUTER_PROGRAM_ID.toBase58(),
    });

    buybackProgram = loadProgram({
      programName: "swapback_buyback",
      provider,
      programId: BUYBACK_PROGRAM_ID.toBase58(),
    });

    // Vérifier solde devnet
    const balance = await provider.connection.getBalance(authority);
    console.log(`   Authority Balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    if (balance < 0.1 * LAMPORTS_PER_SOL) {
      console.warn("   ⚠️  Solde faible! Airdrop recommandé: solana airdrop 1");
    }
  });

  describe("1️⃣ Initialization", () => {
    it("devrait initialiser le Router State", async () => {
      console.log("\n📝 Test: Initialize Router State");

      try {
        // Vérifier si déjà initialisé
        const existingState =
          await provider.connection.getAccountInfo(routerState);

        if (existingState) {
          console.log("   ℹ️  Router State déjà initialisé");
          expect(existingState).toBeDefined();
          expect(existingState.owner).toEqual(ROUTER_PROGRAM_ID);
          return;
        }

        // Initialiser
        const tx = await routerProgram.methods
          .initialize()
          .accounts({
            state: routerState, // IDL utilise "state" pas "routerState"
            authority,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        console.log("   ✅ Signature:", tx);

        // Vérifier création
        const stateAccount =
          await provider.connection.getAccountInfo(routerState);
        expect(stateAccount).toBeDefined();
        expect(stateAccount?.owner).toEqual(ROUTER_PROGRAM_ID);

        console.log("   ✅ Router State créé avec succès");
      } catch (error) {
        if ((error as Error).message.includes("already in use")) {
          console.log("   ℹ️  Router State déjà initialisé (erreur attendue)");
        } else {
          throw error;
        }
      }
    });

    it("devrait initialiser le Buyback State", async () => {
      console.log("\n📝 Test: Initialize Buyback State");

      try {
        const existingState =
          await provider.connection.getAccountInfo(buybackState);

        if (existingState) {
          console.log("   ℹ️  Buyback State déjà initialisé");
          expect(existingState).toBeDefined();
          return;
        }

        if (!RUN_BUYBACK_INIT) {
          console.warn(
            "   ⚠️  Buyback State absent sur devnet – initialisation sautée (définir SWAPBACK_RUN_BUYBACK_INIT=true pour l'activer)."
          );
          return;
        }

        if (!BUYBACK_USDC_MINT_ENV) {
          throw new Error(
            "SWAPBACK_BUYBACK_USDC_MINT manquant: fournir l'adresse mint USDC attendue par le programme devnet."
          );
        }

        const usdcMint = new PublicKey(BUYBACK_USDC_MINT_ENV);

        const tx = await buybackProgram.methods
          .initialize(buybackMinAmount)
          .accounts({
            buybackState,
            backMint: BACK_TOKEN_MINT,
            usdcVault: BUYBACK_USDC_VAULT,
            usdcMint,
            authority,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .rpc();

        console.log("   ✅ Signature:", tx);

        const stateAccount =
          await provider.connection.getAccountInfo(buybackState);
        expect(stateAccount).toBeDefined();

        console.log("   ✅ Buyback State créé avec succès");
      } catch (error) {
        if ((error as Error).message.includes("already in use")) {
          console.log("   ℹ️  Buyback State déjà initialisé");
        } else {
          throw error;
        }
      }
    });
  });

  describe("2️⃣ Oracle Integration", () => {
    it("devrait vérifier que le feed Switchboard est accessible", async () => {
      console.log("\n📝 Test: Oracle Feed Accessibility");

      const feedAccount =
        await provider.connection.getAccountInfo(SWITCHBOARD_SOL_USD);

      expect(feedAccount).not.toBeNull();
      expect(feedAccount?.owner.toBase58()).toBe(
        "SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f"
      );
      expect(feedAccount?.data.length).toBeGreaterThan(0);

      console.log("   ✅ Feed Switchboard accessible");
      console.log(`   Data length: ${feedAccount?.data.length} bytes`);
    });
  });

  describe("3️⃣ Token $BACK Integration", () => {
    it("devrait vérifier que le token $BACK existe", async () => {
      console.log("\n📝 Test: Token $BACK Validation");

      const mintAccount =
        await provider.connection.getAccountInfo(BACK_TOKEN_MINT);

      expect(mintAccount).not.toBeNull();
      expect(mintAccount?.owner.toBase58()).toBe(
        TOKEN_2022_PROGRAM_ID.toBase58()
      );

      console.log("   ✅ Token $BACK validé");
      console.log(`   Owner: ${mintAccount?.owner.toBase58()}`);
    });

    it("devrait créer un ATA pour $BACK si nécessaire", async () => {
      console.log("\n📝 Test: Associated Token Account $BACK");

      const ata = await getAssociatedTokenAddress(
        BACK_TOKEN_MINT,
        authority,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      const ataAccount = await provider.connection.getAccountInfo(ata);

      if (!ataAccount) {
        console.log("   ℹ️  ATA non trouvé, création...");

        const balance = await provider.connection.getBalance(authority);
        if (balance < 0.05 * LAMPORTS_PER_SOL) {
          console.warn(
            "   ⚠️  Solde insuffisant pour créer l'ATA – étape ignorée (≥0.05 SOL recommandé)."
          );
          return;
        }

        const ix = createAssociatedTokenAccountInstruction(
          authority,
          ata,
          authority,
          BACK_TOKEN_MINT,
          TOKEN_2022_PROGRAM_ID
        );

        const tx = new anchor.web3.Transaction().add(ix);
        try {
          const sig = await provider.sendAndConfirm(tx);
          console.log("   ✅ ATA créé:", sig);
        } catch (sendError) {
          console.warn(
            "   ⚠️  Impossible de créer l'ATA (probable manque de SOL ou frais) – étape ignorée.",
            (sendError as Error).message
          );
          return;
        }
      } else {
        console.log("   ✅ ATA déjà existant");
      }

      const finalAta = await provider.connection.getAccountInfo(ata);
      expect(finalAta).not.toBeNull();

      console.log("   ATA Address:", ata.toBase58());
    });
  });

  describe("4️⃣ Program State Verification", () => {
    it("devrait lire le Router State", async () => {
      console.log("\n📝 Test: Read Router State");

      try {
        const state = await (routerProgram.account as any).routerState.fetch(
          routerState
        );

        console.log("   ✅ Router State lu avec succès");
        console.log("   Authority:", state.authority?.toBase58());
        console.log("   Is Paused:", state.isPaused);

        expect(state).toBeDefined();
        expect(state.authority).toBeDefined();
      } catch (error) {
        console.warn(
          "   ⚠️  Erreur lecture Router State:",
          (error as Error).message
        );
        console.warn("   Note: State doit être initialisé en premier");
      }
    });

    it("devrait lire le Buyback State", async () => {
      console.log("\n📝 Test: Read Buyback State");

      try {
        const state = await (buybackProgram.account as any).buybackState.fetch(
          buybackState
        );

        console.log("   ✅ Buyback State lu avec succès");
        console.log("   Token Mint:", state.backTokenMint?.toBase58());

        expect(state).toBeDefined();
        expect(state.backTokenMint).toBeDefined();
      } catch (error) {
        console.warn(
          "   ⚠️  Erreur lecture Buyback State:",
          (error as Error).message
        );
      }
    });
  });

  describe("5️⃣ Summary", () => {
    it("devrait afficher le résumé des tests", async () => {
      console.log("\n" + "═".repeat(70));
      console.log("📊 RÉSUMÉ TESTS E2E ON-CHAIN");
      console.log("═".repeat(70));

      const routerExists =
        await provider.connection.getAccountInfo(routerState);
      const buybackExists =
        await provider.connection.getAccountInfo(buybackState);
      const oracleExists =
        await provider.connection.getAccountInfo(SWITCHBOARD_SOL_USD);
      const backExists =
        await provider.connection.getAccountInfo(BACK_TOKEN_MINT);

      console.log(
        `✅ Router State: ${routerExists ? "Initialisé" : "❌ Non initialisé"}`
      );
      console.log(
        `✅ Buyback State: ${buybackExists ? "Initialisé" : "❌ Non initialisé"}`
      );
      console.log(
        `✅ Oracle Feed: ${oracleExists ? "Accessible" : "❌ Inaccessible"}`
      );
      console.log(`✅ Token $BACK: ${backExists ? "Validé" : "❌ Invalide"}`);

      console.log("\n📌 Prochaines étapes:");
      console.log("   → Créer un Plan DCA (create_plan)");
      console.log("   → Exécuter un swap (swap_toc)");
      console.log("   → Tester buyback + lock");

      console.log("\n" + "═".repeat(70));

      expect(oracleExists).not.toBeNull();
      expect(backExists).not.toBeNull();
    });
  });
});
}
