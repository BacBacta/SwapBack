/**
 * Initialize RouterState for the new Router program on mainnet
 * Program ID: Z3xgiiYwo1eKECcwmNvwiCwKCLJibCPBVXKhzKXyLhx
 */

const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair, SystemProgram } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// New Router Program ID (deployed Dec 8, 2025)
const ROUTER_PROGRAM_ID = new PublicKey('Z3xgiiYwo1eKECcwmNvwiCwKCLJibCPBVXKhzKXyLhx');

async function initializeRouterState() {
  console.log('=== INITIALIZE ROUTER STATE ===');
  console.log('Program ID:', ROUTER_PROGRAM_ID.toString());
  console.log('');
  
  // Load keypair
  const keypairPath = path.join(__dirname, '..', 'mainnet-deploy-keypair.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const authority = Keypair.fromSecretKey(new Uint8Array(keypairData));
  console.log('Authority:', authority.publicKey.toString());
  
  // Connect to mainnet
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  const balance = await connection.getBalance(authority.publicKey);
  console.log('Balance:', balance / 1e9, 'SOL');
  
  // Calculate RouterState PDA
  const [routerStatePda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('router_state')],
    ROUTER_PROGRAM_ID
  );
  console.log('');
  console.log('RouterState PDA:', routerStatePda.toString());
  console.log('Bump:', bump);
  
  // Check if already initialized
  const existingAccount = await connection.getAccountInfo(routerStatePda);
  if (existingAccount) {
    console.log('');
    console.log('⚠️  RouterState already exists!');
    console.log('Owner:', existingAccount.owner.toString());
    console.log('Size:', existingAccount.data.length, 'bytes');
    return;
  }
  
  console.log('');
  console.log('RouterState does not exist, initializing...');
  
  // Load IDL
  const idlPath = path.join(__dirname, '..', 'target', 'idl', 'swapback_router.json');
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
  
  // Create provider
  const wallet = new anchor.Wallet(authority);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });
  
  // Create program
  const program = new anchor.Program(idl, ROUTER_PROGRAM_ID, provider);
  
  console.log('');
  console.log('Sending initialize transaction...');
  
  try {
    const tx = await program.methods
      .initialize()
      .accounts({
        state: routerStatePda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();
    
    console.log('');
    console.log('✅ RouterState initialized!');
    console.log('Transaction:', tx);
    console.log('');
    console.log('RouterState PDA:', routerStatePda.toString());
    
    // Verify
    const newAccount = await connection.getAccountInfo(routerStatePda);
    if (newAccount) {
      console.log('Verified - Size:', newAccount.data.length, 'bytes');
      console.log('Owner:', newAccount.owner.toString());
    }
    
  } catch (error) {
    console.error('Error initializing RouterState:', error);
    throw error;
  }
}

initializeRouterState().catch(console.error);
