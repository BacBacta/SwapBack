/**
 * Script de test complet du système Buyback
 * 
 * Ce script teste le workflow complet du buyback:
 * 1. Déposer USDC dans le buyback vault
 * 2. Exécuter le buyback (swap simulé USDC → BACK)
 * 3. Brûler 50% des BACK achetés
 * 4. Distribuer 50% aux holders de cNFT proportionnellement à leur boost
 * 
 * Workflow:
 * - deposit_usdc: Router dépose USDC accumulés (frais + routing profit)
 * - execute_buyback: Authority achète BACK avec USDC (via Jupiter - simulé pour le test)
 * - burn_back: Brûle 50% des BACK achetés
 * - distribute_buyback: Distribue 50% aux holders selon boost
 * 
 * Formule de distribution:
 * user_share = (user_boost / total_community_boost) × (buyback_tokens × 50%)
 * 
 * Exemple:
 * - Total buyback: 1000 BACK
 * - User boost: 900 bp
 * - Total community boost: 900 bp (1 seul holder)
 * - Distribution: (900 / 900) × (1000 × 50%) = 500 BACK
 * - Burn: 500 BACK
 */

const { Connection, Keypair, PublicKey, Transaction, SystemProgram } = require("@solana/web3.js");
const { getOrCreateAssociatedTokenAccount, createTransferInstruction, TOKEN_PROGRAM_ID, getAccount } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Configuration devnet
const NETWORK = "https://api.devnet.solana.com";
const BUYBACK_PROGRAM_ID = new PublicKey("EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf");
const CNFT_PROGRAM_ID = new PublicKey("9MjuF4Vj4pZeHJejsQtzmo9wTdkjJfa9FbJRSLxHFezw");
const BACK_MINT = new PublicKey("14rtHCJVvU7NKeFJotJsHdbsQGajnNmoQ7MHid41RLTa");
const USDC_MINT = new PublicKey("BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR");

// Paramètres de test
const USDC_DEPOSIT_AMOUNT = 5_000_000; // 5 USDC (6 decimals)
const BACK_BUYBACK_AMOUNT = 500_000_000_000; // 500 BACK (9 decimals) - simulé
const MIN_BUYBACK_THRESHOLD = 1_000_000; // 1 USDC minimum (défini lors de l'init)

