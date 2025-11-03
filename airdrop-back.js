#!/usr/bin/env node

/**
 * Script pour airdrop des tokens BACK à un wallet sur devnet
 * Usage: node airdrop-back.js <WALLET_ADDRESS> <AMOUNT>
 */

const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, mintTo, TOKEN_2022_PROGRAM_ID } = require('@solana/spl-token');
const bs58 = require('bs58');
const fs = require('fs');

const RPC_URL = 'https://api.devnet.solana.com';
const BACK_MINT = new PublicKey('862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux');
const TOKEN_PROGRAM = TOKEN_2022_PROGRAM_ID; // Token-2022 (TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb)

async function main() {
  const walletAddress = process.argv[2] || '3PiZ1xdHbPbj1UaPS8pfzKnHpmQQLfR8zrhy5RcksqAt';
  const amount = parseFloat(process.argv[3] || '100000');

  console.log('🚀 Airdrop de tokens BACK sur devnet');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📍 Wallet destination : ${walletAddress}`);
  console.log(`💰 Montant           : ${amount} BACK`);
  console.log(`🪙 Token BACK        : ${BACK_MINT.toBase58()}`);
  console.log('');

  // Connexion au devnet
  const connection = new Connection(RPC_URL, 'confirmed');

  // Charger le keypair de la mint authority
  let mintAuthority;
  try {
    // Essayer de charger depuis le base58
    const base58Key = fs.readFileSync('/workspaces/SwapBack/devnet-keypair-base58.txt', 'utf8').trim();
    const secretKey = bs58.decode(base58Key);
    mintAuthority = Keypair.fromSecretKey(secretKey);
    console.log(`✅ Mint Authority    : ${mintAuthority.publicKey.toBase58()}`);
  } catch (error) {
    console.error('❌ Erreur lors du chargement du keypair:', error.message);
    process.exit(1);
  }

  // Vérifier que c'est la bonne autorité
  const expectedAuthority = '578DGN45PsuxySc4T5VsZKeJu2Q83L5coCWR47ZJkwQf';
  if (mintAuthority.publicKey.toBase58() !== expectedAuthority) {
    console.error('❌ ERREUR: L\'autorité ne correspond pas!');
    console.error(`   Attendu : ${expectedAuthority}`);
    console.error(`   Obtenu  : ${mintAuthority.publicKey.toBase58()}`);
    process.exit(1);
  }

  const recipient = new PublicKey(walletAddress);

  // Obtenir l'ATA du destinataire
  console.log('\n📦 Obtention de l\'Associated Token Account...');
  const recipientAta = await getAssociatedTokenAddress(
    BACK_MINT,
    recipient,
    false, // allowOwnerOffCurve
    TOKEN_PROGRAM // Token-2022
  );
  console.log(`   ATA: ${recipientAta.toBase58()}`);

  // Vérifier si l'ATA existe
  const ataInfo = await connection.getAccountInfo(recipientAta);
  if (!ataInfo) {
    console.log('   ⚠️  ATA n\'existe pas, création en cours...');
    
    // Créer l'ATA
    const { Transaction } = require('@solana/web3.js');
    const tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        mintAuthority.publicKey,
        recipientAta,
        recipient,
        BACK_MINT,
        TOKEN_PROGRAM // Token-2022
      )
    );

    const signature = await connection.sendTransaction(tx, [mintAuthority]);
    await connection.confirmTransaction(signature);
    console.log(`   ✅ ATA créé: ${signature}`);
  } else {
    console.log('   ✅ ATA existe déjà');
  }

  // Mint les tokens
  console.log(`\n💎 Mint de ${amount} tokens BACK...`);
  const mintAmount = BigInt(Math.floor(amount * 1e9)); // 9 decimals

  try {
    const signature = await mintTo(
      connection,
      mintAuthority,
      BACK_MINT,
      recipientAta,
      mintAuthority,
      mintAmount,
      [],
      undefined,
      TOKEN_PROGRAM // Token-2022
    );

    console.log(`✅ Transaction confirmée: ${signature}`);
  } catch (error) {
    console.error('❌ Erreur lors du mint:', error.message);
    process.exit(1);
  }

  // Vérifier le solde final
  console.log('\n📊 Vérification du nouveau solde...');
  const balance = await connection.getTokenAccountBalance(recipientAta);
  console.log(`✅ Nouveau solde: ${balance.value.uiAmount} BACK`);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Airdrop terminé avec succès!');
  console.log('🔗 Vérifiez sur Solana Explorer:');
  console.log(`   https://explorer.solana.com/address/${walletAddress}?cluster=devnet`);
}

main().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
