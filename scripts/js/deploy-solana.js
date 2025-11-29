#!/usr/bin/env node

/**
 * SwapBack Devnet Deployment Script
 * Utilise @solana/web3.js pour déployer le programme
 */

const fs = require('fs');
const path = require('path');
const { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction, BpfLoaderUpgradeableProgram } = require('@solana/web3.js');

const PROGRAM_ID = "GEkXCcq87yUjQSp5EqcWf7bw9GKrB39A1LWdsE7V3V2E";
const RPC_URL = "https://api.devnet.solana.com";
const BINARY_PATH = "./swapback_cnft.so";
const WALLET_PATH = "./devnet-keypair.json";
const PROGRAM_KEYPAIR_PATH = "./target/deploy/swapback_cnft-keypair.json";

async function loadKeypair(filePath) {
    const secret = JSON.parse(fs.readFileSync(filePath));
    return Keypair.fromSecretKey(Buffer.from(secret));
}

async function deploy() {
    try {
        console.log("🚀 SwapBack Devnet Deployment");
        console.log("================================\n");

        // Vérifier les fichiers
        if (!fs.existsSync(BINARY_PATH)) {
            throw new Error(`Binary not found: ${BINARY_PATH}`);
        }
        if (!fs.existsSync(WALLET_PATH)) {
            throw new Error(`Wallet not found: ${WALLET_PATH}`);
        }
        if (!fs.existsSync(PROGRAM_KEYPAIR_PATH)) {
            throw new Error(`Program keypair not found: ${PROGRAM_KEYPAIR_PATH}`);
        }

        console.log("✅ Fichiers vérifiés");

        // Charger les keypairs
        const payer = await loadKeypair(WALLET_PATH);
        const programKeypair = await loadKeypair(PROGRAM_KEYPAIR_PATH);

        console.log(`   Wallet: ${payer.publicKey.toString()}`);
        console.log(`   Program: ${programKeypair.publicKey.toString()}\n`);

        // Connexion
        const connection = new Connection(RPC_URL, 'confirmed');
        console.log("📡 Connexion au RPC devnet...");
        const version = await connection.getVersion();
        console.log(`   Version: Solana ${version['solana-core']}\n`);

        // Vérifier le solde
        const balance = await connection.getBalance(payer.publicKey);
        const solBalance = balance / 1e9;
        console.log(`💰 Solde du wallet: ${solBalance} SOL`);
        
        if (solBalance < 0.5) {
            throw new Error(`Solde insuffisant: ${solBalance} SOL (min 0.5 SOL requis)`);
        }
        console.log("   ✅ Solde suffisant\n");

        // Charger le binaire
        const program = fs.readFileSync(BINARY_PATH);
        console.log(`📦 Binaire chargé: ${program.length} bytes\n`);

        // Vérifier si le programme existe déjà
        const programId = new PublicKey(PROGRAM_ID);
        const programInfo = await connection.getAccountInfo(programId);

        if (programInfo) {
            console.log("📝 Mise à jour du programme existant...\n");
            
            // Upgrade existant
            const transaction = new Transaction();
            
            // Ajouter instruction d'upgrade via BpfLoaderUpgradeable
            // Note: Ceci est simplifié - le déploiement réel nécessiterait:
            // 1. Créer un compte buffer
            // 2. Uploader le programme dans le buffer
            // 3. Envoyer une instruction d'upgrade
            
            console.log("⚠️  Upgrade non implémenté - utiliser CLI Solana:\n");
            console.log(`   solana program deploy ${BINARY_PATH} \\`);
            console.log(`     --program-id ${PROGRAM_KEYPAIR_PATH} \\`);
            console.log(`     -k ${WALLET_PATH}`);
            
        } else {
            console.log("✨ Déploiement nouveau programme...\n");
            
            // Nouveau déploiement
            // Note: Anchor/Solana-CLI gère normalement cela
            // Web3.js requiert plus de setup manuel
            
            console.log("⚠️  Déploiement initial non implémenté en web3.js\n");
            console.log("Utiliser plutôt:\n");
            console.log(`   export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"`);
            console.log(`   solana config set --url ${RPC_URL}`);
            console.log(`   solana program deploy ${BINARY_PATH} \\`);
            console.log(`     --program-id ${PROGRAM_KEYPAIR_PATH} \\`);
            console.log(`     -k ${WALLET_PATH}`);
        }

        console.log("\n✅ Configuration complétée!");

    } catch (error) {
        console.error("❌ Erreur:", error.message);
        process.exit(1);
    }
}

deploy();
