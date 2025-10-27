/**
 * Script de test pour Swap avec Boost
 * 
 * Ce script simule un swap en utilisant le boost du cNFT détenu par l'utilisateur.
 * Le boost est appliqué au rebate USDC de base (3 USDC).
 * 
 * Workflow:
 * 1. Vérifier que l'utilisateur a un UserNft actif
 * 2. Lire le boost du UserNft (ex: 900 bp = 9%)
 * 3. Calculer le rebate avec boost : BASE (3 USDC) * (1 + 0.09) = 3.27 USDC
 * 4. Appeler l'instruction swap_toc du Router
 * 5. Vérifier le paiement du rebate
 * 
 * Note: Pour ce test, nous simulons juste la lecture du boost et le calcul
 * du rebate. L'exécution complète du swap nécessiterait un pool Orca configuré.
 */

const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const { getAccount } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");

// Configuration devnet
const NETWORK = "https://api.devnet.solana.com";
const CNFT_PROGRAM_ID = new PublicKey("9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw");
const ROUTER_PROGRAM_ID = new PublicKey("GTNyqcgqKHRu3o636WkrZfF6EjJu1KP62Bqdo52t3cgt");
const BACK_MINT = new PublicKey("14rtHCJVvU7NKeFJotJsHdbsQGajnNmoQ7MHid41RLTa");
const USDC_MINT = new PublicKey("BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR");

