/**
 * Script de configuration du RouterState sur Mainnet
 * 
 * Ce script exécute les étapes suivantes:
 * 1. update_wallets - Configure les wallets (treasury, buyback, boost vault, npi vault)
 * 2. initialize_config - Initialise la configuration avec les pourcentages
 * 3. initialize_rebate_vault - Crée le vault USDC pour les rebates
 * 
 * PRÉREQUIS:
 * - Le wallet authority doit avoir des SOL pour les transactions
 * - Le RouterState doit déjà être initialisé
 * 
 * USAGE:
 * npx ts-node scripts/configure-mainnet-router.ts
 */

import { 
  Connection, 
  PublicKey, 
  Keypair,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token';
import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as path from 'path';

// ============ CONFIGURATION ============

const ROUTER_PROGRAM_ID = new PublicKey('GEdKdZRVZHLUKGCX8swwLn7BJUciDFgf2edkjq4M31mJ');
const USDC_MINT_MAINNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const RPC_URL = 'https://api.mainnet-beta.solana.com';

// Configuration avec le wallet authority comme destination temporaire
// FLKsRa7xboYJ5d56jjQi2LKqJXMG2ejmWpkDDMLhv4WS
const AUTHORITY_WALLET = new PublicKey('FLKsRa7xboYJ5d56jjQi2LKqJXMG2ejmWpkDDMLhv4WS');

const WALLETS_CONFIG = {
  // Wallet pour recevoir la part treasury des fees (15% NPI + 85% platform fees)
  treasury: AUTHORITY_WALLET,
  
  // Wallet pour le buyback & burn BACK tokens (15% platform fees)
  buyback: AUTHORITY_WALLET,
  
  // Vault pour les récompenses de boost/lock
  boostVault: AUTHORITY_WALLET,
  
  // Vault NPI (Net Positive Impact) - reçoit les rebates avant distribution
  npiVault: AUTHORITY_WALLET,
};

// Pourcentages par défaut (en basis points, 100 = 1%)
const CONFIG = {
  rebateBps: 7000,        // 70% du NPI → Rebates utilisateurs
  treasuryBps: 1500,      // 15% du NPI → Protocol treasury
  boostVaultBps: 1500,    // 15% du NPI → Boost vault
  treasuryFromFeesBps: 8500,  // 85% des platform fees → Treasury
  buyburnFromFeesBps: 1500,   // 15% des platform fees → Buy & Burn
};

// ============ FONCTIONS HELPERS ============

function loadKeypair(filePath: string): Keypair {
  const secretKey = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

async function deriveRouterStatePDA(): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('router_state')],
    ROUTER_PROGRAM_ID
  );
}

async function deriveRouterConfigPDA(): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('router_config')],
    ROUTER_PROGRAM_ID
  );
}

async function deriveRebateVaultPDA(routerState: PublicKey): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('rebate_vault'), routerState.toBuffer()],
    ROUTER_PROGRAM_ID
  );
}

async function getRouterStateData(connection: Connection, routerStatePda: PublicKey) {
  const accountInfo = await connection.getAccountInfo(routerStatePda);
  if (!accountInfo) {
    throw new Error('RouterState not found');
  }
  
  const data = accountInfo.data;
  let offset = 8; // Skip discriminator
  
  const authority = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  
  const treasuryWallet = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  
  const buybackWallet = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  
  const boostVault = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  
  const npiVault = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  
  const bump = data[offset];
  
  return {
    authority,
    treasuryWallet,
    buybackWallet,
    boostVault,
    npiVault,
    bump,
  };
}

// ============ MAIN ============

