#!/usr/bin/env node
/**
 * Script d'initialisation du BACK Vault pour le NOUVEAU programme 100% burn
 * Program ID: 7wCCwRXxWvMY2DJDRrnhFg3b8jVPb5vVPxLH5YAGL6eJ
 * 
 * Crée et initialise le Token Account pour le BACK Vault PDA
 * 
 * Usage:
 *   node scripts/initialize-back-vault-new.js
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

// Configuration - NOUVEAU PROGRAMME
const CONFIG = {
  RPC_URL: process.env.RPC_URL || 'https://api.devnet.solana.com',
  
  // NEW Program ID (100% burn)
  BUYBACK_PROGRAM_ID: new PublicKey('7wCCwRXxWvMY2DJDRrnhFg3b8jVPb5vVPxLH5YAGL6eJ'),
  
  // Token
  BACK_MINT: new PublicKey(process.env.NEXT_PUBLIC_BACK_MINT || '862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux'),
  
  // Wallet keypair path (devnet)
  KEYPAIR_PATH: process.env.KEYPAIR_PATH || path.join(process.cwd(), 'devnet-keypair.json'),
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
  log('\n' + '='.repeat(70), 'bright');
  log('🔧 Initialisation BACK Vault - 100% Burn Model', 'bright');
  log('='.repeat(70) + '\n', 'bright');
  
  // Connect to Solana
  log('🔌 Connexion à Solana...', 'cyan');
  const connection = new Connection(CONFIG.RPC_URL, 'confirmed');
  
  try {
    const version = await connection.getVersion();
    log(`   ✅ Connecté à Solana ${version['solana-core']}`, 'green');
  } catch (error) {
    log(`   ⚠️  Connexion établie (version non disponible)`, 'yellow');
  }
  
  // Load keypair
  log('\n🔑 Chargement du keypair...', 'cyan');
  const payer = loadKeypair(CONFIG.KEYPAIR_PATH);
  log(`   ✅ Wallet: ${payer.publicKey.toString()}`, 'green');
  
  // Check balance
  const balance = await connection.getBalance(payer.publicKey);
  log(`   💰 Balance: ${(balance / 1e9).toFixed(4)} SOL`, 'cyan');
  
  if (balance < 0.01e9) {
    throw new Error('Balance insuffisante (minimum 0.01 SOL requis)');
  }
  
  // Derive back_vault PDA
  log('\n📍 Calcul des PDAs...', 'cyan');
  const [backVaultPDA, backVaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('back_vault')],
    CONFIG.BUYBACK_PROGRAM_ID
  );
  
  log(`   ✅ BACK Vault PDA: ${backVaultPDA.toString()}`, 'green');
  log(`   ✅ Bump: ${backVaultBump}`, 'green');
  
  // Detect token program (Token vs Token-2022)
  log('\n🔍 Détection du Token Program...', 'cyan');
  const tokenProgramId = await getTokenProgramId(connection, CONFIG.BACK_MINT);
  const isToken2022 = tokenProgramId.equals(TOKEN_2022_PROGRAM_ID);
  log(`   ✅ Token Program: ${isToken2022 ? 'Token-2022' : 'Token'} (${tokenProgramId.toString()})`, 'green');
  
  // Get Associated Token Address
  const backVaultAta = await getAssociatedTokenAddress(
    CONFIG.BACK_MINT,
    backVaultPDA,
    true, // allowOwnerOffCurve = true (PDA can be owner)
    tokenProgramId
  );
  
  log(`   ✅ BACK Vault ATA: ${backVaultAta.toString()}`, 'green');
  
  // Check if ATA already exists
  log('\n🔍 Vérification du compte...', 'cyan');
  const ataAccountInfo = await connection.getAccountInfo(backVaultAta);
  
  if (ataAccountInfo) {
    log(`   ⚠️  BACK Vault ATA existe déjà !`, 'yellow');
    log(`   Address: ${backVaultAta.toString()}`, 'cyan');
    log(`   Owner: ${ataAccountInfo.owner.toString()}`, 'cyan');
    log(`   Size: ${ataAccountInfo.data.length} bytes`, 'cyan');
    
    // Save config and exit
    const outputData = {
      programId: CONFIG.BUYBACK_PROGRAM_ID.toString(),
      backMint: CONFIG.BACK_MINT.toString(),
      backVaultPDA: backVaultPDA.toString(),
      backVaultATA: backVaultAta.toString(),
      tokenProgram: tokenProgramId.toString(),
      isToken2022,
      bump: backVaultBump,
      alreadyExists: true,
      timestamp: new Date().toISOString(),
      network: 'devnet',
      model: '100% Deflationary Burn',
    };
    
    const outputFile = path.join(process.cwd(), 'back-vault-new-initialized.json');
    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
    log(`\n💾 Configuration sauvegardée: ${outputFile}`, 'green');
    
    return;
  }
  
  log('   ✅ Compte non créé, prêt pour initialisation', 'green');
  
  // Create ATA instruction
  log('\n🔨 Création de la transaction...', 'cyan');
  const createAtaIx = createAssociatedTokenAccountInstruction(
    payer.publicKey,      // payer
    backVaultAta,         // ata
    backVaultPDA,         // owner (PDA)
    CONFIG.BACK_MINT,     // mint
    tokenProgramId        // token program
  );
  
  const transaction = new Transaction().add(createAtaIx);
  
  // Send transaction
  log('🚀 Envoi de la transaction...', 'bright');
  try {
    const signature = await connection.sendTransaction(transaction, [payer], {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    
    log(`   📝 Signature: ${signature}`, 'cyan');
    log('   ⏳ Attente de confirmation...', 'yellow');
    
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }
    
    log('\n✅ BACK Vault ATA créé avec succès !', 'green');
    log(`   🔗 Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`, 'blue');
    
    // Verify the created account
    log('\n🔍 Vérification du compte créé...', 'cyan');
    const createdAccountInfo = await connection.getAccountInfo(backVaultAta);
    
    if (!createdAccountInfo) {
      throw new Error('Le compte n\'a pas été créé correctement');
    }
    
    log(`   ✅ Compte vérifié`, 'green');
    log(`   Owner: ${createdAccountInfo.owner.toString()}`, 'cyan');
    log(`   Size: ${createdAccountInfo.data.length} bytes`, 'cyan');
    log(`   Lamports: ${createdAccountInfo.lamports}`, 'cyan');
    
    // Save configuration
    const outputData = {
      programId: CONFIG.BUYBACK_PROGRAM_ID.toString(),
      backMint: CONFIG.BACK_MINT.toString(),
      backVaultPDA: backVaultPDA.toString(),
      backVaultATA: backVaultAta.toString(),
      tokenProgram: tokenProgramId.toString(),
      isToken2022,
      bump: backVaultBump,
      transaction: signature,
      timestamp: new Date().toISOString(),
      network: 'devnet',
      model: '100% Deflationary Burn',
    };
    
    const outputFile = path.join(process.cwd(), 'back-vault-new-initialized.json');
    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
    
    log(`\n💾 Configuration sauvegardée: ${outputFile}`, 'green');
    
    log('\n' + '='.repeat(70), 'bright');
    log('✅ INITIALISATION TERMINÉE AVEC SUCCÈS', 'bright');
    log('='.repeat(70) + '\n', 'bright');
    
  } catch (error) {
    log(`\n❌ Erreur lors de l'envoi de la transaction`, 'red');
    log(`   ${error.message}`, 'red');
    throw error;
  }
}

initializeBackVault().catch(error => {
  log(`\n❌ Erreur fatale: ${error.message}`, 'red');
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
