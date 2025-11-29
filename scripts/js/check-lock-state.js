#!/usr/bin/env node

/**
 * Script de test pour vérifier l'état du programme lock tokens
 */

const { Connection, PublicKey } = require('@solana/web3.js');
const { Program, AnchorProvider, Wallet } = require('@coral-xyz/anchor');
const { Keypair } = require('@solana/web3.js');

const CNFT_PROGRAM_ID = new PublicKey('AaN2BwpGWbvDo7NHfpyC6zGYxsbg2xtcikToW9xYy4Xq');
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com';

async function checkProgramState() {
  console.log('🔍 Vérification de l\'état du programme Lock Tokens...\n');
  
  const connection = new Connection(RPC_URL, 'confirmed');
  
  // Vérifier que le programme existe
  console.log('📍 Program ID:', CNFT_PROGRAM_ID.toString());
  
  try {
    const accountInfo = await connection.getAccountInfo(CNFT_PROGRAM_ID);
    
    if (!accountInfo) {
      console.error('❌ Programme non trouvé sur le réseau!');
      console.log('   Le programme doit être déployé d\'abord.');
      process.exit(1);
    }
    
    console.log('✅ Programme trouvé sur le réseau');
    console.log('   Executable:', accountInfo.executable);
    console.log('   Owner:', accountInfo.owner.toString());
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification du programme:', error.message);
    process.exit(1);
  }
  
  // Vérifier les PDAs
  console.log('🔍 Vérification des PDAs...\n');
  
  const [collectionConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('collection_config')],
    CNFT_PROGRAM_ID
  );
  console.log('📍 Collection Config PDA:', collectionConfig.toString());
  
  try {
    const configAccount = await connection.getAccountInfo(collectionConfig);
    if (configAccount) {
      console.log('✅ Collection Config initialisé');
      console.log('   Data size:', configAccount.data.length);
    } else {
      console.log('⚠️  Collection Config PAS initialisé');
      console.log('   → Vous devez d\'abord exécuter: anchor run init-collection');
    }
  } catch (error) {
    console.log('❌ Erreur:', error.message);
  }
  
  console.log('\n');
  
  const [globalState] = PublicKey.findProgramAddressSync(
    [Buffer.from('global_state')],
    CNFT_PROGRAM_ID
  );
  console.log('📍 Global State PDA:', globalState.toString());
  
  try {
    const stateAccount = await connection.getAccountInfo(globalState);
    if (stateAccount) {
      console.log('✅ Global State initialisé');
      console.log('   Data size:', stateAccount.data.length);
    } else {
      console.log('⚠️  Global State PAS initialisé');
      console.log('   → Vous devez d\'abord exécuter: anchor run init-state');
    }
  } catch (error) {
    console.log('❌ Erreur:', error.message);
  }
  
  console.log('\n');
  
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_authority')],
    CNFT_PROGRAM_ID
  );
  console.log('📍 Vault Authority PDA:', vaultAuthority.toString());
  
  try {
    const vaultAccount = await connection.getAccountInfo(vaultAuthority);
    if (vaultAccount) {
      console.log('✅ Vault Authority existe');
      console.log('   Data size:', vaultAccount.data.length);
    } else {
      console.log('ℹ️  Vault Authority (PDA - pas besoin d\'initialisation)');
    }
  } catch (error) {
    console.log('❌ Erreur:', error.message);
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RÉSUMÉ\n');
  console.log('Pour que le lock fonctionne, vous devez:');
  console.log('1. ✅ Avoir le programme déployé');
  console.log('2. ✅ Avoir CollectionConfig initialisé');
  console.log('3. ✅ Avoir GlobalState initialisé');
  console.log('4. ✅ Avoir des tokens BACK dans votre wallet');
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

checkProgramState().catch(console.error);
