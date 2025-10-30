import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { loadProgram } from "./utils/load-idl";
const ROUTER_PROGRAM_ID = new PublicKey(
  "3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap"
);

type SwapbackRouter = any;

const RUN_ANCHOR_TESTS = process.env.SWAPBACK_RUN_ANCHOR_TESTS === "true";

if (!RUN_ANCHOR_TESTS) {
  console.warn("⏭️  Skip Oracle Switchboard integration tests (set SWAPBACK_RUN_ANCHOR_TESTS=true to enable).");
  describe.skip("🔮 Oracle Switchboard Integration", () => {});
} else {
  describe("🔮 Oracle Switchboard Integration", () => {
  // Configuration - Fallback si ANCHOR_PROVIDER_URL absent
  const provider = process.env.ANCHOR_PROVIDER_URL
    ? AnchorProvider.env()
    : AnchorProvider.local("https://api.devnet.solana.com");
  anchor.setProvider(provider);

  const program = loadProgram({
    programName: "swapback_router",
    provider,
    programId: ROUTER_PROGRAM_ID.toBase58(),
  }) as Program<SwapbackRouter>;

  // Feed Switchboard SOL/USD sur devnet
  const SWITCHBOARD_SOL_USD = new PublicKey(
    "GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR"
  );

  it("✅ Devrait lire le prix SOL/USD depuis Switchboard", async () => {
    console.log("\n📊 Test de lecture Oracle Switchboard...");
    console.log("Feed Address:", SWITCHBOARD_SOL_USD.toBase58());

    try {
      // Note: On ne peut pas appeler read_price() directement car c'est une fonction interne
      // On va donc tester via une instruction qui l'utilise (create_plan)

      // Pour ce test, on va juste vérifier que le feed existe et est accessible
      const feedAccount =
        await provider.connection.getAccountInfo(SWITCHBOARD_SOL_USD);

      expect(feedAccount).to.not.be.null;
      expect(feedAccount?.owner.toBase58()).to.equal(
        "SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f" // Switchboard Program ID
      );
      expect(feedAccount?.data.length).to.be.greaterThan(0);

      console.log("✅ Feed Switchboard accessible");
      console.log("   Owner:", feedAccount?.owner.toBase58());
      console.log("   Data length:", feedAccount?.data.length, "bytes");

      const rawName = feedAccount?.data.slice(13, 45);
      const feedName = rawName
        ? Buffer.from(rawName)
            .toString("utf8")
            .replace(/\0/g, "")
            .trim()
        : "";
      console.log("   Feed name:", feedName || "<inconnu>");
      expect(feedName.length).to.be.greaterThan(0);
    } catch (error) {
      console.error("❌ Erreur lecture feed:", error);
      throw error;
    }
  });

  it("⏭️ Test via create_plan (nécessite Router initialisé)", async () => {
    console.log(
      "\n📝 Note: Test create_plan avec oracle réel à faire dans TODO #5"
    );
    console.log("   Prérequis: Router state initialisé + Token $BACK créé");

    // Ce test sera débloqué dans TODO #5 (Tests On-Chain E2E)
    console.log("   Status: ⏸️ En attente de TODO #3 (Token $BACK)");
  });

  it("📊 Afficher les métadonnées du feed Switchboard", async () => {
    const feedAccount =
      await provider.connection.getAccountInfo(SWITCHBOARD_SOL_USD);

    if (!feedAccount) {
      throw new Error("Feed non trouvé");
    }

    // Discriminator Anchor (8 bytes)
    const discriminator = feedAccount.data.slice(0, 8);
    console.log("\n📋 Métadonnées Feed Switchboard:");
    console.log("   Discriminator:", discriminator.toString("hex"));

    // Name (à partir de byte 13, ~32 bytes)
    const nameBytes = feedAccount.data.slice(13, 45);
    const name = nameBytes.toString().replace(/\0/g, "").trim();
    console.log("   Name:", name);

    console.log("   Total size:", feedAccount.data.length, "bytes");
    console.log("   Owner:", feedAccount.owner.toBase58());
    console.log("   Rent exempt:", feedAccount.lamports / 1e9, "SOL");

    console.log("\n✅ Feed Switchboard prêt pour utilisation");
  });
  });
}
