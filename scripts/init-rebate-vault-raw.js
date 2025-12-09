/**
 * Initialize Rebate Vault for SwapBack Router - Raw Instruction
 */

const { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  TransactionInstruction,
  SystemProgram, 
  SYSVAR_RENT_PUBKEY,
  sendAndConfirmTransaction
} = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

const PROGRAM_ID = new PublicKey('APHj6L2b2bA2q62jwYZp38dqbTxQUqwatqdUum1trPnN');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

const crypto = require('crypto');
function getDiscriminator(name) {
  const hash = crypto.createHash('sha256').update(`global:${name}`).digest();
  return hash.slice(0, 8);
}

async function main() {
  console.log('='.repeat(60));
  console.log('Initialize Rebate Vault (Raw)');
  console.log('='.repeat(60));
  
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  
  // Use the correct keypair path
  const keypairPath = path.join(process.cwd(), 'mainnet-deploy-keypair.json');
  console.log(`Loading keypair from: ${keypairPath}`);
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  console.log(`\nWallet: ${wallet.publicKey.toBase58()}`);
  
  // Derive PDAs
  const [routerState] = PublicKey.findProgramAddressSync(
    [Buffer.from('router_state')],
    PROGRAM_ID
  );
  console.log(`RouterState PDA: ${routerState.toBase58()}`);
  
  const [rebateVault, vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('rebate_vault'), routerState.toBuffer()],
    PROGRAM_ID
  );
  console.log(`RebateVault PDA: ${rebateVault.toBase58()}`);
  
  // Check if already exists
  const vaultInfo = await connection.getAccountInfo(rebateVault);
  if (vaultInfo) {
    console.log('\n✅ RebateVault already initialized!');
    console.log(`   Owner: ${vaultInfo.owner.toBase58()}`);
    return;
  }
  
  console.log('\n⏳ Creating RebateVault...');
  
  // Check balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Balance: ${(balance / 1e9).toFixed(4)} SOL`);
  
  if (balance < 0.01 * 1e9) {
    console.error('❌ Insufficient balance! Need at least 0.01 SOL');
    return;
  }
  
  // Build instruction
  const discriminator = getDiscriminator('initialize_rebate_vault');
  console.log(`Discriminator: ${discriminator.toString('hex')}`);
  
  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: routerState, isSigner: false, isWritable: true },
      { pubkey: rebateVault, isSigner: false, isWritable: true },
      { pubkey: USDC_MINT, isSigner: false, isWritable: false },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: discriminator,
  });
  
  const tx = new Transaction().add(instruction);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  
  try {
    const sig = await sendAndConfirmTransaction(connection, tx, [wallet], {
      commitment: 'confirmed',
    });
    console.log(`\n✅ RebateVault initialized!`);
    console.log(`Transaction: ${sig}`);
    console.log(`https://solscan.io/tx/${sig}`);
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    if (err.logs) {
      console.log('\nLogs:');
      err.logs.forEach(log => console.log('  ', log));
    }
  }
}

main().catch(console.error);
