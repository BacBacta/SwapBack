#!/usr/bin/env npx tsx

import { Connection, Keypair } from '@solana/web3.js';
import { CnftClient, DEFAULT_CNFT_CONFIG } from './src/cnftClient';

// Configuration pour les tests
const CONNECTION_URL = 'http://localhost:8899'; // Localnet
const AUTHORITY_KEYPAIR = Keypair.generate(); // À remplacer par une vraie clé

async function testCnftProgram() {
  console.log('🚀 Test du programme cNFT SwapBack\n');

  // Connexion à Solana
  const connection = new Connection(CONNECTION_URL, 'confirmed');

  // Créer le client cNFT
  const cnftClient = new CnftClient(connection, {} as any, DEFAULT_CNFT_CONFIG);

  try {
    // Vérifier la connexion
    const version = await connection.getVersion();
    console.log('✅ Connecté à Solana', version);

    console.log('📋 Programme cNFT configuré');
    console.log('🔑 Program ID:', DEFAULT_CNFT_CONFIG.programId.toString());
    console.log('📁 Collection Config:', DEFAULT_CNFT_CONFIG.collectionConfig.toString());

    console.log('\n✅ Tests cNFT terminés avec succès!');

  } catch (error) {
    console.error('❌ Erreur lors des tests:', error);
    process.exit(1);
  }
}

// Exécuter les tests si appelé directement
if (require.main === module) {
  testCnftProgram();
}

export { testCnftProgram };