// Paramètres du swap (simulé)
const BASE_REBATE_USDC = 3_000_000; // 3 USDC (6 decimals)
const SWAP_AMOUNT_IN = 10_000_000_000; // 10 BACK (9 decimals)

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║         🔄 TEST SWAP AVEC BOOST cNFT - Devnet              ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const connection = new Connection(NETWORK, "confirmed");

  // Charger le wallet
  const walletPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log(`👤 Wallet: ${payer.publicKey.toString()}`);
  
  const balance = await connection.getBalance(payer.publicKey);
  console.log(`💰 Solde SOL: ${(balance / 1e9).toFixed(4)} SOL\n`);

  // ========================================
  // ÉTAPE 1: Vérifier le UserNft
  // ========================================
  console.log("═".repeat(60));
  console.log("ÉTAPE 1: Vérification du UserNft et boost");
  console.log("═".repeat(60));

  const [userNftPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_nft"), payer.publicKey.toBuffer()],
    CNFT_PROGRAM_ID
  );

  console.log(`UserNft PDA: ${userNftPDA.toString()}`);

  const userNftInfo = await connection.getAccountInfo(userNftPDA);
  
  if (!userNftInfo) {
    console.log("\n❌ UserNft non trouvé!");
    console.log("   Vous devez d'abord exécuter: node scripts/lock-and-mint-cnft.js");
    process.exit(1);
  }

  console.log(`✅ UserNft trouvé (${userNftInfo.data.length} bytes)`);

  // Lire les données du UserNft
  // Structure: discriminator (8) + user (32) + level (1) + amount_locked (8) + lock_duration (8) + boost (2) + mint_time (8) + is_active (1) + bump (1)
  let userBoost = 0;
  let isActive = false;
  let amountLocked = 0n;
  let lockDuration = 0n;

  try {
    // Lire le boost (offset 57)
    userBoost = userNftInfo.data.readUInt16LE(57);
    
    // Lire is_active (offset 67) - CORRIGÉ!
    isActive = userNftInfo.data.readUInt8(67) === 1;
    
    // Lire amount_locked (offset 41)
    amountLocked = userNftInfo.data.readBigUInt64LE(41);
    
    // Lire lock_duration (offset 49)
    lockDuration = userNftInfo.data.readBigInt64LE(49);
    
    console.log(`\n📊 Données UserNft:`);
    console.log(`   • Montant locké: ${(Number(amountLocked) / 1e9).toFixed(2)} BACK`);
    console.log(`   • Durée lock: ${(Number(lockDuration) / 86400).toFixed(0)} jours`);
    console.log(`   • Boost: ${userBoost} basis points (${(userBoost / 100).toFixed(2)}%)`);
    console.log(`   • Actif: ${isActive ? 'Oui ✅' : 'Non ❌'}`);
  } catch (err) {
    console.log(`⚠️  Erreur lors de la lecture des données: ${err.message}`);
    process.exit(1);
  }

  if (!isActive) {
    console.log("\n⚠️  Le UserNft n'est pas actif!");
    console.log("   Le boost ne sera pas appliqué.");
    userBoost = 0;
  }

  // ========================================
  // ÉTAPE 2: Calculer le rebate avec boost
  // ========================================
  console.log("\n═".repeat(60));
  console.log("ÉTAPE 2: Calcul du rebate avec boost");
  console.log("═".repeat(60));

  const effectiveBoost = isActive ? userBoost : 0;
  
  // Formule: rebate_boosted = base_rebate * (10000 + boost_bp) / 10000
  // Exemple: 3 USDC * (10000 + 900) / 10000 = 3 * 10900 / 10000 = 3.27 USDC
  const multiplier = 10000 + effectiveBoost;
  const boostedRebate = Math.floor((BASE_REBATE_USDC * multiplier) / 10000);

  console.log(`\n💰 Calcul du rebate:`);
  console.log(`   • Rebate de base: ${(BASE_REBATE_USDC / 1e6).toFixed(2)} USDC`);
  console.log(`   • Boost appliqué: ${effectiveBoost} bp (${(effectiveBoost / 100).toFixed(2)}%)`);
  console.log(`   • Multiplier: ${multiplier / 100}%`);
  console.log(`   • Rebate final: ${(boostedRebate / 1e6).toFixed(2)} USDC`);
  
  const rebateIncrease = boostedRebate - BASE_REBATE_USDC;
  const increasePercent = ((rebateIncrease / BASE_REBATE_USDC) * 100).toFixed(2);
  console.log(`   • Gain grâce au boost: +${(rebateIncrease / 1e6).toFixed(2)} USDC (+${increasePercent}%)`);

  // ========================================
  // ÉTAPE 3: Vérifier les comptes nécessaires
  // ========================================
  console.log("\n═".repeat(60));
  console.log("ÉTAPE 3: Vérification des comptes pour le swap");
  console.log("═".repeat(60));

  // Router State
  const [routerStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("router_state")],
    ROUTER_PROGRAM_ID
  );
  
  const routerStateInfo = await connection.getAccountInfo(routerStatePDA);
  if (routerStateInfo) {
    console.log(`✅ RouterState: ${routerStatePDA.toString()}`);
  } else {
    console.log(`❌ RouterState non trouvé`);
  }

  // Vérifier les token accounts
  console.log("\n📦 Token Accounts:");
  
  try {
    const { getOrCreateAssociatedTokenAccount } = require("@solana/spl-token");
    
    const userBackAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      BACK_MINT,
      payer.publicKey
    );
    console.log(`   • BACK: ${userBackAccount.address.toString()}`);
    console.log(`     Balance: ${(Number(userBackAccount.amount) / 1e9).toFixed(2)} BACK`);
    
    const userUsdcAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      USDC_MINT,
      payer.publicKey
    );
    console.log(`   • USDC: ${userUsdcAccount.address.toString()}`);
    console.log(`     Balance: ${(Number(userUsdcAccount.amount) / 1e6).toFixed(2)} USDC`);
  } catch (err) {
    console.log(`⚠️  Erreur token accounts: ${err.message}`);
  }

  // ========================================
  // ÉTAPE 4: Simulation du swap
  // ========================================
  console.log("\n═".repeat(60));
  console.log("ÉTAPE 4: Simulation du swap avec boost");
  console.log("═".repeat(60));

  console.log(`\n💱 Paramètres du swap (simulation):`);
  console.log(`   • Montant IN: ${(SWAP_AMOUNT_IN / 1e9).toFixed(2)} BACK`);
  console.log(`   • Token OUT: USDC`);
  console.log(`   • Boost utilisé: ${effectiveBoost} bp`);
  console.log(`   • Rebate attendu: ${(boostedRebate / 1e6).toFixed(2)} USDC`);

  console.log(`\n📋 Comptes requis pour l'instruction swap_toc:`);
  console.log(`   1. state (RouterState)`);
  console.log(`   2. user (signer)`);
  console.log(`   3. oracle (Pyth price feed)`);
  console.log(`   4. user_token_account_a (BACK)`);
  console.log(`   5. user_token_account_b (USDC)`);
  console.log(`   6. vault_token_account_a`);
  console.log(`   7. vault_token_account_b`);
  console.log(`   8. user_nft (${userNftPDA.toString().slice(0, 20)}...) ✅`);
  console.log(`   9. user_rebate_account (USDC pour recevoir le rebate)`);

  // Note sur l'implémentation complète
  console.log(`\n📝 Note sur l'implémentation complète:`);
  console.log(`   Pour exécuter un swap réel, il faudrait:`);
  console.log(`   1. Avoir un pool Orca configuré avec BACK/USDC`);
  console.log(`   2. Passer tous les comptes Orca requis (remaining_accounts)`);
  console.log(`   3. Construire la transaction avec l'instruction swap_toc`);
  console.log(`   4. Le programme Router appellerait Orca via CPI`);
  console.log(`   5. Le rebate serait payé automatiquement avec le boost`);

  // ========================================
  // RAPPORT FINAL
  // ========================================
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║               📊 RAPPORT DE SIMULATION                       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  console.log(`\n✅ Vérifications réussies:`);
  console.log(`   • UserNft trouvé et actif: ${isActive ? 'Oui' : 'Non'}`);
  console.log(`   • Boost disponible: ${userBoost} bp (${(userBoost / 100).toFixed(2)}%)`);
  console.log(`   • RouterState initialisé: ${routerStateInfo ? 'Oui' : 'Non'}`);

  console.log(`\n💡 Résultat de la simulation:`);
  console.log(`   Avec un boost de ${userBoost} bp, chaque swap génèrerait:`);
  console.log(`   • Rebate de base: ${(BASE_REBATE_USDC / 1e6).toFixed(2)} USDC`);
  console.log(`   • Rebate avec boost: ${(boostedRebate / 1e6).toFixed(2)} USDC`);
  console.log(`   • Gain: +${(rebateIncrease / 1e6).toFixed(2)} USDC (+${increasePercent}%)`);

  console.log(`\n🚀 Prochaines étapes:`);
  console.log(`   1. Configurer un pool Orca BACK/USDC sur devnet`);
  console.log(`   2. Créer le script d'exécution swap complet`);
  console.log(`   3. Tester le paiement du rebate avec boost réel`);
  console.log(`   4. Vérifier l'accumulation USDC dans le buyback vault\n`);

  // Sauvegarder le rapport
  const report = {
    wallet: payer.publicKey.toString(),
    userNftPDA: userNftPDA.toString(),
    boost: userBoost,
    isActive,
    amountLocked: Number(amountLocked),
    baseRebate: BASE_REBATE_USDC,
    boostedRebate,
    rebateIncrease,
    increasePercent: parseFloat(increasePercent),
    timestamp: new Date().toISOString(),
    network: "devnet",
  };

  const reportPath = path.join(__dirname, "../swap-boost-simulation.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`💾 Rapport sauvegardé: ${reportPath}\n`);
}

main()
  .then(() => {
    console.log("✅ Simulation terminée avec succès");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erreur:", error);
    process.exit(1);
  });
