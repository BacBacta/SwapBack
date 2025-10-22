#!/bin/bash

# Script de surveillance pour maintenir le serveur Next.js actif
# Ce script vérifie régulièrement que le serveur fonctionne et le redémarre si nécessaire

LOG_FILE="/tmp/swapback-watchdog.log"
PID_FILE="/tmp/swapback-dev.pid"
CHECK_INTERVAL=30  # Vérifier toutes les 30 secondes

echo "🔍 SwapBack Watchdog - Démarrage" | tee -a "$LOG_FILE"
echo "=================================" | tee -a "$LOG_FILE"

# Fonction pour vérifier si le serveur est actif
is_server_running() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            # Vérifier aussi que le port 3000 répond
            if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null | grep -q "200"; then
                return 0
            fi
        fi
    fi
    return 1
}

# Fonction pour redémarrer le serveur
restart_server() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  Redémarrage du serveur..." | tee -a "$LOG_FILE"
    /workspaces/SwapBack/start-dev.sh >> "$LOG_FILE" 2>&1
}

# Boucle de surveillance
while true; do
    if ! is_server_running; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ Serveur arrêté - Redémarrage..." | tee -a "$LOG_FILE"
        restart_server
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Serveur actif" >> "$LOG_FILE"
    fi
    
    sleep "$CHECK_INTERVAL"
done
