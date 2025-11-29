#!/usr/bin/env node

/**
 * Script de déploiement du programme buyback avec support Token-2022
 * Utilise les APIs Solana pour créer la transaction de déploiement
 */

const fs = require('fs');
const path = require('path');
const { Connection, PublicKey, Keypair, Transaction, SystemProgram, sendAndConfirmTransaction } = require("@solana/web3.js");
const { BpfLoaderUpgradeable } = require("@solana/web3.js");

// Configuration
const DEVNET_RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("EoVjmALZdkU3N9uehxVV4n9C6ukRa8QrbZRMHKBD2KUf");

console.log('🚀 Déploiement programme buyback avec support Token-2022');
console.log('==================================================\n');

// Chemins des fichiers
const programKeypairPath = path.join(__dirname, 'target/deploy/swapback_buyback-keypair.json');
const programSoPath = path.join(__dirname, 'target/deploy/swapback_buyback.so');

// Charger la keypair du programme
let programKeypair;
try {
  const keypairData = JSON.parse(fs.readFileSync(programKeypairPath, 'utf8'));
  programKeypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
  console.log('✅ Keypair du programme chargée');
  console.log(`   Pubkey: ${programKeypair.publicKey.toBase58()}`);
} catch (error) {
  console.error('❌ Erreur chargement keypair:', error.message);
  process.exit(1);
}

// Charger le bytecode
let programData;
try {
  programData = fs.readFileSync(programSoPath);
  console.log('✅ Bytecode chargé');
  console.log(`   Taille: ${programData.length} bytes`);
} catch (error) {
  console.error('❌ Erreur chargement bytecode:', error.message);
  process.exit(1);
}

async function deployProgram() {
  const connection = new Connection(DEVNET_RPC, "confirmed");

  // Charger le wallet authority
  const walletPath = path.join(require('os').homedir(), '.config/solana/id.json');
  let authority;
  try {
    const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
    authority = Keypair.fromSecretKey(new Uint8Array(walletData));
    console.log(`✅ Wallet authority: ${authority.publicKey.toBase58()}`);
  } catch (error) {
    console.error('❌ Erreur chargement wallet:', error.message);
    console.log('   Assurez-vous que ~/.config/solana/id.json existe');
    process.exit(1);
  }

  // Vérifier le solde
  const balance = await connection.getBalance(authority.publicKey);
  console.log(`💰 Solde: ${balance / 1e9} SOL`);

  if (balance < 5 * 1e9) {
    console.log('⚠️  Solde insuffisant. Il faut au moins 5 SOL pour le déploiement.');
    console.log('   Obtenez un airdrop: solana airdrop 5');
    process.exit(1);
  }

  // Vérifier si le programme existe déjà
  const programInfo = await connection.getAccountInfo(PROGRAM_ID);
  if (!programInfo) {
    console.log('❌ Programme non trouvé. Déploiement initial requis.');
    console.log('   Utilisez Solana CLI:');
    console.log(`   solana program deploy --program-id ${programKeypairPath} ${programSoPath}`);
    return;
  }

  console.log('✅ Programme trouvé, préparation mise à jour...');

  // Pour la mise à jour, nous avons besoin du ProgramData account
  // Calculer l'adresse du ProgramData account
  const [programDataAddress] = PublicKey.findProgramAddressSync(
    [PROGRAM_ID.toBuffer()],
    new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111")
  );

  console.log(`📍 ProgramData: ${programDataAddress.toBase58()}`);

  // Créer l'instruction de mise à jour
  const upgradeInstruction = {
    programId: new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111"),
    keys: [
      { pubkey: programDataAddress, isSigner: false, isWritable: true },
      { pubkey: PROGRAM_ID, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: false },
      { pubkey: new PublicKey("11111111111111111111111111111112"), isSigner: false, isWritable: false }, // Clock
      { pubkey: new PublicKey("SysvarRent111111111111111111111111111111111"), isSigner: false, isWritable: false }, // Rent
    ],
    data: Buffer.concat([
      Buffer.from([3]), // Upgrade instruction
      programData
    ])
  };

  const transaction = new Transaction().add(upgradeInstruction);

  console.log('\n📤 Envoi de la transaction de mise à jour...');

  try {
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [authority],
      {
        commitment: 'confirmed',
        skipPreflight: false
      }
    );

    console.log('✅ Déploiement réussi!');
    console.log(`   Signature: ${signature}`);
    console.log(`   Programme: ${PROGRAM_ID.toBase58()}`);
    console.log('\n🎯 Programme buyback maintenant compatible Token-2022!');

  } catch (error) {
    console.error('❌ Erreur déploiement:', error.message);

    if (error.message.includes('insufficient funds')) {
      console.log('\n💡 Solution: Obtenez plus de SOL');
      console.log('   solana airdrop 5');
    } else {
      console.log('\n💡 Alternative: Utilisez Solana CLI directement');
      console.log(`   solana program deploy --program-id ${programKeypairPath} ${programSoPath}`);
    }
  }
}

deployProgram().catch(console.error);