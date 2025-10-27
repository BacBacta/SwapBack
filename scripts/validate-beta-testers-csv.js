#!/usr/bin/env node

/**
 * Script de validation du fichier CSV des beta testers
 * 
 * Vérifie:
 * - Format CSV correct
 * - Adresses wallet Solana valides
 * - Pas de doublons
 * - Emails valides
 * 
 * Usage: node scripts/validate-beta-testers-csv.js
 */

const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { PublicKey } = require("@solana/web3.js");

// Accepter fichier en argument ou variable d'environnement
const CSV_FILENAME = process.argv[2] || process.env.CSV_FILE || "beta-invites-2025-10-20.csv";
const CSV_FILE = path.join(__dirname, "..", CSV_FILENAME);

// Validation email simple
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validation wallet Solana
function isValidSolanaAddress(address) {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

async function validateCSV() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║       🔍 Validation CSV Beta Testers                       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  if (!fs.existsSync(CSV_FILE)) {
    console.log(`❌ Fichier non trouvé: ${CSV_FILE}`);
    console.log(`\n💡 Créer un fichier CSV avec format:`);
    console.log(`   name,email,wallet_address,discord,status`);
    process.exit(1);
  }

  const testers = [];
  const errors = [];
  const warnings = [];
  const walletsSeen = new Set();
  const emailsSeen = new Set();

  return new Promise((resolve) => {
    fs.createReadStream(CSV_FILE)
      .pipe(csv())
      .on('data', (row) => {
        const lineNum = testers.length + 2; // +2 for header + 1-indexing
        const tester = {
          line: lineNum,
          name: row.name?.trim() || '',
          email: row.email?.trim() || '',
          wallet: row.wallet_address?.trim() || '',
          discord: row.discord?.trim() || '',
          status: row.status?.trim() || 'pending'
        };

        testers.push(tester);

        // Validation: Nom
        if (!tester.name || tester.name.length === 0) {
          warnings.push(`Ligne ${lineNum}: Nom manquant`);
        }

        // Validation: Email
        if (!tester.email || tester.email.length === 0) {
          errors.push(`Ligne ${lineNum}: Email manquant`);
        } else if (!isValidEmail(tester.email)) {
          errors.push(`Ligne ${lineNum}: Email invalide (${tester.email})`);
        } else if (emailsSeen.has(tester.email)) {
          errors.push(`Ligne ${lineNum}: Email dupliqué (${tester.email})`);
        } else {
          emailsSeen.add(tester.email);
        }

        // Validation: Wallet
        if (!tester.wallet || tester.wallet.length === 0) {
          errors.push(`Ligne ${lineNum}: Wallet manquant`);
        } else if (!isValidSolanaAddress(tester.wallet)) {
          errors.push(`Ligne ${lineNum}: Wallet invalide (${tester.wallet})`);
        } else if (walletsSeen.has(tester.wallet)) {
          errors.push(`Ligne ${lineNum}: Wallet dupliqué (${tester.wallet})`);
        } else {
          walletsSeen.add(tester.wallet);
        }

        // Validation: Discord (optionnel mais recommandé)
        if (!tester.discord || tester.discord.length === 0) {
          warnings.push(`Ligne ${lineNum}: Discord manquant (${tester.name})`);
        }

        // Validation: Status
        const validStatuses = ['pending', 'invited', 'confirmed', 'active', 'inactive'];
        if (!validStatuses.includes(tester.status)) {
          warnings.push(`Ligne ${lineNum}: Status invalide "${tester.status}" (${tester.name})`);
        }
      })
      .on('end', () => {
        console.log(`📄 Fichier: ${CSV_FILE}`);
        console.log(`📊 Lignes lues: ${testers.length} testeurs\n`);

        console.log("═".repeat(60));
        console.log("RÉSULTATS VALIDATION");
        console.log("═".repeat(60));

        // Statistiques
        const byStatus = testers.reduce((acc, t) => {
          acc[t.status] = (acc[t.status] || 0) + 1;
          return acc;
        }, {});

        console.log(`\n📈 Statistiques:`);
        console.log(`   • Total testeurs: ${testers.length}`);
        console.log(`   • Emails uniques: ${emailsSeen.size}`);
        console.log(`   • Wallets uniques: ${walletsSeen.size}`);
        console.log(`   • Avec Discord: ${testers.filter(t => t.discord).length}`);
        
        console.log(`\n🏷️  Par statut:`);
        Object.entries(byStatus).forEach(([status, count]) => {
          console.log(`   • ${status}: ${count}`);
        });

        // Erreurs critiques
        if (errors.length > 0) {
          console.log(`\n❌ ERREURS CRITIQUES (${errors.length}):`);
          errors.forEach(err => console.log(`   ${err}`));
        }

        // Warnings
        if (warnings.length > 0) {
          console.log(`\n⚠️  AVERTISSEMENTS (${warnings.length}):`);
          warnings.slice(0, 10).forEach(warn => console.log(`   ${warn}`));
          if (warnings.length > 10) {
            console.log(`   ... et ${warnings.length - 10} autres avertissements`);
          }
        }

        // Liste des testeurs valides
        const validTesters = testers.filter(t => 
          t.email && isValidEmail(t.email) &&
          t.wallet && isValidSolanaAddress(t.wallet)
        );

        console.log(`\n✅ TESTEURS VALIDES (${validTesters.length}):`);
        validTesters.slice(0, 10).forEach(t => {
          const discordBadge = t.discord ? `@${t.discord}` : '❌ no discord';
          console.log(`   • ${t.name.padEnd(20)} | ${t.wallet.slice(0, 8)}... | ${discordBadge}`);
        });

        if (validTesters.length > 10) {
          console.log(`   ... et ${validTesters.length - 10} autres testeurs valides`);
        }

        // Budget estimé
        const SOL_PER_TESTER = 2;
        const BACK_PER_TESTER = 1000;
        const USDC_PER_TESTER = 100;

        console.log(`\n💰 BUDGET AIRDROP ESTIMÉ (${validTesters.length} testeurs):`);
        console.log(`   • SOL: ${(SOL_PER_TESTER * validTesters.length).toFixed(1)} SOL`);
        console.log(`   • BACK: ${(BACK_PER_TESTER * validTesters.length).toLocaleString()} BACK`);
        console.log(`   • USDC: ${(USDC_PER_TESTER * validTesters.length).toLocaleString()} USDC`);

        // Recommandations
        console.log(`\n📋 RECOMMANDATIONS:`);

        if (errors.length > 0) {
          console.log(`   ❌ Corriger les ${errors.length} erreurs critiques avant airdrop`);
        }

        if (warnings.length > 10) {
          console.log(`   ⚠️  Vérifier les ${warnings.length} avertissements`);
        }

        if (validTesters.length < 10) {
          console.log(`   ⚠️  Seulement ${validTesters.length} testeurs valides (recommandé: 10-20)`);
          console.log(`   💡 Recruter ${10 - validTesters.length} testeurs supplémentaires`);
        }

        const missingDiscord = validTesters.filter(t => !t.discord).length;
        if (missingDiscord > 0) {
          console.log(`   ⚠️  ${missingDiscord} testeurs sans Discord`);
          console.log(`   💡 Demander leur username Discord avant UAT`);
        }

        // Résultat final
        console.log(`\n${"═".repeat(60)}`);
        if (errors.length === 0 && validTesters.length >= 10) {
          console.log(`✅ CSV VALIDE - Prêt pour airdrop!`);
          console.log(`   ${validTesters.length} testeurs prêts à recevoir tokens`);
        } else if (errors.length === 0) {
          console.log(`⚠️  CSV VALIDE mais manque testeurs`);
          console.log(`   ${validTesters.length} testeurs (recommandé: 10-20)`);
        } else {
          console.log(`❌ CSV INVALIDE - Corrections nécessaires`);
          console.log(`   ${errors.length} erreurs à corriger`);
        }
        console.log(`${"═".repeat(60)}\n`);

        // Exit code
        const exitCode = errors.length > 0 ? 1 : 0;
        resolve({ testers: validTesters, errors, warnings, exitCode });
      })
      .on('error', (err) => {
        console.error(`❌ Erreur lecture CSV: ${err.message}`);
        process.exit(1);
      });
  });
}

// Exécution
if (require.main === module) {
  validateCSV()
    .then(({ exitCode }) => process.exit(exitCode))
    .catch((err) => {
      console.error("❌ Erreur fatale:", err);
      process.exit(1);
    });
}

module.exports = { validateCSV };
