#!/usr/bin/env node
/**
 * Script d'initialisation du BACK Vault
 * 
 * Crée et initialise le Token Account pour le BACK Vault PDA
 * du programme swapback_buyback.
 * 
 * Usage:
 *   node scripts/initialize-back-vault.js
 */

const { Connection, PublicKey, Keypair, Transaction, SystemProgram } = require('@solana/web3.js');
const { 
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  RPC_URL: process.env.RPC_URL || 'https://api.devnet.solana.com',
  
  // Program IDs
  BUYBACK_PROGRAM_ID: new PublicKey('4cyYvpjwERF67UDpd5euYzZ6xZ5tcDL6XrByBaZbVVjK'),
  
  // Token
  BACK_MINT: new PublicKey(process.env.NEXT_PUBLIC_BACK_MINT || '862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux'),
  
  // Wallet keypair path (devnet)
  KEYPAIR_PATH: process.env.KEYPAIR_PATH || path.join(process.env.HOME || '', '.config/solana/id.json'),
};

// Colors
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

/**
 * Charge le keypair depuis le fichier
 */
function loadKeypair(filepath) {
  try {
    const keypairData = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  } catch (error) {
    throw new Error(`Impossible de charger le keypair depuis ${filepath}: ${error.message}`);
  }
}

/**
 * Détermine si le token utilise Token ou Token-2022
 */
async function getTokenProgramId(connection, mint) {
  try {
    const accountInfo = await connection.getAccountInfo(mint);
    if (!accountInfo) {
      throw new Error('Mint account not found');
    }
    
    // Token-2022 a un owner différent
    if (accountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
      return TOKEN_2022_PROGRAM_ID;
    }
    
    return TOKEN_PROGRAM_ID;
  } catch (error) {
    log(`   ⚠️  Erreur détection Token Program, utilisation Token-2022 par défaut`, 'yellow');
    return TOKEN_2022_PROGRAM_ID;
  }
}

/**
 * Initialise le BACK Vault
 */
