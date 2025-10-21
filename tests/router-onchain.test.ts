/**
 * Tests On-Chain E2E - Router Program
 * Teste le programme Router déployé sur devnet avec oracle Switchboard et token $BACK
 */
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect, beforeAll } from "vitest";

describe("🚀 Router On-Chain E2E Tests", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);

  // Program ID déployé sur devnet
  const ROUTER_PROGRAM_ID = new PublicKey(
    "3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap"
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
    // Charger le programme depuis l'IDL on-chain
    const idl = await Program.fetchIdl(ROUTER_PROGRAM_ID, provider);
    if (!idl) {
      throw new Error(
        "IDL non trouvé on-chain. Uploader avec: anchor idl upgrade"
      );
    }
    program = new Program(idl, provider);
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

      try {
        // Vérifier si déjà initialisé
        const existingState =
          await provider.connection.getAccountInfo(routerStatePda);

        if (existingState) {
          console.log("   ℹ️  Router State déjà initialisé");

          // Lire les données brutes (IDL n'expose pas account.state)
          const accountData = existingState.data;
          console.log("   Data length:", accountData.length, "bytes");

          // Parser manuellement: authority (32 bytes) + paused (1 byte) + padding
          const authorityBytes = accountData.slice(8, 40); // après discriminator 8 bytes
          const authority = new PublicKey(authorityBytes);
          const paused = accountData.readUInt8(40) === 1;

          console.log("   Authority actuelle:", authority.toBase58());
          console.log("   Paused:", paused);

          expect(authority.toBase58()).to.equal(
            provider.wallet.publicKey.toBase58()
          );
          return;
        }

        // Initialiser
        const tx = await program.methods
          .initialize()
          .accounts({
            state: routerStatePda,
            authority: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        console.log("   ✅ Router initialisé. Signature:", tx);

        // Vérifier (lecture brute)
        const accountInfo =
          await provider.connection.getAccountInfo(routerStatePda);
        if (!accountInfo) {
          throw new Error("Router state non créé");
        }

        const authorityBytes = accountInfo.data.slice(8, 40);
        const authority = new PublicKey(authorityBytes);
        const paused = accountInfo.data.readUInt8(40) === 1;

        expect(authority.toBase58()).to.equal(
          provider.wallet.publicKey.toBase58()
        );
        expect(paused).to.equal(false);

        console.log("   ✅ State validé");
      } catch (error) {
        console.error("   ❌ Erreur:", error);
        throw error;
      }
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
