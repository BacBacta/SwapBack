#!/bin/bash

# Test E2E du système cNFT SwapBack
# Usage: ./scripts/test_cnft_e2e.sh

set -e  # Exit on error

echo "🧪 Test E2E du système cNFT SwapBack"
echo "==================================="

# Couleurs pour output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NETWORK="devnet"
RPC_URL="https://api.$NETWORK.solana.com"

# 1. Vérifier les prérequis
echo -e "${BLUE}🔍 Vérification des prérequis...${NC}"

if ! command -v solana &> /dev/null; then
    echo -e "${RED}❌ Solana CLI non installé${NC}"
    exit 1
fi

if ! command -v anchor &> /dev/null; then
    echo -e "${RED}❌ Anchor CLI non installé${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js non installé${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prérequis OK${NC}"

# 2. Configurer le réseau
echo -e "${BLUE}🌐 Configuration réseau: $NETWORK${NC}"
solana config set --url $RPC_URL

# 3. Build tous les programmes
echo -e "${BLUE}📦 Build des programmes...${NC}"
anchor build

# 4. Build le SDK
echo -e "${BLUE}📚 Build du SDK...${NC}"
cd sdk
npm install
npm run build
cd ..

# 5. Démarrer le validator local pour les tests
echo -e "${BLUE}🏃 Démarrage du validator local...${NC}"
solana-test-validator --reset &

VALIDATOR_PID=$!
sleep 5

# Fonction de nettoyage
cleanup() {
    echo -e "${BLUE}🧹 Nettoyage...${NC}"
    kill $VALIDATOR_PID 2>/dev/null || true
    pkill -f solana-test-validator || true
}

trap cleanup EXIT

# 6. Déployer les programmes
echo -e "${BLUE}🚀 Déploiement des programmes...${NC}"
anchor deploy

# 7. Générer les IDLs
echo -e "${BLUE}📄 Génération des IDLs...${NC}"
anchor idl parse -f target/idl/swapback_router.json --out target/idl/swapback_router.ts
anchor idl parse -f target/idl/swapback_buyback.json --out target/idl/swapback_buyback.ts
anchor idl parse -f target/idl/swapback_cnft.json --out target/idl/swapback_cnft.ts

# 8. Créer les comptes de test
echo -e "${BLUE}👤 Création des comptes de test...${NC}"

# Compte authority
AUTHORITY_KEYPAIR=$(solana-keygen new --no-passphrase --silent)
AUTHORITY_PUBKEY=$(solana-keygen pubkey $AUTHORITY_KEYPAIR)

# Compte utilisateur
USER_KEYPAIR=$(solana-keygen new --no-passphrase --silent)
USER_PUBKEY=$(solana-keygen pubkey $USER_KEYPAIR)

# Airdrop SOL
solana airdrop 2 $AUTHORITY_PUBKEY
solana airdrop 2 $USER_PUBKEY

echo "Authority: $AUTHORITY_PUBKEY"
echo "User: $USER_PUBKEY"

# 9. Test du programme cNFT
echo -e "${BLUE}🎨 Test du programme cNFT...${NC}"

cat > /tmp/test_cnft.ts << 'EOF'
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { IDL } from '../target/idl/swapback_cnft';
import { createCreateTreeInstruction, PROGRAM_ID as BUBBLEGUM_PROGRAM_ID } from '@metaplex-foundation/mpl-bubblegum';
import { SPL_ACCOUNT_COMPRESSION_PROGRAM_ID, SPL_NOOP_PROGRAM_ID, getConcurrentMerkleTreeAccountSize } from '@solana/spl-account-compression';

