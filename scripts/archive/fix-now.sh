#!/bin/bash
# Script d'urgence pour forcer la reconnexion Codespaces
# Usage: bash fix-now.sh

echo "🚨 CORRECTION URGENTE CONNEXION CODESPACES"
echo "=========================================="
echo ""

# 1. Définir les variables gRPC immédiatement
export GRPC_VERBOSITY=error
export GRPC_DNS_RESOLVER=native
export GRPC_TRACE=''
export NO_PROXY=localhost,127.0.0.1

echo "✅ Variables gRPC exportées"
env | grep GRPC

# 2. Tuer tous les processus VS Code Server problématiques
echo ""
echo "🔄 Redémarrage des services VS Code..."
pkill -f vscode-server || true

# 3. Nettoyer les sockets et fichiers temporaires
rm -f /tmp/.vscode-* 2>/dev/null || true
rm -f /tmp/vscode-* 2>/dev/null || true

# 4. Vérifier la connectivité
echo ""
echo "🔍 Test de connectivité..."
if ping -c 1 github.com &>/dev/null; then
    echo "✅ github.com accessible"
else
    echo "⚠️  github.com non accessible - vérifier DNS"
    echo "Nameservers actuels:"
    cat /etc/resolv.conf | grep nameserver
fi

echo ""
echo "=========================================="
echo "✅ Corrections appliquées !"
echo ""
echo "📋 ACTIONS REQUISES MAINTENANT:"
echo ""
echo "1. Rechargez la fenêtre VS Code:"
echo "   Cmd/Ctrl + R"
echo ""
echo "2. Si ça ne suffit pas, reconstruisez:"
echo "   Cmd/Ctrl + Shift + P"
echo "   Tapez: 'Developer: Reload Window'"
echo ""
echo "3. En dernier recours:"
echo "   Cmd/Ctrl + Shift + P"
echo "   Tapez: 'Codespaces: Rebuild Container'"
echo ""
echo "⚠️  IMPORTANT: Ces actions sont NÉCESSAIRES"
echo "   Les variables ne seront actives qu'après rechargement"
