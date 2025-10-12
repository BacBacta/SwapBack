#!/bin/bash

# Script de déploiement du programme cNFT SwapBack
# Usage: ./scripts/deploy_cnft.sh [devnet|mainnet]

set -e  # Exit on error

NETWORK=${1:-devnet}

echo "🚀 Déploiement du programme cNFT SwapBack sur $NETWORK..."

# Couleurs pour output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier que Solana CLI est installé
if ! command -v solana &> /dev/null; then
    echo -e "${RED}❌ Solana CLI n'est pas installé${NC}"
    exit 1
fi

# Configurer le réseau
echo -e "${BLUE}🌐 Configuration du réseau: $NETWORK${NC}"
solana config set --url https://api.$NETWORK.solana.com

# Vérifier le solde
BALANCE=$(solana balance | awk '{print $1}')
echo -e "${BLUE}💰 Solde actuel: $BALANCE SOL${NC}"

REQUIRED_SOL=3  # ~2 SOL pour déploiement + 1 SOL pour l'arbre Merkle
if (( $(echo "$BALANCE < $REQUIRED_SOL" | bc -l) )); then
    echo -e "${RED}❌ Solde insuffisant. Besoin de $REQUIRED_SOL SOL minimum${NC}"
    echo -e "${YELLOW}💡 Obtenez des SOL sur https://faucet.solana.com ($NETWORK)${NC}"
    exit 1
fi

# 1. Build le programme cNFT
echo -e "${BLUE}📦 Build du programme cNFT...${NC}"
anchor build --program-name swapback_cnft

# 2. Déployer le programme
echo -e "${BLUE}🚀 Déploiement du programme cNFT...${NC}"
anchor deploy --program-name swapback_cnft --provider.cluster $NETWORK

# Récupérer l'adresse du programme déployé
CNFT_PROGRAM_ID=$(solana address -k target/deploy/swapback_cnft-keypair.json)
echo -e "${GREEN}✅ Programme cNFT déployé: $CNFT_PROGRAM_ID${NC}"

# 3. Mettre à jour Anchor.toml avec la vraie adresse
echo -e "${BLUE}📝 Mise à jour d'Anchor.toml...${NC}"
sed -i.bak "s/swapback_cnft = \".*\"/swapback_cnft = \"$CNFT_PROGRAM_ID\"/" Anchor.toml

# 4. Créer l'arbre Merkle pour les cNFTs
echo -e "${BLUE}🌳 Création de l'arbre Merkle pour les cNFTs...${NC}"

# Créer un script temporaire pour initialiser l'arbre
cat > /tmp/init_cnft_tree.ts << 'EOF'
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { createCreateTreeInstruction, PROGRAM_ID as BUBBLEGUM_PROGRAM_ID } from '@metaplex-foundation/mpl-bubblegum';
import { SPL_ACCOUNT_COMPRESSION_PROGRAM_ID, SPL_NOOP_PROGRAM_ID, getConcurrentMerkleTreeAccountSize } from '@solana/spl-account-compression';
import { sendAndConfirmTransaction } from '@solana/web3.js';

async function createMerkleTree() {
  const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com');
  const payer = Keypair.fromSecretKey(new Uint8Array(JSON.parse(process.env.PRIVATE_KEY!)));

  const treeKeypair = Keypair.generate();
  const treeConfig = Keypair.generate();

  const maxDepth = 14;
  const maxBufferSize = 64;
  const requiredSpace = getConcurrentMerkleTreeAccountSize(maxDepth, maxBufferSize);

  console.log(`Création de l'arbre Merkle: ${treeKeypair.publicKey.toString()}`);

  const createTreeIx = createCreateTreeInstruction({
    treeAuthority: treeConfig.publicKey,
    merkleTree: treeKeypair.publicKey,
    payer: payer.publicKey,
    treeCreator: payer.publicKey,
    logWrapper: SPL_NOOP_PROGRAM_ID,
    compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  }, {
    maxDepth,
    maxBufferSize,
    public: false,
  }, BUBBLEGUM_PROGRAM_ID);

  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: treeKeypair.publicKey,
    lamports: await connection.getMinimumBalanceForRentExemption(requiredSpace),
    space: requiredSpace,
    programId: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  });

  const createConfigIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: treeConfig.publicKey,
    lamports: await connection.getMinimumBalanceForRentExemption(0),
    space: 0,
    programId: BUBBLEGUM_PROGRAM_ID,
  });

  const tx = await sendAndConfirmTransaction(connection, {
    instructions: [createAccountIx, createConfigIx, createTreeIx],
    signers: [payer, treeKeypair, treeConfig],
  });

  console.log(`Arbre Merkle créé: ${tx}`);
  console.log(`Adresse de l'arbre: ${treeKeypair.publicKey.toString()}`);
  console.log(`Config de l'arbre: ${treeConfig.publicKey.toString()}`);

  // Sauvegarder les adresses
  require('fs').writeFileSync('/tmp/cnft_tree_config.json', JSON.stringify({
    treeAddress: treeKeypair.publicKey.toString(),
    treeConfig: treeConfig.publicKey.toString(),
  }));
}

