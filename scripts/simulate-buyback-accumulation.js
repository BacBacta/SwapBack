#!/usr/bin/env node
/**
 * Script de simulation d'accumulation USDC et déclenchement buyback
 * 
 * Étapes:
 * 1. Vérifier balance USDC du wallet
 * 2. Déposer USDC dans le vault buyback (simulation de frais accumulés)
 * 3. Vérifier que le montant minimum (100 USDC) est atteint
 * 4. Déclencher un buyback test
 * 5. Observer la supply reduction
 * 
 * Usage:
 *   node scripts/simulate-buyback-accumulation.js [--amount=AMOUNT]
 */

const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { 
  getAssociatedTokenAddress, 
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID 
} = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  RPC_URL: process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com',
  
  // Program IDs
  BUYBACK_PROGRAM_ID: new PublicKey('7wCCwRXxWvMY2DJDRrnhFg3b8jVPb5vVPxLH5YAGL6eJ'),
  
  // Tokens
  BACK_MINT: new PublicKey('862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux'),
  USDC_MINT: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
  
  // Wallet
  KEYPAIR_PATH: process.env.ANCHOR_WALLET || path.join(process.cwd(), 'devnet-keypair.json'),
  
  // Default amount
  DEFAULT_DEPOSIT_AMOUNT: 150, // 150 USDC (au-dessus du minimum de 100)
};

// Parse arguments
let depositAmount = CONFIG.DEFAULT_DEPOSIT_AMOUNT;
process.argv.forEach(arg => {
  if (arg.startsWith('--amount=')) {
    depositAmount = parseFloat(arg.split('=')[1]);
  }
});

// Colors
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

/**
 * Charge le keypair
 */
function loadKeypair(filepath) {
  try {
    const keypairData = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  } catch (error) {
    throw new Error(`Impossible de charger le keypair: ${error.message}`);
  }
}

/**
 * Dérive les PDAs
 */
function derivePDAs() {
  const [buybackState] = PublicKey.findProgramAddressSync(
    [Buffer.from('buyback_state')],
    CONFIG.BUYBACK_PROGRAM_ID
  );
  
  const [usdcVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('usdc_vault')],
    CONFIG.BUYBACK_PROGRAM_ID
  );
  
  const [backVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('back_vault')],
    CONFIG.BUYBACK_PROGRAM_ID
  );
  
  return { buybackState, usdcVault, backVault };
}

/**
 * Lit la supply du token
 */
async function getTokenSupply(connection, mint) {
  try {
    const supply = await connection.getTokenSupply(mint);
    return supply.value.uiAmount;
  } catch (error) {
    log(`  ⚠️  Erreur lecture supply: ${error.message}`, 'yellow');
    return null;
  }
}

/**
 * Lit le balance d'un token account
 */
async function getTokenBalance(connection, tokenAccount) {
  try {
    const accountInfo = await connection.getAccountInfo(tokenAccount);
    if (!accountInfo) return 0;
    
    const amount = accountInfo.data.readBigUInt64LE(64);
    return Number(amount);
  } catch (error) {
    log(`  ⚠️  Erreur lecture balance: ${error.message}`, 'yellow');
    return 0;
  }
}

/**
 * Étape 1: Vérifier les balances
 */
async function checkBalances(connection, payer) {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'bright');
  log('Étape 1: Vérification des balances', 'bright');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'bright');
  
  // SOL balance
  const solBalance = await connection.getBalance(payer.publicKey);
  log(`\n💰 Balance SOL: ${(solBalance / 1e9).toFixed(4)} SOL`, 'cyan');
  
  if (solBalance < 0.1e9) {
    log(`  ⚠️  Balance SOL faible, minimum 0.1 SOL recommandé`, 'yellow');
  }
  
  // USDC balance
  const usdcAta = await getAssociatedTokenAddress(
    CONFIG.USDC_MINT,
    payer.publicKey,
    false,
    TOKEN_PROGRAM_ID
  );
  
  const usdcBalance = await getTokenBalance(connection, usdcAta);
  log(`💵 Balance USDC: ${(usdcBalance / 1_000_000).toFixed(2)} USDC`, 'cyan');
  
  if (usdcBalance < depositAmount * 1_000_000) {
    log(`  ❌ Balance USDC insuffisante pour déposer ${depositAmount} USDC`, 'red');
    log(`  💡 Utilisez un faucet devnet ou ajustez --amount=XX`, 'yellow');
    return false;
  }
  
  log(`  ✅ Balance suffisante pour déposer ${depositAmount} USDC`, 'green');
  return true;
}

