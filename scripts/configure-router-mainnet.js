/**
 * Configure RouterState for SwapBack Router on mainnet
 * 
 * Step 1: Initialize RouterConfig (this will set correct percentages in RouterState)
 * Step 2: Initialize Rebate Vault (USDC token account for user rebates)
 * 
 * Program ID: FuzLkp1G7v39XXxobvr5pnGk7xZucBUroa215LrCjsAg
 * 
 * Expected values after initialization:
 * - Rebate: 7000 bps (70%)
 * - Treasury: 1500 bps (15%)
 * - Boost Vault: 1500 bps (15%)
 * - Treasury from fees: 8500 bps (85%)
 * - Buy/Burn from fees: 1500 bps (15%)
 */

const { 
  Connection, 
  PublicKey, 
  Keypair, 
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  SYSVAR_RENT_PUBKEY
} = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Router Program ID (deployed Dec 8, 2025)
const ROUTER_PROGRAM_ID = new PublicKey('FuzLkp1G7v39XXxobvr5pnGk7xZucBUroa215LrCjsAg');

// USDC Mint on mainnet
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

// Calculate Anchor discriminator
function getInstructionDiscriminator(instructionName) {
  const preimage = `global:${instructionName}`;
  const hash = crypto.createHash('sha256').update(preimage).digest();
  return hash.slice(0, 8);
}

