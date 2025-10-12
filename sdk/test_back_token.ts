#!/usr/bin/env npx tsx

/**
 * Script de test pour le token $BACK
 * Teste la création, les transfers et le burn automatique
 */

import { Connection, Keypair } from '@solana/web3.js';
import { createBackTokenClient } from './src/backToken';

// Configuration Solana
const SOLANA_RPC = process.env.SOLANA_RPC || 'https://api.devnet.solana.com';
const connection = new Connection(SOLANA_RPC, 'confirmed');

async function testBackToken() {
  console.log('🪙 Test du token $BACK');
  console.log('======================');

  try {
    // Charger la configuration
    console.log('📄 Chargement de la configuration...');
    const client = await createBackTokenClient(connection);

    console.log('✅ Client $BACK initialisé');

    // Créer un wallet de test
    const testWallet = Keypair.generate();
    console.log(`👤 Wallet de test: ${testWallet.publicKey.toString()}`);

    // Airdrop SOL pour les frais
    console.log('💰 Airdrop SOL...');
    // Note: À implémenter avec un airdrop réel ou utiliser un wallet pré-fundé

    // Test 1: Créer un ATA
    console.log('🏦 Test 1: Création ATA...');
    const ata = await client.createAssociatedTokenAccount(testWallet.publicKey);
    console.log(`✅ ATA créé: ${ata.toString()}`);

    // Test 2: Vérifier le solde initial
    console.log('💰 Test 2: Vérification solde initial...');
    const initialBalance = await client.getBalance(testWallet.publicKey);
    console.log(`💰 Solde initial: ${initialBalance} $BACK`);

    // Test 3: Calcul des montants après burn
    console.log('🔥 Test 3: Calcul burn automatique...');
    const testAmount = 1000;
    const amountAfterBurn = client.calculateAmountAfterBurn(testAmount);
    const burnAmount = client.estimateBurn(testAmount);

    console.log(`📊 Montant initial: ${testAmount} $BACK`);
    console.log(`🔥 Burn (0.1%): ${burnAmount} $BACK`);
    console.log(`📈 Montant après burn: ${amountAfterBurn} $BACK`);

    // Test 4: Statistiques du token
    console.log('📈 Test 4: Statistiques du token...');
    const stats = await client.getTokenStats();
    console.log(`📊 Supply total: ${stats.supply} $BACK`);
    console.log(`🔥 Total brûlé: ${stats.burned} $BACK`);
    console.log(`💫 Circulant: ${stats.circulating} $BACK`);

    console.log('');
    console.log('🎉 Tests terminés avec succès!');
    console.log('');
    console.log('📝 Note: Pour tester les vrais transfers, il faut:');
    console.log('   1. Déployer le programme Transfer Hook');
    console.log('   2. Mint des tokens $BACK dans la trésorerie');
    console.log('   3. Effectuer des transfers réels');

  } catch (error) {
    console.error('❌ Erreur lors des tests:', error);
    process.exit(1);
  }
}

// Exécuter les tests
testBackToken();