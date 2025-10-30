/**
 * Tests On-Chain E2E - Router Program
 * Teste le programme Router déployé sur devnet avec oracle Switchboard et token $BACK
 */
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { expect, beforeAll, describe } from "vitest";
import { loadProgram } from "./utils/load-idl";

const RUN_ANCHOR_TESTS = process.env.SWAPBACK_RUN_ANCHOR_TESTS === "true";

if (!RUN_ANCHOR_TESTS) {
  console.warn("⏭️  Skip Router On-Chain E2E tests (set SWAPBACK_RUN_ANCHOR_TESTS=true to enable).");
  describe.skip("🚀 Router On-Chain E2E Tests", () => {});
} else {
describe("🚀 Router On-Chain E2E Tests", () => {
  const provider = process.env.ANCHOR_PROVIDER_URL
    ? AnchorProvider.env()
    : AnchorProvider.local("https://api.devnet.solana.com");
  anchor.setProvider(provider);

  // Program ID déployé sur devnet
  const ROUTER_PROGRAM_ID = new PublicKey(
    "3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap"
  );

  const ROUTER_STATE_AUTHORITY = new PublicKey(
    process.env.SWAPBACK_ROUTER_AUTHORITY_BASE58 ??
      "578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf"
  );

  // Oracle Switchboard SOL/USD
  const SWITCHBOARD_SOL_USD = new PublicKey(
    "GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR"
  );

  // Token $BACK
  const BACK_TOKEN_MINT = new PublicKey(
    "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux"
  );

  let program: Program;

  beforeAll(async () => {
    program = loadProgram({
      programName: "swapback_router",
      provider,
      programId: ROUTER_PROGRAM_ID.toBase58(),
    });
    console.log("\n✅ Programme Router chargé:", ROUTER_PROGRAM_ID.toBase58());
  });

  describe("📊 1. Initialisation Router State", () => {
    it("Devrait initialiser le router state", async () => {
      console.log("\n🔧 Test initialize router...");

      // Dériver PDA pour router_state
      // Seeds: [b"router_state"] (PAS d'authority - vérifié dans lib.rs)
      const [routerStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("router_state")],
        program.programId
      );

      console.log("   Router State PDA:", routerStatePda.toBase58());
      console.log("   Authority:", provider.wallet.publicKey.toBase58());

      const existingState = await provider.connection.getAccountInfo(
        routerStatePda
      );

      if (!existingState) {
        throw new Error(
          "Router state absent sur devnet – vérifier le déploiement ou mettre à jour l'authority attendue."
        );
      }

      console.log("   ℹ️  Router State déjà initialisé");

      const accountData = existingState.data;
      console.log("   Data length:", accountData.length, "bytes");

      const authorityBytes = accountData.slice(8, 40);
      const authority = new PublicKey(authorityBytes);
      const paused = accountData.readUInt8(40) === 1;

      console.log("   Authority actuelle:", authority.toBase58());
      console.log("   Paused:", paused);

      expect(authority.toBase58()).to.equal(
        ROUTER_STATE_AUTHORITY.toBase58()
      );
      expect(paused).to.equal(false);

      console.log("   ✅ State validé contre l'authority attendue");
    });
  });

  describe("🔮 2. Oracle Switchboard", () => {
    it("Devrait lire le prix depuis Switchboard", async () => {
      console.log("\n🔮 Test lecture oracle Switchboard...");

      const feedAccount =
        await provider.connection.getAccountInfo(SWITCHBOARD_SOL_USD);

      expect(feedAccount).to.not.be.null;
      expect(feedAccount?.owner.toBase58()).to.equal(
        "SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f"
      );

      console.log("   ✅ Feed Switchboard accessible");
      console.log("   Feed:", SWITCHBOARD_SOL_USD.toBase58());
    });
  });

  describe("💰 3. Token $BACK", () => {
    it("Devrait valider le token $BACK", async () => {
      console.log("\n💰 Test token $BACK...");

      const mintAccount =
        await provider.connection.getAccountInfo(BACK_TOKEN_MINT);

      expect(mintAccount).to.not.be.null;
      expect(mintAccount?.owner.toBase58()).to.equal(
        "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" // Token-2022
      );

      console.log("   ✅ Token $BACK validé");
      console.log("   Mint:", BACK_TOKEN_MINT.toBase58());
    });
  });

  describe("📝 4. Create Plan (TODO)", () => {
    it.skip("Devrait créer un plan DCA avec oracle Switchboard", async () => {
      // TODO: Implémenter après avoir vérifié la structure exacte des comptes
      console.log("\n📝 Test create_plan (à implémenter)...");
    });
  });

  describe("🔄 5. Swap TOC (TODO)", () => {
    it.skip("Devrait exécuter un swap avec buyback $BACK", async () => {
      // TODO: Implémenter après create_plan
      console.log("\n🔄 Test swap_toc (à implémenter)...");
    });
  });
});
}
