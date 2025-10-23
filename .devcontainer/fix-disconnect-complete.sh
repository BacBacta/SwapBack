#!/bin/bash
# 🔧 Script complet de correction des déconnexions Codespaces
# Identifie, diagnostique et résout les problèmes de stabilité

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

LOG_FILE="/tmp/codespaces-fix-$(date +%Y%m%d-%H%M%S).log"

# Fonction de logging
log() {
    local msg="$1"
    echo -e "${msg}" | tee -a "$LOG_FILE"
}

log_header() {
    log "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "${BLUE}$1${NC}"
    log "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

log_success() {
    log "${GREEN}✅ $1${NC}"
}

log_error() {
    log "${RED}❌ $1${NC}"
}

log_warning() {
    log "${YELLOW}⚠️  $1${NC}"
}

log_info() {
    log "${BLUE}ℹ️  $1${NC}"
}

# ==== PHASE 1 : DIAGNOSTIQUE ====
log_header "PHASE 1: DIAGNOSTIQUE"

# Test 1: DNS
log "1️⃣ Test DNS..."
if nslookup github.com > /dev/null 2>&1; then
    log_success "DNS fonctionne (github.com résolu)"
else
    log_error "DNS échoue - Vérifiez /etc/resolv.conf"
    cat /etc/resolv.conf | tee -a "$LOG_FILE"
fi

# Test 2: Connectivité réseau
log "\n2️⃣ Test connectivité Internet..."
if ping -c 1 8.8.8.8 > /dev/null 2>&1; then
    log_success "Ping vers 8.8.8.8 réussi"
else
    log_error "Pas de connectivité Internet"
fi

# Test 3: Variables gRPC
log "\n3️⃣ Variables d'environnement gRPC..."
GRPC_OK=true
if [ -z "$GRPC_VERBOSITY" ]; then
    log_warning "GRPC_VERBOSITY non défini"
    GRPC_OK=false
else
    log_info "GRPC_VERBOSITY=$GRPC_VERBOSITY"
fi

if [ -z "$GRPC_DNS_RESOLVER" ]; then
    log_warning "GRPC_DNS_RESOLVER non défini"
    GRPC_OK=false
else
    log_info "GRPC_DNS_RESOLVER=$GRPC_DNS_RESOLVER"
fi

# Test 4: Vérifier les ressources
log "\n4️⃣ Vérification des ressources..."

# Mémoire
TOTAL_MEM=$(free -m | awk 'NR==2 {print $2}')
USED_MEM=$(free -m | awk 'NR==2 {print $3}')
MEM_PERCENT=$((USED_MEM * 100 / TOTAL_MEM))
log_info "Mémoire: ${USED_MEM}MB/${TOTAL_MEM}MB (${MEM_PERCENT}%)"

if [ "$MEM_PERCENT" -gt 85 ]; then
    log_error "Mémoire critique (${MEM_PERCENT}% utilisée)"
elif [ "$MEM_PERCENT" -gt 75 ]; then
    log_warning "Mémoire élevée (${MEM_PERCENT}% utilisée)"
else
    log_success "Mémoire OK"
fi

# Disque
DISK_USAGE=$(df /workspaces | tail -1 | awk '{print $5}' | sed 's/%//')
log_info "Disque: ${DISK_USAGE}% utilisé"

if [ "$DISK_USAGE" -gt 90 ]; then
    log_error "Disque critique (${DISK_USAGE}%)"
elif [ "$DISK_USAGE" -gt 80 ]; then
    log_warning "Disque plein (${DISK_USAGE}%)"
else
    log_success "Espace disque OK"
fi

# Test 5: Processus lourds
log "\n5️⃣ Top 5 processus gourmands..."
ps aux --sort=-%mem | head -6 | tail -5 | tee -a "$LOG_FILE"

# Test 6: VS Code Server
log "\n6️⃣ État du VS Code Server..."
if pgrep -f "vscode-server" > /dev/null; then
    log_success "VS Code Server actif"
else
    log_warning "VS Code Server non trouvé (normal si idle)"
fi

# ==== PHASE 2 : CORRECTIONS ====
log_header "PHASE 2: CORRECTIONS"

# Correction 1: Variables gRPC
log "1️⃣ Configuration des variables gRPC..."
if [ "$GRPC_OK" = false ]; then
    if ! grep -q "GRPC_VERBOSITY" ~/.zshrc 2>/dev/null; then
        cat >> ~/.zshrc << 'EOF'

# 🔧 Fix Codespaces gRPC - 23 octobre 2025
export GRPC_VERBOSITY=error
export GRPC_DNS_RESOLVER=native
export GRPC_TRACE=''
export NO_PROXY=localhost,127.0.0.1
export GRPC_GO_LOG_SEVERITY_LEVEL=error
EOF
        log_success "Variables gRPC ajoutées à ~/.zshrc"
    else
        log_info "Variables gRPC déjà présentes"
    fi
    
    # Charger immédiatement
    export GRPC_VERBOSITY=error
    export GRPC_DNS_RESOLVER=native
    export GRPC_TRACE=''
    export NO_PROXY=localhost,127.0.0.1
    export GRPC_GO_LOG_SEVERITY_LEVEL=error
    log_success "Variables gRPC chargées en mémoire"
else
    log_info "Variables gRPC déjà configurées"
fi

# Correction 2: Keepalive
log "\n2️⃣ Configuration du keepalive..."
if [ -f /tmp/codespaces-keepalive.pid ]; then
    OLD_PID=$(cat /tmp/codespaces-keepalive.pid)
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        log_info "Keepalive déjà actif (PID: $OLD_PID)"
    else
        log_warning "Ancien keepalive mort, redémarrage..."
        bash /workspaces/SwapBack/.devcontainer/keepalive.sh
        log_success "Keepalive démarré"
    fi
else
    log_info "Démarrage du keepalive..."
    bash /workspaces/SwapBack/.devcontainer/keepalive.sh
    log_success "Keepalive démarré"
fi

# Correction 3: Nettoyer les processus lourds si nécessaire
log "\n3️⃣ Optimisation des processus..."
if [ "$MEM_PERCENT" -gt 80 ]; then
    log_warning "Mémoire élevée, identification des gros consommateurs..."
    
    # Tuer les processus npm idle
    if pgrep -f "npm" > /dev/null 2>&1; then
        log_info "Processus npm détectés"
        pkill -f "npm.*--watch" || true
        log_info "Arrêt des watchers npm"
    fi
fi

# Correction 4: Nettoyage disque si nécessaire
log "\n4️⃣ Gestion de l'espace disque..."
if [ "$DISK_USAGE" -gt 85 ]; then
    log_warning "Disque plein, nettoyage..."
    
    # Supprimer les caches
    rm -rf /workspaces/SwapBack/node_modules/.cache 2>/dev/null || true
    rm -rf /tmp/*.log 2>/dev/null || true
    rm -rf /tmp/npm-cache 2>/dev/null || true
    
    log_success "Caches temporaires supprimés"
    
    NEW_USAGE=$(df /workspaces | tail -1 | awk '{print $5}' | sed 's/%//')
    log_info "Nouvel usage: ${NEW_USAGE}%"
fi

# Correction 5: Configuration SSH pour connexion stable
log "\n5️⃣ Configuration SSH..."
if ! grep -q "ServerAliveInterval" ~/.ssh/config 2>/dev/null; then
    mkdir -p ~/.ssh
    cat >> ~/.ssh/config << 'EOF'

# SSH Keepalive for Codespaces
Host *
    ServerAliveInterval 60
    ServerAliveCountMax 10
    TCPKeepAlive yes
EOF
    log_success "Configuration SSH keepalive ajoutée"
else
    log_info "Configuration SSH déjà présente"
fi

# ==== PHASE 3 : VALIDATION ====
log_header "PHASE 3: VALIDATION"

log "1️⃣ Vérification des variables gRPC..."
env | grep GRPC | tee -a "$LOG_FILE" || log_warning "Aucune variable gRPC en cours"

log "\n2️⃣ Vérification du keepalive..."
if [ -f /tmp/codespaces-keepalive.pid ]; then
    PID=$(cat /tmp/codespaces-keepalive.pid)
    if ps -p "$PID" > /dev/null 2>&1; then
        log_success "Keepalive actif (PID: $PID)"
    else
        log_error "Keepalive inactif (PID invalide)"
    fi
else
    log_error "Pas de keepalive trouvé"
fi

log "\n3️⃣ Vérification de la stabilité..."
for i in {1..5}; do
    if curl -s -m 2 https://github.com > /dev/null 2>&1; then
        log_success "Tentative $i/5 - Connexion OK"
    else
        log_warning "Tentative $i/5 - Connexion lente"
    fi
done

# ==== RAPPORT FINAL ====
log_header "RAPPORT FINAL"

log "${GREEN}✅ Toutes les corrections ont été appliquées !${NC}\n"

log "📋 Prochaines étapes :"
log "  ${BLUE}1.${NC} Rechargez le terminal:"
log "     ${BLUE}source ~/.zshrc${NC}"
log ""
log "  ${BLUE}2.${NC} Si déconnexions persistent, rechargez VS Code:"
log "     ${BLUE}Cmd/Ctrl + R${NC}"
log ""
log "  ${BLUE}3.${NC} En dernier recours, reconstruisez le container:"
log "     ${BLUE}Cmd/Ctrl + Shift + P → 'Dev Containers: Rebuild Container'${NC}"
log ""
log "🔍 Pour diagnostiquer : ${BLUE}bash .devcontainer/network-diagnostic.sh${NC}"
log "📊 Logs complète: ${BLUE}cat $LOG_FILE${NC}"
log "⏰ Suivi keepalive: ${BLUE}tail -f /tmp/codespaces-keepalive.log${NC}"

log "\n${BLUE}════════════════════════════════════════════${NC}\n"

echo -e "\n${GREEN}✅ Correction appliquée avec succès !${NC}"
echo "📍 Fichier de log: $LOG_FILE"
