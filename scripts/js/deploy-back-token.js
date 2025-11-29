const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');
const {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} = require('@solana/spl-token');
const fs = require('fs');

(async () => {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Load keypair
  const keypairData = JSON.parse(fs.readFileSync('./devnet-keypair.json'));
  const payer = Keypair.fromSecretKey(new Uint8Array(keypairData));
  
  console.log('Payer:', payer.publicKey.toString());
  
  // Create mint
  console.log('\n📋 Creating token mint...');
  const mint = await createMint(
    connection,
    payer,
    payer.publicKey, // mint authority
    payer.publicKey, // freeze authority
    6 // decimals
  );
  
  console.log('✅ Token Mint:', mint.toString());
  
  // Create associated token account
  console.log('\n💰 Creating associated token account...');
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey
  );
  
  console.log('✅ Token Account:', tokenAccount.address.toString());
  
  // Mint 100,000 tokens
  console.log('\n🪙 Minting 100,000 BACK tokens...');
  const tx = await mintTo(
    connection,
    payer,
    mint,
    tokenAccount.address,
    payer.publicKey,
    100000 * Math.pow(10, 6) // 100k with 6 decimals
  );
  
  console.log('✅ Mint TX:', tx);
  
  console.log('\n========================================');
  console.log('🎉 Token deployment complete!');
  console.log('========================================');
  console.log('NEXT_PUBLIC_BACK_MINT=' + mint.toString());
  console.log('BACK Token Account: ' + tokenAccount.address.toString());
  
})().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
