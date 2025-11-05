#!/bin/bash
# Script pour démarrer l'application en arrière-plan

cd /workspaces/SwapBack/app

# Tuer les anciens processus si existants
pkill -f "next dev" 2>/dev/null || true

# Démarrer l'application
nohup npm run dev > /tmp/swapback-app.log 2>&1 &
APP_PID=$!

echo "🚀 Application démarrée (PID: $APP_PID)"
echo "📋 Logs disponibles: tail -f /tmp/swapback-app.log"

# Attendre que le serveur démarre
echo "⏳ Attente du démarrage..."
for i in {1..30}; do
    sleep 1
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo "✅ Application accessible sur http://localhost:3000"
        exit 0
    fi
done

echo "⚠️  Timeout - vérifiez les logs: tail -f /tmp/swapback-app.log"
exit 1
