#!/usr/bin/env ts-node

import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const DEVNET_RPC = 'https://api.devnet.solana.com';
const BUYBACK_PROGRAM_ID = new PublicKey('92znK8METYTFW5dGDJUnHUMqubVGnPBTyjZ4HzjWQzir');

// PDA buyback state
const [buybackStatePDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('buyback_state')],
  BUYBACK_PROGRAM_ID
);

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                      ║');
  console.log('║         🔧 MISE À JOUR DES PARAMÈTRES BUYBACK - DEVNET              ║');
  console.log('║                                                                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  // Connexion
  const connection = new Connection(DEVNET_RPC, 'confirmed');

  // Charger le wallet
  const walletPath = path.join(require('os').homedir(), '.config/solana/id.json');
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const payer = Keypair.fromSecretKey(new Uint8Array(walletData));

  console.log('📡 Configuration:');
  console.log(`   RPC: ${DEVNET_RPC}`);
  console.log(`   Wallet: ${payer.publicKey.toBase58()}`);
  console.log(`   Programme: ${BUYBACK_PROGRAM_ID.toBase58()}`);
  console.log(`   Buyback State: ${buybackStatePDA.toBase58()}\n`);

  // Charger l'IDL
  const idlPath = '/workspaces/SwapBack/target/idl/swapback_buyback.json';
  if (!fs.existsSync(idlPath)) {
    console.error('❌ IDL non trouvé. Exécutez d\'abord: anchor build');
    process.exit(1);
  }

  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

  // Créer le provider et le program
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(payer),
    { commitment: 'confirmed' }
  );
  anchor.setProvider(provider);

  const program = new Program(idl, provider);

  // Lire l'état actuel
  console.log('📊 État actuel du buyback:');
  try {
    const buybackStateAccount: any = await connection.getAccountInfo(buybackStatePDA);
    
    if (!buybackStateAccount) {
      console.error('❌ Erreur: Compte buyback state non trouvé');
      process.exit(1);
    }

    // Parser manuellement les données
    // Structure: discriminator(8) + authority(32) + back_mint(32) + usdc_vault(32) + 
    //            min_buyback_amount(8) + total_usdc_spent(8) + total_back_burned(8) + 
    //            buyback_count(8) + bump(1)
    const data = buybackStateAccount.data;
    const authority = new PublicKey(data.slice(8, 40));  // bytes 8-40
    const backMint = new PublicKey(data.slice(40, 72));  // bytes 40-72
    const usdcVault = new PublicKey(data.slice(72, 104));  // bytes 72-104
    const minBuybackAmount = new anchor.BN(data.slice(104, 112), 'le');  // bytes 104-112
    const totalUsdcSpent = new anchor.BN(data.slice(112, 120), 'le');  // bytes 112-120
    const totalBackBurned = new anchor.BN(data.slice(120, 128), 'le');  // bytes 120-128
    const buybackCount = new anchor.BN(data.slice(128, 136), 'le');  // bytes 128-136
    
    console.log(`   Authority: ${authority.toBase58()}`);
    console.log(`   BACK Mint: ${backMint.toBase58()}`);
    console.log(`   USDC Vault: ${usdcVault.toBase58()}`);
    console.log(`   Min Buyback Amount: ${minBuybackAmount.toNumber() / 1e6} USDC`);
    console.log(`   Total USDC Spent: ${totalUsdcSpent.toNumber() / 1e6} USDC`);
    console.log(`   Total $BACK Burned: ${totalBackBurned.toNumber() / 1e9} BACK`);
    console.log(`   Buyback Count: ${buybackCount.toNumber()}\n`);

    // Vérifier l'autorité
    if (authority.toBase58() !== payer.publicKey.toBase58()) {
      console.error('❌ Erreur: Vous n\'êtes pas l\'autorité de ce programme');
      console.error(`   Autorité requise: ${authority.toBase58()}`);
      console.error(`   Votre clé: ${payer.publicKey.toBase58()}`);
      process.exit(1);
    }

    // Nouveau montant minimum: 100 USDC
    const newMinBuyback = new anchor.BN(100_000_000); // 100 USDC (6 decimals)

    console.log('🔧 Mise à jour des paramètres:');
    console.log(`   Ancien min_buyback_amount: ${minBuybackAmount.toNumber() / 1e6} USDC`);
    console.log(`   Nouveau min_buyback_amount: ${newMinBuyback.toNumber() / 1e6} USDC\n`);

    // Exécuter la mise à jour
    console.log('⏳ Envoi de la transaction...');
    const tx = await (program.methods as any)
      .updateParams(newMinBuyback)
      .accounts({
        buybackState: buybackStatePDA,
        authority: payer.publicKey,
      })
      .rpc();

    console.log(`✅ Transaction confirmée: ${tx}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);

    // Vérifier la mise à jour
    console.log('🔍 Vérification de la mise à jour...');
    const updatedAccount: any = await connection.getAccountInfo(buybackStatePDA);
    const updatedData = updatedAccount.data;
    const updatedMinBuyback = new anchor.BN(updatedData.slice(104, 112), 'le');
    console.log(`   ✓ Min Buyback Amount mis à jour: ${updatedMinBuyback.toNumber() / 1e6} USDC\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 MISE À JOUR RÉUSSIE!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    if (error.logs) {
      console.error('\nLogs:');
      error.logs.forEach((log: string) => console.error(`   ${log}`));
    }
    process.exit(1);
  }
}

main().catch(console.error);
