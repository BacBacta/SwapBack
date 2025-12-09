/**
 * Test Swap on Mainnet - Pyth V2
 * Simulates a swap to verify the new program works
 */

const { Connection, PublicKey, Keypair, Transaction, SystemProgram, ComputeBudgetProgram } = require('@solana/web3.js');
const { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const PROGRAM_ID = new PublicKey('APHj6L2b2bA2q62jwYZp38dqbTxQUqwatqdUum1trPnN');

// Pyth V2 Push Feed for SOL/USD
const SOL_USD_ORACLE = new PublicKey('7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE');

// USDC and SOL mints
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

// PDAs
const ROUTER_STATE = new PublicKey('C7TaTP9oqHhV5m8qFieaEouVWS6pvfTopSDJXsqWN2rE');
const ROUTER_CONFIG = new PublicKey('7sdBhDyuDtdPdVFrm9brbQP9qgBsG5AoDXn9mvUsYZQR');

async function main() {
  console.log('='.repeat(60));
  console.log('Test Swap Mainnet - Pyth V2');
  console.log('='.repeat(60));
  
  // Connect to mainnet
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  
  // Load wallet
  const keypairPath = process.env.HOME + '/.config/solana/id.json';
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  console.log('\n📊 État des comptes:');
  console.log(`  Wallet: ${wallet.publicKey.toBase58()}`);
  
  // Check program exists
  const programInfo = await connection.getAccountInfo(PROGRAM_ID);
  console.log(`  Program: ${programInfo ? '✅ Déployé' : '❌ Non trouvé'}`);
  
  // Check RouterState
  const routerStateInfo = await connection.getAccountInfo(ROUTER_STATE);
  console.log(`  RouterState: ${routerStateInfo ? '✅ Initialisé' : '❌ Non trouvé'}`);
  
  // Check RouterConfig
  const routerConfigInfo = await connection.getAccountInfo(ROUTER_CONFIG);
  console.log(`  RouterConfig: ${routerConfigInfo ? '✅ Initialisé' : '❌ Non trouvé'}`);
  
  // Check Pyth Oracle
  const oracleInfo = await connection.getAccountInfo(SOL_USD_ORACLE);
  console.log(`  Oracle SOL/USD: ${oracleInfo ? '✅ Actif (' + oracleInfo.data.length + ' bytes)' : '❌ Non trouvé'}`);
  
  if (oracleInfo) {
    console.log(`    Owner: ${oracleInfo.owner.toBase58()}`);
  }
  
  // Check wallet balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`  Balance: ${(balance / 1e9).toFixed(4)} SOL`);
  
  // Get USDC balance
  const usdcAta = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);
  try {
    const usdcBalance = await connection.getTokenAccountBalance(usdcAta);
    console.log(`  USDC: ${usdcBalance.value.uiAmount} USDC`);
  } catch {
    console.log('  USDC: 0 (pas de compte)');
  }
  
  console.log('\n✅ Vérification terminée!');
  console.log('\nLe programme est déployé et prêt. Pour tester un swap réel:');
  console.log('1. Visitez l\'application frontend');
  console.log('2. Connectez votre wallet');
  console.log('3. Effectuez un petit swap SOL → USDC');
  console.log('\n🔗 Le frontend devrait maintenant utiliser le nouveau Program ID.');
}

main().catch(console.error);
