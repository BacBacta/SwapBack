#!/bin/bash
# 📊 Script de monitoring en temps réel - Stabilité Codespaces
# Permet de vérifier que les déconnexions ont cessé

echo "📊 MONITORING STABILITÉ CODESPACES"
echo "=================================="
echo ""
echo "ℹ️  Appuyez sur Ctrl+C pour arrêter"
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Compteurs
ITERATION=0
CRITICAL_ALERTS=0
WARNING_ALERTS=0

# Boucle de monitoring
while true; do
    ITERATION=$((ITERATION + 1))
    TIMESTAMP=$(date '+%H:%M:%S')
    
    # Effacer l'écran
    clear
    
    echo -e "${BLUE}📊 MONITORING STABILITÉ CODESPACES - Itération $ITERATION${NC}"
    echo -e "${BLUE}Heure: $TIMESTAMP${NC}"
    echo "=================================="
    echo ""
    
    # 1. Mémoire
    TOTAL_MEM=$(free -m | awk 'NR==2 {print $2}')
    USED_MEM=$(free -m | awk 'NR==2 {print $3}')
    FREE_MEM=$(free -m | awk 'NR==2 {print $4}')
    MEM_PERCENT=$((USED_MEM * 100 / TOTAL_MEM))
    
    echo "1️⃣ MÉMOIRE"
    printf "   %s / %sMB (" "$USED_MEM" "$TOTAL_MEM"
    
    if [ "$MEM_PERCENT" -gt 85 ]; then
        echo -e "${RED}${MEM_PERCENT}% - CRITIQUE${NC})"
        CRITICAL_ALERTS=$((CRITICAL_ALERTS + 1))
    elif [ "$MEM_PERCENT" -gt 70 ]; then
        echo -e "${YELLOW}${MEM_PERCENT}% - ATTENTION${NC})"
        WARNING_ALERTS=$((WARNING_ALERTS + 1))
    else
        echo -e "${GREEN}${MEM_PERCENT}% - OK${NC})"
    fi
    
    # Graphique de mémoire (ASCII)
    MEM_BAR=$(printf '█%.0s' $(seq 1 $((MEM_PERCENT / 5))))
    MEM_EMPTY=$(printf '░%.0s' $(seq 1 $((20 - MEM_PERCENT / 5))))
    echo "   [$MEM_BAR$MEM_EMPTY] $MEM_PERCENT%"
    echo ""
    
    # 2. Disque
    DISK_USAGE=$(df /workspaces | tail -1 | awk '{print $5}' | sed 's/%//')
    DISK_USED=$(df /workspaces | tail -1 | awk '{print $3}')
    DISK_TOTAL=$(df /workspaces | tail -1 | awk '{print $2}')
    
    echo "2️⃣ DISQUE"
    printf "   %sMB / %sMB (" "$DISK_USED" "$DISK_TOTAL"
    
    if [ "$DISK_USAGE" -gt 90 ]; then
        echo -e "${RED}${DISK_USAGE}% - CRITIQUE${NC})"
        CRITICAL_ALERTS=$((CRITICAL_ALERTS + 1))
    elif [ "$DISK_USAGE" -gt 80 ]; then
        echo -e "${YELLOW}${DISK_USAGE}% - ATTENTION${NC})"
        WARNING_ALERTS=$((WARNING_ALERTS + 1))
    else
        echo -e "${GREEN}${DISK_USAGE}% - OK${NC})"
    fi
    
    DISK_BAR=$(printf '█%.0s' $(seq 1 $((DISK_USAGE / 5))))
    DISK_EMPTY=$(printf '░%.0s' $(seq 1 $((20 - DISK_USAGE / 5))))
    echo "   [$DISK_BAR$DISK_EMPTY] $DISK_USAGE%"
    echo ""
    
    # 3. Keepalive
    echo "3️⃣ KEEPALIVE"
    if [ -f /tmp/codespaces-keepalive.pid ]; then
        PID=$(cat /tmp/codespaces-keepalive.pid)
        if ps -p "$PID" > /dev/null 2>&1; then
            echo -e "   ${GREEN}✓ Actif (PID: $PID)${NC}"
            LAST_PING=$(tail -1 /tmp/codespaces-keepalive.log 2>/dev/null | grep -oP '\[\K[^\]]+' || echo "N/A")
            echo "   Dernier ping: $LAST_PING"
        else
            echo -e "   ${RED}✗ Inactif (PID mort)${NC}"
            CRITICAL_ALERTS=$((CRITICAL_ALERTS + 1))
        fi
    else
        echo -e "   ${RED}✗ Non trouvé${NC}"
        CRITICAL_ALERTS=$((CRITICAL_ALERTS + 1))
    fi
    echo ""
    
    # 4. Variables gRPC
    echo "4️⃣ VARIABLES gRPC"
    if [ -z "$GRPC_VERBOSITY" ]; then
        echo -e "   ${RED}✗ GRPC_VERBOSITY non défini${NC}"
        WARNING_ALERTS=$((WARNING_ALERTS + 1))
    else
        echo -e "   ${GREEN}✓ GRPC_VERBOSITY=$GRPC_VERBOSITY${NC}"
    fi
    
    if [ -z "$GRPC_DNS_RESOLVER" ]; then
        echo -e "   ${RED}✗ GRPC_DNS_RESOLVER non défini${NC}"
        WARNING_ALERTS=$((WARNING_ALERTS + 1))
    else
        echo -e "   ${GREEN}✓ GRPC_DNS_RESOLVER=$GRPC_DNS_RESOLVER${NC}"
    fi
    echo ""
    
    # 5. Processus lourds
    echo "5️⃣ TOP 3 PROCESSUS GOURMANDS"
    ps aux --sort=-%mem | head -4 | tail -3 | awk '{printf "   %s: %.1f%% (%sMB)\n", $11, $4, int($6/1024)}'
    echo ""
    
    # 6. État du réseau
    echo "6️⃣ CONNECTIVITÉ"
    if curl -s -m 2 https://github.com > /dev/null 2>&1; then
        echo -e "   ${GREEN}✓ GitHub accessible${NC}"
    else
        echo -e "   ${RED}✗ GitHub inaccessible${NC}"
        WARNING_ALERTS=$((WARNING_ALERTS + 1))
    fi
    echo ""
    
    # Résumé alertes
    echo "=================================="
    echo -e "RÉSUMÉ: ${RED}Critiques: $CRITICAL_ALERTS${NC} | ${YELLOW}Avertissements: $WARNING_ALERTS${NC}"
    
    # Recommandations
    if [ "$CRITICAL_ALERTS" -gt 0 ]; then
        echo ""
        echo -e "${RED}⚠️  ALERTES CRITIQUES!${NC}"
        if [ "$MEM_PERCENT" -gt 85 ]; then
            echo "   • Mémoire trop élevée: tuer les processus lourds"
            echo "     pkill -f 'npm.*watch'"
        fi
        if [ ! -f /tmp/codespaces-keepalive.pid ] || ! ps -p "$(cat /tmp/codespaces-keepalive.pid)" > /dev/null 2>&1; then
            echo "   • Redémarrer le keepalive: bash .devcontainer/keepalive.sh"
        fi
    fi
    
    if [ "$MEM_PERCENT" -lt 70 ] && [ "$DISK_USAGE" -lt 80 ] && [ "$CRITICAL_ALERTS" -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ SYSTÈME STABLE - Pas d'alertes !${NC}"
    fi
    
    echo ""
    echo "🔄 Actualisation toutes les 10 secondes (Ctrl+C pour arrêter)..."
    
    # Attendre avant de rafraîchir
    sleep 10
done
