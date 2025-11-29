#!/usr/bin/env bash
set -e

echo "🚀 RECONSTRUCTION COMPLETE DU PROGRAMME LOCK/UNLOCK"
echo "=================================================="
echo ""

# Couleurs pour le terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Étape 1: Générer une nouvelle keypair pour le programme
echo -e "${BLUE}📝 Étape 1/6: Génération d'une nouvelle keypair...${NC}"
if [ ! -d "target/deploy" ]; then
    mkdir -p target/deploy
fi

# Générer la keypair (force overwrite si existe)
solana-keygen new --no-bip39-passphrase -o target/deploy/swapback_cnft-keypair.json --force

# Extraire le program ID
NEW_PROGRAM_ID=$(solana-keygen pubkey target/deploy/swapback_cnft-keypair.json)
echo -e "${GREEN}✅ Nouvelle keypair générée${NC}"
echo -e "${YELLOW}📌 Nouveau Program ID: ${NEW_PROGRAM_ID}${NC}"
echo ""

# Étape 2: Mettre à jour declare_id! dans lib.rs
echo -e "${BLUE}📝 Étape 2/6: Mise à jour du declare_id! dans lib.rs...${NC}"
sed -i "s/declare_id!(\"[^\"]*\")/declare_id!(\"${NEW_PROGRAM_ID}\")/" programs/swapback_cnft/src/lib.rs
echo -e "${GREEN}✅ declare_id! mis à jour avec: ${NEW_PROGRAM_ID}${NC}"
echo ""

# Étape 3: Mettre à jour Anchor.toml
echo -e "${BLUE}📝 Étape 3/6: Mise à jour d'Anchor.toml...${NC}"
# Sauvegarder l'ancien Anchor.toml
cp Anchor.toml Anchor.toml.backup-$(date +%Y%m%d-%H%M%S)

# Mettre à jour le program ID pour devnet
sed -i "/\[programs.devnet\]/,/swapback_cnft/ s/swapback_cnft = \"[^\"]*\"/swapback_cnft = \"${NEW_PROGRAM_ID}\"/" Anchor.toml

echo -e "${GREEN}✅ Anchor.toml mis à jour${NC}"
echo ""

# Étape 4: Build le programme
echo -e "${BLUE}📝 Étape 4/6: Build du programme...${NC}"
echo -e "${YELLOW}⏳ Cela peut prendre quelques minutes...${NC}"

# Utiliser les optimisations pour éviter les problèmes de mémoire
export TMPDIR=/tmp
export CARGO_TARGET_DIR=/tmp/cargo-target
export RUSTFLAGS='-C target-cpu=generic -C opt-level=1'

anchor build --program-name swapback_cnft

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build réussi!${NC}"
else
    echo -e "${RED}❌ Erreur lors du build${NC}"
    exit 1
fi
echo ""

# Étape 5: Vérifier la configuration Solana
echo -e "${BLUE}📝 Étape 5/6: Vérification de la configuration Solana...${NC}"
solana config get
echo ""

# Vérifier le solde du wallet
BALANCE=$(solana balance)
echo -e "${YELLOW}💰 Solde du wallet: ${BALANCE}${NC}"

# Avertir si le solde est faible
BALANCE_LAMPORTS=$(solana balance --lamports)
if [ "$BALANCE_LAMPORTS" -lt 1000000000 ]; then
    echo -e "${RED}⚠️  Solde faible! Vous aurez besoin d'au moins 1 SOL pour déployer.${NC}"
    echo -e "${YELLOW}📥 Pour obtenir des SOL devnet: solana airdrop 2${NC}"
fi
echo ""

# Étape 6: Déploiement sur devnet
echo -e "${BLUE}📝 Étape 6/6: Déploiement sur devnet...${NC}"
echo -e "${YELLOW}🚀 Déploiement en cours...${NC}"

anchor deploy --provider.cluster devnet --program-name swapback_cnft

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║           ✅ DÉPLOIEMENT RÉUSSI! ✅                        ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}📌 Nouveau Program ID:${NC} ${NEW_PROGRAM_ID}"
    echo ""
    echo -e "${BLUE}📋 PROCHAINES ÉTAPES:${NC}"
    echo ""
    echo "1️⃣  Mettre à jour le frontend avec le nouveau Program ID:"
    echo "   - app/src/config/testnet.ts"
    echo "   - app/src/config/constants.ts"
    echo "   - app/src/config/tokens.ts"
    echo "   - app/src/lib/validateEnv.ts"
    echo ""
    echo "2️⃣  Initialiser les comptes du programme:"
    echo "   anchor run init-cnft --provider.cluster devnet"
    echo ""
    echo "3️⃣  Tester la fonctionnalité lock/unlock:"
    echo "   anchor test --provider.cluster devnet"
    echo ""
    echo -e "${GREEN}🎉 Programme cNFT reconstruit et déployé avec succès!${NC}"
else
    echo -e "${RED}❌ Erreur lors du déploiement${NC}"
    echo ""
    echo -e "${YELLOW}💡 Solutions possibles:${NC}"
    echo "- Vérifier votre solde: solana balance"
    echo "- Obtenir des SOL devnet: solana airdrop 2"
    echo "- Vérifier la configuration: solana config get"
    exit 1
fi
