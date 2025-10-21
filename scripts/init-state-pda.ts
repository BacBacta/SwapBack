/**
 * 🔧 Script d'initialisation du Router State PDA sur Devnet
 * 
 * Ce script initialise le compte State du Router Program
 * qui est requis pour toutes les opérations on-chain.
 */

import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider, web3 } from '@coral-xyz/anchor';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

const ROUTER_PROGRAM_ID = new PublicKey('3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap');
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

async function main() {
  console.log('\n🔧 Initializing Router State PDA on Devnet...\n');

  // 1. Setup connection et wallet
  const connection = new Connection(RPC_URL, 'confirmed');
  
  // Charger le wallet depuis le fichier système
  const walletPath = path.join(process.env.HOME || '', '.config/solana/id.json');
  const walletKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
  );
  
  console.log('✅ Wallet loaded:', walletKeypair.publicKey.toBase58());
  console.log('✅ RPC URL:', RPC_URL);
  console.log('✅ Router Program ID:', ROUTER_PROGRAM_ID.toBase58());

  // Vérifier le solde
  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log(`✅ Wallet balance: ${balance / web3.LAMPORTS_PER_SOL} SOL\n`);

  if (balance < 0.01 * web3.LAMPORTS_PER_SOL) {
    console.error('❌ Insufficient balance. Need at least 0.01 SOL');
    process.exit(1);
  }

  // 2. Dériver le State PDA
  const [statePda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('router_state')],
    ROUTER_PROGRAM_ID
  );

  console.log('📍 State PDA:', statePda.toBase58());
  console.log('📍 Bump:', bump);

  // 3. Vérifier si déjà initialisé
  const accountInfo = await connection.getAccountInfo(statePda);
  
  if (accountInfo) {
    console.log('\n⚠️  State PDA already initialized!');
    console.log('   Owner:', accountInfo.owner.toBase58());
    console.log('   Data length:', accountInfo.data.length);
    console.log('\n✅ Nothing to do.');
    return;
  }

  console.log('\n🔨 Creating State PDA initialization transaction...\n');

  // 4. Charger l'IDL du programme
  const idlPath = path.join(__dirname, '../target/idl/swapback_router.json');
  
  if (!fs.existsSync(idlPath)) {
    console.error('❌ IDL not found at:', idlPath);
    console.log('   Run: anchor build');
    process.exit(1);
  }

  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

  // 5. Setup provider et programme
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  
  const program = new Program(idl, ROUTER_PROGRAM_ID, provider);

  // 6. Appeler l'instruction initialize
  try {
    const tx = await program.methods
      .initialize()
      .accounts({
        state: statePda,
        authority: walletKeypair.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    console.log('✅ Transaction sent:', tx);
    console.log('⏳ Confirming...');

    // Attendre confirmation
    await connection.confirmTransaction(tx, 'confirmed');

    console.log('\n🎉 State PDA initialized successfully!\n');
    console.log('📍 State PDA:', statePda.toBase58());
    console.log('📍 Authority:', walletKeypair.publicKey.toBase58());
    console.log('📍 Transaction:', tx);
    console.log(`📍 Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);

    // Vérifier le compte créé
    const newAccountInfo = await connection.getAccountInfo(statePda);
    if (newAccountInfo) {
      console.log('✅ Account verified:');
      console.log('   Owner:', newAccountInfo.owner.toBase58());
      console.log('   Data length:', newAccountInfo.data.length);
      console.log('   Lamports:', newAccountInfo.lamports);
    }

  } catch (error) {
    console.error('\n❌ Failed to initialize State PDA:', error);
    
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      
      // Afficher les logs si disponibles
      if ('logs' in error) {
        console.error('\n📋 Program Logs:');
        (error as any).logs?.forEach((log: string) => console.error('   ', log));
      }
    }
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