/**
 * Étape 2: Déposer USDC dans le vault
 */
async function depositUsdcToVault(connection, payer, program, amount) {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'bright');
  log('Étape 2: Dépôt USDC dans Buyback Vault', 'bright');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'bright');
  
  const { buybackState, usdcVault } = derivePDAs();
  
  // Get user USDC ATA
  const userUsdcAta = await getAssociatedTokenAddress(
    CONFIG.USDC_MINT,
    payer.publicKey,
    false,
    TOKEN_PROGRAM_ID
  );
  
  const amountLamports = new anchor.BN(amount * 1_000_000);
  
  log(`\n📤 Dépôt de ${amount} USDC...`, 'cyan');
  log(`   De      : ${userUsdcAta.toString()}`, 'cyan');
  log(`   Vers    : ${usdcVault.toString()}`, 'cyan');
  log(`   Montant : ${amount} USDC`, 'cyan');
  
  try {
    const txSig = await program.methods
      .depositUsdc(amountLamports)
      .accounts({
        buybackState,
        sourceUsdc: userUsdcAta,
        usdcVault,
        authority: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    
    log(`\n✅ Dépôt réussi !`, 'green');
    log(`   Transaction: ${txSig}`, 'cyan');
    log(`   🔗 Explorer: https://explorer.solana.com/tx/${txSig}?cluster=devnet`, 'blue');
    
    return true;
  } catch (error) {
    log(`\n❌ Échec du dépôt: ${error.message}`, 'red');
    if (error.logs) {
      log('\n📝 Program logs:', 'yellow');
      error.logs.forEach(l => log(`   ${l}`, 'yellow'));
    }
    return false;
  }
}

/**
 * Étape 3: Vérifier balance vault
 */
async function checkVaultBalance(connection) {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'bright');
  log('Étape 3: Vérification Balance Vault', 'bright');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'bright');
  
  const { usdcVault } = derivePDAs();
  const balance = await getTokenBalance(connection, usdcVault);
  
  log(`\n💰 Balance USDC Vault: ${(balance / 1_000_000).toFixed(2)} USDC`, 'cyan');
  
  const minRequired = 100;
  if (balance >= minRequired * 1_000_000) {
    log(`  ✅ Montant minimum atteint (${minRequired} USDC)`, 'green');
    log(`  ✅ Buyback peut être déclenché !`, 'green');
    return true;
  } else {
    log(`  ⚠️  Montant insuffisant (minimum ${minRequired} USDC)`, 'yellow');
    log(`  💡 Ajoutez ${(minRequired - balance / 1_000_000).toFixed(2)} USDC supplémentaires`, 'yellow');
    return false;
  }
}

/**
 * Étape 4: Initier le buyback
 */
async function initiateBuyback(connection, payer, program) {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'bright');
  log('Étape 4: Déclenchement Buyback', 'bright');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'bright');
  
  const { buybackState, usdcVault } = derivePDAs();
  
  log(`\n🚀 Initiation du buyback...`, 'cyan');
  
  try {
    const txSig = await program.methods
      .initiateBuyback()
      .accounts({
        buybackState,
        usdcVault,
        authority: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    
    log(`\n✅ Buyback initié !`, 'green');
    log(`   Transaction: ${txSig}`, 'cyan');
    log(`   🔗 Explorer: https://explorer.solana.com/tx/${txSig}?cluster=devnet`, 'blue');
    
    log(`\n💡 Prochaines étapes manuelles:`, 'bright');
    log(`   1. Swap USDC → $BACK via Jupiter`, 'cyan');
    log(`   2. Appeler finalize_buyback()`, 'cyan');
    log(`   3. Appeler burn_back()`, 'cyan');
    
    return true;
  } catch (error) {
    log(`\n❌ Échec initiation: ${error.message}`, 'red');
    if (error.logs) {
      log('\n📝 Program logs:', 'yellow');
      error.logs.forEach(l => log(`   ${l}`, 'yellow'));
    }
    
    // Vérifier si le cooldown n'est pas passé
    if (error.message.includes('time_lock') || error.message.includes('TimeLockNotElapsed')) {
      log(`\n💡 Le cooldown de 1 heure n'est pas encore écoulé`, 'yellow');
      log(`   Attendez avant de relancer le buyback`, 'yellow');
    }
    
    return false;
  }
}

/**
 * Étape 5: Observer supply
 */
async function observeSupply(connection) {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'bright');
  log('Étape 5: Observation Supply $BACK', 'bright');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'bright');
  
  const supply = await getTokenSupply(connection, CONFIG.BACK_MINT);
  
  if (supply) {
    log(`\n📊 Supply actuelle: ${supply.toLocaleString()} $BACK`, 'cyan');
    
    log(`\n💡 Pour observer la réduction:`, 'bright');
    log(`   1. Notez la supply actuelle: ${supply.toLocaleString()}`, 'cyan');
    log(`   2. Complétez le buyback (Jupiter swap + finalize + burn)`, 'cyan');
    log(`   3. Relancez ce script pour voir la nouvelle supply`, 'cyan');
    log(`   4. Supply devrait avoir diminué du montant brûlé`, 'green');
  }
}

