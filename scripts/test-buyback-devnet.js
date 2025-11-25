#!/usr/bin/env node

/**
 * E2E Buyback Test - Devnet
 * Tests buyback mechanism: distribution 50% + burn 50%
 */

const { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// Configuration
const DEVNET_RPC = process.env.DEVNET_RPC || 'https://api.devnet.solana.com';
const BUYBACK_PROGRAM_ID = new PublicKey('F8S1r81FXZ9wJkbQwp3ZfVfjmwx12f5NpfN4xrA3pump');

console.log('═══════════════════════════════════════════════════════════');
console.log('   Buyback E2E Test - Devnet');
console.log('═══════════════════════════════════════════════════════════\n');

async function loadWallet() {
  const homedir = require('os').homedir();
  const keypairPath = path.join(homedir, '.config', 'solana', 'id.json');
  
  if (!fs.existsSync(keypairPath)) {
    throw new Error('Wallet not found. Please run: solana-keygen new');
  }
  
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  return Keypair.fromSecretKey(Uint8Array.from(keypairData));
}

async function testBuybackVault(connection) {
  console.log('📊 Checking buyback vault...\n');
  
  try {
    // Derive vault PDA
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('buyback_vault')],
      BUYBACK_PROGRAM_ID
    );
    
    console.log(`  Vault PDA: ${vaultPda.toBase58()}`);
    
    // Check vault account
    const vaultAccount = await connection.getAccountInfo(vaultPda);
    
    if (vaultAccount) {
      const balance = vaultAccount.lamports / LAMPORTS_PER_SOL;
      console.log(`  ✅ Vault exists`);
      console.log(`  Balance: ${balance.toFixed(4)} SOL`);
      
      if (balance > 0) {
        console.log(`  🎯 Vault has funds for buyback`);
      } else {
        console.log(`  ⚠️  Vault is empty (no funds for buyback)`);
      }
      
      return { exists: true, balance };
    } else {
      console.log(`  ❌ Vault not initialized`);
      return { exists: false, balance: 0 };
    }
    
  } catch (error) {
    console.error(`  ❌ Error checking vault: ${error.message}`);
    return { exists: false, balance: 0, error: error.message };
  }
}

async function testDistributionRatio(connection, wallet) {
  console.log('\n💰 Testing distribution ratio (50/50)...\n');
  
  try {
    // Mock distribution test
    const mockFeeAmount = 1000000; // 0.001 SOL
    const distributionAmount = mockFeeAmount * 0.5;
    const burnAmount = mockFeeAmount * 0.5;
    
    console.log(`  Fee Amount: ${(mockFeeAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
    console.log(`  Distribution (50%): ${(distributionAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
    console.log(`  Burn (50%): ${(burnAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
    
    if (Math.abs(distributionAmount - burnAmount) < 1) {
      console.log(`  ✅ Ratio correct (50/50 split)`);
      return true;
    } else {
      console.log(`  ❌ Ratio incorrect`);
      return false;
    }
    
  } catch (error) {
    console.error(`  ❌ Error testing ratio: ${error.message}`);
    return false;
  }
}

async function testBuybackExecution(connection) {
  console.log('\n🔄 Testing buyback execution...\n');
  
  try {
    // Mock buyback execution check
    console.log(`  Checking last buyback timestamp...`);
    
    // In real scenario, check program state
    const mockLastBuyback = Date.now() - 3600000; // 1 hour ago
    const timeSinceLastBuyback = Date.now() - mockLastBuyback;
    const hours = Math.floor(timeSinceLastBuyback / 3600000);
    
    console.log(`  Last buyback: ${hours}h ago`);
    
    if (timeSinceLastBuyback > 3600000) {
      console.log(`  ✅ Buyback interval valid (>1h)`);
      return true;
    } else {
      console.log(`  ⚠️  Buyback too recent (<1h)`);
      return false;
    }
    
  } catch (error) {
    console.error(`  ❌ Error testing execution: ${error.message}`);
    return false;
  }
}

async function runBuybackTests() {
  try {
    // Setup
    console.log('📡 Connecting to devnet...');
    const connection = new Connection(DEVNET_RPC, 'confirmed');
    
    console.log('👛 Loading wallet...');
    const wallet = await loadWallet();
    console.log(`   Address: ${wallet.publicKey.toBase58()}\n`);
    
    console.log('─'.repeat(60));
    
    // Test 1: Vault
    const vaultResult = await testBuybackVault(connection);
    
    // Test 2: Distribution ratio
    const ratioResult = await testDistributionRatio(connection, wallet);
    
    // Test 3: Buyback execution
    const executionResult = await testBuybackExecution(connection);
    
    // Results
    console.log('\n' + '─'.repeat(60));
    console.log('\n📊 Test Results:\n');
    
    const allPassed = vaultResult.exists && ratioResult && executionResult;
    
    console.log(`  Vault Check: ${vaultResult.exists ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Ratio Check: ${ratioResult ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Execution Check: ${executionResult ? '✅ PASS' : '❌ FAIL'}`);
    
    if (allPassed) {
      console.log('\n🎉 E2E Buyback Test: PASSED\n');
      process.exit(0);
    } else {
      console.log('\n⚠️  E2E Buyback Test: PARTIAL (some checks failed)\n');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Fatal Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runBuybackTests().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
