#!/bin/bash
# Script de keepalive amélioré pour Codespaces
# Empêche les déconnexions en maintenant une activité régulière
# Amélioré pour stabilité maximale - 23 octobre 2025

LOG_FILE="/tmp/codespaces-keepalive.log"
ACTIVITY_FILE="/tmp/.codespaces_alive"
PID_FILE="/tmp/codespaces-keepalive.pid"

echo "[$(date)] 🟢 Keepalive démarré (PID: $$)" >> "$LOG_FILE"

# Fonction pour maintenir l'activité
keep_alive() {
    COUNTER=0
    
    while true; do
        COUNTER=$((COUNTER + 1))
        CURRENT_TIME=$(date '+%H:%M:%S')
        
        # Activité légère toutes les 3 minutes (plus fréquent pour plus de stabilité)
        sleep 180
        
        # Toucher un fichier temporaire
        touch "$ACTIVITY_FILE"
        
        # Ping DNS pour maintenir la connexion active
        nslookup localhost > /dev/null 2>&1 || true
        
        # Vérifier l'espace disque
        df /workspaces > /dev/null 2>&1 || true
        
        # Log discret (toutes les 4 pings = 12 min)
        if [ $((COUNTER % 4)) -eq 0 ]; then
            MEMORY=$(free -m | awk 'NR==2 {print $3"MB"}')
            DISK=$(df /workspaces | tail -1 | awk '{print $5}')
            echo "[${CURRENT_TIME}] ⏰ Ping #${COUNTER} - Mém: ${MEMORY} | Disque: ${DISK}" >> "$LOG_FILE"
            
            # Nettoyer les vieux logs (garder 200 dernières lignes)
            if [ $(wc -l < "$LOG_FILE") -gt 200 ]; then
                tail -200 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
            fi
        fi
    done
}

# Gestion des signaux
cleanup() {
    echo "[$(date)] 🛑 Keepalive arrêté" >> "$LOG_FILE"
    exit 0
}

trap cleanup SIGTERM SIGINT

# Lancer en arrière-plan
keep_alive &
KEEP_PID=$!

echo $KEEP_PID > "$PID_FILE"
echo "[$(date)] ✅ Keepalive PID: $KEEP_PID" >> "$LOG_FILE"

# Garder le script en vie
wait $KEEP_PID
