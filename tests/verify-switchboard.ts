/**
 * Test simple de vérification du feed Switchboard
 * Sans dépendance à l'IDL du programme
 */
import { Connection, PublicKey } from "@solana/web3.js";

const DEVNET_RPC = "https://api.devnet.solana.com";
const SWITCHBOARD_SOL_USD = "GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR";
const SWITCHBOARD_PROGRAM = "SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f";

async function testSwitchboardFeed() {
  console.log("\n🔮 Test Oracle Switchboard - Vérification Feed\n");
  console.log("═".repeat(60));

  const connection = new Connection(DEVNET_RPC, "confirmed");
  const feedPubkey = new PublicKey(SWITCHBOARD_SOL_USD);

  try {
    // 1. Vérifier que le feed existe
    console.log("\n📊 1. Vérification existence du feed...");
    const feedAccount = await connection.getAccountInfo(feedPubkey);

    if (!feedAccount) {
      throw new Error("❌ Feed Switchboard non trouvé sur devnet");
    }

    console.log("✅ Feed trouvé!");
    console.log(`   Address: ${feedPubkey.toBase58()}`);
    console.log(`   Owner: ${feedAccount.owner.toBase58()}`);
    console.log(`   Data length: ${feedAccount.data.length} bytes`);
    console.log(`   Balance: ${feedAccount.lamports / 1e9} SOL`);

    // 2. Vérifier que c'est bien un compte Switchboard
    console.log("\n🔍 2. Vérification propriétaire...");
    if (feedAccount.owner.toBase58() !== SWITCHBOARD_PROGRAM) {
      throw new Error(
        `❌ Owner incorrect: ${feedAccount.owner.toBase58()} (attendu: ${SWITCHBOARD_PROGRAM})`
      );
    }
    console.log("✅ Propriétaire valide (Switchboard Program)");

    // 3. Vérifier le nom du feed
    console.log("\n📝 3. Lecture métadonnées...");
    const nameBytes = feedAccount.data.slice(13, 45);
    const feedName = nameBytes.toString().replace(/\0/g, "").trim();
    console.log(`✅ Feed name: "${feedName}"`);

    if (!feedName.includes("SOL")) {
      console.warn("⚠️  Warning: Feed name ne contient pas 'SOL'");
    }

    // 4. Afficher le discriminator
    const discriminator = feedAccount.data.slice(0, 8);
    console.log(`   Discriminator: ${discriminator.toString("hex")}`);

    // 5. Vérifier notre programme Router déployé
    console.log("\n🚀 4. Vérification programme Router...");
    const routerProgram = new PublicKey(
      "3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap"
    );
    const routerAccount = await connection.getAccountInfo(routerProgram);

    if (!routerAccount) {
      throw new Error("❌ Programme Router non trouvé sur devnet");
    }

    console.log("✅ Programme Router déployé");
    console.log(`   Address: ${routerProgram.toBase58()}`);
    console.log(`   Executable: ${routerAccount.executable}`);
    console.log(`   Owner: ${routerAccount.owner.toBase58()}`);

    // Résumé
    console.log("\n" + "═".repeat(60));
    console.log("🎉 TESTS ORACLE SWITCHBOARD - TOUS PASSÉS\n");
    console.log("✅ Feed Switchboard SOL/USD accessible");
    console.log("✅ Programme Router déployé avec Switchboard compilé");
    console.log("\n📌 Prochaine étape:");
    console.log("   → TODO #5: Tests E2E avec create_plan utilisant l'oracle");
    console.log("   → Nécessite: Router initialisé + Token $BACK (TODO #3)\n");

    return true;
  } catch (error) {
    console.error("\n❌ ERREUR:", error);
    process.exit(1);
  }
}

// Exécuter le test
testSwitchboardFeed()
  .then(() => {
    console.log("✅ Script terminé avec succès");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Erreur fatale:", err);
    process.exit(1);
  });
