const { PublicKey } = require('@solana/web3.js');

// Nouveau programme CNFT
const CNFT_PROGRAM_ID = new PublicKey('9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq');

// Calculer le PDA collection_config
const [collectionConfigPda, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from('collection_config')],
  CNFT_PROGRAM_ID
);

console.log('\n📋 Collection Config PDA:');
console.log('Address:', collectionConfigPda.toString());
console.log('Bump:', bump);
console.log('\n✅ Utilisez cette adresse dans .env.local:');
console.log(`NEXT_PUBLIC_COLLECTION_CONFIG=${collectionConfigPda.toString()}`);