async function configureRouter() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('     SWAPBACK ROUTER CONFIGURATION - MAINNET');
  console.log('═══════════════════════════════════════════════════════');
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
  console.log('Balance:', (balance / 1e9).toFixed(4), 'SOL');
  console.log('');
  
  // Calculate PDAs
  const [routerStatePda, stateBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('router_state')],
    ROUTER_PROGRAM_ID
  );
  console.log('RouterState PDA:', routerStatePda.toString(), '(bump:', stateBump + ')');
  
  const [configPda, configBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('router_config')],
    ROUTER_PROGRAM_ID
  );
  console.log('RouterConfig PDA:', configPda.toString(), '(bump:', configBump + ')');
  
  const [rebateVaultPda, vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('rebate_vault'), routerStatePda.toBuffer()],
    ROUTER_PROGRAM_ID
  );
  console.log('Rebate Vault PDA:', rebateVaultPda.toString(), '(bump:', vaultBump + ')');
  console.log('');
  
  // ========================================
  // STEP 1: Initialize RouterConfig
  // ========================================
  console.log('─────────────────────────────────────────────────');
  console.log('STEP 1: Initialize RouterConfig');
  console.log('─────────────────────────────────────────────────');
  
  const configAccount = await connection.getAccountInfo(configPda);
  
  if (!configAccount) {
    console.log('RouterConfig NOT found. Initializing...');
    console.log('');
    console.log('This will set:');
    console.log('  • Rebate BPS: 7000 (70% of NPI to users)');
    console.log('  • Treasury BPS: 1500 (15% of NPI to protocol)');
    console.log('  • Boost Vault BPS: 1500 (15% of NPI for lock rewards)');
    console.log('  • Treasury from Fees: 8500 (85% of platform fee)');
    console.log('  • Buy/Burn from Fees: 1500 (15% of platform fee)');
    console.log('');
    
    // Build initialize_config instruction
    // Accounts (from InitializeConfig struct):
    // 1. config (init, writable) - PDA with seeds ["router_config"]
    // 2. state (mut) - PDA with seeds ["router_state"]
    // 3. authority (signer, mut)
    // 4. system_program
    const discriminator = getInstructionDiscriminator('initialize_config');
    
    const keys = [
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: routerStatePda, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
    
    const initConfigIx = new TransactionInstruction({
      keys,
      programId: ROUTER_PROGRAM_ID,
      data: discriminator,
    });
    
    const tx = new Transaction().add(initConfigIx);
    tx.feePayer = authority.publicKey;
    
    try {
      const sig = await sendAndConfirmTransaction(connection, tx, [authority], { 
        commitment: 'confirmed',
        skipPreflight: false,
      });
      console.log('✅ RouterConfig initialized!');
      console.log('   Transaction:', sig);
    } catch (error) {
      console.error('❌ Error initializing config:', error.message);
      if (error.logs) {
        console.error('Program Logs:');
        error.logs.forEach(log => console.error('  ', log));
      }
      return;
    }
  } else {
    console.log('✅ RouterConfig already exists! Size:', configAccount.data.length, 'bytes');
  }
  
  // ========================================
  // STEP 2: Initialize Rebate Vault
  // ========================================
  console.log('');
  console.log('─────────────────────────────────────────────────');
  console.log('STEP 2: Initialize Rebate Vault (USDC)');
  console.log('─────────────────────────────────────────────────');
  
  const rebateVaultAccount = await connection.getAccountInfo(rebateVaultPda);
  
  if (!rebateVaultAccount) {
    console.log('Rebate Vault NOT found. Initializing...');
    console.log('USDC Mint:', USDC_MINT.toString());
    console.log('');
    
    // Build initialize_rebate_vault instruction
    // Accounts (from InitializeRebateVault struct):
    // 1. state (mut) - PDA with seeds ["router_state"]
    // 2. rebate_vault (init) - Token account PDA with seeds ["rebate_vault", state.key()]
    // 3. usdc_mint - The USDC mint
    // 4. authority (signer, mut)
    // 5. token_program
    // 6. system_program
    // 7. rent
    const discriminator = getInstructionDiscriminator('initialize_rebate_vault');
    
    const keys = [
      { pubkey: routerStatePda, isSigner: false, isWritable: true },
      { pubkey: rebateVaultPda, isSigner: false, isWritable: true },
      { pubkey: USDC_MINT, isSigner: false, isWritable: false },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];
    
    const initVaultIx = new TransactionInstruction({
      keys,
      programId: ROUTER_PROGRAM_ID,
      data: discriminator,
    });
    
    const tx = new Transaction().add(initVaultIx);
    tx.feePayer = authority.publicKey;
    
    try {
      const sig = await sendAndConfirmTransaction(connection, tx, [authority], { 
        commitment: 'confirmed',
        skipPreflight: false,
      });
      console.log('✅ Rebate Vault initialized!');
      console.log('   Transaction:', sig);
    } catch (error) {
      console.error('❌ Error initializing rebate vault:', error.message);
      if (error.logs) {
        console.error('Program Logs:');
        error.logs.forEach(log => console.error('  ', log));
      }
    }
  } else {
    console.log('✅ Rebate Vault already exists! Size:', rebateVaultAccount.data.length, 'bytes');
  }
  
  // ========================================
  // VERIFICATION
  // ========================================
  console.log('');
  console.log('─────────────────────────────────────────────────');
  console.log('VERIFICATION: Reading RouterState');
  console.log('─────────────────────────────────────────────────');
  
  const stateAccount = await connection.getAccountInfo(routerStatePda);
  if (stateAccount) {
    const data = stateAccount.data;
    
    // Skip 8-byte discriminator
    // RouterState structure (approximate offsets):
    // - authority: 8-40 (32 bytes)
    // - bump: 40 (1 byte)
    // - is_paused: 41 (1 byte)
    // - pending_authority: 42-75 (1 + 32 bytes Option)
    // - rebate_percentage: 75-77 (u16)
    // - treasury_percentage: 77-79 (u16)
    // - boost_vault_percentage: 79-81 (u16)
    
    const rebateBps = data.readUInt16LE(75);
    const treasuryBps = data.readUInt16LE(77);
    const boostBps = data.readUInt16LE(79);
    
    console.log('');
    console.log('NPI Distribution:');
    console.log('  Rebate:', rebateBps, 'bps (' + (rebateBps/100) + '%)');
    console.log('  Treasury:', treasuryBps, 'bps (' + (treasuryBps/100) + '%)');
    console.log('  Boost Vault:', boostBps, 'bps (' + (boostBps/100) + '%)');
    console.log('  Total:', (rebateBps + treasuryBps + boostBps), 'bps (should be 10000)');
    
    if (rebateBps === 7000 && treasuryBps === 1500 && boostBps === 1500) {
      console.log('');
      console.log('✅ All percentages correctly configured!');
    } else if (rebateBps === 0 && treasuryBps === 0 && boostBps === 0) {
      console.log('');
      console.log('⚠️  Percentages still at 0. RouterConfig may need to be initialized.');
    }
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('     CONFIGURATION COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
}

configureRouter().catch(console.error);
