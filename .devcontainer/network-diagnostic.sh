#!/bin/bash
# Script de diagnostic réseau pour Codespaces
# Identifie et résout les problèmes de connexion

set -e

echo "🔍 Diagnostic réseau Codespaces..."
echo "=================================="
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Vérifier la connectivité DNS
echo "1️⃣ Test DNS..."
if nslookup github.com > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} DNS fonctionne (github.com résolu)"
else
    echo -e "${RED}✗${NC} DNS échoue - Problème potentiel avec /etc/resolv.conf"
    cat /etc/resolv.conf
fi
echo ""

# 2. Vérifier la connectivité réseau
echo "2️⃣ Test connectivité Internet..."
if ping -c 3 8.8.8.8 > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Ping vers 8.8.8.8 réussi"
else
    echo -e "${RED}✗${NC} Pas de connectivité Internet"
fi
echo ""

# 3. Vérifier les variables d'environnement gRPC
echo "3️⃣ Variables d'environnement gRPC..."
if [ -z "$GRPC_VERBOSITY" ]; then
    echo -e "${YELLOW}⚠${NC} GRPC_VERBOSITY non défini (devrait être 'error')"
else
    echo -e "${GREEN}✓${NC} GRPC_VERBOSITY=$GRPC_VERBOSITY"
fi

if [ -z "$GRPC_DNS_RESOLVER" ]; then
    echo -e "${YELLOW}⚠${NC} GRPC_DNS_RESOLVER non défini (devrait être 'native')"
else
    echo -e "${GREEN}✓${NC} GRPC_DNS_RESOLVER=$GRPC_DNS_RESOLVER"
fi
echo ""

# 4. Vérifier les ports en écoute
echo "4️⃣ Ports en écoute..."
netstat -tuln | grep -E ':(3000|8080|8899|2000)' || echo "Aucun port applicatif en écoute"
echo ""

# 5. Vérifier les processus lourds
echo "5️⃣ Processus consommant le plus de mémoire..."
ps aux --sort=-%mem | head -10
echo ""

# 6. Vérifier l'utilisation disque
echo "6️⃣ Espace disque..."
df -h /workspaces | tail -1
echo ""

# 7. Tester la connexion VS Code Remote
echo "7️⃣ Test connexion VS Code Remote..."
if pgrep -f "vscode-server" > /dev/null; then
    echo -e "${GREEN}✓${NC} VS Code Server actif"
    ps aux | grep vscode-server | grep -v grep | head -3
else
    echo -e "${RED}✗${NC} VS Code Server non trouvé"
fi
echo ""

# 8. Vérifier les logs récents
echo "8️⃣ Derniers logs keepalive..."
if [ -f /tmp/codespaces-keepalive.log ]; then
    tail -5 /tmp/codespaces-keepalive.log
else
    echo -e "${YELLOW}⚠${NC} Pas de log keepalive trouvé"
fi
echo ""

# 9. Recommandations
echo "🔧 RECOMMANDATIONS:"
echo "-------------------"

if [ ! -f /tmp/codespaces-keepalive.log ]; then
    echo -e "${YELLOW}•${NC} Lancer le keepalive: bash .devcontainer/keepalive.sh"
fi

# Vérifier si les variables gRPC sont définies
if [ -z "$GRPC_VERBOSITY" ] || [ -z "$GRPC_DNS_RESOLVER" ]; then
    echo -e "${YELLOW}•${NC} Ajouter au ~/.bashrc ou ~/.zshrc:"
    echo "  export GRPC_VERBOSITY=error"
    echo "  export GRPC_DNS_RESOLVER=native"
    echo "  export GRPC_TRACE=''"
fi

# Vérifier l'espace disque
DISK_USAGE=$(df /workspaces | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 85 ]; then
    echo -e "${RED}•${NC} Nettoyer le disque (${DISK_USAGE}% utilisé):"
    echo "  rm -rf node_modules target"
fi

echo ""
echo "=================================="
echo "✅ Diagnostic terminé"
echo ""
echo "Si les déconnexions persistent:"
echo "1. Rechargez la fenêtre VS Code (Cmd/Ctrl+R)"
echo "2. Reconstruisez le container: Cmd+Shift+P → 'Rebuild Container'"
echo "3. Vérifiez votre connexion locale (VPN, firewall, proxy)"
