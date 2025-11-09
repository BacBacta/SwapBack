const { Connection, PublicKey } = require('@solana/web3.js');

const MINT1 = '3v3xneRUmsHY3UAyZDXZgVZwVeJwXVDwx5ZRsRAxuaLn';
const MINT2 = '862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux';

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

async function check() {
  console.log('\n🔍 VÉRIFICATION DES ADRESSES $BACK TOKEN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('📋 Adresse #1 (dans .env.local et TokenSelector):');
  console.log('   ' + MINT1);
  try {
    const info1 = await connection.getAccountInfo(new PublicKey(MINT1));
    if (info1) {
      console.log('   ✅ EXISTE sur devnet');
      console.log('   Owner:', info1.owner.toString());
      console.log('   Data length:', info1.data.length, 'bytes');
    } else {
      console.log('   ❌ N\'EXISTE PAS sur devnet');
    }
  } catch (e) {
    console.log('   ❌ ERREUR:', e.message);
  }
  
  console.log('\n📋 Adresse #2 (fallback dans LockInterface):');
  console.log('   ' + MINT2);
  try {
    const info2 = await connection.getAccountInfo(new PublicKey(MINT2));
    if (info2) {
      console.log('   ✅ EXISTE sur devnet');
      console.log('   Owner:', info2.owner.toString());
      console.log('   Data length:', info2.data.length, 'bytes');
    } else {
      console.log('   ❌ N\'EXISTE PAS sur devnet');
    }
  } catch (e) {
    console.log('   ❌ ERREUR:', e.message);
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📝 CONCLUSION:');
  console.log('   La bonne adresse à utiliser est celle qui EXISTE sur devnet.');
  console.log('   Assurez-vous que .env.local et TOUS les fichiers utilisent');
  console.log('   la MÊME adresse via process.env.NEXT_PUBLIC_BACK_MINT\n');
}

check().catch(console.error);
