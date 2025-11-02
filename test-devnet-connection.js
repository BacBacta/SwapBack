// Test de connexion devnet pour vérifier les comptes DCA
const { Connection, PublicKey } = require('@solana/web3.js');

async function testDevnetConnection() {
  console.log('🔍 Test de connexion Devnet...\n');
  
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  try {
    // Test 1: Vérifier la connexion RPC
    console.log('1️⃣ Test connexion RPC...');
    const version = await connection.getVersion();
    console.log('✅ RPC connecté:', version);
    
    // Test 2: Vérifier le programme Router
    const routerProgramId = new PublicKey('BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz');
    console.log('\n2️⃣ Vérification du programme Router...');
    const programInfo = await connection.getAccountInfo(routerProgramId);
    if (programInfo) {
      console.log('✅ Programme Router trouvé');
      console.log('   - Propriétaire:', programInfo.owner.toString());
      console.log('   - Taille:', programInfo.data.length, 'bytes');
      console.log('   - Exécutable:', programInfo.executable);
    } else {
      console.log('❌ Programme Router non trouvé');
    }
    
    // Test 3: Vérifier un compte cNFT mentionné dans les logs
    const cnftAccount = new PublicKey('73Stu2mtmjNAbAAtbxz91Zerb3JpnYCMorDprtGS5t98');
    console.log('\n3️⃣ Vérification du compte cNFT...');
    try {
      const accountInfo = await connection.getAccountInfo(cnftAccount);
      if (accountInfo) {
        console.log('✅ Compte cNFT trouvé');
        console.log('   - Propriétaire:', accountInfo.owner.toString());
        console.log('   - Taille:', accountInfo.data.length, 'bytes');
      } else {
        console.log('⚠️  Compte cNFT non trouvé (normal si pas encore créé)');
      }
    } catch (error) {
      console.log('❌ Erreur accès compte cNFT:', error.message);
    }
    
    // Test 4: Vérifier le dernier blockhash
    console.log('\n4️⃣ Test récupération blockhash...');
    const { blockhash } = await connection.getLatestBlockhash();
    console.log('✅ Blockhash récupéré:', blockhash.slice(0, 8) + '...');
    
    console.log('\n✅ Tous les tests de connexion devnet réussis!\n');
    return true;
  } catch (error) {
    console.error('\n❌ Erreur test devnet:', error.message);
    if (error.message.includes('403')) {
      console.error('   → Erreur 403: Accès refusé au RPC');
    }
    return false;
  }
}

testDevnetConnection()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('Erreur fatale:', err);
    process.exit(1);
  });
