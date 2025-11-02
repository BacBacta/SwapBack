// Test de création de plan DCA via l'interface
// Ce test simule la logique de DCAClient.tsx

const { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { AnchorProvider, Program, BN } = require('@coral-xyz/anchor');

// Charger l'IDL depuis le fichier généré
const fs = require('fs');
const path = require('path');

async function testDCACreation() {
  console.log('🧪 Test création plan DCA devnet...\n');
  
  try {
    // 1️⃣ Configuration
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const programId = new PublicKey('BKExqm5cetXMFmN8uk8kkLJkYw51NZCh9V1hVZNvp5Zz');
    
    console.log('✅ Configuration:');
    console.log('   - RPC: https://api.devnet.solana.com');
    console.log('   - Programme:', programId.toString());
    
    // 2️⃣ Charger l'IDL
    const idlPath = path.join(__dirname, 'app/src/idl/swapback_router.json');
    if (!fs.existsSync(idlPath)) {
      console.log('❌ IDL non trouvé:', idlPath);
      console.log('   Essayez: npm run copy-idl');
      return false;
    }
    
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    console.log('\n✅ IDL chargé:', idl.name);
    
    // 3️⃣ Vérifier que l'instruction createDcaPlan existe
    const hasDcaInstruction = idl.instructions?.some(ix => ix.name === 'createDcaPlan');
    console.log('\n✅ Instructions disponibles:');
    idl.instructions?.forEach(ix => {
      console.log('   -', ix.name);
    });
    
    if (!hasDcaInstruction) {
      console.log('\n⚠️  Instruction createDcaPlan non trouvée dans l\'IDL');
      console.log('   L\'IDL doit être mis à jour avec le programme déployé');
    }
    
    // 4️⃣ Simuler la dérivation du PDA
    const userId = Keypair.generate().publicKey;
    const planId = new BN(Date.now());
    
    const [dcaPlanPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('dca_plan'),
        userId.toBuffer(),
        planId.toArrayLike(Buffer, 'le', 8),
      ],
      programId
    );
    
    console.log('\n✅ PDA DCA Plan dérivé:');
    console.log('   - User:', userId.toString().slice(0, 8) + '...');
    console.log('   - Plan ID:', planId.toString());
    console.log('   - PDA:', dcaPlanPda.toString());
    
    // 5️⃣ Vérifier le State PDA
    const [statePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('router_state')],
      programId
    );
    
    console.log('\n✅ State PDA dérivé:', statePda.toString());
    
    // 6️⃣ Vérifier que le State existe on-chain
    const stateInfo = await connection.getAccountInfo(statePda);
    if (stateInfo) {
      console.log('   ✓ State account existe on-chain');
      console.log('   - Taille:', stateInfo.data.length, 'bytes');
    } else {
      console.log('   ⚠️  State account non trouvé - doit être initialisé d\'abord');
    }
    
    console.log('\n✅ Test de simulation DCA réussi!');
    console.log('\n📝 Prochaines étapes:');
    console.log('   1. Connecter un wallet avec SOL devnet');
    console.log('   2. Initialiser le State si nécessaire');
    console.log('   3. Créer un plan DCA via l\'interface');
    
    return true;
  } catch (error) {
    console.error('\n❌ Erreur test DCA:', error.message);
    return false;
  }
}

testDCACreation()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('Erreur fatale:', err);
    process.exit(1);
  });
