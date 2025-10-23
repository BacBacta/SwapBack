#!/bin/bash
# Script de correction rapide pour les déconnexions Codespaces
# Usage: bash .devcontainer/fix-connection.sh

set -e

echo "🔧 Application des corrections Codespaces..."
echo ""

# 1. Ajouter les variables gRPC au shell
echo "1️⃣ Configuration des variables d'environnement gRPC..."
if ! grep -q "GRPC_VERBOSITY" ~/.zshrc 2>/dev/null; then
    cat >> ~/.zshrc << 'EOF'

# Fix Codespaces gRPC connection issues
export GRPC_VERBOSITY=error
export GRPC_DNS_RESOLVER=native
export GRPC_TRACE=''
export NO_PROXY=localhost,127.0.0.1
EOF
    echo "✅ Variables ajoutées à ~/.zshrc"
else
    echo "✓ Variables déjà configurées"
fi

# Charger immédiatement
export GRPC_VERBOSITY=error
export GRPC_DNS_RESOLVER=native
export GRPC_TRACE=''
export NO_PROXY=localhost,127.0.0.1

echo ""

# 2. Lancer le keepalive
echo "2️⃣ Démarrage du keepalive..."
if [ -f /tmp/codespaces-keepalive.pid ]; then
    OLD_PID=$(cat /tmp/codespaces-keepalive.pid)
    if ps -p $OLD_PID > /dev/null 2>&1; then
        echo "✓ Keepalive déjà actif (PID: $OLD_PID)"
    else
        bash /workspaces/SwapBack/.devcontainer/keepalive.sh
        echo "✅ Keepalive démarré"
    fi
else
    bash /workspaces/SwapBack/.devcontainer/keepalive.sh
    echo "✅ Keepalive démarré"
fi

echo ""

# 3. Nettoyer les processus lourds si nécessaire
echo "3️⃣ Vérification de la mémoire..."
MEM_USAGE=$(ps aux --sort=-%mem | awk 'NR==2 {print $4}' | cut -d. -f1)
if [ "$MEM_USAGE" -gt 10 ]; then
    echo "⚠️  Processus gourmand détecté (${MEM_USAGE}% mémoire)"
    echo "   Redémarrage recommandé: Cmd+Shift+P → 'Reload Window'"
else
    echo "✓ Mémoire OK"
fi

echo ""

# 4. Vérifier l'espace disque
echo "4️⃣ Vérification disque..."
DISK_USAGE=$(df /workspaces | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 85 ]; then
    echo "❌ Disque plein (${DISK_USAGE}%)"
    echo "   Nettoyer avec: rm -rf node_modules target .next"
else
    echo "✓ Espace disque OK (${DISK_USAGE}%)"
fi

echo ""
echo "=================================="
echo "✅ Corrections appliquées !"
echo ""
echo "📋 Prochaines étapes:"
echo "1. Rechargez le terminal: source ~/.zshrc"
echo "2. Si déconnexions persistent: Cmd+R (Reload Window)"
echo "3. Si ça ne suffit pas: Cmd+Shift+P → 'Rebuild Container'"
echo ""
echo "🔍 Pour diagnostiquer: bash .devcontainer/network-diagnostic.sh"
echo "📖 Guide complet: .devcontainer/TROUBLESHOOTING.md"
