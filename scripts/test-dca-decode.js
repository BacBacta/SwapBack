#!/usr/bin/env node
/**
 * Test DCA Plans Decoding
 * Vérifie le décodage des comptes DCA avec le coder Anchor
 */

const { Connection, PublicKey } = require('@solana/web3.js');
const { AnchorProvider, Wallet, Program } = require('@coral-xyz/anchor');
const bs58 = require('bs58');
const fs = require('fs');
const path = require('path');

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const ROUTER_PROGRAM_ID = new PublicKey('9ttege5TrSQzHbYFSuTPLAS16NYTUPRuVpkyEwVFD2Fh');

// Discriminator pour DcaPlan
const DISCRIMINATOR = Buffer.from([231, 97, 112, 227, 171, 241, 52, 84]);
const DISCRIMINATOR_BASE58 = bs58.encode(DISCRIMINATOR);

async function main() {
  const userPubkey = process.argv[2];
  
  if (!userPubkey) {
    console.log('Usage: node test-dca-decode.js <USER_PUBKEY>');
    console.log('Example: node test-dca-decode.js DAdb3ArBvhJ77trTRUs5wbHARGXdupoAgjSYCHpkt6gP');
    process.exit(1);
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║              🔍 TEST DCA PLANS DECODING                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const connection = new Connection(RPC, 'confirmed');
  const userPublicKey = new PublicKey(userPubkey);

  try {
    // Charger l'IDL
    const idlPath = path.join(__dirname, '..', 'app', 'src', 'idl', 'swapback_router.json');
    console.log('📄 Loading IDL from:', idlPath);
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    console.log('✅ IDL loaded\n');

    // Créer un provider mock (pas besoin de wallet pour décoder)
    const provider = new AnchorProvider(
      connection,
      { publicKey: userPublicKey },
      { commitment: 'confirmed' }
    );

    // Créer le programme
    const program = new Program(idl, ROUTER_PROGRAM_ID, provider);
    console.log('🔧 Program created');
    console.log('   Program ID:', program.programId.toBase58());
    console.log('   Coder:', program.coder ? '✅' : '❌');
    console.log('   Coder.accounts:', program.coder.accounts ? '✅' : '❌');
    console.log('');

    // Vérifier si DcaPlan existe dans le coder
    console.log('🔍 Checking coder.accounts structure...');
    if (program.coder.accounts) {
      console.log('   Available account types:');
      // Le coder Anchor expose les types via _idl
      if (program.idl && program.idl.accounts) {
        program.idl.accounts.forEach(acc => {
          console.log(`   - ${acc.name}`);
        });
      } else if (program.idl && program.idl.types) {
        program.idl.types.forEach(type => {
          if (type.type && type.type.kind === 'struct') {
            console.log(`   - ${type.name}`);
          }
        });
      }
    }
    console.log('');

    // Fetch les comptes
    console.log('📋 Fetching DCA plans...');
    const accounts = await connection.getProgramAccounts(ROUTER_PROGRAM_ID, {
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

    console.log(`   Found ${accounts.length} account(s)\n`);

    if (accounts.length === 0) {
      console.log('❌ No accounts found for this user');
      return;
    }

    // Tenter de décoder chaque compte
    console.log('🔓 Decoding accounts...\n');
    
    for (let i = 0; i < accounts.length; i++) {
      const { pubkey, account } = accounts[i];
      console.log(`Account ${i + 1}/${accounts.length}:`);
      console.log(`  PDA: ${pubkey.toBase58()}`);
      console.log(`  Size: ${account.data.length} bytes`);
      console.log(`  Discriminator: ${account.data.slice(0, 8).toString('hex')}`);

      try {
        // Méthode 1: Via program.coder.accounts
        let decoded = null;
        try {
          decoded = program.coder.accounts.decode('dcaPlan', account.data);
          console.log('  ✅ Decoded via coder.accounts.decode("dcaPlan")');
        } catch (e) {
          console.log('  ❌ coder.accounts.decode("dcaPlan") failed:', e.message);
        }

        // Méthode 2: Via program.coder.accounts
        if (!decoded) {
          try {
            decoded = program.coder.accounts.decode('DcaPlan', account.data);
            console.log('  ✅ Decoded via coder.accounts.decode("DcaPlan")');
          } catch (e) {
            console.log('  ❌ coder.accounts.decode("DcaPlan") failed:', e.message);
          }
        }

        // Méthode 3: Via program.account
        if (!decoded && program.account && program.account.dcaPlan) {
          try {
            const accountInfo = await program.account.dcaPlan.fetch(pubkey);
            decoded = accountInfo;
            console.log('  ✅ Decoded via program.account.dcaPlan.fetch()');
          } catch (e) {
            console.log('  ❌ program.account.dcaPlan.fetch() failed:', e.message);
          }
        }

        if (decoded) {
          console.log('  📦 Decoded data:');
          console.log('     planId:', decoded.planId ? decoded.planId.toString() : 'N/A');
          console.log('     user:', decoded.user ? decoded.user.toBase58() : 'N/A');
          console.log('     inputMint:', decoded.inputMint ? decoded.inputMint.toBase58() : 'N/A');
          console.log('     outputMint:', decoded.outputMint ? decoded.outputMint.toBase58() : 'N/A');
          console.log('     amountPerCycle:', decoded.amountPerCycle ? decoded.amountPerCycle.toString() : 'N/A');
          console.log('     cycleFrequency:', decoded.cycleFrequency ? decoded.cycleFrequency.toString() : 'N/A');
          console.log('     nextCycleAt:', decoded.nextCycleAt ? new Date(decoded.nextCycleAt.toNumber() * 1000).toISOString() : 'N/A');
          console.log('     remainingCycles:', decoded.remainingCycles ? decoded.remainingCycles.toString() : 'N/A');
          console.log('     active:', decoded.active);
        } else {
          console.log('  ❌ Could not decode with any method');
        }

      } catch (error) {
        console.log('  ❌ Decoding error:', error.message);
      }

      console.log('');
    }

    console.log('✅ Test completed\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
