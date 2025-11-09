const { Connection, PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID } = require('@solana/spl-token');

const MINT1 = '3v3xneRUmsHY3UAyZDXZgVZwVeJwXVDwx5ZRsRAxuaLn';
const MINT2 = '862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux';

async function checkBalance(walletAddress) {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const publicKey = new PublicKey(walletAddress);
  
  console.log('\n🔍 VÉRIFICATION SOLDE $BACK TOKEN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📍 Wallet: ${walletAddress}\n`);

  // Vérifier SOL
  const solBalance = await connection.getBalance(publicKey);
  console.log(`💰 SOL Balance: ${(solBalance / 1e9).toFixed(4)} SOL\n`);

  // Fonction helper pour vérifier un mint
  async function checkMint(mint, name) {
    console.log(`🔸 ${name}:`);
    console.log(`   Mint: ${mint}`);
    
    try {
      const ata = await getAssociatedTokenAddress(
        new PublicKey(mint),
        publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      
      console.log(`   ATA: ${ata.toString()}`);
      
      const accountInfo = await connection.getAccountInfo(ata);
      
      if (!accountInfo) {
        console.log(`   ❌ Le compte token n'existe pas`);
        console.log(`   📝 Créer avec: spl-token create-account ${mint} --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`);
        return 0;
      }
      
      console.log(`   ✅ Le compte existe`);
      
      const data = accountInfo.data;
      if (data.length < 72) {
        console.log(`   ⚠️  Données invalides (taille: ${data.length} bytes)`);
        return 0;
      }
      
      const amount = data.readBigUInt64LE(64);
      const balance = Number(amount) / 1e9;
      
      console.log(`   💎 Solde: ${balance.toFixed(9)} $BACK`);
      
      if (balance > 0) {
        console.log(`   ✨ VOUS AVEZ DES TOKENS ICI!`);
      }
      
      return balance;
      
    } catch (error) {
      console.log(`   ❌ Erreur: ${error.message}`);
      return 0;
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const balance1 = await checkMint(MINT1, 'Token #1 (3v3xne...) - Config .env.local');
  console.log('');
  const balance2 = await checkMint(MINT2, 'Token #2 (862PQy...) - Ancien fallback');
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📊 RÉCAPITULATIF:\n');
  
  const total = balance1 + balance2;
  console.log(`   Total $BACK: ${total.toFixed(9)}`);
  console.log(`   - Sur mint #1: ${balance1.toFixed(9)}`);
  console.log(`   - Sur mint #2: ${balance2.toFixed(9)}`);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n💡 SOLUTION:\n');
  
  if (balance1 > 0 && balance2 === 0) {
    console.log('   ✅ Parfait! Vos tokens sont sur le bon mint (celui dans .env.local)');
    console.log('   📝 Le problème vient d\'ailleurs. Vérifiez:');
    console.log('      - Que l\'app utilise bien NEXT_PUBLIC_BACK_MINT');
    console.log('      - Que le wallet connecté est bien celui-ci');
    console.log('      - Que vous êtes sur devnet dans l\'interface');
  } else if (balance1 === 0 && balance2 > 0) {
    console.log('   ⚠️  VOS TOKENS SONT SUR L\'ANCIEN MINT!');
    console.log('   📝 OPTIONS:');
    console.log('      1. Transférer les tokens du mint #2 vers le mint #1');
    console.log('      2. OU changer .env.local pour utiliser le mint #2:');
    console.log(`         NEXT_PUBLIC_BACK_MINT=${MINT2}`);
    console.log('         (puis redémarrer l\'app)');
  } else if (balance1 > 0 && balance2 > 0) {
    console.log('   ℹ️  Vous avez des tokens sur LES DEUX mints');
    console.log('   📝 Recommandation:');
    console.log('      - Gardez le mint #1 dans .env.local');
    console.log('      - Utilisez ces tokens pour les tests');
    console.log('      - Optionnel: transférer tout vers un seul mint');
  } else {
    console.log('   ❌ AUCUN TOKEN TROUVÉ sur les deux mints!');
    console.log('   📝 PROCHAINES ÉTAPES:');
    console.log('      1. Choisir le mint à utiliser (recommandé: mint #1)');
    console.log('      2. Créer le compte token:');
    console.log(`         spl-token create-account ${MINT1} --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`);
    console.log('      3. Recevoir des tokens via faucet ou mint');
    console.log('      4. Si vous êtes l\'autorité:');
    console.log(`         spl-token mint ${MINT1} 10000 --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`);
  }
  
  console.log('');
}

const walletAddress = process.argv[2];
if (!walletAddress) {
  console.log('\n❌ Usage: node check-both-mints.js <WALLET_ADDRESS>');
  console.log('\nExemple:');
  console.log('  node scripts/check-both-mints.js $(solana address)');
  process.exit(1);
}

checkBalance(walletAddress).catch(console.error);
