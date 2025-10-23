#!/bin/bash
# Script de keepalive pour Codespaces
# Empêche les déconnexions en maintenant une activité régulière

LOG_FILE="/tmp/codespaces-keepalive.log"

echo "[$(date)] 🟢 Keepalive démarré" >> "$LOG_FILE"

# Fonction pour maintenir l'activité
keep_alive() {
    while true; do
        # Activité légère toutes les 5 minutes
        sleep 300
        
        # Toucher un fichier temporaire
        touch /tmp/.codespaces_alive
        
        # Log discret
        echo "[$(date)] ⏰ Ping" >> "$LOG_FILE"
        
        # Nettoyer les vieux logs (garder 100 dernières lignes)
        tail -100 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
    done
}

# Lancer en arrière-plan
keep_alive &

echo $! > /tmp/codespaces-keepalive.pid
echo "[$(date)] ✅ Keepalive PID: $(cat /tmp/codespaces-keepalive.pid)" >> "$LOG_FILE"
