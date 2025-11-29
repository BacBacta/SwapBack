#!/usr/bin/env node

// Script de déploiement du programme buyback avec support Token-2022
// Utilise les APIs Node.js Solana disponibles

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Déploiement du programme buyback avec support Token-2022...\n');

// Chemins des fichiers
const programKeypairPath = path.join(__dirname, 'target/deploy/swapback_buyback-keypair.json');
const programSoPath = path.join(__dirname, 'target/deploy/swapback_buyback.so');

// Vérifier que les fichiers existent
if (!fs.existsSync(programKeypairPath)) {
  console.error('❌ Keypair non trouvée:', programKeypairPath);
  process.exit(1);
}

if (!fs.existsSync(programSoPath)) {
  console.error('❌ Binaire non trouvé:', programSoPath);
  process.exit(1);
}

console.log('✅ Fichiers de déploiement trouvés');

// Charger la keypair
let programKeypair;
try {
  programKeypair = JSON.parse(fs.readFileSync(programKeypairPath, 'utf8'));
  console.log('✅ Keypair chargée');
} catch (error) {
  console.error('❌ Erreur lors du chargement de la keypair:', error.message);
  process.exit(1);
}

// Pour le déploiement, nous aurions besoin de Solana CLI ou d'une API
// Comme nous n'avons pas accès direct à Solana CLI dans ce conteneur,
// nous allons créer un script qui peut être exécuté manuellement

console.log('\n📋 Instructions de déploiement manuel:');
console.log('=====================================');
console.log('');
console.log('1. Assurez-vous que Solana CLI est installé et configuré pour devnet:');
console.log('   solana config set --url https://api.devnet.solana.com');
console.log('');
console.log('2. Vérifiez votre solde (minimum 5 SOL recommandé):');
console.log('   solana balance');
console.log('');
console.log('3. Si besoin, demandez un airdrop:');
console.log('   solana airdrop 5');
console.log('');
console.log('4. Déployez le programme:');
console.log(`   solana program deploy --program-id ${programKeypairPath} ${programSoPath}`);
console.log('');
console.log('5. Vérifiez le déploiement:');
console.log('   solana program show <PROGRAM_ID>');
console.log('');

console.log('🎯 Programme ID attendu après déploiement:');
console.log('EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf');
console.log('');

console.log('⚠️  Note: Le programme buyback a été modifié pour supporter Token-2022.');
console.log('   Assurez-vous que le déploiement réussit avant de procéder aux tests.');

// Créer un script de déploiement prêt à exécuter
const deployScript = `#!/bin/bash
# Script de déploiement du programme buyback
set -e

echo "🚀 Déploiement programme buyback avec support Token-2022..."

# Configuration devnet
solana config set --url https://api.devnet.solana.com

# Vérifier solde
BALANCE=$(solana balance | awk '{print $1}')
echo "Solde actuel: $BALANCE SOL"

if (( $(echo "$BALANCE < 2.0" | bc -l) )); then
  echo "Demande d'airdrop..."
  solana airdrop 5
fi

# Déploiement
echo "Déploiement du programme..."
solana program deploy --program-id target/deploy/swapback_buyback-keypair.json target/deploy/swapback_buyback.so

echo "✅ Déploiement terminé!"
echo "Programme ID: EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf"
`;

fs.writeFileSync('deploy-buyback.sh', deployScript);
fs.chmodSync('deploy-buyback.sh', '755');

console.log('📄 Script de déploiement créé: deploy-buyback.sh');
console.log('   Exécutez: ./deploy-buyback.sh');