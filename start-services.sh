#!/bin/bash

# Script de démarrage pour SwapBack
# Lance l'Oracle API et l'application Next.js

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}======================================${NC}"
echo -e "${YELLOW}  SwapBack - Démarrage des Services  ${NC}"
echo -e "${YELLOW}======================================${NC}"
echo ""

# Fonction pour arrêter les services
cleanup() {
    echo ""
    echo -e "${YELLOW}Arrêt des services...${NC}"
    pkill -f "node dist/index.js" 2>/dev/null || true
    pkill -f "next dev" 2>/dev/null || true
    echo -e "${GREEN}Services arrêtés${NC}"
    exit 0
}

# Capturer Ctrl+C
trap cleanup SIGINT SIGTERM

# Arrêter les anciens processus
echo -e "${YELLOW}🧹 Nettoyage des anciens processus...${NC}"
pkill -f "node dist/index.js" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
sleep 2

# Démarrer l'Oracle API
echo -e "${YELLOW}🚀 Démarrage de l'Oracle API (port 3003)...${NC}"
cd /workspaces/SwapBack/oracle
npm run build > /dev/null 2>&1
nohup npm start > /tmp/oracle.log 2>&1 &
ORACLE_PID=$!
sleep 3

# Vérifier que l'Oracle est démarré
if wget -qO- --timeout=2 http://localhost:3003/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Oracle API démarré (PID: $ORACLE_PID)${NC}"
else
    echo -e "${RED}❌ Échec du démarrage de l'Oracle API${NC}"
    cat /tmp/oracle.log
    exit 1
fi

# Démarrer l'application Next.js
echo -e "${YELLOW}🚀 Démarrage de l'application Next.js (port 3000)...${NC}"
cd /workspaces/SwapBack/app
nohup npm run dev > /tmp/nextjs.log 2>&1 &
APP_PID=$!
sleep 5

# Vérifier que l'application est démarrée
if netstat -tlnp 2>/dev/null | grep -q ":3000"; then
    echo -e "${GREEN}✅ Application Next.js démarrée (PID: $APP_PID)${NC}"
else
    echo -e "${RED}❌ Échec du démarrage de l'application${NC}"
    tail -20 /tmp/nextjs.log
    exit 1
fi

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}    Tous les services sont prêts !   ${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "📊 ${YELLOW}Services:${NC}"
echo -e "   🔹 Oracle API:  http://localhost:3003"
echo -e "   🔹 Application: http://localhost:3000"
echo ""
echo -e "📝 ${YELLOW}Logs:${NC}"
echo -e "   🔹 Oracle:      tail -f /tmp/oracle.log"
echo -e "   🔹 Next.js:     tail -f /tmp/nextjs.log"
echo ""
echo -e "🛑 ${YELLOW}Pour arrêter: Ctrl+C${NC}"
echo ""

# Afficher les logs en temps réel (optionnel)
if [ "$1" == "--logs" ]; then
    echo -e "${YELLOW}📋 Affichage des logs (Ctrl+C pour arrêter)...${NC}"
    echo ""
    tail -f /tmp/oracle.log /tmp/nextjs.log
else
    # Garder le script actif
    echo -e "${YELLOW}✨ Services en cours d'exécution...${NC}"
    echo -e "${YELLOW}   Appuyez sur Ctrl+C pour arrêter${NC}"
    echo ""
    
    # Boucle infinie pour garder le script actif
    while true; do
        sleep 10
        # Vérifier que les services tournent toujours
        if ! kill -0 $ORACLE_PID 2>/dev/null; then
            echo -e "${RED}❌ Oracle API s'est arrêté !${NC}"
            cat /tmp/oracle.log
            exit 1
        fi
        if ! kill -0 $APP_PID 2>/dev/null; then
            echo -e "${RED}❌ Application Next.js s'est arrêtée !${NC}"
            tail -20 /tmp/nextjs.log
            exit 1
        fi
    done
fi
