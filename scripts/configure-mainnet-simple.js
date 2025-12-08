/**
 * Script de configuration du RouterState sur Mainnet
 * 
 * EXÉCUTION:
 * 1. Sur votre machine locale avec le keypair authority:
 *    cd scripts && node configure-mainnet-simple.js
 * 
 * 2. Ou définissez ANCHOR_WALLET:
 *    ANCHOR_WALLET=/path/to/your/keypair.json node configure-mainnet-simple.js
 */

const { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, SystemProgram, SYSVAR_RENT_PUBKEY } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

// ============ CONFIGURATION ============
const ROUTER_PROGRAM_ID = new PublicKey('5HR9WsW81YySSst7qUSdqxnXc2X4NVfJNANDfvWnZUXW');
const USDC_MINT_MAINNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const RPC_URL = 'https://api.mainnet-beta.solana.com';

// Wallet authority utilisé pour tous les wallets (temporaire)
const AUTHORITY_WALLET = new PublicKey('FLKsRa7xboYJ5d56jjQi2LKqJXMG2ejmWpkDDMLhv4WS');

// Pourcentages (en basis points)
const CONFIG = {
  rebateBps: 7000,        // 70% NPI → Rebates
  treasuryBps: 1500,      // 15% NPI → Treasury
  boostVaultBps: 1500,    // 15% NPI → Boost
};

// ============ IDL Instruction Discriminators (Anchor) ============
// Ces discriminators sont calculés avec sha256("global:<instruction_name>")[0..8]
const DISCRIMINATORS = {
  updateWallets: Buffer.from([209, 33, 147, 51, 29, 215, 56, 133]),
  initializeConfig: Buffer.from([208, 127, 21, 1, 194, 190, 196, 70]),
  updateConfig: Buffer.from([29, 158, 252, 191, 10, 83, 219, 99]),
  initializeRebateVault: Buffer.from([115, 234, 217, 40, 160, 70, 108, 120]),
};

// ============ HELPERS ============
function loadKeypair(filePath) {
  const secretKey = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

function deriveRouterStatePDA() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('router_state')],
    ROUTER_PROGRAM_ID
  );
}

function deriveRouterConfigPDA() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('router_config')],
    ROUTER_PROGRAM_ID
  );
}

function deriveRebateVaultPDA(routerState) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('rebate_vault'), routerState.toBuffer()],
    ROUTER_PROGRAM_ID
  );
}

