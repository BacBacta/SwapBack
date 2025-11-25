/**
 * Test Buyback Deposit Flow
 * Vérifie que les dépôts USDC fonctionnent vers le buyback vault
 */

const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const fs = require('fs');

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const ROUTER_PROGRAM_ID = new PublicKey('9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh');
const BUYBACK_PROGRAM_ID = new PublicKey('F8S1r81FcTsSBb9vP3jFNuVoTMYNrxaCptbvkzSXcEce');

async function testBuybackDeposit() {
  console.log('🔍 Testing Buyback Deposit Flow...\n');

  const connection = new Connection(RPC_URL, 'confirmed');
  
  // Load wallet
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(process.env.HOME + '/.config/solana/id.json')))
  );
  
  console.log('📊 Configuration:');
  console.log(`   Wallet: ${walletKeypair.publicKey.toString()}`);
  console.log(`   Router: ${ROUTER_PROGRAM_ID.toString()}`);
  console.log(`   Buyback: ${BUYBACK_PROGRAM_ID.toString()}`);
  console.log('');

  // Check buyback state
  const [buybackStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('buyback_state')],
    BUYBACK_PROGRAM_ID
  );

  console.log('🔍 Checking Buyback State...');
  console.log(`   PDA: ${buybackStatePDA.toString()}`);

  try {
    const buybackStateAccount = await connection.getAccountInfo(buybackStatePDA);
    
    if (!buybackStateAccount) {
      console.log('❌ Buyback state not initialized!');
      console.log('\n📝 To initialize:');
      console.log('   Run: node scripts/init-buyback-state.js');
      return;
    }

    console.log('✅ Buyback state exists');
    console.log(`   Size: ${buybackStateAccount.data.length} bytes`);

    // Decode state (simple version - first fields)
    const data = buybackStateAccount.data;
    
    // Skip discriminator (8 bytes)
    let offset = 8;
    
    // Read authority (32 bytes)
    const authority = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    
    console.log(`   Authority: ${authority.toString()}`);

    // Check USDC vault
    const [usdcVaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('usdc_vault')],
      BUYBACK_PROGRAM_ID
    );

    console.log('\n🏦 Checking USDC Vault...');
    console.log(`   PDA: ${usdcVaultPDA.toString()}`);

    const vaultInfo = await connection.getAccountInfo(usdcVaultPDA);
    
    if (!vaultInfo) {
      console.log('❌ USDC vault not found');
      return;
    }

    // Parse token account (simple)
    const vaultData = vaultInfo.data;
    // Token account: mint(32) + owner(32) + amount(8) + ...
    const amount = Number(Buffer.from(vaultData.slice(64, 72)).readBigUInt64LE());
    
    console.log('✅ USDC Vault exists');
    console.log(`   Balance: ${amount / 1e6} USDC`);

    if (amount > 0) {
      console.log('   🎉 Vault has USDC! Buyback deposits are working!');
    } else {
      console.log('   ⚠️  Vault is empty (no deposits yet)');
    }

    // Check router state to see if buyback is enabled
    const [routerStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('router_state')],
      ROUTER_PROGRAM_ID
    );

    console.log('\n🔍 Checking Router State...');
    const routerStateInfo = await connection.getAccountInfo(routerStatePDA);
    
    if (routerStateInfo) {
      console.log('✅ Router state exists');
      // Note: Router state structure would need full decode
      // For now, we just confirm it exists
    }

    console.log('\n📝 Next Steps:');
    if (amount === 0) {
      console.log('   1. Execute a swap to trigger buyback deposit');
      console.log('      Go to: https://swap-back-mauve.vercel.app/swap');
      console.log('   2. Swap ~0.01 SOL → USDC');
      console.log('   3. Re-run this script to verify deposit');
    } else {
      console.log('   ✅ Deposits working! Ready to test execute_buyback');
      console.log('   Next: node scripts/test-execute-buyback.js');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testBuybackDeposit();
