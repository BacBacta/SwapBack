#!/usr/bin/env node

/**
 * Initialize Router State for DCA functionality
 * 
 * This script must be run by the program authority wallet.
 * It initializes the global Router State PDA which is required
 * before any DCA plans can be created.
 * 
 * Usage:
 *   node scripts/init-router-state-simple.js
 * 
 * Environment:
 *   - Requires authority wallet keypair (default: ~/.config/solana/id.json)
 *   - Connects to devnet by default
 */

const { Connection, PublicKey, Keypair, SystemProgram } = require('@solana/web3.js');
const { AnchorProvider, Program, Wallet } = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

// Configuration
const ROUTER_PROGRAM_ID = 'BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz';
const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.devnet.solana.com';
const WALLET_PATH = process.env.WALLET_PATH || path.join(
  require('os').homedir(),
  '.config/solana/id.json'
);

async function main() {
  console.log('🚀 Initializing Router State for DCA...\n');
  
  // 1. Load wallet
  console.log('📝 Loading wallet from:', WALLET_PATH);
  if (!fs.existsSync(WALLET_PATH)) {
    console.error('❌ Wallet file not found:', WALLET_PATH);
    console.error('   Set WALLET_PATH environment variable to your authority keypair');
    process.exit(1);
  }
  
  const walletData = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf-8'));
  const wallet = Keypair.fromSecretKey(new Uint8Array(walletData));
  console.log('✅ Wallet loaded:', wallet.publicKey.toBase58());
  
  // 2. Connect to Solana
  console.log('\n📡 Connecting to:', RPC_ENDPOINT);
  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  
  // Check balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log('💰 Balance:', (balance / 1e9).toFixed(4), 'SOL');
  
  if (balance < 0.01 * 1e9) {
    console.error('❌ Insufficient balance. Need at least 0.01 SOL');
    process.exit(1);
  }
  
  // 3. Load Router program IDL
  console.log('\n📄 Loading Router IDL...');
  const idlPath = path.join(__dirname, '../target/idl/swapback_router.json');
  if (!fs.existsSync(idlPath)) {
    console.error('❌ IDL not found:', idlPath);
    console.error('   Run: anchor build');
    process.exit(1);
  }
  
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
  console.log('✅ IDL loaded:', idl.name);
  
  // 4. Create Anchor provider and program
  const provider = new AnchorProvider(
    connection,
    new Wallet(wallet),
    { commitment: 'confirmed' }
  );
  
  const programId = new PublicKey(ROUTER_PROGRAM_ID);
  const program = new Program(idl, programId, provider);
  console.log('✅ Program:', programId.toBase58());
  
  // 5. Derive Router State PDA
  const [statePda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('router_state')],
    programId
  );
  console.log('\n🔑 Router State PDA:', statePda.toBase58());
  console.log('   Bump:', bump);
  
  // 6. Check if already initialized
  const stateAccount = await connection.getAccountInfo(statePda);
  if (stateAccount) {
    console.log('\n✅ Router State is already initialized!');
    console.log('   Size:', stateAccount.data.length, 'bytes');
    console.log('   Owner:', stateAccount.owner.toBase58());
    
    // Try to decode state
    try {
      const state = await program.account.routerState.fetch(statePda);
      console.log('\n📊 Router State Data:');
      console.log('   Authority:', state.authority.toBase58());
      console.log('   Rebate %:', state.rebatePercentage / 100, '%');
      console.log('   Buyback %:', state.buybackPercentage / 100, '%');
      console.log('   Protocol %:', state.protocolPercentage / 100, '%');
      console.log('   Total Volume:', state.totalVolume.toString());
      console.log('   Total NPI:', state.totalNpi.toString());
    } catch (decodeError) {
      console.warn('⚠️  Could not decode state data:', decodeError.message);
    }
    
    console.log('\n✨ No action needed. Router State is ready for DCA!');
    return;
  }
  
  // 7. Initialize Router State
  console.log('\n🔄 Initializing Router State...');
  console.log('   Authority:', wallet.publicKey.toBase58());
  
  try {
    const tx = await program.methods
      .initialize()
      .accounts({
        state: statePda,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log('\n✅ Router State initialized!');
    console.log('   Transaction:', tx);
    console.log('   Explorer:', `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
    
    // Wait for confirmation
    await connection.confirmTransaction(tx, 'confirmed');
    
    // Verify
    const verifyAccount = await connection.getAccountInfo(statePda);
    if (verifyAccount) {
      console.log('\n✅ Verification successful!');
      console.log('   State account size:', verifyAccount.data.length, 'bytes');
      
      // Decode and show state
      const state = await program.account.routerState.fetch(statePda);
      console.log('\n📊 Initialized Router State:');
      console.log('   Authority:', state.authority.toBase58());
      console.log('   Rebate %:', state.rebatePercentage / 100, '%');
      console.log('   Buyback %:', state.buybackPercentage / 100, '%');
      console.log('   Protocol %:', state.protocolPercentage / 100, '%');
      
      console.log('\n✨ DCA functionality is now ready to use!');
    }
    
  } catch (error) {
    console.error('\n❌ Failed to initialize Router State:', error.message);
    if (error.logs) {
      console.error('\n📋 Transaction logs:');
      error.logs.forEach(log => console.error('   ', log));
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