async function main() {
  console.log('🚀 Configuration du RouterState sur Mainnet\n');
  
  // Vérifier que les wallets sont configurés
  console.log('📍 Wallets configurés avec authority:', AUTHORITY_WALLET.toBase58());
  
  // Charger le keypair authority
  const keypairPath = process.env.ANCHOR_WALLET || 
    path.join(process.env.HOME || '', '.config/solana/id.json');
  
  if (!fs.existsSync(keypairPath)) {
    console.error(`❌ Keypair non trouvé: ${keypairPath}`);
    console.error('   Définissez ANCHOR_WALLET ou utilisez solana-keygen');
    process.exit(1);
  }
  
  const authority = loadKeypair(keypairPath);
  console.log(`📍 Authority: ${authority.publicKey.toBase58()}`);
  
  // Connexion
  const connection = new Connection(RPC_URL, 'confirmed');
  const balance = await connection.getBalance(authority.publicKey);
  console.log(`💰 Balance: ${balance / 1e9} SOL\n`);
  
  if (balance < 0.1 * 1e9) {
    console.error('❌ Balance insuffisante. Minimum 0.1 SOL requis.');
    process.exit(1);
  }
  
  // Dériver les PDAs
  const [routerStatePda, stateBump] = await deriveRouterStatePDA();
  const [routerConfigPda, configBump] = await deriveRouterConfigPDA();
  const [rebateVaultPda, vaultBump] = await deriveRebateVaultPDA(routerStatePda);
  
  console.log('📋 PDAs:');
  console.log(`   RouterState: ${routerStatePda.toBase58()}`);
  console.log(`   RouterConfig: ${routerConfigPda.toBase58()}`);
  console.log(`   RebateVault: ${rebateVaultPda.toBase58()}\n`);
  
  // Vérifier l'état actuel
  const currentState = await getRouterStateData(connection, routerStatePda);
  
  if (currentState.authority.toBase58() !== authority.publicKey.toBase58()) {
    console.error('❌ ERREUR: Vous n\'êtes pas l\'authority du RouterState!');
    console.error(`   Authority attendu: ${currentState.authority.toBase58()}`);
    console.error(`   Votre wallet: ${authority.publicKey.toBase58()}`);
    process.exit(1);
  }
  
  console.log('✅ Vous êtes l\'authority du RouterState\n');
  
  // Charger l'IDL
  const idlPath = path.join(__dirname, '../app/src/idl/swapback_router.json');
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
  
  // Créer le provider et le programme
  const wallet = new anchor.Wallet(authority);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  const program = new Program(idl, ROUTER_PROGRAM_ID, provider);
  
  // ============ ÉTAPE 1: update_wallets ============
  console.log('📝 ÉTAPE 1: Configuration des wallets...');
  
  try {
    const tx1 = await program.methods
      .updateWallets(
        WALLETS_CONFIG.treasury,
        WALLETS_CONFIG.buyback,
        WALLETS_CONFIG.boostVault,
        WALLETS_CONFIG.npiVault
      )
      .accounts({
        state: routerStatePda,
        authority: authority.publicKey,
      })
      .rpc();
    
    console.log(`   ✅ Wallets configurés! Tx: ${tx1}\n`);
  } catch (error: any) {
    console.error(`   ❌ Erreur update_wallets: ${error.message}`);
    // Continuer si déjà configuré
  }
  
  // ============ ÉTAPE 2: initialize_config ============
  console.log('📝 ÉTAPE 2: Initialisation de la configuration...');
  
  const configExists = await connection.getAccountInfo(routerConfigPda);
  
  if (!configExists) {
    try {
      const tx2 = await program.methods
        .initializeConfig()
        .accounts({
          config: routerConfigPda,
          state: routerStatePda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      console.log(`   ✅ Config initialisée! Tx: ${tx2}\n`);
    } catch (error: any) {
      console.error(`   ❌ Erreur initialize_config: ${error.message}`);
    }
  } else {
    console.log('   ℹ️  Config déjà initialisée, mise à jour...\n');
    
    try {
      const tx2 = await program.methods
        .updateConfig(
          CONFIG.rebateBps,
          CONFIG.treasuryBps,
          CONFIG.boostVaultBps,
          CONFIG.treasuryFromFeesBps,
          CONFIG.buyburnFromFeesBps,
          false, // dynamic_slippage_enabled
          false  // npi_benchmarking_enabled
        )
        .accounts({
          config: routerConfigPda,
          state: routerStatePda,
          authority: authority.publicKey,
        })
        .rpc();
      
      console.log(`   ✅ Config mise à jour! Tx: ${tx2}\n`);
    } catch (error: any) {
      console.error(`   ❌ Erreur update_config: ${error.message}`);
    }
  }
  
  // ============ ÉTAPE 3: initialize_rebate_vault ============
  console.log('📝 ÉTAPE 3: Initialisation du Rebate Vault...');
  
  const vaultExists = await connection.getAccountInfo(rebateVaultPda);
  
  if (!vaultExists) {
    try {
      const tx3 = await program.methods
        .initializeRebateVault()
        .accounts({
          state: routerStatePda,
          rebateVault: rebateVaultPda,
          usdcMint: USDC_MINT_MAINNET,
          authority: authority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      
      console.log(`   ✅ Rebate Vault initialisé! Tx: ${tx3}\n`);
    } catch (error: any) {
      console.error(`   ❌ Erreur initialize_rebate_vault: ${error.message}`);
    }
  } else {
    console.log('   ℹ️  Rebate Vault déjà initialisé\n');
  }
  
  // ============ VÉRIFICATION FINALE ============
  console.log('🔍 Vérification finale...\n');
  
  const finalState = await getRouterStateData(connection, routerStatePda);
  
  console.log('=== Configuration RouterState ===');
  console.log(`Authority: ${finalState.authority.toBase58()}`);
  console.log(`\n--- Wallets ---`);
  console.log(`Treasury: ${finalState.treasuryWallet.toBase58()}`);
  console.log(`Buyback: ${finalState.buybackWallet.toBase58()}`);
  console.log(`Boost Vault: ${finalState.boostVault.toBase58()}`);
  console.log(`NPI Vault: ${finalState.npiVault.toBase58()}`);
  
  const finalVault = await connection.getAccountInfo(rebateVaultPda);
  console.log(`\n--- Rebate Vault ---`);
  console.log(`PDA: ${rebateVaultPda.toBase58()}`);
  console.log(`Existe: ${finalVault ? '✅ OUI' : '❌ NON'}`);
  
  if (finalVault && finalVault.data.length === 165) {
    const balance = Number(finalVault.data.readBigUInt64LE(64));
    console.log(`Balance USDC: ${balance / 1e6}`);
  }
  
  console.log('\n✅ Configuration terminée!');
}

main().catch(console.error);
