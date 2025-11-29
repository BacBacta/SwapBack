#!/bin/bash
# Script de commit automatique avec configuration sécurisée

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "╔════════════════════════════════════════════════════════════╗"
echo "║              GIT COMMIT & PUSH - SwapBack                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Configurer Git localement pour éviter les problèmes GPG
echo -e "${YELLOW}🔧 Configuration Git locale...${NC}"
git config --local commit.gpgsign false
git config --local user.name "Cyrille Tsannang"
git config --local user.email "tsannangcyrille@gmail.com"
echo -e "${GREEN}✅ Configuration appliquée${NC}"
echo ""

# Afficher le statut
echo -e "${YELLOW}📊 Statut des fichiers:${NC}"
git status --short
echo ""

# Demander le message de commit si non fourni
if [ -z "$1" ]; then
    echo -e "${YELLOW}📝 Message de commit:${NC}"
    read -p "> " COMMIT_MSG
else
    COMMIT_MSG="$1"
fi

if [ -z "$COMMIT_MSG" ]; then
    echo -e "${YELLOW}⚠️  Message vide - utilisation d'un message par défaut${NC}"
    COMMIT_MSG="chore: update files $(date +%Y-%m-%d)"
fi

# Ajouter tous les fichiers
echo ""
echo -e "${YELLOW}📦 Ajout des fichiers...${NC}"
git add -A

# Commiter
echo -e "${YELLOW}💾 Commit en cours...${NC}"
if git commit -m "$COMMIT_MSG" --no-gpg-sign; then
    echo -e "${GREEN}✅ Commit réussi${NC}"
    
    # Pousser vers GitHub
    echo ""
    echo -e "${YELLOW}🚀 Push vers GitHub...${NC}"
    if git push origin main; then
        echo -e "${GREEN}✅ Push réussi !${NC}"
        echo ""
        echo "╔════════════════════════════════════════════════════════════╗"
        echo "║          ✅ COMMIT & PUSH RÉUSSIS !                       ║"
        echo "╚════════════════════════════════════════════════════════════╝"
    else
        echo -e "${YELLOW}⚠️  Push échoué - vérifiez votre connexion${NC}"
        echo "Vous pouvez pousser manuellement avec: git push origin main"
    fi
else
    echo -e "${YELLOW}⚠️  Commit échoué${NC}"
    echo "Détails de l'erreur ci-dessus"
    exit 1
fi
