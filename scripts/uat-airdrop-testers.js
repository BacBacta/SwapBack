/**
 * Script de préparation UAT - Airdrop tokens aux beta testers
 * 
 * Ce script envoie SOL + BACK + USDC à tous les beta testers
 * pour qu'ils puissent commencer les tests sur devnet.
 * 
 * Fichier source: beta-invites-2025-10-20.csv
 * Format CSV: name,email,wallet_address,discord,status
 * 
 * Airdrop par testeur:
 * - 2 SOL (frais transactions)
 * - 1000 BACK (tests de lock)
 * - 100 USDC (tests de swap)
 */

const { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const { getOrCreateAssociatedTokenAccount, createTransferInstruction, TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

// Configuration
const NETWORK = "https://api.devnet.solana.com";
const BACK_MINT = new PublicKey("14rtHCJVvU7NKeFJotJsHdbsQGajnNmoQ7MHid41RLTa");
const USDC_MINT = new PublicKey("BinixfcasoPdEQyV1tGw9BJ7Ar3ujoZe8MqDtTyDPEvR");

// Montants à airdrop
const SOL_AMOUNT = 2; // 2 SOL par testeur
const BACK_AMOUNT = 1000_000_000_000; // 1000 BACK (9 decimals)
const USDC_AMOUNT = 100_000_000; // 100 USDC (6 decimals)

// Fichier CSV
const CSV_FILE = path.join(__dirname, "../beta-invites-2025-10-20.csv");
const REPORT_FILE = path.join(__dirname, "../uat-airdrop-report.json");

async function loadBetaTesters() {
  return new Promise((resolve, reject) => {
    const testers = [];
    
    fs.createReadStream(CSV_FILE)
      .pipe(csv())
      .on('data', (row) => {
        // Format attendu: name,email,wallet_address,discord,status
        if (row.wallet_address && row.wallet_address.length > 0) {
          testers.push({
            name: row.name || 'Unknown',
            email: row.email || '',
            wallet: row.wallet_address.trim(),
            discord: row.discord || '',
            status: row.status || 'pending'
          });
        }
      })
      .on('end', () => {
        console.log(`✅ ${testers.length} beta testers chargés depuis CSV`);
        resolve(testers);
      })
      .on('error', reject);
  });
}

async function airdropToTester(connection, payer, tester, index, total) {
  console.log(`\n[${ index + 1}/${total}] Processing: ${tester.name}`);
  console.log(`   Wallet: ${tester.wallet}`);

  const result = {
    name: tester.name,
    wallet: tester.wallet,
    discord: tester.discord,
    sol: { success: false, amount: 0, signature: null },
    back: { success: false, amount: 0, signature: null },
    usdc: { success: false, amount: 0, signature: null },
    errors: []
  };

  try {
    const recipientPubkey = new PublicKey(tester.wallet);

    // ============================================
    // 1. Airdrop SOL
    // ============================================
    console.log(`   📤 Sending ${SOL_AMOUNT} SOL...`);
    try {
      const solTransferIx = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipientPubkey,
        lamports: SOL_AMOUNT * LAMPORTS_PER_SOL
      });

      const solTx = new Transaction().add(solTransferIx);
      solTx.feePayer = payer.publicKey;
      solTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const solSig = await connection.sendTransaction(solTx, [payer]);
      await connection.confirmTransaction(solSig, 'confirmed');

      result.sol.success = true;
      result.sol.amount = SOL_AMOUNT;
      result.sol.signature = solSig;
      console.log(`   ✅ SOL sent: ${solSig.slice(0, 20)}...`);
    } catch (err) {
      result.errors.push(`SOL transfer failed: ${err.message}`);
      console.log(`   ❌ SOL failed: ${err.message}`);
    }

    // Petite pause pour éviter rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));

    // ============================================
    // 2. Airdrop BACK
    // ============================================
    console.log(`   📤 Sending ${(BACK_AMOUNT / 1e9).toFixed(0)} BACK...`);
    try {
      // Créer ou récupérer le compte BACK du testeur
      const recipientBackAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        BACK_MINT,
        recipientPubkey
      );

      // Compte BACK du payer
      const payerBackAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        BACK_MINT,
        payer.publicKey
      );

      const backTransferIx = createTransferInstruction(
        payerBackAccount.address,
        recipientBackAccount.address,
        payer.publicKey,
        BACK_AMOUNT,
        [],
        TOKEN_PROGRAM_ID
      );

      const backTx = new Transaction().add(backTransferIx);
      backTx.feePayer = payer.publicKey;
      backTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const backSig = await connection.sendTransaction(backTx, [payer]);
      await connection.confirmTransaction(backSig, 'confirmed');

      result.back.success = true;
      result.back.amount = BACK_AMOUNT / 1e9;
      result.back.signature = backSig;
      console.log(`   ✅ BACK sent: ${backSig.slice(0, 20)}...`);
    } catch (err) {
      result.errors.push(`BACK transfer failed: ${err.message}`);
      console.log(`   ❌ BACK failed: ${err.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    // ============================================
    // 3. Airdrop USDC
    // ============================================
    console.log(`   📤 Sending ${(USDC_AMOUNT / 1e6).toFixed(0)} USDC...`);
    try {
      const recipientUsdcAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        USDC_MINT,
        recipientPubkey
      );

      const payerUsdcAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        USDC_MINT,
        payer.publicKey
      );

      const usdcTransferIx = createTransferInstruction(
        payerUsdcAccount.address,
        recipientUsdcAccount.address,
        payer.publicKey,
        USDC_AMOUNT,
        [],
        TOKEN_PROGRAM_ID
      );

      const usdcTx = new Transaction().add(usdcTransferIx);
      usdcTx.feePayer = payer.publicKey;
      usdcTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const usdcSig = await connection.sendTransaction(usdcTx, [payer]);
      await connection.confirmTransaction(usdcSig, 'confirmed');

      result.usdc.success = true;
      result.usdc.amount = USDC_AMOUNT / 1e6;
      result.usdc.signature = usdcSig;
      console.log(`   ✅ USDC sent: ${usdcSig.slice(0, 20)}...`);
    } catch (err) {
      result.errors.push(`USDC transfer failed: ${err.message}`);
      console.log(`   ❌ USDC failed: ${err.message}`);
    }

    // Résumé
    const successCount = [result.sol.success, result.back.success, result.usdc.success].filter(Boolean).length;
    console.log(`   📊 Result: ${successCount}/3 transfers successful`);

  } catch (err) {
    result.errors.push(`General error: ${err.message}`);
    console.log(`   ❌ Error: ${err.message}`);
  }

  return result;
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║         🎁 UAT AIRDROP - Beta Testers Devnet               ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const connection = new Connection(NETWORK, "confirmed");

  // Charger le wallet du payer
  const walletPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  if (!fs.existsSync(walletPath)) {
    console.log("❌ Wallet non trouvé:", walletPath);
    process.exit(1);
  }

  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log(`👤 Payer wallet: ${payer.publicKey.toString()}`);
  const balance = await connection.getBalance(payer.publicKey);
  console.log(`💰 Solde SOL: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);

  // Vérifier soldes BACK et USDC
  try {
    const { getAccount } = require("@solana/spl-token");
    
    const backAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      BACK_MINT,
      payer.publicKey
    );
    console.log(`💼 Solde BACK: ${(Number(backAccount.amount) / 1e9).toFixed(2)} BACK`);

    const usdcAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      USDC_MINT,
      payer.publicKey
    );
    console.log(`💵 Solde USDC: ${(Number(usdcAccount.amount) / 1e6).toFixed(2)} USDC\n`);
  } catch (err) {
    console.log(`⚠️  Erreur lecture soldes tokens: ${err.message}\n`);
  }

  // Charger les beta testers
  console.log("═".repeat(60));
  console.log("CHARGEMENT DES BETA TESTERS");
  console.log("═".repeat(60));

  let testers;
  try {
    testers = await loadBetaTesters();
  } catch (err) {
    console.log(`❌ Erreur chargement CSV: ${err.message}`);
    console.log(`   Fichier attendu: ${CSV_FILE}`);
    process.exit(1);
  }

  if (testers.length === 0) {
    console.log("❌ Aucun beta tester trouvé dans le CSV!");
    process.exit(1);
  }

  console.log(`\n📋 Beta testers à airdrop:`);
  testers.forEach((t, i) => {
    console.log(`   ${i + 1}. ${t.name} (@${t.discord || 'no-discord'})`);
  });

  // Calculer budget total nécessaire
  const totalSol = SOL_AMOUNT * testers.length;
  const totalBack = (BACK_AMOUNT / 1e9) * testers.length;
  const totalUsdc = (USDC_AMOUNT / 1e6) * testers.length;

  console.log(`\n💰 Budget total requis:`);
  console.log(`   • SOL: ${totalSol.toFixed(2)} SOL`);
  console.log(`   • BACK: ${totalBack.toFixed(0)} BACK`);
  console.log(`   • USDC: ${totalUsdc.toFixed(0)} USDC`);

  // Vérifier si budget suffisant
  if (balance / LAMPORTS_PER_SOL < totalSol + 1) {
    console.log(`\n❌ Solde SOL insuffisant!`);
    console.log(`   Requis: ${totalSol + 1} SOL (+ 1 SOL buffer)`);
    console.log(`   Disponible: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    process.exit(1);
  }

  // Confirmation
  console.log(`\n⚠️  Prêt à envoyer aux ${testers.length} testeurs.`);
  console.log(`   Appuyez sur Ctrl+C pour annuler, ou attendez 5 sec...\n`);
  await new Promise(resolve => setTimeout(resolve, 5000));

  // ============================================
  // AIRDROP À TOUS LES TESTEURS
  // ============================================
  console.log("═".repeat(60));
  console.log("AIRDROP EN COURS");
  console.log("═".repeat(60));

  const results = [];
  for (let i = 0; i < testers.length; i++) {
    const result = await airdropToTester(connection, payer, testers[i], i, testers.length);
    results.push(result);
    
    // Pause entre testeurs pour éviter spam
    if (i < testers.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // ============================================
  // RAPPORT FINAL
  // ============================================
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║               📊 RAPPORT AIRDROP FINAL                      ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const stats = {
    total: results.length,
    success_full: results.filter(r => r.sol.success && r.back.success && r.usdc.success).length,
    success_partial: results.filter(r => 
      (r.sol.success || r.back.success || r.usdc.success) && 
      !(r.sol.success && r.back.success && r.usdc.success)
    ).length,
    failed: results.filter(r => !r.sol.success && !r.back.success && !r.usdc.success).length,
    sol_sent: results.filter(r => r.sol.success).length,
    back_sent: results.filter(r => r.back.success).length,
    usdc_sent: results.filter(r => r.usdc.success).length
  };

  console.log(`📈 Statistiques globales:`);
  console.log(`   • Total testeurs: ${stats.total}`);
  console.log(`   • Succès complet (3/3): ${stats.success_full} (${(stats.success_full / stats.total * 100).toFixed(0)}%)`);
  console.log(`   • Succès partiel: ${stats.success_partial}`);
  console.log(`   • Échec total: ${stats.failed}`);

  console.log(`\n💸 Tokens envoyés:`);
  console.log(`   • SOL: ${stats.sol_sent}/${stats.total} testeurs (${stats.sol_sent * SOL_AMOUNT} SOL)`);
  console.log(`   • BACK: ${stats.back_sent}/${stats.total} testeurs (${stats.back_sent * BACK_AMOUNT / 1e9} BACK)`);
  console.log(`   • USDC: ${stats.usdc_sent}/${stats.total} testeurs (${stats.usdc_sent * USDC_AMOUNT / 1e6} USDC)`);

  // Lister les échecs
  const failures = results.filter(r => r.errors.length > 0);
  if (failures.length > 0) {
    console.log(`\n⚠️  Erreurs détectées (${failures.length}):`);
    failures.forEach(f => {
      console.log(`   • ${f.name} (${f.wallet.slice(0, 20)}...)`);
      f.errors.forEach(err => console.log(`     - ${err}`));
    });
  }

  // Sauvegarder rapport JSON
  const report = {
    timestamp: new Date().toISOString(),
    network: NETWORK,
    payer: payer.publicKey.toString(),
    stats,
    results,
    config: {
      sol_amount: SOL_AMOUNT,
      back_amount: BACK_AMOUNT / 1e9,
      usdc_amount: USDC_AMOUNT / 1e6
    }
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  console.log(`\n💾 Rapport sauvegardé: ${REPORT_FILE}`);

  // Message final
  if (stats.success_full === stats.total) {
    console.log(`\n✅ Airdrop 100% réussi! Tous les testeurs sont prêts.`);
  } else if (stats.success_full + stats.success_partial === stats.total) {
    console.log(`\n⚠️  Airdrop partiellement réussi. Vérifier les erreurs ci-dessus.`);
  } else {
    console.log(`\n❌ Airdrop avec problèmes. ${stats.failed} testeurs n'ont rien reçu.`);
  }

  console.log(`\n🚀 Prochaines étapes:`);
  console.log(`   1. Vérifier rapport: ${REPORT_FILE}`);
  console.log(`   2. Re-essayer pour échecs si nécessaire`);
  console.log(`   3. Notifier testeurs sur Discord`);
  console.log(`   4. Envoyer emails avec guide UAT`);
  console.log(`   5. Démarrer session de tests!\n`);
}

main()
  .then(() => {
    console.log("✅ Script terminé");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erreur fatale:", error);
    process.exit(1);
  });
