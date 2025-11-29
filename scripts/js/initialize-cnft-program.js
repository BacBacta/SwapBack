/**
 * Script pour initialiser global_state et collection_config du programme cNFT
 */

const { 
  Connection, 
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram
} = require('@solana/web3.js');
const { Program, AnchorProvider, Idl } = require('@coral-xyz/anchor');
const fs = require('fs');
const cnftIdl = require('./app/src/idl/swapback_cnft.json');

async function main() {
  // Configuration
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const CNFT_PROGRAM_ID = new PublicKey('GEkXCcq87yUjQSp5EqcWf7bw9GKrB39A1LWdsE7V3V2E');
  
  // Charger le keypair payer (authority)
  const keypairPath = process.env.SOLANA_KEYPAIR || '/workspaces/SwapBack/devnet-keypair.json';
  if (!fs.existsSync(keypairPath)) {
    console.error('❌ Keypair not found at:', keypairPath);
    process.exit(1);
  }
  
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  const authority = Keypair.fromSecretKey(new Uint8Array(keypairData));
  console.log('💳 Authority:', authority.publicKey.toString());
  
  // Créer le provider Anchor
  const wallet = {
    publicKey: authority.publicKey,
    signTransaction: async (tx) => {
      tx.partialSign(authority);
      return tx;
    },
    signAllTransactions: async (txs) => {
      return txs.map(tx => {
        tx.partialSign(authority);
        return tx;
      });
    }
  };
  
  const provider = new AnchorProvider(
    connection,
    wallet,
    { commitment: 'confirmed', skipPreflight: false }
  );
  
  // Charger le programme
  const program = new Program(cnftIdl, provider);
  console.log('📝 Program loaded:', program.programId.toString());
  
  // Dériver les PDAs
  const [globalState] = PublicKey.findProgramAddressSync(
    [Buffer.from('global_state')],
    CNFT_PROGRAM_ID
  );
  
  const [collectionConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('collection_config')],
    CNFT_PROGRAM_ID
  );
  
  console.log('🔐 Global State PDA:', globalState.toString());
  console.log('🔐 Collection Config PDA:', collectionConfig.toString());
  
  // Vérifier si déjà initialisés
  const gsInfo = await connection.getAccountInfo(globalState);
  const ccInfo = await connection.getAccountInfo(collectionConfig);
  
  // Initialiser global_state si nécessaire
  if (!gsInfo) {
    console.log('\n📝 Initializing global_state...');
    try {
      const tx = await program.methods
        .initializeGlobalState()
        .accounts({
          globalState,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      
      console.log('✅ Global State initialized!');
      console.log('   Signature:', tx);
      console.log('   Explorer: https://explorer.solana.com/tx/' + tx + '?cluster=devnet');
    } catch (err) {
      console.error('❌ Failed to initialize global_state:', err.message);
      if (err.logs) {
        console.error('Logs:', err.logs);
      }
    }
  } else {
    console.log('✅ Global State already initialized');
  }
  
  // Initialiser collection_config si nécessaire
  if (!ccInfo) {
    console.log('\n📝 Initializing collection_config...');
    
    try {
      const tx = await program.methods
        .initializeCollection()
        .accounts({
          collectionConfig,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
      
      console.log('✅ Collection Config initialized!');
      console.log('   Signature:', tx);
      console.log('   Explorer: https://explorer.solana.com/tx/' + tx + '?cluster=devnet');
    } catch (err) {
      console.error('❌ Failed to initialize collection_config:', err.message);
      if (err.logs) {
        console.error('Logs:', err.logs);
      }
    }
  } else {
    console.log('✅ Collection Config already initialized');
  }
  
  console.log('\n🎉 Initialization complete! You can now lock tokens.');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
