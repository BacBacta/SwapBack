#!/bin/bash

# Script de démarrage du serveur Next.js en arrière-plan

cd /workspaces/SwapBack/app

# Kill les anciens processus
pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f "node.*3001" 2>/dev/null

# Attendre que les ports se libèrent
sleep 2

# Lancer le serveur en arrière-plan
PORT=3001 npm run dev > /tmp/nextjs-server.log 2>&1 &

SERVER_PID=$!
echo "Serveur démarré avec PID: $SERVER_PID"
echo $SERVER_PID > /tmp/nextjs-server.pid

# Attendre que le serveur soit prêt
echo "Attente du démarrage du serveur..."
for i in {1..30}; do
    sleep 1
    if curl -s http://localhost:3001 > /dev/null 2>&1; then
        echo "✅ Serveur prêt sur http://localhost:3001"
        exit 0
    fi
    echo -n "."
done

echo ""
echo "❌ Le serveur n'a pas démarré dans les 30 secondes"
echo "Logs:"
tail -20 /tmp/nextjs-server.log
exit 1