/**
 * Fonction principale
 */
async function main() {
  log('\n╔════════════════════════════════════════════════════════════════════╗', 'bright');
  log('║   🔥 SIMULATION ACCUMULATION USDC & BUYBACK - DEVNET              ║', 'bright');
  log('║                    24 Novembre 2025                                ║', 'bright');
  log('╚════════════════════════════════════════════════════════════════════╝\n', 'bright');
  
  log(`📝 Configuration:`, 'cyan');
  log(`   Montant à déposer: ${depositAmount} USDC`, 'cyan');
  log(`   RPC             : ${CONFIG.RPC_URL}`, 'cyan');
  log(`   Buyback Program : ${CONFIG.BUYBACK_PROGRAM_ID.toString()}`, 'cyan');
  
  // Connexion
  const connection = new Connection(CONFIG.RPC_URL, 'confirmed');
  
  try {
    const version = await connection.getVersion();
    log(`   Solana version  : ${version['solana-core']}\n`, 'cyan');
  } catch (error) {
    log(`   Solana connecté\n`, 'cyan');
  }
  
  // Load wallet
  const payer = loadKeypair(CONFIG.KEYPAIR_PATH);
  log(`🔑 Wallet: ${payer.publicKey.toString()}\n`, 'cyan');
  
  // Setup Anchor
  const wallet = new anchor.Wallet(payer);
  const provider = new anchor.AnchorProvider(connection, wallet, anchor.AnchorProvider.defaultOptions());
  anchor.setProvider(provider);
  
  const idlPath = path.join(__dirname, '..', 'target', 'idl', 'swapback_buyback.json');
  if (!fs.existsSync(idlPath)) {
    throw new Error('IDL introuvable. Lancez `anchor build` d\'abord.');
  }
  
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
  const sanitizedIdl = {
    ...idl,
    address: CONFIG.BUYBACK_PROGRAM_ID.toString(),
    accounts: [],
  };
  
  const program = new anchor.Program(sanitizedIdl, provider);
  
  // Exécuter les étapes
  const step1 = await checkBalances(connection, payer);
  if (!step1) {
    log('\n❌ Balance insuffisante. Impossible de continuer.', 'red');
    process.exit(1);
  }
  
  const step2 = await depositUsdcToVault(connection, payer, program, depositAmount);
  if (!step2) {
    log('\n❌ Dépôt échoué. Vérifiez les logs ci-dessus.', 'red');
    process.exit(1);
  }
  
  const step3 = await checkVaultBalance(connection);
  
  if (step3) {
    const step4 = await initiateBuyback(connection, payer, program);
    
    if (step4) {
      log('\n🎉 Buyback initié avec succès !', 'green');
    }
  }
  
  await observeSupply(connection);
  
  log('\n' + '═'.repeat(70), 'bright');
  log('✅ SIMULATION TERMINÉE', 'green');
  log('═'.repeat(70) + '\n', 'bright');
  
  log('📋 Résumé:', 'bright');
  log(`   ✅ Balances vérifiées`, 'green');
  log(`   ${step2 ? '✅' : '❌'} USDC déposé dans vault`, step2 ? 'green' : 'red');
  log(`   ${step3 ? '✅' : '⚠️ '} Montant minimum atteint`, step3 ? 'green' : 'yellow');
  
  log('\n💡 Pour compléter le buyback:', 'bright');
  log('   1. Le buyback est initié, USDC est "locked"', 'cyan');
  log('   2. Manuellement: swap USDC → $BACK via Jupiter', 'cyan');
  log('   3. Appeler finalize_buyback() pour recevoir les tokens', 'cyan');
  log('   4. Appeler burn_back() pour brûler 100% des tokens', 'cyan');
  log('   5. Observer la supply reduction !', 'green');
}

main().catch(error => {
  log(`\n❌ Erreur fatale: ${error.message}`, 'red');
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
