/**
 * Initialize RouterState for the new Router program on mainnet
 * Using raw transaction building (no IDL dependency)
 * 
 * Program ID: Z3xgiiYwo1eKECcwmNvwiCwKCLJibCPBVXKhzKXyLhx
 */

const { 
  Connection, 
  PublicKey, 
  Keypair, 
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction
} = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// New Router Program ID (deployed Dec 8, 2025)
const ROUTER_PROGRAM_ID = new PublicKey('FuzLkp1G7v39XXxobvr5pnGk7xZucBUroa215LrCjsAg');

// RouterState size from state/router_state.rs
const ROUTER_STATE_SIZE = 278; // 8 + 32 + 33 + 1 + 8 + 10 + 128 + 56 + 1 + 1

// Calculate Anchor discriminator for "initialize" instruction
function getInstructionDiscriminator(instructionName) {
  const preimage = `global:${instructionName}`;
  const hash = crypto.createHash('sha256').update(preimage).digest();
  return hash.slice(0, 8);
}

async function initializeRouterState() {
  console.log('=== INITIALIZE ROUTER STATE (Raw TX) ===');
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
    return { pda: routerStatePda, bump };
  }
  
  console.log('');
  console.log('RouterState does not exist, initializing...');
  
  // Build initialize instruction
  // Anchor instruction format: 8-byte discriminator + instruction data
  const discriminator = getInstructionDiscriminator('initialize');
  console.log('Discriminator:', discriminator.toString('hex'));
  
  // Account metas for initialize:
  // 1. state (PDA, writable, not signer) - will be init
  // 2. authority (signer, writable) - pays for account
  // 3. system_program (readonly)
  const keys = [
    { pubkey: routerStatePda, isSigner: false, isWritable: true },
    { pubkey: authority.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  
  const initInstruction = new TransactionInstruction({
    keys,
    programId: ROUTER_PROGRAM_ID,
    data: discriminator,
  });
  
  // Create and send transaction
  const transaction = new Transaction().add(initInstruction);
  
  console.log('Sending initialize transaction...');
  
  try {
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [authority],
      { commitment: 'confirmed' }
    );
    
    console.log('');
    console.log('✅ RouterState initialized!');
    console.log('Transaction:', signature);
    console.log('Explorer: https://explorer.solana.com/tx/' + signature);
    
    // Verify
    const newAccount = await connection.getAccountInfo(routerStatePda);
    if (newAccount) {
      console.log('');
      console.log('Verified:');
      console.log('  Size:', newAccount.data.length, 'bytes');
      console.log('  Owner:', newAccount.owner.toString());
    }
    
    return { pda: routerStatePda, bump, signature };
    
  } catch (error) {
    console.error('');
    console.error('Error initializing RouterState:', error.message);
    if (error.logs) {
      console.error('Logs:', error.logs);
    }
    throw error;
  }
}

initializeRouterState()
  .then(result => {
    if (result) {
      console.log('');
      console.log('=== SUMMARY ===');
      console.log('RouterState PDA:', result.pda.toString());
      console.log('Bump:', result.bump);
    }
  })
  .catch(console.error);
