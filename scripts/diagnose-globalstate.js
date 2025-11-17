#!/usr/bin/env node
/**
 * Diagnostic du problème GlobalState
 * Vérifie l'état actuel et fournit les solutions
 */

const { Connection, PublicKey } = require("@solana/web3.js");

const CNFT_PROGRAM_ID = process.env.NEXT_PUBLIC_CNFT_PROGRAM_ID || "GEkXCcq87yUjQSp5EqcWf7bw9GKrB39A1LWdsE7V3V2E";
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

async function main() {
  console.log("\n🔍 Diagnostic du GlobalState CNFT\n");
  console.log("=" .repeat(60));

  const connection = new Connection(RPC_URL, "confirmed");
  const cnftProgramId = new PublicKey(CNFT_PROGRAM_ID);

  // Dériver le PDA GlobalState
  const [globalStatePDA, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    cnftProgramId
  );

  console.log(`\n📍 Program ID: ${cnftProgramId.toString()}`);
  console.log(`🔑 Global State PDA: ${globalStatePDA.toString()}`);
  console.log(`🔢 Bump: ${bump}\n`);

  // Vérifier le compte
  console.log("🔍 Vérification du compte...\n");
  const accountInfo = await connection.getAccountInfo(globalStatePDA);

  if (!accountInfo) {
    console.log("❌ PROBLÈME: GlobalState n'existe pas!");
    console.log("\n📋 SOLUTION:");
    console.log("   Le compte doit être initialisé avec les 4 nouveaux wallets.");
    console.log("\n💡 Commandes:");
    console.log("   # 1. Obtenir du SOL devnet");
    console.log("   solana airdrop 1 --url devnet");
    console.log("\n   # 2. Initialiser GlobalState");
    console.log("   node scripts/reinit-cnft-globalstate.js");
    console.log("\n");
    return;
  }

  console.log("✅ GlobalState existe");
  console.log(`   Taille: ${accountInfo.data.length} bytes`);
  console.log(`   Lamports: ${accountInfo.lamports}`);
  console.log(`   Owner: ${accountInfo.owner.toString()}\n`);

  // Analyser la structure
  const discriminator = accountInfo.data.slice(0, 8);
  console.log(`🔖 Discriminator: ${discriminator.toString('hex')}`);

  // Structure attendue (nouveau format)
  // 8 bytes: discriminator
  // 32 bytes: authority
  // 32 bytes: treasury_wallet
  // 32 bytes: boost_vault_wallet
  // 32 bytes: buyback_wallet
  // 32 bytes: npi_vault_wallet
  // 9 * 8 bytes: u64 fields (total_community_boost, etc.)
  const expectedSize = 8 + 32 + 32 + 32 + 32 + 32 + 9 * 8;

  console.log(`\n📏 Taille du compte:`);
  console.log(`   Actuelle: ${accountInfo.data.length} bytes`);
  console.log(`   Attendue (nouveau format): ${expectedSize} bytes`);

  if (accountInfo.data.length < expectedSize) {
    console.log("\n❌ PROBLÈME IDENTIFIÉ:");
    console.log("   Le compte GlobalState a l'ANCIEN FORMAT (sans les 4 wallets)");
    console.log("   Il manque les champs: treasury_wallet, boost_vault_wallet,");
    console.log("   buyback_wallet, npi_vault_wallet");
    
    console.log("\n🔧 CAUSE:");
    console.log("   Vous avez modifié le programme Rust (ajout de 4 wallets)");
    console.log("   mais le compte on-chain a l'ancienne structure.");
    
    console.log("\n📋 SOLUTION:");
    console.log("   Il faut redéployer le programme et réinitialiser GlobalState.");
    
    console.log("\n💡 Étapes:");
    console.log("   # 1. Obtenir du SOL devnet (si nécessaire)");
    console.log("   solana airdrop 1 --url devnet");
    
    console.log("\n   # 2. Rebuild le programme");
    console.log("   anchor build");
    
    console.log("\n   # 3. Fermer l'ancien IDL et compte");
    console.log("   anchor idl close --provider.cluster devnet");
    
    console.log("\n   # 4. Redéployer");
    console.log("   anchor deploy --provider.cluster devnet");
    
    console.log("\n   # 5. Initialiser le nouveau GlobalState");
    console.log("   node scripts/reinit-cnft-globalstate.js");
    
    console.log("\n⚠️  ATTENTION:");
    console.log("   Cette opération fermera l'ancien compte et toutes");
    console.log("   ses données seront perdues. Assurez-vous que c'est");
    console.log("   bien ce que vous voulez sur DEVNET.\n");
    
  } else if (accountInfo.data.length === expectedSize) {
    console.log("\n✅ TOUT EST OK!");
    console.log("   Le compte a la bonne taille (nouveau format).");
    
    // Lire les wallets
    try {
      const authority = new PublicKey(accountInfo.data.slice(8, 40));
      const treasury = new PublicKey(accountInfo.data.slice(40, 72));
      const boost = new PublicKey(accountInfo.data.slice(72, 104));
      const buyback = new PublicKey(accountInfo.data.slice(104, 136));
      const npiVault = new PublicKey(accountInfo.data.slice(136, 168));
      
      console.log("\n🔐 Wallets configurés:");
      console.log(`   Authority:  ${authority.toString()}`);
      console.log(`   Treasury:   ${treasury.toString()}`);
      console.log(`   Boost:      ${boost.toString()}`);
      console.log(`   Buyback:    ${buyback.toString()}`);
      console.log(`   NPI Vault:  ${npiVault.toString()}`);
      
    } catch (error) {
      console.log("\n⚠️  Impossible de lire les wallets (données corrompues?)");
    }
    
    console.log("\n💡 Si vous voyez toujours l'erreur 'AccountDidNotDeserialize':");
    console.log("   1. Vérifiez que le programme déployé correspond au code local");
    console.log("   2. Rebuild et redeploy si nécessaire");
    console.log("   3. Vérifiez l'IDL avec: anchor idl fetch --provider.cluster devnet");
    
  } else {
    console.log("\n⚠️  Taille inattendue!");
    console.log("   Le compte est plus grand que prévu.");
    console.log("   Vérifiez la structure dans programs/swapback_cnft/src/lib.rs\n");
  }

  console.log("\n" + "=".repeat(60) + "\n");
}

main().catch(error => {
  console.error("\n❌ Erreur:", error.message);
  process.exit(1);
});