createMerkleTree().catch(console.error);
EOF

# Exécuter le script d'initialisation
echo -e "${BLUE}⚙️  Initialisation de l'arbre Merkle...${NC}"
PRIVATE_KEY=$(solana-keygen pubkey ~/.config/solana/id.json) npx tsx /tmp/init_cnft_tree.ts

# Récupérer les adresses de l'arbre
TREE_CONFIG=$(cat /tmp/cnft_tree_config.json)
TREE_ADDRESS=$(echo $TREE_CONFIG | jq -r '.treeAddress')
TREE_CONFIG_ADDR=$(echo $TREE_CONFIG | jq -r '.treeConfig')

echo -e "${GREEN}✅ Arbre Merkle créé${NC}"
echo -e "Adresse de l'arbre: ${TREE_ADDRESS}"
echo -e "Config de l'arbre: ${TREE_CONFIG_ADDR}"

# 5. Initialiser la collection cNFT
echo -e "${BLUE}🎨 Initialisation de la collection cNFT...${NC}"

cat > /tmp/init_cnft_collection.ts << 'EOF'
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { IDL } from '../target/idl/swapback_cnft';

async function initializeCollection() {
  const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com');
  const payer = Keypair.fromSecretKey(new Uint8Array(JSON.parse(process.env.PRIVATE_KEY!)));

  const programId = new PublicKey(process.env.CNFT_PROGRAM_ID!);
  const provider = new AnchorProvider(connection, { publicKey: payer.publicKey, signTransaction: async (tx) => tx, signAllTransactions: async (txs) => txs });
  const program = new Program(IDL, programId, provider);

  const treeConfig = new PublicKey(process.env.TREE_CONFIG!);

  const tx = await program.methods
    .initializeCollection()
    .accounts({
      collectionConfig: PublicKey.findProgramAddressSync([Buffer.from('collection_config')], programId)[0],
      treeConfig,
      authority: payer.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([payer])
    .rpc();

  console.log(`Collection cNFT initialisée: ${tx}`);
}

initializeCollection().catch(console.error);
EOF

# Exécuter l'initialisation de la collection
CNFT_PROGRAM_ID=$CNFT_PROGRAM_ID TREE_CONFIG=$TREE_CONFIG_ADDR npx tsx /tmp/init_cnft_collection.ts

echo -e "${GREEN}✅ Collection cNFT initialisée${NC}"

# Nettoyer les fichiers temporaires
rm -f /tmp/init_cnft_tree.ts /tmp/init_cnft_collection.ts /tmp/cnft_tree_config.json

echo ""
echo -e "${GREEN}🎉 Déploiement cNFT terminé avec succès!${NC}"
echo ""
echo "Résumé:"
echo "--------"
echo -e "Programme cNFT: ${GREEN}$CNFT_PROGRAM_ID${NC}"
echo -e "Arbre Merkle:   ${GREEN}$TREE_ADDRESS${NC}"
echo -e "Config Arbre:   ${GREEN}$TREE_CONFIG_ADDR${NC}"
echo ""
echo -e "${BLUE}Prochaines étapes:${NC}"
echo "1. Mettre à jour le frontend avec les nouvelles adresses"
echo "2. Tester le mint des cNFTs"
echo "3. Intégrer le système de lock/unlock avec les cNFTs"