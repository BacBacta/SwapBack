#!/usr/bin/env node
/**
 * Initialise le buyback state pour le NOUVEAU Program ID 100% burn (devnet)
 * Program ID: 7wCCwRXxWvMY2DJDRrnhFg3b8jVPb5vVPxLH5YAGL6eJ
 * 
 * Usage:
 *   node scripts/init-buyback-state-new.js
 */

const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

// Nouveau Program ID (100% burn model)
const BUYBACK_PROGRAM_ID = new anchor.web3.PublicKey('7wCCwRXxWvMY2DJDRrnhFg3b8jVPb5vVPxLH5YAGL6eJ');
const BACK_MINT = new anchor.web3.PublicKey('862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux');
const USDC_MINT = new anchor.web3.PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

const DEFAULT_MIN_USDC = 100 * 1_000_000; // 100 USDC en lamports

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

async function main() {
  log('\n' + '='.repeat(70), 'bright');
  log('🔧 Initialisation BuybackState - 100% Burn Model', 'bright');
  log('='.repeat(70) + '\n', 'bright');

  const rpcUrl = process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com';
  const walletPath = process.env.ANCHOR_WALLET || path.join(process.cwd(), 'devnet-keypair.json');

  if (!fs.existsSync(walletPath)) {
    throw new Error(`Anchor wallet introuvable: ${walletPath}`);
  }

  const secret = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const walletKeypair = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(secret));
  const connection = new anchor.web3.Connection(rpcUrl, 'confirmed');
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, anchor.AnchorProvider.defaultOptions());
  anchor.setProvider(provider);

  log('🔌 Connexion à Solana...', 'cyan');
  try {
    const version = await connection.getVersion();
    log(`   ✅ Connecté à Solana ${version['solana-core']}`, 'green');
  } catch (error) {
    log(`   ⚠️  Connexion établie (version non disponible)`, 'yellow');
  }

  // Check balance
  const balance = await connection.getBalance(wallet.publicKey);
  log(`   💰 Balance: ${(balance / 1e9).toFixed(4)} SOL`, 'cyan');
  if (balance < 0.1e9) {
    log(`   ⚠️  Balance faible, minimum 0.1 SOL recommandé`, 'yellow');
  }

  const idlPath = path.join(__dirname, '..', 'target', 'idl', 'swapback_buyback.json');
  if (!fs.existsSync(idlPath)) {
    throw new Error('IDL introuvable. Lancez `anchor build` d\'abord.');
  }
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
  
  // Sanitize IDL for compatibility
  const sanitizedIdl = {
    ...idl,
    address: BUYBACK_PROGRAM_ID.toString(),
    accounts: [],
  };

  const program = new anchor.Program(sanitizedIdl, provider);

  // Derive PDAs
  const [buybackState] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('buyback_state')],
    BUYBACK_PROGRAM_ID
  );
  const [usdcVault] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('usdc_vault')],
    BUYBACK_PROGRAM_ID
  );
  const [backVault] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('back_vault')],
    BUYBACK_PROGRAM_ID
  );

  const minUsdcLamports = parseInt(process.env.MIN_BUYBACK_USDC ?? '100', 10) * 1_000_000 || DEFAULT_MIN_USDC;

  log('\n📋 Configuration:', 'bright');
  log(`   Program ID      : ${BUYBACK_PROGRAM_ID.toString()}`, 'cyan');
  log(`   Authority       : ${wallet.publicKey.toString()}`, 'cyan');
  log(`   Min buyback     : ${minUsdcLamports / 1_000_000} USDC`, 'cyan');
  log(`   BACK Mint       : ${BACK_MINT.toString()}`, 'cyan');
  log(`   USDC Mint       : ${USDC_MINT.toString()}`, 'cyan');
  log('\n📍 PDAs:', 'bright');
  log(`   BuybackState    : ${buybackState.toString()}`, 'blue');
  log(`   USDC Vault      : ${usdcVault.toString()}`, 'blue');
  log(`   BACK Vault      : ${backVault.toString()}`, 'blue');

  // Check if already initialized
  log('\n🔍 Vérification état...', 'cyan');
  try {
    const stateAccount = await connection.getAccountInfo(buybackState);
    if (stateAccount && stateAccount.data.length > 0) {
      log('   ⚠️  BuybackState déjà initialisé !', 'yellow');
      log('   💡 Si vous voulez réinitialiser, fermez d\'abord le compte existant.', 'yellow');
      
      // Display current state info
      try {
        const state = await program.account.buybackState.fetch(buybackState);
        log('\n📊 État actuel:', 'bright');
        log(`   Authority       : ${state.authority.toString()}`, 'cyan');
        log(`   Min USDC        : ${state.minBuybackAmount.toNumber() / 1_000_000} USDC`, 'cyan');
        log(`   Last Buyback    : ${new Date(state.lastBuybackTime.toNumber() * 1000).toISOString()}`, 'cyan');
      } catch (err) {
        log(`   ℹ️  Impossible de lire l'état (structure peut avoir changé)`, 'yellow');
      }
      return;
    }
  } catch (error) {
    log('   ✅ Compte non initialisé, prêt pour initialisation', 'green');
  }

  log('\n🚀 Initialisation du BuybackState...', 'bright');
  
  try {
    const txSig = await program.methods
      .initialize(new anchor.BN(minUsdcLamports))
      .accounts({
        buybackState,
        backMint: BACK_MINT,
        usdcVault,
        usdcMint: USDC_MINT,
        authority: wallet.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    log('\n✅ BuybackState initialisé avec succès !', 'green');
    log(`   Transaction: ${txSig}`, 'cyan');
    log(`   🔗 Explorer: https://explorer.solana.com/tx/${txSig}?cluster=devnet`, 'blue');

    // Save configuration
    const configOutput = {
      programId: BUYBACK_PROGRAM_ID.toString(),
      buybackState: buybackState.toString(),
      usdcVault: usdcVault.toString(),
      backVault: backVault.toString(),
      authority: wallet.publicKey.toString(),
      minBuybackUsdc: minUsdcLamports / 1_000_000,
      burnRatio: '100%',
      distributionRatio: '0%',
      model: '100% Deflationary Burn',
      transaction: txSig,
      timestamp: new Date().toISOString(),
      network: 'devnet',
    };

    const outputPath = path.join(process.cwd(), 'buyback-state-new-initialized.json');
    fs.writeFileSync(outputPath, JSON.stringify(configOutput, null, 2));
    log(`\n💾 Configuration sauvegardée: ${outputPath}`, 'green');

    log('\n📋 Prochaines étapes:', 'bright');
    log('   1. Initialiser le BACK Vault ATA (si pas déjà fait)', 'cyan');
    log('   2. Recompiler et déployer le router avec nouveau BUYBACK_PROGRAM_ID', 'cyan');
    log('   3. Tester le flux complet de buyback', 'cyan');
    log('   4. Vérifier que 100% des tokens sont burn (pas de distribution)', 'cyan');

  } catch (error) {
    log('\n❌ Échec de l\'initialisation', 'red');
    log(`   Erreur: ${error.message}`, 'red');
    if (error.logs) {
      log('\n📝 Program logs:', 'yellow');
      error.logs.forEach(l => log(`   ${l}`, 'yellow'));
    }
    throw error;
  }
}

main().catch((err) => {
  log(`\n❌ Erreur fatale: ${err.message}`, 'red');
  if (err?.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
