#!/usr/bin/env node

/**
 * 🚀 SWAPBACK TOKEN FAUCET - DEVNET
 *
 * Script pour obtenir des tokens $BACK sur devnet
 * Utilise le token mint créé précédemment
 */

const { Connection, PublicKey, Keypair, Transaction } = require('@solana/web3.js');
const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createMintToInstruction, TOKEN_2022_PROGRAM_ID } = require('@solana/spl-token');
const bs58 = require('bs58');

// Configuration
const BACK_MINT = '3v3xneRUmsHY3UAyZDXZgVZwVeJwXVDwx5ZRsRAxuaLn';
const DEVNET_RPC = 'https://api.devnet.solana.com';

// Clé privée du mint authority (celle utilisée pour créer le token)
// ⚠️  ATTENTION: Cette clé ne doit JAMAIS être utilisée en production
const MINT_AUTHORITY_SECRET = 'YOUR_MINT_AUTHORITY_SECRET_KEY_HERE';

async function getBackTokens(walletAddress, amount = 1000) {
  console.log(`🚀 Obtention de ${amount} $BACK tokens pour ${walletAddress}`);

  try {
    // Connexion à devnet
    const connection = new Connection(DEVNET_RPC, 'confirmed');

    // Clés
    const mint = new PublicKey(BACK_MINT);
    const userWallet = new PublicKey(walletAddress);

    // ⚠️  Pour la démo seulement - utiliser une vraie clé d'autorité de mint
    console.log('⚠️  ATTENTION: Utilisation de la clé d\'autorité de mint pour la démo');
    console.log('🔑 Mint Authority:', MINT_AUTHORITY_SECRET.slice(0, 8) + '...');

    // Pour cette démo, on simule - en réalité il faudrait la vraie clé privée
    console.log('💡 En production, utilisez un faucet sécurisé ou demandez des tokens à l\'équipe');

    // Instructions pour créer le compte token si nécessaire
    console.log('📝 Instructions:');
    console.log('1. Allez sur https://faucet.solana.com/');
    console.log('2. Obtenez des SOL sur devnet');
    console.log('3. Contactez l\'équipe SwapBack pour des tokens $BACK de test');

    console.log(`✅ Simulation terminée - ${amount} $BACK tokens seraient disponibles`);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

// Fonction principale
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Usage: node faucet.js <wallet_address> [amount]');
    console.log('Example: node faucet.js 11111111111111111111111111111112 1000');
    process.exit(1);
  }

  const walletAddress = args[0];
  const amount = args[1] ? parseInt(args[1]) : 1000;

  await getBackTokens(walletAddress, amount);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { getBackTokens };