// Créer l'instruction update_wallets
function createUpdateWalletsInstruction(routerState, authority, treasury, buyback, boostVault, npiVault) {
  // Serializer les arguments
  // Option<Pubkey> = 1 byte (Some=1) + 32 bytes pubkey
  const data = Buffer.alloc(8 + 4 * 33); // discriminator + 4 Option<Pubkey>
  
  let offset = 0;
  DISCRIMINATORS.updateWallets.copy(data, offset);
  offset += 8;
  
  // Treasury (Some)
  data.writeUInt8(1, offset); offset += 1;
  treasury.toBuffer().copy(data, offset); offset += 32;
  
  // Buyback (Some)
  data.writeUInt8(1, offset); offset += 1;
  buyback.toBuffer().copy(data, offset); offset += 32;
  
  // Boost Vault (Some)
  data.writeUInt8(1, offset); offset += 1;
  boostVault.toBuffer().copy(data, offset); offset += 32;
  
  // NPI Vault (Some)
  data.writeUInt8(1, offset); offset += 1;
  npiVault.toBuffer().copy(data, offset); offset += 32;
  
  return new TransactionInstruction({
    programId: ROUTER_PROGRAM_ID,
    keys: [
      { pubkey: routerState, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data,
  });
}

// Créer l'instruction initialize_config
function createInitializeConfigInstruction(config, routerState, authority) {
  return new TransactionInstruction({
    programId: ROUTER_PROGRAM_ID,
    keys: [
      { pubkey: config, isSigner: false, isWritable: true },
      { pubkey: routerState, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: DISCRIMINATORS.initializeConfig,
  });
}

// Créer l'instruction update_config
function createUpdateConfigInstruction(config, routerState, authority, rebateBps, treasuryBps, boostVaultBps) {
  // Option<u16> = 1 byte (Some=1) + 2 bytes value
  const data = Buffer.alloc(8 + 7 * 3); // discriminator + 7 Option<u16> ou Option<bool>
  
  let offset = 0;
  DISCRIMINATORS.updateConfig.copy(data, offset);
  offset += 8;
  
  // rebate_bps (Some)
  data.writeUInt8(1, offset); offset += 1;
  data.writeUInt16LE(rebateBps, offset); offset += 2;
  
  // treasury_bps (Some)
  data.writeUInt8(1, offset); offset += 1;
  data.writeUInt16LE(treasuryBps, offset); offset += 2;
  
  // boost_vault_bps (Some)
  data.writeUInt8(1, offset); offset += 1;
  data.writeUInt16LE(boostVaultBps, offset); offset += 2;
  
  // treasury_from_fees_bps (None)
  data.writeUInt8(0, offset); offset += 1;
  
  // buyburn_from_fees_bps (None)
  data.writeUInt8(0, offset); offset += 1;
  
  // dynamic_slippage_enabled (None)
  data.writeUInt8(0, offset); offset += 1;
  
  // npi_benchmarking_enabled (None)
  data.writeUInt8(0, offset); offset += 1;
  
  return new TransactionInstruction({
    programId: ROUTER_PROGRAM_ID,
    keys: [
      { pubkey: config, isSigner: false, isWritable: true },
      { pubkey: routerState, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data: data.slice(0, offset),
  });
}

// Créer l'instruction initialize_rebate_vault
function createInitializeRebateVaultInstruction(routerState, rebateVault, usdcMint, authority) {
  return new TransactionInstruction({
    programId: ROUTER_PROGRAM_ID,
    keys: [
      { pubkey: routerState, isSigner: false, isWritable: true },
      { pubkey: rebateVault, isSigner: false, isWritable: true },
      { pubkey: usdcMint, isSigner: false, isWritable: false },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: DISCRIMINATORS.initializeRebateVault,
  });
}

// ============ MAIN ============
async function main() {
  console.log('🚀 Configuration du RouterState sur Mainnet\n');
  
  // Charger le keypair
  const keypairPath = process.env.ANCHOR_WALLET || 
    path.join(process.env.HOME || '', '.config/solana/id.json');
  
  if (!fs.existsSync(keypairPath)) {
    console.error(`❌ Keypair non trouvé: ${keypairPath}`);
    console.error('   Définissez ANCHOR_WALLET=/chemin/vers/keypair.json');
    process.exit(1);
  }
  
  const authority = loadKeypair(keypairPath);
  console.log(`📍 Authority: ${authority.publicKey.toBase58()}`);
  
  if (authority.publicKey.toBase58() !== AUTHORITY_WALLET.toBase58()) {
    console.error(`❌ Ce keypair n'est pas l'authority du RouterState!`);
    console.error(`   Attendu: ${AUTHORITY_WALLET.toBase58()}`);
    console.error(`   Trouvé: ${authority.publicKey.toBase58()}`);
    process.exit(1);
  }
  
  const connection = new Connection(RPC_URL, 'confirmed');
  const balance = await connection.getBalance(authority.publicKey);
  console.log(`💰 Balance: ${balance / 1e9} SOL\n`);
  
  if (balance < 0.05 * 1e9) {
    console.error('❌ Balance insuffisante. Minimum 0.05 SOL requis.');
    process.exit(1);
  }
  
  // Dériver les PDAs
  const [routerStatePda] = deriveRouterStatePDA();
  const [routerConfigPda] = deriveRouterConfigPDA();
  const [rebateVaultPda] = deriveRebateVaultPDA(routerStatePda);
  
  console.log('📋 PDAs:');
  console.log(`   RouterState: ${routerStatePda.toBase58()}`);
  console.log(`   RouterConfig: ${routerConfigPda.toBase58()}`);
  console.log(`   RebateVault: ${rebateVaultPda.toBase58()}\n`);
  
  // ============ ÉTAPE 1: update_wallets ============
  console.log('📝 ÉTAPE 1: Configuration des wallets...');
  
  try {
    const ix1 = createUpdateWalletsInstruction(
      routerStatePda,
      authority.publicKey,
      AUTHORITY_WALLET, // treasury
      AUTHORITY_WALLET, // buyback
      AUTHORITY_WALLET, // boost vault
      AUTHORITY_WALLET  // npi vault
    );
    
    const tx1 = new Transaction().add(ix1);
    tx1.feePayer = authority.publicKey;
    tx1.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx1.sign(authority);
    
    const sig1 = await connection.sendRawTransaction(tx1.serialize());
    await connection.confirmTransaction(sig1, 'confirmed');
    console.log(`   ✅ Wallets configurés! Tx: ${sig1}\n`);
  } catch (error) {
    console.error(`   ⚠️ Erreur update_wallets: ${error.message}`);
    if (error.logs) console.error(error.logs.slice(-5).join('\n'));
  }
  
  // ============ ÉTAPE 2: initialize_config ============
  console.log('📝 ÉTAPE 2: Initialisation de la configuration...');
  
  const configExists = await connection.getAccountInfo(routerConfigPda);
  
  if (!configExists) {
    try {
      const ix2 = createInitializeConfigInstruction(
        routerConfigPda,
        routerStatePda,
        authority.publicKey
      );
      
      const tx2 = new Transaction().add(ix2);
      tx2.feePayer = authority.publicKey;
      tx2.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      tx2.sign(authority);
      
      const sig2 = await connection.sendRawTransaction(tx2.serialize());
      await connection.confirmTransaction(sig2, 'confirmed');
      console.log(`   ✅ Config initialisée! Tx: ${sig2}\n`);
    } catch (error) {
      console.error(`   ⚠️ Erreur initialize_config: ${error.message}`);
      if (error.logs) console.error(error.logs.slice(-5).join('\n'));
    }
  } else {
    console.log('   ℹ️  Config existe déjà, mise à jour...');
    try {
      const ix2 = createUpdateConfigInstruction(
        routerConfigPda,
        routerStatePda,
        authority.publicKey,
        CONFIG.rebateBps,
        CONFIG.treasuryBps,
        CONFIG.boostVaultBps
      );
      
      const tx2 = new Transaction().add(ix2);
      tx2.feePayer = authority.publicKey;
      tx2.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      tx2.sign(authority);
      
      const sig2 = await connection.sendRawTransaction(tx2.serialize());
      await connection.confirmTransaction(sig2, 'confirmed');
      console.log(`   ✅ Config mise à jour! Tx: ${sig2}\n`);
    } catch (error) {
      console.error(`   ⚠️ Erreur update_config: ${error.message}`);
    }
  }
  
  // ============ ÉTAPE 3: initialize_rebate_vault ============
  console.log('📝 ÉTAPE 3: Initialisation du Rebate Vault...');
  
  const vaultExists = await connection.getAccountInfo(rebateVaultPda);
  
  if (!vaultExists) {
    try {
      const ix3 = createInitializeRebateVaultInstruction(
        routerStatePda,
        rebateVaultPda,
        USDC_MINT_MAINNET,
        authority.publicKey
      );
      
      const tx3 = new Transaction().add(ix3);
      tx3.feePayer = authority.publicKey;
      tx3.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      tx3.sign(authority);
      
      const sig3 = await connection.sendRawTransaction(tx3.serialize());
      await connection.confirmTransaction(sig3, 'confirmed');
      console.log(`   ✅ Rebate Vault initialisé! Tx: ${sig3}\n`);
    } catch (error) {
      console.error(`   ⚠️ Erreur initialize_rebate_vault: ${error.message}`);
      if (error.logs) console.error(error.logs.slice(-5).join('\n'));
    }
  } else {
    console.log('   ℹ️  Rebate Vault existe déjà\n');
  }
  
  // ============ VÉRIFICATION FINALE ============
  console.log('🔍 Vérification finale...');
  
  const stateInfo = await connection.getAccountInfo(routerStatePda);
  if (stateInfo) {
    const data = stateInfo.data;
    let offset = 8;
    
    const authority = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
    const treasuryWallet = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
    const buybackWallet = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
    const boostVault = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
    const npiVault = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
    
    console.log('\n=== Configuration Finale ===');
    console.log(`Authority: ${authority.toBase58()}`);
    console.log(`Treasury: ${treasuryWallet.toBase58()}`);
    console.log(`Buyback: ${buybackWallet.toBase58()}`);
    console.log(`Boost Vault: ${boostVault.toBase58()}`);
    console.log(`NPI Vault: ${npiVault.toBase58()}`);
  }
  
  const finalVault = await connection.getAccountInfo(rebateVaultPda);
  console.log(`\nRebate Vault: ${finalVault ? '✅ Initialisé' : '❌ Non initialisé'}`);
  
  console.log('\n✅ Configuration terminée!');
}

main().catch(console.error);
