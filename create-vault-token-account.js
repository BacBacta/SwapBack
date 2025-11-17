/**
 * Script pour créer le vault token account pour le programme cNFT
 */

const { 
  Connection, 
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction
} = require('@solana/web3.js');
const { 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID
} = require('@solana/spl-token');
const fs = require('fs');

async function main() {
  // Configuration
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const CNFT_PROGRAM_ID = new PublicKey('GEkXCcq87yUjQSp5EqcWf7bw9GKrB39A1LWdsE7V3V2E');
  const BACK_MINT = new PublicKey('862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux');
  
  // Charger le keypair payer (votre wallet)
  const keypairPath = process.env.SOLANA_KEYPAIR || '/workspaces/SwapBack/devnet-keypair.json';
  if (!fs.existsSync(keypairPath)) {
    console.error('❌ Keypair not found at:', keypairPath);
    console.error('   Set your keypair with: solana config set --keypair <path>');
    process.exit(1);
  }
  
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  const payer = Keypair.fromSecretKey(new Uint8Array(keypairData));
  console.log('💳 Payer:', payer.publicKey.toString());
  
  // Dériver le vault authority PDA
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_authority')],
    CNFT_PROGRAM_ID
  );
  console.log('🔐 Vault Authority PDA:', vaultAuthority.toString());
  
  // Calculer l'ATA pour le vault
  const vaultTokenAccount = await getAssociatedTokenAddress(
    BACK_MINT,
    vaultAuthority,
    true, // allowOwnerOffCurve = true pour PDA
    TOKEN_PROGRAM_ID
  );
  console.log('🏦 Vault Token Account:', vaultTokenAccount.toString());
  
  // Vérifier si existe déjà
  const accountInfo = await connection.getAccountInfo(vaultTokenAccount);
  if (accountInfo) {
    console.log('✅ Vault token account already exists!');
    console.log('   Owner:', accountInfo.owner.toString());
    console.log('   Lamports:', accountInfo.lamports);
    return;
  }
  
  console.log('📝 Creating vault token account...');
  
  // Créer l'instruction pour créer l'ATA
  const createATAInstruction = createAssociatedTokenAccountInstruction(
    payer.publicKey, // payer
    vaultTokenAccount, // ata
    vaultAuthority, // owner (le PDA)
    BACK_MINT, // mint
    TOKEN_PROGRAM_ID
  );
  
  // Construire et envoyer la transaction
  const transaction = new Transaction().add(createATAInstruction);
  
  console.log('🚀 Sending transaction...');
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer],
    { commitment: 'confirmed' }
  );
  
  console.log('✅ Vault token account created!');
  console.log('   Signature:', signature);
  console.log('   Explorer: https://explorer.solana.com/tx/' + signature + '?cluster=devnet');
  console.log('');
  console.log('🎉 You can now lock tokens!');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
