#!/bin/bash
# Script de lancement du fuzzing - SwapBack
# Date: 25 Novembre 2025
# Durée recommandée: 24h minimum

set -e

echo "🔍 ======================================"
echo "   LANCEMENT DU FUZZING - SwapBack"
echo "   Durée recommandée: 24h minimum"
echo "========================================"
echo ""

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ROUTER_DIR="/workspaces/SwapBack/programs/swapback_router"
DURATION_HOURS=${1:-24}

echo -e "${BLUE}📊 Configuration:${NC}"
echo "  - Répertoire: $ROUTER_DIR"
echo "  - Durée: ${DURATION_HOURS}h"
echo "  - Cores disponibles: $(nproc)"
echo ""

# Vérifier que cargo-fuzz est installé
if ! command -v cargo-fuzz &> /dev/null; then
    echo -e "${YELLOW}⚠️  cargo-fuzz n'est pas installé. Installation...${NC}"
    cargo install cargo-fuzz
fi

echo -e "${GREEN}✅ cargo-fuzz est installé${NC}"
echo ""

# Lister les targets disponibles
echo -e "${BLUE}📋 Targets de fuzzing disponibles:${NC}"
cd "$ROUTER_DIR"
cargo fuzz list
echo ""

# Fonction pour lancer un target
launch_target() {
    local target=$1
    local log_file="fuzz_${target}_$(date +%Y%m%d_%H%M%S).log"
    
    echo -e "${GREEN}🚀 Lancement de: $target${NC}"
    echo "   Logs: $log_file"
    
    # Lancer en arrière-plan avec nohup
    nohup cargo fuzz run "$target" -- -max_total_time=$((DURATION_HOURS * 3600)) > "$log_file" 2>&1 &
    
    local pid=$!
    echo "   PID: $pid"
    echo "$pid" > "fuzz_${target}.pid"
    echo ""
}

# Créer le répertoire de logs
mkdir -p "$ROUTER_DIR/fuzz_logs"
cd "$ROUTER_DIR/fuzz_logs"

# Lancer tous les targets en parallèle
echo -e "${BLUE}🎯 Lancement des targets de fuzzing...${NC}"
echo ""

launch_target "fuzz_swap"
launch_target "fuzz_fee_calculation"
launch_target "fuzz_oracle_price"

echo ""
echo -e "${GREEN}✅ Fuzzing lancé avec succès !${NC}"
echo ""
echo "📊 Pour monitorer:"
echo "   - tail -f $ROUTER_DIR/fuzz_logs/fuzz_*.log"
echo "   - ps aux | grep cargo-fuzz"
echo ""
echo "🛑 Pour arrêter:"
echo "   - kill \$(cat $ROUTER_DIR/fuzz_logs/fuzz_*.pid)"
echo "   - ou: pkill -f cargo-fuzz"
echo ""
echo "⏰ Durée estimée: ${DURATION_HOURS}h"
echo "📅 Fin prévue: $(date -d "+${DURATION_HOURS} hours" "+%Y-%m-%d %H:%M:%S")"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT:${NC}"
echo "  - Laisser tourner au moins 24h pour des résultats significatifs"
echo "  - Vérifier les logs régulièrement pour détecter des crashes"
echo "  - 0 crash = code robuste ✅"
echo ""

# Créer un script de monitoring
cat > monitor_fuzzing.sh << 'EOF'
#!/bin/bash
echo "📊 MONITORING FUZZING - SwapBack"
echo "================================"
echo ""

for pid_file in fuzz_*.pid; do
    if [ -f "$pid_file" ]; then
        pid=$(cat "$pid_file")
        target=$(echo "$pid_file" | sed 's/fuzz_//' | sed 's/.pid//')
        
        if ps -p $pid > /dev/null 2>&1; then
            echo "✅ $target (PID: $pid) - RUNNING"
            
            # Trouver le fichier de log correspondant
            log_file=$(ls -t fuzz_${target}_*.log 2>/dev/null | head -1)
            if [ -f "$log_file" ]; then
                echo "   Dernières lignes du log:"
                tail -3 "$log_file" | sed 's/^/   /'
            fi
        else
            echo "❌ $target (PID: $pid) - STOPPED"
        fi
        echo ""
    fi
done

echo "Pour voir les détails: tail -f fuzz_*.log"
EOF

chmod +x monitor_fuzzing.sh

echo "📊 Script de monitoring créé: ./monitor_fuzzing.sh"
echo ""
echo "🎉 Fuzzing démarré ! Bonne chasse aux bugs ! 🐛"
