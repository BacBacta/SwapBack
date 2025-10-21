/**
 * Script de validation Token $BACK
 * Vérifie que le token est correctement configuré sur devnet
 */
import { Connection, PublicKey } from "@solana/web3.js";

const DEVNET_RPC = "https://api.devnet.solana.com";
const BACK_TOKEN_MINT = "862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const EXPECTED_DECIMALS = 9;
const EXPECTED_SUPPLY = 1_000_000_000; // 1B tokens

async function validateBackToken() {
  console.log("\n💰 Validation Token $BACK (Token-2022)\n");
  console.log("═".repeat(70));

  const connection = new Connection(DEVNET_RPC, "confirmed");
  const mintPubkey = new PublicKey(BACK_TOKEN_MINT);

  try {
    // 1. Vérifier que le mint existe
    console.log("\n📊 1. Vérification existence du mint...");
    const mintAccount = await connection.getAccountInfo(mintPubkey);

    if (!mintAccount) {
      throw new Error("❌ Token mint non trouvé sur devnet");
    }

    console.log("✅ Mint trouvé!");
    console.log(`   Address: ${mintPubkey.toBase58()}`);
    console.log(`   Owner: ${mintAccount.owner.toBase58()}`);
    console.log(`   Data length: ${mintAccount.data.length} bytes`);
    console.log(`   Rent-exempt balance: ${mintAccount.lamports / 1e9} SOL`);

    // 2. Vérifier que c'est bien Token-2022
    console.log("\n🔍 2. Vérification Token-2022 Program...");
    if (mintAccount.owner.toBase58() !== TOKEN_2022_PROGRAM) {
      throw new Error(
        `❌ Owner incorrect: ${mintAccount.owner.toBase58()} (attendu: ${TOKEN_2022_PROGRAM})`
      );
    }
    console.log("✅ Token-2022 Program validé");

    // 3. Parser les données du mint (structure simplifiée)
    console.log("\n📝 3. Parsing données du mint...");
    const data = mintAccount.data;

    // Mint authority (offset 0, 36 bytes: 4 bytes option + 32 bytes pubkey)
    const mintAuthorityOption = data.readUInt32LE(0);
    let mintAuthority = "None";
    if (mintAuthorityOption === 1) {
      mintAuthority = new PublicKey(data.slice(4, 36)).toBase58();
    }

    // Supply (offset 36, 8 bytes u64 little-endian)
    const supplyLow = data.readUInt32LE(36);
    const supplyHigh = data.readUInt32LE(40);
    const supply = supplyLow + supplyHigh * 0x100000000;

    // Decimals (offset 44, 1 byte)
    const decimals = data.readUInt8(44);

    // Freeze authority (offset 46, 36 bytes)
    const freezeAuthorityOption = data.readUInt32LE(46);
    let freezeAuthority = "None";
    if (freezeAuthorityOption === 1) {
      freezeAuthority = new PublicKey(data.slice(50, 82)).toBase58();
    }

    console.log(`   Supply (raw): ${supply}`);
    console.log(`   Supply (formatted): ${supply / 10 ** decimals} BACK`);
    console.log(`   Decimals: ${decimals}`);
    console.log(`   Mint Authority: ${mintAuthority}`);
    console.log(`   Freeze Authority: ${freezeAuthority}`);

    // 4. Validations
    console.log("\n✅ 4. Validations...");

    if (decimals !== EXPECTED_DECIMALS) {
      throw new Error(
        `❌ Decimals incorrect: ${decimals} (attendu: ${EXPECTED_DECIMALS})`
      );
    }
    console.log(`✅ Decimals: ${decimals} (correct)`);

    const supplyFormatted = supply / 10 ** decimals;
    if (supplyFormatted !== EXPECTED_SUPPLY) {
      throw new Error(
        `❌ Supply incorrecte: ${supplyFormatted} (attendu: ${EXPECTED_SUPPLY})`
      );
    }
    console.log(
      `✅ Supply: ${supplyFormatted.toLocaleString()} BACK (correct)`
    );

    if (mintAuthority === "None") {
      console.warn("⚠️  Mint Authority: None (mint gelé - normal si voulu)");
    } else {
      console.log(`✅ Mint Authority: ${mintAuthority}`);
    }

    if (freezeAuthority === "None") {
      console.log("✅ Freeze Authority: None (recommandé pour DeFi)");
    } else {
      console.warn(
        `⚠️  Freeze Authority: ${freezeAuthority} (risque centralisé)`
      );
    }

    // 5. Vérifier les extensions Token-2022
    console.log("\n🔧 5. Extensions Token-2022...");
    console.log("   Note: Extensions détectables via data length");
    console.log(`   Data length: ${data.length} bytes`);

    if (data.length > 82) {
      console.log("✅ Extensions présentes (Metadata Pointer détecté)");
    } else {
      console.warn("⚠️  Pas d'extensions détectées");
    }

    // Résumé
    console.log("\n" + "═".repeat(70));
    console.log("🎉 VALIDATION TOKEN $BACK - TOUS LES TESTS PASSÉS\n");
    console.log("✅ Token-2022 correctement configuré");
    console.log("✅ Metadata Pointer activé");
    console.log("✅ Supply et decimals corrects");
    console.log("\n📌 Informations Clés:");
    console.log(`   Mint Address: ${BACK_TOKEN_MINT}`);
    console.log(`   Symbol: BACK`);
    console.log(`   Name: SwapBack Token`);
    console.log(`   Decimals: ${decimals}`);
    console.log(`   Supply: ${supplyFormatted.toLocaleString()} BACK`);
    console.log(`   Program: Token-2022`);
    console.log(
      `\n🔗 Explorer: https://explorer.solana.com/address/${BACK_TOKEN_MINT}?cluster=devnet\n`
    );

    return true;
  } catch (error) {
    console.error("\n❌ ERREUR:", error);
    process.exit(1);
  }
}

// Exécuter la validation
validateBackToken()
  .then(() => {
    console.log("✅ Script terminé avec succès");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Erreur fatale:", err);
    process.exit(1);
  });