async function initializeBackVault() {
  log('\n' + '='.repeat(60), 'bright');
  log('🔧 Initialisation BACK Vault', 'bright');
  log('='.repeat(60) + '\n', 'bright');
  
  // Connect to Solana
  log('🔌 Connexion à Solana...', 'cyan');
  const connection = new Connection(CONFIG.RPC_URL, 'confirmed');
  
  try {
    const version = await connection.getVersion();
    log(`   ✅ Connecté à Solana ${version['solana-core']}`, 'green');
  } catch (error) {
    log(`   ❌ Échec de connexion: ${error.message}`, 'red');
    process.exit(1);
  }
  
  // Load keypair
  log('\n🔑 Chargement du keypair...', 'cyan');
  let payer;
  try {
    payer = loadKeypair(CONFIG.KEYPAIR_PATH);
    log(`   ✅ Keypair chargé: ${payer.publicKey.toBase58()}`, 'green');
    
    // Check balance
    const balance = await connection.getBalance(payer.publicKey);
    const balanceSOL = balance / 1e9;
    log(`   💰 Balance: ${balanceSOL.toFixed(4)} SOL`, balanceSOL > 0.1 ? 'green' : 'yellow');
    
    if (balanceSOL < 0.01) {
      log(`   ⚠️  Balance faible, airdrop recommandé: solana airdrop 1`, 'yellow');
    }
  } catch (error) {
    log(`   ❌ ${error.message}`, 'red');
    log(`   💡 Essayez: export KEYPAIR_PATH=/path/to/your/keypair.json`, 'yellow');
    process.exit(1);
  }
  
  // Dérive le PDA BuybackState
  log('\n📍 Dérivation des PDAs...', 'cyan');
  const [buybackStatePDA, buybackBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('buyback_state')],
    CONFIG.BUYBACK_PROGRAM_ID
  );
  log(`   BuybackState PDA: ${buybackStatePDA.toBase58()}`);
  log(`   Bump: ${buybackBump}`);
  
  // Dérive le PDA BACK Vault
  const [backVaultPDA, backVaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('back_vault')],
    CONFIG.BUYBACK_PROGRAM_ID
  );
  log(`   BACK Vault PDA: ${backVaultPDA.toBase58()}`);
  log(`   Bump: ${backVaultBump}`);
  
  // Vérifie si le vault existe déjà
  log('\n🔍 Vérification état actuel...', 'cyan');
  const vaultAccountInfo = await connection.getAccountInfo(backVaultPDA);
  
  if (vaultAccountInfo !== null) {
    log(`   ✅ BACK Vault existe déjà !`, 'green');
    log(`   Owner: ${vaultAccountInfo.owner.toBase58()}`);
    log(`   Taille: ${vaultAccountInfo.data.length} bytes`);
    log(`   Lamports: ${(vaultAccountInfo.lamports / 1e9).toFixed(6)} SOL`);
    
    log('\n🎉 Aucune action nécessaire - Vault déjà initialisé', 'green');
    return;
  }
  
  log(`   ⚠️  BACK Vault n'existe pas encore`, 'yellow');
  
  // Détermine le Token Program à utiliser
  log('\n🔍 Détection Token Program...', 'cyan');
  const tokenProgramId = await getTokenProgramId(connection, CONFIG.BACK_MINT);
  log(`   Token Program: ${tokenProgramId.toBase58()}`);
  log(`   Type: ${tokenProgramId.equals(TOKEN_2022_PROGRAM_ID) ? 'Token-2022' : 'Token Standard'}`);
  
  // Calcule l'ATA pour le BACK Vault PDA
  log('\n📦 Calcul Associated Token Address...', 'cyan');
  const backVaultATA = await getAssociatedTokenAddress(
    CONFIG.BACK_MINT,
    backVaultPDA,
    true, // allowOwnerOffCurve (PDA peut être owner)
    tokenProgramId
  );
  
  log(`   ATA calculé: ${backVaultATA.toBase58()}`);
  
  // Note: Le PDA back_vault devrait correspondre à l'ATA
  if (!backVaultATA.equals(backVaultPDA)) {
    log(`   ⚠️  Attention: ATA (${backVaultATA.toBase58()}) ≠ PDA (${backVaultPDA.toBase58()})`, 'yellow');
    log(`   Le programme utilise probablement un PDA custom, pas un ATA standard`, 'yellow');
  }
  
  // Vérifie si l'ATA existe
  const ataAccountInfo = await connection.getAccountInfo(backVaultATA);
  if (ataAccountInfo !== null) {
    log(`   ✅ ATA existe déjà`, 'green');
    log(`\n🎉 BACK Vault configuré avec succès`, 'green');
    return;
  }
  
  // Crée l'instruction pour créer l'ATA
  log('\n🔨 Création du Token Account...', 'cyan');
  log(`   Mint: ${CONFIG.BACK_MINT.toBase58()}`);
  log(`   Owner: ${backVaultPDA.toBase58()} (PDA)`);
  log(`   Payer: ${payer.publicKey.toBase58()}`);
  
  const createATAInstruction = createAssociatedTokenAccountInstruction(
    payer.publicKey, // payer
    backVaultATA, // ata
    backVaultPDA, // owner (le PDA)
    CONFIG.BACK_MINT, // mint
    tokenProgramId // token program
  );
  
  // Crée et envoie la transaction
  log('\n📤 Envoi de la transaction...', 'cyan');
  const transaction = new Transaction().add(createATAInstruction);
  
  try {
    const signature = await connection.sendTransaction(transaction, [payer], {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    
    log(`   Transaction envoyée: ${signature}`, 'blue');
    log(`   🔗 Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`, 'blue');
    
    // Attendre la confirmation
    log(`   ⏳ Attente confirmation...`, 'yellow');
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      throw new Error(`Transaction échouée: ${JSON.stringify(confirmation.value.err)}`);
    }
    
    log(`   ✅ Transaction confirmée !`, 'green');
    
  } catch (error) {
    log(`   ❌ Erreur lors de la création: ${error.message}`, 'red');
    
    if (error.message.includes('already in use')) {
      log(`   💡 Le compte existe peut-être déjà`, 'yellow');
    }
    
    throw error;
  }
  
  // Vérifie la création
  log('\n✅ Vérification finale...', 'cyan');
  const finalAccountInfo = await connection.getAccountInfo(backVaultATA);
  
  if (finalAccountInfo !== null) {
    log(`   ✅ BACK Vault créé avec succès !`, 'green');
    log(`   Address: ${backVaultATA.toBase58()}`);
    log(`   Owner: ${finalAccountInfo.owner.toBase58()}`);
    log(`   Taille: ${finalAccountInfo.data.length} bytes`);
    log(`   Lamports: ${(finalAccountInfo.lamports / 1e9).toFixed(6)} SOL`);
    
    // Sauvegarde l'adresse
    const outputData = {
      backVaultPDA: backVaultPDA.toBase58(),
      backVaultATA: backVaultATA.toBase58(),
      tokenProgramId: tokenProgramId.toBase58(),
      backMint: CONFIG.BACK_MINT.toBase58(),
      timestamp: new Date().toISOString(),
    };
    
    const outputFile = path.join(process.cwd(), 'back-vault-initialized.json');
    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
    log(`   💾 Configuration sauvegardée: ${outputFile}`, 'cyan');
    
  } else {
    log(`   ❌ Échec de la vérification`, 'red');
    process.exit(1);
  }
  
  log('\n' + '='.repeat(60), 'bright');
  log('🎉 INITIALISATION TERMINÉE AVEC SUCCÈS', 'green');
  log('='.repeat(60) + '\n', 'bright');
  
  log('📋 Prochaines étapes:', 'cyan');
  log('   1. ✅ BACK Vault est prêt à recevoir des tokens');
  log('   2. Le programme buyback peut maintenant stocker les $BACK achetés');
  log('   3. Les fonctions distribute_buyback() et burn_back() sont opérationnelles');
  log('   4. Tester avec un buyback de test\n');
}

// Run initialization
initializeBackVault().catch(error => {
  log(`\n❌ Erreur fatale: ${error.message}\n`, 'red');
  console.error(error);
  process.exit(1);
});
