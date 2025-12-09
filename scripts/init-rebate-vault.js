/**
 * Initialize Rebate Vault for SwapBack Router
 * 
 * Le rebate_vault est un PDA Token Account qui stocke les USDC pour les rebates
 */

const { Connection, PublicKey, Keypair, Transaction, SystemProgram, SYSVAR_RENT_PUBKEY } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } = require('@solana/spl-token');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const PROGRAM_ID = new PublicKey('APHj6L2b2bA2q62jwYZp38dqbTxQUqwatqdUum1trPnN');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

async function main() {
  console.log('='.repeat(60));
  console.log('Initialize Rebate Vault');
  console.log('='.repeat(60));
  
  // Connect to mainnet
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  
  // Load wallet
  const keypairPath = process.env.HOME + '/.config/solana/id.json';
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  console.log(`\nWallet: ${wallet.publicKey.toBase58()}`);
  
  // Derive RouterState PDA
  const [routerState, stateBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('router_state')],
    PROGRAM_ID
  );
  console.log(`RouterState PDA: ${routerState.toBase58()}`);
  
  // Derive RebateVault PDA
  const [rebateVault, vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('rebate_vault'), routerState.toBuffer()],
    PROGRAM_ID
  );
  console.log(`RebateVault PDA: ${rebateVault.toBase58()}`);
  
  // Check if rebate vault already exists
  const vaultInfo = await connection.getAccountInfo(rebateVault);
  if (vaultInfo) {
    console.log('\n✅ RebateVault already initialized!');
    console.log(`   Owner: ${vaultInfo.owner.toBase58()}`);
    console.log(`   Size: ${vaultInfo.data.length} bytes`);
    return;
  }
  
  console.log('\n⏳ RebateVault not initialized, creating...');
  
  // Load IDL
  const idlPath = path.join(__dirname, '../target/idl/swapback_router.json');
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
  
  // Setup provider
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: 'confirmed' }
  );
  anchor.setProvider(provider);
  
  // Create program instance
  const program = new anchor.Program(idl, PROGRAM_ID, provider);
  
  // Check balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Balance: ${(balance / 1e9).toFixed(4)} SOL`);
  
  if (balance < 0.01 * 1e9) {
    console.error('❌ Insufficient balance!');
    return;
  }
  
  try {
    // Call initialize_rebate_vault
    const tx = await program.methods
      .initializeRebateVault()
      .accounts({
        state: routerState,
        rebateVault: rebateVault,
        usdcMint: USDC_MINT,
        authority: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([wallet])
      .rpc();
    
    console.log(`\n✅ RebateVault initialized!`);
    console.log(`Transaction: ${tx}`);
    console.log(`https://solscan.io/tx/${tx}`);
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    if (err.logs) {
      console.log('\nLogs:');
      err.logs.forEach(log => console.log('  ', log));
    }
  }
}

main().catch(console.error);
