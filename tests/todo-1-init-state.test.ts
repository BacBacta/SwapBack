/**
 * Test d'initialisation du State PDA - TODO #1
 */

import { describe, it, expect } from 'vitest';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import fs from 'fs';
import path from 'path';

const ROUTER_PROGRAM_ID = new PublicKey('3Z295H9QHByYn9sHm3tH7ASHitwd2Y4AEaXUddfhQKap');
const RPC_URL = 'https://api.devnet.solana.com';

const RUN_ANCHOR_TESTS = process.env.SWAPBACK_RUN_ANCHOR_TESTS === 'true';
const describeAnchor = RUN_ANCHOR_TESTS ? describe : describe.skip;

if (!RUN_ANCHOR_TESTS) {
  console.warn('⏭️  Skip TODO #1 - Initialize State PDA (set SWAPBACK_RUN_ANCHOR_TESTS=true to enable).');
}

describeAnchor('TODO #1 - Initialize State PDA', () => {
  it('should initialize Router State PDA on devnet', async () => {
    console.log('\n🔧 TODO #1: Initializing Router State PDA...\n');

    const connection = new Connection(RPC_URL, 'confirmed');

    // Charger le wallet
    const walletPath = path.join(process.env.HOME || '', '.config/solana/id.json');
    const walletKeypair = Keypair.fromSecretKey(
      Buffer.from(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
    );

    console.log('✅ Wallet:', walletKeypair.publicKey.toBase58());

    // Dériver State PDA
    const [statePda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from('router_state')],
      ROUTER_PROGRAM_ID
    );

    console.log('✅ State PDA:', statePda.toBase58());
    console.log('✅ Bump:', bump);

    // Vérifier si déjà initialisé
    let accountInfo = await connection.getAccountInfo(statePda);

    if (accountInfo) {
      console.log('\n✅ State PDA already initialized!');
      expect(accountInfo).not.toBeNull();
      return;
    }

    console.log('\n🔨 Initializing State PDA...');

    // Charger IDL
    const idlPath = path.join(__dirname, '../target/idl/swapback_router.json');
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

    // Setup Anchor
    const wallet = new anchor.Wallet(walletKeypair);
    const provider = new anchor.AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });

    const program = new anchor.Program(idl as anchor.Idl, provider);

    // Appeler initialize
    const tx = await program.methods
      .initialize()
      .accounts({
        state: statePda,
        authority: walletKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log('✅ Transaction:', tx);

    // Attendre confirmation
    await connection.confirmTransaction(tx, 'confirmed');

    // Vérifier
    accountInfo = await connection.getAccountInfo(statePda);
    expect(accountInfo).not.toBeNull();

    console.log('\n🎉 State PDA initialized successfully!');
    console.log(`   Explorer: https://explorer.solana.com/address/${statePda.toBase58()}?cluster=devnet\n`);
  }, 60000);
});
