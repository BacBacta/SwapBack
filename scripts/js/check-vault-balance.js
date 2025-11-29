#!/usr/bin/env node

/**
 * Script pour vérifier le solde du vault token account
 */

const { Connection, PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID } = require('@solana/spl-token');

const CNFT_PROGRAM_ID = new PublicKey('9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq');
const BACK_MINT = new PublicKey('862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux');
const USER_WALLET = new PublicKey('ARFN6HfLS6VUYdKy7gtuBjuW1JjqCkjqrJkMyvvZpAm5'); // Votre wallet

async function checkVaultBalance() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  console.log('🔍 Checking vault token account balance...\n');

  // Dériver vault_authority PDA
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_authority')],
    CNFT_PROGRAM_ID
  );
  console.log('📍 Vault Authority PDA:', vaultAuthority.toString());

  // Obtenir l'adresse du vault token account
  const vaultTokenAccount = await getAssociatedTokenAddress(
    BACK_MINT,
    vaultAuthority,
    true, // allowOwnerOffCurve pour PDA
    TOKEN_2022_PROGRAM_ID
  );
  console.log('📍 Vault Token Account:', vaultTokenAccount.toString());

  // Obtenir l'adresse du user token account
  const userTokenAccount = await getAssociatedTokenAddress(
    BACK_MINT,
    USER_WALLET,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  console.log('📍 User Token Account:', userTokenAccount.toString());

  try {
    // Vérifier si le vault token account existe
    const vaultAccountInfo = await connection.getAccountInfo(vaultTokenAccount);
    
    if (!vaultAccountInfo) {
      console.log('\n❌ VAULT TOKEN ACCOUNT DOES NOT EXIST!');
      console.log('   This means tokens were never transferred to the vault during lock.');
      return;
    }

    console.log('\n✅ Vault token account exists');

    // Obtenir le solde du vault
    const vaultBalance = await connection.getTokenAccountBalance(vaultTokenAccount);
    console.log('\n💰 VAULT BALANCE:');
    console.log('   Raw amount:', vaultBalance.value.amount);
    console.log('   UI amount:', vaultBalance.value.uiAmount, 'BACK');
    console.log('   Decimals:', vaultBalance.value.decimals);

    // Obtenir le solde user
    const userBalance = await connection.getTokenAccountBalance(userTokenAccount);
    console.log('\n👤 USER BALANCE:');
    console.log('   Raw amount:', userBalance.value.amount);
    console.log('   UI amount:', userBalance.value.uiAmount, 'BACK');

    // Vérifier le user_nft PDA
    const [userNft] = PublicKey.findProgramAddressSync(
      [Buffer.from('user_nft'), USER_WALLET.toBuffer()],
      CNFT_PROGRAM_ID
    );
    console.log('\n📍 User NFT PDA:', userNft.toString());

    const userNftInfo = await connection.getAccountInfo(userNft);
    if (!userNftInfo) {
      console.log('❌ User NFT account does not exist!');
    } else {
      console.log('✅ User NFT account exists');
      console.log('   Data length:', userNftInfo.data.length, 'bytes');
      
      // Essayer de décoder (simplifié)
      if (userNftInfo.data.length >= 16) {
        const amountLocked = userNftInfo.data.readBigUInt64LE(8);
        console.log('   Amount locked (from NFT):', amountLocked.toString());
        console.log('   Amount locked (UI):', Number(amountLocked) / 1_000_000_000, 'BACK');
      }
    }

  } catch (error) {
    console.error('\n❌ Error checking balances:', error.message);
  }
}

checkVaultBalance().catch(console.error);
