#!/usr/bin/env node

/**
 * Test rapide pour vérifier le solde BACK du wallet
 */

const { Connection, PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID } = require('@solana/spl-token');

const RPC_URL = 'https://api.devnet.solana.com';
const BACK_MINT = new PublicKey('862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux');
const WALLET = new PublicKey('3PiZ1xdHbPbj1UaPS8pfzKnHpmQQLfR8zrhy5RcksqAt');

async function checkBalance() {
  console.log('🔍 Vérification du solde BACK...\n');
  
  const connection = new Connection(RPC_URL, 'confirmed');
  
  // Obtenir l'ATA
  const ata = await getAssociatedTokenAddress(
    BACK_MINT,
    WALLET,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  
  console.log(`Wallet  : ${WALLET.toBase58()}`);
  console.log(`Token   : ${BACK_MINT.toBase58()}`);
  console.log(`ATA     : ${ata.toBase58()}`);
  
  // Vérifier le solde
  try {
    const balance = await connection.getTokenAccountBalance(ata);
    console.log(`\n✅ Solde : ${balance.value.uiAmount} BACK`);
    console.log(`\n📊 L'interface Lock devrait afficher ce montant quand vous connectez votre wallet.`);
  } catch (error) {
    console.error(`\n❌ Erreur : ${error.message}`);
  }
}

checkBalance();