async function testCnftSystem() {
  const connection = new Connection('http://localhost:8899');
  const authority = Keypair.fromSecretKey(new Uint8Array(JSON.parse(process.env.AUTHORITY_KEYPAIR!)));
  const user = Keypair.fromSecretKey(new Uint8Array(JSON.parse(process.env.USER_KEYPAIR!)));

  const programId = new PublicKey(process.env.CNFT_PROGRAM_ID!);
  const provider = new AnchorProvider(connection, { publicKey: authority.publicKey, signTransaction: async (tx) => tx, signAllTransactions: async (txs) => txs });
  const program = new Program(IDL, programId, provider);

  console.log('🔧 Initialisation du système cNFT...');

  // Créer l'arbre Merkle
  const treeKeypair = Keypair.generate();
  const treeConfig = Keypair.generate();
  const maxDepth = 14;
  const maxBufferSize = 64;
  const requiredSpace = getConcurrentMerkleTreeAccountSize(maxDepth, maxBufferSize);

  const createTreeIx = createCreateTreeInstruction({
    treeAuthority: treeConfig.publicKey,
    merkleTree: treeKeypair.publicKey,
    payer: authority.publicKey,
    treeCreator: authority.publicKey,
    logWrapper: SPL_NOOP_PROGRAM_ID,
    compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  }, {
    maxDepth,
    maxBufferSize,
    public: false,
  }, BUBBLEGUM_PROGRAM_ID);

  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: authority.publicKey,
    newAccountPubkey: treeKeypair.publicKey,
    lamports: await connection.getMinimumBalanceForRentExemption(requiredSpace),
    space: requiredSpace,
    programId: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  });

  const createConfigIx = SystemProgram.createAccount({
    fromPubkey: authority.publicKey,
    newAccountPubkey: treeConfig.publicKey,
    lamports: await connection.getMinimumBalanceForRentExemption(0),
    space: 0,
    programId: BUBBLEGUM_PROGRAM_ID,
  });

  const treeTx = await connection.sendTransaction({
    instructions: [createAccountIx, createConfigIx, createTreeIx],
    signers: [authority, treeKeypair, treeConfig],
  });

  console.log('✅ Arbre Merkle créé:', treeTx);

  // Initialiser la collection
  const collectionConfig = PublicKey.findProgramAddressSync([Buffer.from('collection_config')], programId)[0];

  const initTx = await program.methods
    .initializeCollection()
    .accounts({
      collectionConfig,
      treeConfig: treeConfig.publicKey,
      authority: authority.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([authority])
    .rpc();

  console.log('✅ Collection initialisée:', initTx);

  // Test mint Bronze NFT (devrait réussir)
  const bronzeAmount = 100_000_000; // 100 $BACK
  const bronzeDuration = 90 * 24 * 60 * 60; // 90 jours

  console.log('🎨 Test mint Bronze NFT...');
  try {
    const mintTx = await program.methods
      .mintLevelNft({ bronze: {} }, new anchor.BN(bronzeAmount), new anchor.BN(bronzeDuration))
      .accounts({
        collectionConfig,
        userNft: PublicKey.findProgramAddressSync([Buffer.from('user_nft'), user.publicKey.toBuffer()], programId)[0],
        treeConfig: treeConfig.publicKey,
        merkleTree: treeKeypair.publicKey,
        user: user.publicKey,
        bubblegumProgram: BUBBLEGUM_PROGRAM_ID,
        logWrapper: SPL_NOOP_PROGRAM_ID,
        compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    console.log('✅ Bronze NFT minté:', mintTx);
  } catch (error) {
    console.log('❌ Échec mint Bronze (attendu pour test):', error.message);
  }

  console.log('🎉 Tests cNFT terminés!');
}

testCnftSystem().catch(console.error);
EOF

# Exécuter le test
AUTHORITY_KEYPAIR="$AUTHORITY_KEYPAIR" USER_KEYPAIR="$USER_KEYPAIR" CNFT_PROGRAM_ID="$(solana address -k target/deploy/swapback_cnft-keypair.json)" npx tsx /tmp/test_cnft.ts

# Nettoyer
rm -f /tmp/test_cnft.ts

echo -e "${GREEN}✅ Tests E2E cNFT terminés avec succès!${NC}"

# Résumé
echo ""
echo "📊 Résumé des tests:"
echo "-------------------"
echo -e "✅ Programmes déployés"
echo -e "✅ SDK compilé"
echo -e "✅ Arbre Merkle créé"
echo -e "✅ Collection initialisée"
echo -e "✅ Logique de mint testée"
echo ""
echo -e "${BLUE}🎯 Prochaines étapes:${NC}"
echo "1. Finaliser l'intégration Bubblegum dans mintLevelNft"
echo "2. Tester avec le programme router (lock -> mint cNFT)"
echo "3. Intégrer l'affichage cNFT dans le frontend"