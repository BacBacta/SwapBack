#!/usr/bin/env node
/**
 * Script pour vérifier si l'utilisateur a déjà un NFT de lock
 */

const { Connection, PublicKey } = require('@solana/web3.js');

const CNFT_PROGRAM_ID = new PublicKey('AaN2BwpGWbvDo7NHfpyC6zGYxsbg2xtcikToW9xYy4Xq');
const RPC_URL = 'https://api.devnet.solana.com';

async function checkUserNft(userPubkey) {
  const connection = new Connection(RPC_URL, 'confirmed');
  
  console.log('\n🔍 Vérification du User NFT');
  console.log('═══════════════════════════════════════════════════════════════');
  
  // Dériver le user_nft PDA
  const [userNftPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_nft'), userPubkey.toBuffer()],
    CNFT_PROGRAM_ID
  );
  
  console.log(`👤 Utilisateur: ${userPubkey.toString()}`);
  console.log(`📍 User NFT PDA: ${userNftPda.toString()}`);
  
  try {
    const accountInfo = await connection.getAccountInfo(userNftPda);
    
    if (accountInfo) {
      console.log('\n✅ User NFT existe déjà!');
      console.log(`   Owner: ${accountInfo.owner.toString()}`);
      console.log(`   Data size: ${accountInfo.data.length} bytes`);
      console.log(`   Lamports: ${accountInfo.lamports}`);
      
      // Essayer de décoder les données
      if (accountInfo.data.length > 8) {
        const data = accountInfo.data;
        console.log('\n📊 Données du compte:');
        console.log(`   Discriminator: ${data.slice(0, 8).toString('hex')}`);
        
        // Le reste des données (structure UserNft)
        // Vous pouvez ajouter plus de décodage ici si nécessaire
      }
      
      return true;
    } else {
      console.log('\n❌ User NFT n\'existe pas encore');
      console.log('   ℹ️  Ce compte sera créé lors du premier lock');
      return false;
    }
  } catch (error) {
    console.error('\n❌ Erreur lors de la vérification:', error.message);
    return false;
  }
}

// Utiliser l'adresse du wallet de test
// Remplacez par votre adresse de wallet
const DEFAULT_WALLET = process.env.USER_WALLET || 'VOTRE_WALLET_ADDRESS';

if (process.argv.length > 2) {
  const userAddress = process.argv[2];
  checkUserNft(new PublicKey(userAddress));
} else {
  console.log('\n📝 Usage: node check-user-nft.js <USER_WALLET_ADDRESS>');
  console.log(`   Exemple: node check-user-nft.js ${DEFAULT_WALLET}\n`);
}
