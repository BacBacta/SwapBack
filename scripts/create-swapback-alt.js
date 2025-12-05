/**
 * Script pour créer l'Address Lookup Table SwapBack sur mainnet
 * 
 * Usage:
 *   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com \
 *   DEPLOYER_KEYPAIR_PATH=./mainnet-deploy-keypair.json \
 *   node scripts/create-swapback-alt.js
 * 
 * L'ALT créée permettra de réduire la taille des transactions de swap
 * de ~1500 bytes à ~400 bytes, évitant l'erreur "Transaction too large"
 */

const {
  Connection,
  Keypair,
  PublicKey,
  AddressLookupTableProgram,
  TransactionMessage,
  VersionedTransaction,
} = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// Configuration
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const KEYPAIR_PATH = process.env.DEPLOYER_KEYPAIR_PATH || './mainnet-deploy-keypair.json';

// Adresses à inclure dans l'ALT
const ADDRESSES_TO_INCLUDE = [
  // === Programs SwapBack ===
  '5K7kKoYd1E2S2gycBMeAeyXnxdbVgAEqJWKERwW8FTMf', // Router Program
  '7wCCwRXxWvMY2DJDRrnhFg3b8jVPb5vVPxLH5YAGL6eJ', // Buyback Program
  '26kzow1KF3AbrbFA7M3WxXVCtcMRgzMXkAKtVYDDt6Ru', // cNFT Program
  
  // === PDAs SwapBack ===
  '7nGEn5zY78G1X97VynadEbHRPkNtHmR69TGwWqymqeSs', // Router State
  '27bTPt5g9M3uJk8vKd4nwhrmQZ8csbXepfHRDZELjdmz', // Rebate Vault
  
  // === Jupiter ===
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter v6
  'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB', // Jupiter v4
  
  // === DEX Programs ===
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium AMM
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', // Orca Whirlpool
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK', // Raydium CLMM
  'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',  // Meteora DLMM
  
  // === Token Programs ===
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',  // Token Program
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', // Token-2022
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token
  
  // === System Programs ===
  '11111111111111111111111111111111',              // System Program
  'SysvarRent111111111111111111111111111111111',   // Rent Sysvar
  'SysvarC1ock11111111111111111111111111111111',   // Clock Sysvar
  'ComputeBudget111111111111111111111111111111',   // Compute Budget
  
  // === Common Token Mints ===
  'So11111111111111111111111111111111111111112',   // Wrapped SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',  // mSOL
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // Bonk
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',  // JUP
  'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',  // Render
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', // Pyth
  'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux',  // Helium
  
  // === Jito Tip Accounts ===
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
];

