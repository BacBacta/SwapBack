#!/bin/bash
# 🔧 Script d'optimisation CPU pour Codespace
# Réduit la charge CPU en tuant les processus inutiles et en optimisant les language servers

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🚀 OPTIMISATION CPU CODESPACE${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# 1. Afficher l'utilisation CPU actuelle
echo -e "${YELLOW}📊 Utilisation CPU avant optimisation:${NC}"
echo ""
ps aux --sort=-%cpu | head -10
echo ""

# 2. Tuer les TS servers en trop (garder le plus récent)
echo -e "${YELLOW}🔧 Nettoyage des TS Servers multiples...${NC}"
TS_PIDS=$(pgrep -f "tsserver.js" | head -n -1)  # Garde le dernier
if [ -n "$TS_PIDS" ]; then
    echo "$TS_PIDS" | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}✅ TS Servers anciens tués${NC}"
else
    echo -e "${BLUE}ℹ️  Un seul TS Server actif${NC}"
fi
echo ""

# 3. Tuer les TailwindCSS servers en trop
echo -e "${YELLOW}🔧 Nettoyage des Tailwind Servers multiples...${NC}"
TW_PIDS=$(pgrep -f "tailwindServer.js" | head -n -1)
if [ -n "$TW_PIDS" ]; then
    echo "$TW_PIDS" | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}✅ Tailwind Servers anciens tués${NC}"
else
    echo -e "${BLUE}ℹ️  Un seul Tailwind Server actif${NC}"
fi
echo ""

# 4. Tuer les ESLint servers en trop
echo -e "${YELLOW}🔧 Nettoyage des ESLint Servers multiples...${NC}"
ESLINT_PIDS=$(pgrep -f "eslintServer.js" | head -n -1)
if [ -n "$ESLINT_PIDS" ]; then
    echo "$ESLINT_PIDS" | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}✅ ESLint Servers anciens tués${NC}"
else
    echo -e "${BLUE}ℹ️  Un seul ESLint Server actif${NC}"
fi
echo ""

# 5. Redémarrer rust-analyzer s'il consomme trop (>2GB)
echo -e "${YELLOW}🔧 Vérification rust-analyzer...${NC}"
RA_PID=$(pgrep -f "rust-analyzer" | head -1)
if [ -n "$RA_PID" ]; then
    RA_MEM=$(ps -p "$RA_PID" -o rss= 2>/dev/null | awk '{print $1/1024}')
    if [ -n "$RA_MEM" ]; then
        if awk "BEGIN {exit !($RA_MEM > 2000)}"; then
            echo -e "${YELLOW}⚠️  rust-analyzer consomme ${RA_MEM}MB, redémarrage...${NC}"
            kill -9 "$RA_PID" 2>/dev/null || true
            echo -e "${GREEN}✅ rust-analyzer redémarré (sera relancé auto par VS Code)${NC}"
        else
            echo -e "${GREEN}✅ rust-analyzer OK (${RA_MEM}MB)${NC}"
        fi
    fi
else
    echo -e "${BLUE}ℹ️  rust-analyzer non actif${NC}"
fi
echo ""

# 6. Tuer les extensionHost en trop (garder les 2 plus récents)
echo -e "${YELLOW}🔧 Nettoyage des Extension Hosts multiples...${NC}"
EXT_PIDS=$(pgrep -f "extensionHost" | head -n -2)
if [ -n "$EXT_PIDS" ]; then
    echo "$EXT_PIDS" | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}✅ Extension Hosts anciens tués${NC}"
else
    echo -e "${BLUE}ℹ️  Nombre d'Extension Hosts optimal${NC}"
fi
echo ""

# 7. Nettoyer les fichiers temporaires
echo -e "${YELLOW}🔧 Nettoyage fichiers temporaires...${NC}"
rm -rf /tmp/vscode-typescript*/tscancellation-*.tmp* 2>/dev/null || true
rm -rf /tmp/vscode-*.sock 2>/dev/null || true
echo -e "${GREEN}✅ Fichiers temporaires nettoyés${NC}"
echo ""

# 8. Optimiser les watchers de fichiers
echo -e "${YELLOW}🔧 Optimisation des watchers...${NC}"
# Augmenter la limite des watchers si besoin
CURRENT_WATCHERS=$(sysctl fs.inotify.max_user_watches 2>/dev/null | awk '{print $3}')
if [ -n "$CURRENT_WATCHERS" ] && [ "$CURRENT_WATCHERS" -lt 524288 ]; then
    echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf > /dev/null 2>&1 || true
    sudo sysctl -p > /dev/null 2>&1 || true
    echo -e "${GREEN}✅ Watchers optimisés${NC}"
else
    echo -e "${BLUE}ℹ️  Watchers déjà optimisés${NC}"
fi
echo ""

# 9. Afficher l'utilisation CPU après optimisation
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📊 Utilisation CPU après optimisation:${NC}"
echo ""
sleep 2  # Laisser le temps aux processus de se terminer
ps aux --sort=-%cpu | head -10
echo ""

# 10. Résumé
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ OPTIMISATION CPU TERMINÉE${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}📋 Actions effectuées:${NC}"
echo "  ✅ TS Servers multiples nettoyés"
echo "  ✅ Tailwind Servers multiples nettoyés"
echo "  ✅ ESLint Servers multiples nettoyés"
echo "  ✅ rust-analyzer optimisé"
echo "  ✅ Extension Hosts anciens tués"
echo "  ✅ Fichiers temporaires nettoyés"
echo "  ✅ Watchers optimisés"
echo ""

echo -e "${YELLOW}🔄 Prochaines étapes recommandées:${NC}"
echo "  1. Rechargez VS Code Desktop: Cmd/Ctrl + R"
echo "  2. Attendez 30 secondes pour la stabilisation"
echo "  3. Vérifiez l'utilisation CPU: top -bn1 | head -20"
echo ""

echo -e "${BLUE}💡 Conseils pour maintenir une faible utilisation CPU:${NC}"
echo "  • Fermez les fichiers/onglets inutilisés"
echo "  • Désactivez les extensions non critiques"
echo "  • Évitez d'ouvrir trop de projets simultanément"
echo "  • Utilisez 'git.autorefresh': false dans settings.json"
echo ""

echo -e "${GREEN}✅ Script terminé avec succès !${NC}\n"
