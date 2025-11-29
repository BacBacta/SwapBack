#!/usr/bin/env node

/**
 * Test de l'affichage du solde BACK avec Token-2022
 */

const { Connection, PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID } = require('@solana/spl-token');

const RPC_URL = 'https://api.devnet.solana.com';
const BACK_MINT = new PublicKey('862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux');
const WALLET = new PublicKey('3PiZ1xdHbPbj1UaPS8pfzKnHpmQQLfR8zrhy5RcksqAt');

async function testBalance() {
  console.log('🧪 TEST: Affichage du solde BACK dans l\'interface\n');
  
  const connection = new Connection(RPC_URL, 'confirmed');
  
  console.log('📋 Configuration:');
  console.log(`   Wallet : ${WALLET.toBase58()}`);
  console.log(`   Token  : ${BACK_MINT.toBase58()}`);
  console.log(`   RPC    : ${RPC_URL}`);
  console.log('');
  
  // Méthode CORRECTE (avec Token-2022)
  console.log('✅ Méthode CORRECTE (Token-2022):');
  try {
    const ataToken2022 = await getAssociatedTokenAddress(
      BACK_MINT,
      WALLET,
      false,
      TOKEN_2022_PROGRAM_ID
    );
    console.log(`   ATA: ${ataToken2022.toBase58()}`);
    
    const balance = await connection.getTokenAccountBalance(ataToken2022);
    console.log(`   Solde: ${balance.value.uiAmount} BACK ✅`);
  } catch (error) {
    console.error(`   ❌ Erreur: ${error.message}`);
  }
  
  console.log('');
  
  // Méthode INCORRECTE (sans Token-2022) - pour comparaison
  console.log('❌ Méthode INCORRECTE (SPL Token standard):');
  try {
    const ataStandard = await getAssociatedTokenAddress(
      BACK_MINT,
      WALLET
      // Pas de TOKEN_2022_PROGRAM_ID
    );
    console.log(`   ATA: ${ataStandard.toBase58()}`);
    
    const balance = await connection.getTokenAccountBalance(ataStandard);
    console.log(`   Solde: ${balance.value.uiAmount} BACK`);
  } catch (error) {
    console.error(`   ❌ Erreur (attendue): ${error.message}`);
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Le composant LockInterface a été corrigé pour utiliser Token-2022');
  console.log('📱 Rafraîchissez l\'application et reconnectez votre wallet');
  console.log('💰 Vous devriez voir: 500,000 BACK disponibles pour le Lock');
  console.log('🔄 Suffisant pour tester le DCA également');
}

testBalance();