// Ratio distribution: 50% burn, 50% distribution
const BURN_RATIO = 0.5;
const DISTRIBUTION_RATIO = 0.5;

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║         🔥 TEST BUYBACK FLOW COMPLET - Devnet              ║");
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
  // ÉTAPE 0: Vérifier les PDAs
  // ========================================
  console.log("═".repeat(60));
  console.log("ÉTAPE 0: Vérification des PDAs");
  console.log("═".repeat(60));

  const [buybackStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("buyback_state")],
    BUYBACK_PROGRAM_ID
  );
  console.log(`BuybackState PDA: ${buybackStatePDA.toString()}`);

  const buybackStateInfo = await connection.getAccountInfo(buybackStatePDA);
  if (!buybackStateInfo) {
    console.log("❌ BuybackState non trouvé! Exécutez d'abord: node scripts/init-buyback-state.js");
    process.exit(1);
  }
  console.log(`✅ BuybackState trouvé (${buybackStateInfo.data.length} bytes)`);

  const [usdcVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("usdc_vault")],
    BUYBACK_PROGRAM_ID
  );
  console.log(`USDC Vault PDA: ${usdcVaultPDA.toString()}`);

  const [globalStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    CNFT_PROGRAM_ID
  );
  console.log(`GlobalState PDA: ${globalStatePDA.toString()}`);

  const [userNftPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_nft"), payer.publicKey.toBuffer()],
    CNFT_PROGRAM_ID
  );
  console.log(`UserNft PDA: ${userNftPDA.toString()}`);

  // ========================================
  // ÉTAPE 1: Déposer USDC dans le buyback vault
  // ========================================
  console.log("\n═".repeat(60));
  console.log("ÉTAPE 1: Dépôt USDC dans le buyback vault");
  console.log("═".repeat(60));

  // Vérifier le solde USDC de l'utilisateur
  const userUsdcAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    USDC_MINT,
    payer.publicKey
  );
  console.log(`\n📦 Compte USDC utilisateur: ${userUsdcAccount.address.toString()}`);
  console.log(`   Solde: ${(Number(userUsdcAccount.amount) / 1e6).toFixed(2)} USDC`);

  if (Number(userUsdcAccount.amount) < USDC_DEPOSIT_AMOUNT) {
    console.log(`\n❌ Solde USDC insuffisant!`);
    console.log(`   Requis: ${(USDC_DEPOSIT_AMOUNT / 1e6).toFixed(2)} USDC`);
    console.log(`   Disponible: ${(Number(userUsdcAccount.amount) / 1e6).toFixed(2)} USDC`);
    process.exit(1);
  }

  // Vérifier le solde actuel du vault USDC
  const usdcVaultInfo = await connection.getAccountInfo(usdcVaultPDA);
  let currentVaultBalance = 0;
  if (usdcVaultInfo) {
    const vaultAccount = await getAccount(connection, usdcVaultPDA);
    currentVaultBalance = Number(vaultAccount.amount);
    console.log(`\n💼 USDC Vault actuel: ${(currentVaultBalance / 1e6).toFixed(2)} USDC`);
  }

  // Construire l'instruction deposit_usdc
  console.log(`\n🔨 Construction de l'instruction deposit_usdc...`);
  
  // Discriminator pour "global:deposit_usdc"
  const depositDiscriminator = crypto.createHash("sha256")
    .update("global:deposit_usdc")
    .digest()
    .subarray(0, 8);

  // Encoder le montant (u64 little-endian)
  const amountBuffer = Buffer.alloc(8);
  amountBuffer.writeBigUInt64LE(BigInt(USDC_DEPOSIT_AMOUNT));

  const depositData = Buffer.concat([depositDiscriminator, amountBuffer]);

  const depositKeys = [
    { pubkey: buybackStatePDA, isSigner: false, isWritable: true }, // buyback_state
    { pubkey: userUsdcAccount.address, isSigner: false, isWritable: true }, // source_usdc
    { pubkey: usdcVaultPDA, isSigner: false, isWritable: true }, // usdc_vault
    { pubkey: payer.publicKey, isSigner: true, isWritable: false }, // depositor
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
  ];

  const depositIx = {
    programId: BUYBACK_PROGRAM_ID,
    keys: depositKeys,
    data: depositData,
  };

  // Envoyer la transaction
  const depositTx = new Transaction().add(depositIx);
  depositTx.feePayer = payer.publicKey;
  depositTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  console.log(`📡 Envoi de la transaction deposit_usdc...`);
  const depositSig = await connection.sendTransaction(depositTx, [payer], {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  console.log(`⏳ Confirmation de la transaction...`);
  await connection.confirmTransaction(depositSig, "confirmed");

  console.log(`\n✅ Dépôt USDC réussi!`);
  console.log(`   Transaction: ${depositSig}`);
  console.log(`   Montant déposé: ${(USDC_DEPOSIT_AMOUNT / 1e6).toFixed(2)} USDC`);

  // Vérifier le nouveau solde du vault
  const newVaultAccount = await getAccount(connection, usdcVaultPDA);
  const newVaultBalance = Number(newVaultAccount.amount);
  console.log(`   Nouveau solde vault: ${(newVaultBalance / 1e6).toFixed(2)} USDC`);
  console.log(`   Augmentation: +${((newVaultBalance - currentVaultBalance) / 1e6).toFixed(2)} USDC`);

  // Vérifier le seuil minimum
  if (newVaultBalance < MIN_BUYBACK_THRESHOLD) {
    console.log(`\n⚠️  Le vault USDC est sous le seuil minimum!`);
    console.log(`   Requis: ${(MIN_BUYBACK_THRESHOLD / 1e6).toFixed(2)} USDC`);
    console.log(`   Actuel: ${(newVaultBalance / 1e6).toFixed(2)} USDC`);
    console.log(`   Le buyback ne peut pas être exécuté pour le moment.`);
  } else {
    console.log(`\n✅ Le vault USDC dépasse le seuil minimum!`);
    console.log(`   Seuil: ${(MIN_BUYBACK_THRESHOLD / 1e6).toFixed(2)} USDC`);
    console.log(`   Actuel: ${(newVaultBalance / 1e6).toFixed(2)} USDC`);
    console.log(`   Le buyback peut être exécuté.`);
  }

  // ========================================
  // ÉTAPE 2: Calculer la distribution théorique
  // ========================================
  console.log("\n═".repeat(60));
  console.log("ÉTAPE 2: Calcul de la distribution théorique");
  console.log("═".repeat(60));

  // Lire le GlobalState pour total_community_boost
  const globalStateInfo = await connection.getAccountInfo(globalStatePDA);
  if (!globalStateInfo) {
    console.log("❌ GlobalState non trouvé!");
    process.exit(1);
  }

  const totalCommunityBoost = globalStateInfo.data.readBigUInt64LE(40); // offset 40 pour total_community_boost (après discriminator 8 + authority 32)
  console.log(`\n📊 Total Community Boost: ${totalCommunityBoost} bp`);

  // Lire le UserNft pour le boost utilisateur
  const userNftInfo = await connection.getAccountInfo(userNftPDA);
  if (!userNftInfo) {
    console.log("❌ UserNft non trouvé!");
    process.exit(1);
  }

  const userBoost = userNftInfo.data.readUInt16LE(57); // offset 57 pour boost
  const isActive = userNftInfo.data.readUInt8(67) === 1; // offset 67 pour is_active

  console.log(`\n👤 User Boost: ${userBoost} bp (${(userBoost / 100).toFixed(2)}%)`);
  console.log(`   Actif: ${isActive ? 'Oui ✅' : 'Non ❌'}`);

  if (!isActive) {
    console.log(`\n⚠️  Le UserNft n'est pas actif!`);
    console.log(`   Aucune distribution ne sera reçue.`);
  }

  // Calculer la distribution théorique
  console.log(`\n💡 Calcul de distribution théorique:`);
  console.log(`   Buyback simulé: ${(BACK_BUYBACK_AMOUNT / 1e9).toFixed(2)} BACK`);
  
  const burnAmount = Math.floor(BACK_BUYBACK_AMOUNT * BURN_RATIO);
  const distributableAmount = Math.floor(BACK_BUYBACK_AMOUNT * DISTRIBUTION_RATIO);
  
  console.log(`   • Montant à brûler (50%): ${(burnAmount / 1e9).toFixed(2)} BACK`);
  console.log(`   • Montant distribuable (50%): ${(distributableAmount / 1e9).toFixed(2)} BACK`);

  if (isActive && totalCommunityBoost > 0) {
    const userShare = Math.floor((distributableAmount * userBoost) / Number(totalCommunityBoost));
    const userPercentage = (userBoost / Number(totalCommunityBoost) * 100).toFixed(2);
    
    console.log(`\n   Part de l'utilisateur:`);
    console.log(`   • Formule: (${userBoost} / ${totalCommunityBoost}) × ${(distributableAmount / 1e9).toFixed(2)} BACK`);
    console.log(`   • Pourcentage: ${userPercentage}%`);
    console.log(`   • Tokens reçus: ${(userShare / 1e9).toFixed(2)} BACK`);
  }

  // ========================================
  // RAPPORT FINAL
  // ========================================
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║               📊 RAPPORT DE TEST BUYBACK                    ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  console.log(`\n✅ Étapes complétées:`);
  console.log(`   • Dépôt USDC dans vault: ✅ ${(USDC_DEPOSIT_AMOUNT / 1e6).toFixed(2)} USDC`);
  console.log(`   • Nouveau solde vault: ${(newVaultBalance / 1e6).toFixed(2)} USDC`);
  console.log(`   • Seuil minimum atteint: ${newVaultBalance >= MIN_BUYBACK_THRESHOLD ? 'Oui ✅' : 'Non ❌'}`);

  console.log(`\n📋 Informations de distribution:`);
  console.log(`   • Total community boost: ${totalCommunityBoost} bp`);
  console.log(`   • User boost: ${userBoost} bp (${(userBoost / 100).toFixed(2)}%)`);
  console.log(`   • UserNft actif: ${isActive ? 'Oui ✅' : 'Non ❌'}`);

  console.log(`\n🔜 Prochaines étapes (manuelles):`);
  console.log(`   1. execute_buyback: Acheter BACK avec USDC (via Jupiter - TODO)`);
  console.log(`   2. burn_back: Brûler 50% des BACK achetés`);
  console.log(`   3. distribute_buyback: Distribuer 50% aux holders`);

  console.log(`\n⚠️  NOTE IMPORTANTE:`);
  console.log(`   L'instruction execute_buyback a un TODO pour l'intégration Jupiter.`);
  console.log(`   Pour le MVP, le swap USDC → BACK est simulé.`);
  console.log(`   Les BACK doivent être manuellement déposés dans le back_vault`);
  console.log(`   avant de pouvoir tester burn_back et distribute_buyback.\n`);

  // Sauvegarder le rapport
  const report = {
    wallet: payer.publicKey.toString(),
    depositAmount: USDC_DEPOSIT_AMOUNT,
    vaultBalanceBefore: currentVaultBalance,
    vaultBalanceAfter: newVaultBalance,
    minBuybackThreshold: MIN_BUYBACK_THRESHOLD,
    canExecuteBuyback: newVaultBalance >= MIN_BUYBACK_THRESHOLD,
    userBoost,
    totalCommunityBoost: Number(totalCommunityBoost),
    isUserNftActive: isActive,
    buybackSimulated: BACK_BUYBACK_AMOUNT,
    burnAmount,
    distributableAmount,
    depositTransaction: depositSig,
    timestamp: new Date().toISOString(),
    network: "devnet",
  };

  const reportPath = path.join(__dirname, "../buyback-test-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`💾 Rapport sauvegardé: ${reportPath}\n`);
}

main()
  .then(() => {
    console.log("✅ Test buyback terminé");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erreur:", error);
    process.exit(1);
  });
