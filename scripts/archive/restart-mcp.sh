#!/bin/bash

# 🔄 SCRIPT DE REDÉMARRAGE MCP COMPLET
echo "🔄 Redémarrage complet des serveurs MCP..."

# Arrêter tous les processus MCP existants
echo "⏹️  Arrêt des processus MCP existants..."
pkill -f "modelcontextprotocol" 2>/dev/null
pkill -f "tavily" 2>/dev/null
pkill -f "server-fetch" 2>/dev/null
pkill -f "server-memory" 2>/dev/null

sleep 2

# Nettoyer le cache npm
echo "🧹 Nettoyage du cache npm..."
npm cache clean --force

# Vérifier et installer Node.js si nécessaire
if ! command -v node &> /dev/null; then
    echo "📦 Installation de Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Préinstaller les serveurs MCP
echo "📥 Préinstallation des serveurs MCP..."
npx -y @modelcontextprotocol/server-tavily --version &
npx -y @modelcontextprotocol/server-fetch --version &
npx -y @modelcontextprotocol/server-memory --version &
npx -y @modelcontextprotocol/server-filesystem --version &

wait

echo "✅ Serveurs MCP prêts!"
echo ""
echo "📋 ÉTAPES SUIVANTES:"
echo "1. Sauvegardez mcp.json (Ctrl+S)"
echo "2. Rechargez VS Code (Ctrl+Shift+P → 'Developer: Reload Window')"
echo "3. Attendez 30 secondes"
echo "4. Testez: 'Search Tavily: test de fonctionnement MCP'"