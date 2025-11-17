#!/bin/bash
# Script de redéploiement complet du programme CNFT avec nouveau GlobalState

set -e

echo ""
echo "🚀 Redéploiement CNFT avec nouveau GlobalState"
echo "=============================================="
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier le solde
echo "💰 Vérification du solde..."
BALANCE=$(solana balance --url devnet 2>/dev/null | grep -oP '\d+\.\d+' || echo "0")
echo "Solde actuel: $BALANCE SOL"

if (( $(echo "$BALANCE < 0.5" | bc -l) )); then
    echo -e "${YELLOW}⚠️  Solde insuffisant. Demande d'airdrop...${NC}"
    solana airdrop 1 --url devnet || {
        echo -e "${RED}❌ Échec de l'airdrop. Réessayez manuellement:${NC}"
        echo "   solana airdrop 1 --url devnet"
        exit 1
    }
    echo -e "${GREEN}✅ Airdrop reçu!${NC}"
fi

# Étape 1: Build
echo ""
echo "🔨 Étape 1/5: Build du programme..."
anchor build || {
    echo -e "${RED}❌ Échec du build${NC}"
    exit 1
}
echo -e "${GREEN}✅ Build réussi${NC}"

# Étape 2: Fermer l'ancien IDL (peut échouer si déjà fermé)
echo ""
echo "🗑️  Étape 2/5: Fermeture de l'ancien IDL..."
anchor idl close --provider.cluster devnet --program-id GEkXCcq87yUjQSp5EqcWf7bw9GKrB39A1LWdsE7V3V2E 2>/dev/null && {
    echo -e "${GREEN}✅ IDL fermé${NC}"
} || {
    echo -e "${YELLOW}⚠️  Aucun IDL à fermer (ou déjà fermé)${NC}"
}

# Étape 3: Deploy
echo ""
echo "📤 Étape 3/5: Déploiement du programme..."
DEPLOY_OUTPUT=$(anchor deploy --provider.cluster devnet 2>&1) || {
    echo -e "${RED}❌ Échec du déploiement${NC}"
    echo "$DEPLOY_OUTPUT"
    exit 1
}

echo "$DEPLOY_OUTPUT"

# Extraire le program ID (si changé)
NEW_PROGRAM_ID=$(echo "$DEPLOY_OUTPUT" | grep -oP 'Program Id: \K[A-Za-z0-9]+' || echo "GEkXCcq87yUjQSp5EqcWf7bw9GKrB39A1LWdsE7V3V2E")
echo -e "${GREEN}✅ Programme déployé: $NEW_PROGRAM_ID${NC}"

# Vérifier si le program ID a changé
if [ "$NEW_PROGRAM_ID" != "GEkXCcq87yUjQSp5EqcWf7bw9GKrB39A1LWdsE7V3V2E" ]; then
    echo -e "${YELLOW}⚠️  ATTENTION: Le Program ID a changé!${NC}"
    echo "   Ancien: GEkXCcq87yUjQSp5EqcWf7bw9GKrB39A1LWdsE7V3V2E"
    echo "   Nouveau: $NEW_PROGRAM_ID"
    echo ""
    echo "   Mettez à jour NEXT_PUBLIC_CNFT_PROGRAM_ID dans:"
    echo "   - app/.env.local"
    echo "   - Vercel environment variables"
    echo ""
    export NEXT_PUBLIC_CNFT_PROGRAM_ID=$NEW_PROGRAM_ID
fi

# Étape 4: Upload IDL
echo ""
echo "📝 Étape 4/5: Upload de l'IDL..."
anchor idl init --filepath target/idl/swapback_cnft.json --provider.cluster devnet $NEW_PROGRAM_ID 2>&1 || {
    echo -e "${YELLOW}⚠️  IDL init échoué, tentative d'upgrade...${NC}"
    anchor idl upgrade --filepath target/idl/swapback_cnft.json --provider.cluster devnet $NEW_PROGRAM_ID || {
        echo -e "${RED}❌ Échec de l'upload IDL${NC}"
    }
}
echo -e "${GREEN}✅ IDL uploadé${NC}"

# Étape 5: Initialiser GlobalState
echo ""
echo "🔧 Étape 5/5: Initialisation du GlobalState..."

# Vérifier que le script existe
if [ ! -f "scripts/reinit-cnft-globalstate.js" ]; then
    echo -e "${RED}❌ Script reinit-cnft-globalstate.js introuvable${NC}"
    exit 1
fi

# Exécuter avec le bon program ID
NEXT_PUBLIC_CNFT_PROGRAM_ID=$NEW_PROGRAM_ID node scripts/reinit-cnft-globalstate.js || {
    echo -e "${RED}❌ Échec de l'initialisation GlobalState${NC}"
    echo ""
    echo "💡 Vérifiez:"
    echo "   1. Vous avez assez de SOL (solana airdrop 1 --url devnet)"
    echo "   2. Le wallet est correct (~/.config/solana/id.json)"
    echo "   3. Les variables d'environnement (SWAPBACK_*_WALLET)"
    exit 1
}

echo ""
echo -e "${GREEN}✅ Initialisation réussie!${NC}"

# Vérification finale
echo ""
echo "🔍 Vérification finale..."
node scripts/diagnose-globalstate.js

echo ""
echo "=============================================="
echo -e "${GREEN}🎉 Redéploiement terminé avec succès!${NC}"
echo "=============================================="
echo ""
echo "📋 Prochaines étapes:"
echo "   1. Testez le lock/unlock via l'interface web"
echo "   2. Vérifiez que la pénalité de 2% fonctionne"
echo "   3. Testez le claim NPI (si implémenté)"
echo ""
echo "🔗 Explorer: https://explorer.solana.com/address/$NEW_PROGRAM_ID?cluster=devnet"
echo ""
