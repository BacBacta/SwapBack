#!/usr/bin/env node
/**
 * Test DCA Plans Fetching
 * Vérifie si des comptes DCA existent pour un wallet donné
 */

const { Connection, PublicKey } = require('@solana/web3.js');
const bs58 = require('bs58');

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const ROUTER_PROGRAM_ID = new PublicKey('9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh');

// Discriminator pour DcaPlan [231, 97, 112, 227, 171, 241, 52, 84]
const DISCRIMINATOR = Buffer.from([231, 97, 112, 227, 171, 241, 52, 84]);
const DISCRIMINATOR_BASE58 = bs58.encode(DISCRIMINATOR);

async function main() {
  const userPubkey = process.argv[2];
  
  if (!userPubkey) {
    console.log('Usage: node test-dca-fetch.js <USER_PUBKEY>');
    console.log('Example: node test-dca-fetch.js DAdb3ArBvhJ77trTRUs5wbHARGXdupoAgjSYCHpkt6gP');
    process.exit(1);
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║              🔍 TEST DCA PLANS FETCHING                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const connection = new Connection(RPC, 'confirmed');
  const userPublicKey = new PublicKey(userPubkey);

  console.log('🌐 RPC:', RPC);
  console.log('🆔 Router Program:', ROUTER_PROGRAM_ID.toBase58());
  console.log('👤 User:', userPublicKey.toBase58());
  console.log('🔑 Discriminator (hex):', DISCRIMINATOR.toString('hex'));
  console.log('🔑 Discriminator (base58):', DISCRIMINATOR_BASE58);
  console.log('');

  try {
    // Test 1: Fetch ALL DcaPlan accounts (no user filter)
    console.log('📋 Test 1: Fetching ALL DCA plans (no user filter)...');
    const allAccounts = await connection.getProgramAccounts(ROUTER_PROGRAM_ID, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: DISCRIMINATOR_BASE58,
          },
        },
      ],
    });
    
    console.log(`   Found ${allAccounts.length} total DCA plan(s) in the program`);
    
    if (allAccounts.length > 0) {
      console.log('   First 5 accounts:');
      allAccounts.slice(0, 5).forEach((acc, idx) => {
        console.log(`   ${idx + 1}. ${acc.pubkey.toBase58()}`);
        // Parse user from account data (offset 40)
        if (acc.account.data.length >= 72) {
          const userBytes = acc.account.data.slice(40, 72);
          const user = new PublicKey(userBytes);
          console.log(`      User: ${user.toBase58()}`);
        }
      });
    }

    console.log('');

    // Test 2: Fetch user-specific DCA plans
    console.log('📋 Test 2: Fetching DCA plans for specific user...');
    const userAccounts = await connection.getProgramAccounts(ROUTER_PROGRAM_ID, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: DISCRIMINATOR_BASE58,
          },
        },
        {
          memcmp: {
            offset: 40,
            bytes: userPublicKey.toBase58(),
          },
        },
      ],
    });

    console.log(`   Found ${userAccounts.length} DCA plan(s) for this user`);
    
    if (userAccounts.length > 0) {
      console.log('   Plans:');
      userAccounts.forEach((acc, idx) => {
        console.log(`   ${idx + 1}. PDA: ${acc.pubkey.toBase58()}`);
        console.log(`      Size: ${acc.account.data.length} bytes`);
        console.log(`      Owner: ${acc.account.owner.toBase58()}`);
      });
    } else {
      console.log('   ℹ️  No plans found for this user');
      console.log('   Possible reasons:');
      console.log('   - Plans not yet created');
      console.log('   - Wrong user pubkey');
      console.log('   - Plans on different network (mainnet vs devnet)');
    }

    console.log('\n✅ Test completed successfully\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack:', error.stack);
    }
    process.exit(1);
  }
}

main();