async function main() {
  console.log('🔧 SwapBack Address Lookup Table Creator');
  console.log('=========================================\n');

  // 1. Charger le keypair
  let keypair;
  try {
    const keypairData = JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf-8'));
    keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
    console.log(`✅ Loaded deployer keypair: ${keypair.publicKey.toBase58()}`);
  } catch (error) {
    console.error(`❌ Failed to load keypair from ${KEYPAIR_PATH}:`, error.message);
    process.exit(1);
  }

  // 2. Connexion RPC
  const connection = new Connection(RPC_URL, 'confirmed');
  console.log(`✅ Connected to: ${RPC_URL}`);

  // 3. Vérifier le solde
  const balance = await connection.getBalance(keypair.publicKey);
  const solBalance = balance / 1e9;
  console.log(`💰 Deployer balance: ${solBalance.toFixed(4)} SOL`);

  if (solBalance < 0.1) {
    console.error('❌ Insufficient balance. Need at least 0.1 SOL');
    process.exit(1);
  }

  // 4. Convertir les adresses en PublicKey
  const addresses = ADDRESSES_TO_INCLUDE.map(addr => new PublicKey(addr));
  console.log(`\n📋 Addresses to include: ${addresses.length}`);

  // 5. Obtenir le slot actuel
  const slot = await connection.getSlot();
  console.log(`📍 Current slot: ${slot}`);

  // 6. Créer l'instruction de création de l'ALT
  const [createIx, altAddress] = AddressLookupTableProgram.createLookupTable({
    authority: keypair.publicKey,
    payer: keypair.publicKey,
    recentSlot: slot - 1,
  });

  console.log(`\n🔑 ALT Address: ${altAddress.toBase58()}`);

  // 7. Créer l'instruction pour étendre l'ALT avec les adresses
  // Note: Max 30 adresses par transaction
  const MAX_ADDRESSES_PER_TX = 30;
  const addressChunks = [];
  for (let i = 0; i < addresses.length; i += MAX_ADDRESSES_PER_TX) {
    addressChunks.push(addresses.slice(i, i + MAX_ADDRESSES_PER_TX));
  }

  console.log(`\n📦 Will create ALT in ${addressChunks.length + 1} transaction(s)`);

  // 8. Transaction 1: Créer l'ALT + premier chunk d'adresses
  const firstChunk = addressChunks.shift();
  const extendIx = AddressLookupTableProgram.extendLookupTable({
    payer: keypair.publicKey,
    authority: keypair.publicKey,
    lookupTable: altAddress,
    addresses: firstChunk,
  });

  console.log('\n🚀 Sending transaction 1 (create + extend)...');
  
  const { blockhash: bh1, lastValidBlockHeight: lvbh1 } = await connection.getLatestBlockhash();
  
  const message1 = new TransactionMessage({
    payerKey: keypair.publicKey,
    recentBlockhash: bh1,
    instructions: [createIx, extendIx],
  }).compileToV0Message();

  const tx1 = new VersionedTransaction(message1);
  tx1.sign([keypair]);

  const sig1 = await connection.sendTransaction(tx1, {
    skipPreflight: false,
    maxRetries: 3,
  });

  console.log(`   Signature: ${sig1}`);
  
  await connection.confirmTransaction({
    signature: sig1,
    blockhash: bh1,
    lastValidBlockHeight: lvbh1,
  }, 'confirmed');
  
  console.log('   ✅ Transaction 1 confirmed');

  // 9. Transactions suivantes: Ajouter les chunks restants
  for (let i = 0; i < addressChunks.length; i++) {
    const chunk = addressChunks[i];
    console.log(`\n🚀 Sending transaction ${i + 2} (extend with ${chunk.length} addresses)...`);

    // Attendre un peu entre les transactions
    await new Promise(resolve => setTimeout(resolve, 1000));

    const extendIxN = AddressLookupTableProgram.extendLookupTable({
      payer: keypair.publicKey,
      authority: keypair.publicKey,
      lookupTable: altAddress,
      addresses: chunk,
    });

    const { blockhash: bhN, lastValidBlockHeight: lvbhN } = await connection.getLatestBlockhash();
    
    const messageN = new TransactionMessage({
      payerKey: keypair.publicKey,
      recentBlockhash: bhN,
      instructions: [extendIxN],
    }).compileToV0Message();

    const txN = new VersionedTransaction(messageN);
    txN.sign([keypair]);

    const sigN = await connection.sendTransaction(txN, {
      skipPreflight: false,
      maxRetries: 3,
    });

    console.log(`   Signature: ${sigN}`);
    
    await connection.confirmTransaction({
      signature: sigN,
      blockhash: bhN,
      lastValidBlockHeight: lvbhN,
    }, 'confirmed');
    
    console.log(`   ✅ Transaction ${i + 2} confirmed`);
  }

  // 10. Vérifier l'ALT créée
  console.log('\n📊 Verifying ALT...');
  
  // Attendre que l'ALT soit activée (1 slot)
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const altAccount = await connection.getAddressLookupTable(altAddress);
  
  if (altAccount.value) {
    const addressCount = altAccount.value.state.addresses.length;
    console.log(`   Addresses in ALT: ${addressCount}`);
    console.log(`   Authority: ${altAccount.value.state.authority?.toBase58() || 'None'}`);
    
    // Calculer l'économie de bytes
    const bytesSaved = addressCount * 31; // 32 - 1 byte par adresse
    console.log(`\n💾 Estimated bytes saved per transaction: ~${bytesSaved} bytes`);
  }

  // 11. Sauvegarder l'adresse de l'ALT
  const outputPath = path.join(__dirname, '..', 'swapback-alt-address.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    altAddress: altAddress.toBase58(),
    network: RPC_URL.includes('mainnet') ? 'mainnet-beta' : 'devnet',
    createdAt: new Date().toISOString(),
    addressCount: addresses.length,
    authority: keypair.publicKey.toBase58(),
  }, null, 2));

  console.log(`\n💾 ALT address saved to: ${outputPath}`);

  // 12. Instructions finales
  console.log('\n=========================================');
  console.log('✅ ALT CREATED SUCCESSFULLY!');
  console.log('=========================================');
  console.log('\n📝 Next steps:');
  console.log(`   1. Add to .env: NEXT_PUBLIC_SWAPBACK_ALT_ADDRESS=${altAddress.toBase58()}`);
  console.log('   2. Redeploy frontend: fly deploy');
  console.log('   3. Test a swap to verify reduced transaction size');
  console.log('\n🔗 Explorer link:');
  console.log(`   https://solscan.io/account/${altAddress.toBase58()}`);
}

main().catch(console.error);
