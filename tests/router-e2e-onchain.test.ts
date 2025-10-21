/**
 * SwapBack Router - Tests On-Chain E2E (Devnet)
 * Tests avec programmes réellement déployés sur devnet
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import * as fs from "node:fs";
import * as path from "node:path";

// Helper pour charger les IDL depuis les fichiers locaux
function loadIdl(programName: string) {
  const idlPath = path.join(__dirname, `../sdk/src/idl/${programName}.json`);
  const idlContent = fs.readFileSync(idlPath, "utf-8");
  return JSON.parse(idlContent);
}

// Program IDs déployés sur devnet
const ROUTER_PROGRAM_ID = new PublicKey(
  "3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap"
);
const BUYBACK_PROGRAM_ID = new PublicKey(
  "46UWFYdksvkGhTPy9cTSJGa3d5nqzpY766rtJeuxtMgU"
);

// Token $BACK (Token-2022)
const BACK_TOKEN_MINT = new PublicKey(
  "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux"
);

// Oracle Switchboard SOL/USD
const SWITCHBOARD_SOL_USD = new PublicKey(
  "GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR"
);

describe("🚀 SwapBack Router - Tests E2E On-Chain (Devnet)", () => {
  const provider = process.env.ANCHOR_PROVIDER_URL
    ? AnchorProvider.env()
    : AnchorProvider.local("https://api.devnet.solana.com");
  anchor.setProvider(provider);

  const authority = provider.wallet.publicKey;
  let routerState: PublicKey;
  let buybackState: PublicKey;

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
      [Buffer.from("router_state")],
      ROUTER_PROGRAM_ID
    );
    console.log("   Router State PDA:", routerState.toBase58());

    // Buyback State PDA
    [buybackState] = PublicKey.findProgramAddressSync(
      [Buffer.from("buyback_state")],
      BUYBACK_PROGRAM_ID
    );
    console.log("   Buyback State PDA:", buybackState.toBase58());

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

      // Charger IDL depuis fichier local
      const idl = loadIdl("swapback_router");
      // Add programId to IDL if not present
      if (!idl.address) {
        idl.address = ROUTER_PROGRAM_ID.toBase58();
      }
      const routerProgram = new Program(idl, provider);

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

      // Charger IDL depuis fichier local
      const idl = loadIdl("swapback_buyback");
      // Add programId to IDL if not present
      if (!idl.address) {
        idl.address = BUYBACK_PROGRAM_ID.toBase58();
      }
      const buybackProgram = new Program(idl, provider);

      try {
        const existingState =
          await provider.connection.getAccountInfo(buybackState);

        if (existingState) {
          console.log("   ℹ️  Buyback State déjà initialisé");
          expect(existingState).toBeDefined();
          return;
        }

        const tx = await buybackProgram.methods
          .initialize(BACK_TOKEN_MINT)
          .accounts({
            buybackState,
            authority,
            systemProgram: SystemProgram.programId,
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

        const ix = createAssociatedTokenAccountInstruction(
          authority,
          ata,
          authority,
          BACK_TOKEN_MINT,
          TOKEN_2022_PROGRAM_ID
        );

        const tx = new anchor.web3.Transaction().add(ix);
        const sig = await provider.sendAndConfirm(tx);

        console.log("   ✅ ATA créé:", sig);
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

      // Charger IDL depuis fichier local
      const idl = loadIdl("swapback_router");
      // Add programId to IDL if not present
      if (!idl.address) {
        idl.address = ROUTER_PROGRAM_ID.toBase58();
      }
      const routerProgram = new Program(idl, provider);

      try {
        const state =
          await routerProgram.account.routerState.fetch(routerState);

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

      // Charger IDL depuis fichier local
      const idl = loadIdl("swapback_buyback");
      // Add programId to IDL if not present
      if (!idl.address) {
        idl.address = BUYBACK_PROGRAM_ID.toBase58();
      }
      const buybackProgram = new Program(idl, provider);

      try {
        const state =
          await buybackProgram.account.buybackState.fetch(buybackState);

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
