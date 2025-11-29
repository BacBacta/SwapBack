#!/bin/bash

# Script de vérification de santé de l'application SwapBack
# Usage: ./check-health.sh

echo "🔍 Vérification de l'état de l'application SwapBack..."
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Vérifier si le serveur est en cours d'exécution
echo "📡 Vérification du processus Next.js..."
if pgrep -f "next-server" > /dev/null; then
    echo -e "${GREEN}✅ Serveur Next.js en cours d'exécution${NC}"
else
    echo -e "${RED}❌ Serveur Next.js non trouvé${NC}"
    echo -e "${YELLOW}💡 Démarrage du serveur...${NC}"
    cd /workspaces/SwapBack/app && npm run dev > /tmp/swapback.log 2>&1 &
    sleep 8
fi

echo ""

# 2. Tester les routes principales
echo "🌐 Test des routes HTTP..."

routes=("/" "/dca" "/dashboard" "/buyback")
all_ok=true

for route in "${routes[@]}"; do
    status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000${route})
    if [ "$status" = "200" ]; then
        echo -e "${GREEN}✅${NC} http://localhost:3000${route} - Status: ${status}"
    else
        echo -e "${RED}❌${NC} http://localhost:3000${route} - Status: ${status}"
        all_ok=false
    fi
done

echo ""

# 3. Vérifier les logs pour les erreurs récentes
echo "📋 Vérification des logs..."
if [ -f "/tmp/swapback.log" ]; then
    error_count=$(tail -50 /tmp/swapback.log | grep -ciE "error|fail" || true)
    if [ "$error_count" -eq 0 ]; then
        echo -e "${GREEN}✅ Aucune erreur dans les 50 dernières lignes de logs${NC}"
    else
        echo -e "${YELLOW}⚠️  ${error_count} erreur(s) trouvée(s) dans les logs récents${NC}"
        echo -e "${YELLOW}   Consultez /tmp/swapback.log pour plus de détails${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Fichier de log non trouvé${NC}"
fi

echo ""

# 4. Résumé
echo "================================================"
if [ "$all_ok" = true ]; then
    echo -e "${GREEN}✅ APPLICATION OPÉRATIONNELLE${NC}"
    echo ""
    echo "🌐 Accès:"
    echo "   - Page d'accueil: http://localhost:3000"
    echo "   - DCA: http://localhost:3000/dca"
    echo "   - Dashboard: http://localhost:3000/dashboard"
    echo "   - Buyback: http://localhost:3000/buyback"
else
    echo -e "${RED}❌ PROBLÈMES DÉTECTÉS${NC}"
    echo "   Consultez les messages ci-dessus pour plus de détails"
fi
echo "================================================"
