#!/bin/bash

echo "🔧 DIAGNOSTIC ET RÉPARATION MCP TAVILY"
echo "======================================"

# Couleurs pour l'affichage
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction de log
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_info() { echo -e "ℹ️  $1"; }

# 1. Vérification de l'environnement
echo ""
log_info "1. VÉRIFICATION DE L'ENVIRONNEMENT"
echo "-----------------------------------"

# Vérifier Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    log_success "Node.js installé: $NODE_VERSION"
else
    log_error "Node.js non trouvé!"
    log_info "Installation de Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Vérifier npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    log_success "npm installé: $NPM_VERSION"
else
    log_error "npm non trouvé!"
fi

# Vérifier npx
if command -v npx &> /dev/null; then
    log_success "npx disponible"
else
    log_error "npx non trouvé!"
fi

# 2. Test des serveurs MCP
echo ""
log_info "2. TEST DES SERVEURS MCP"
echo "-------------------------"

# Test Tavily
log_info "Test du serveur Tavily..."
if timeout 10 npx -y @modelcontextprotocol/server-tavily --help &>/dev/null; then
    log_success "Serveur Tavily accessible"
else
    log_warning "Problème avec le serveur Tavily - tentative de réinstallation..."
    npm cache clean --force
    timeout 15 npx -y @modelcontextprotocol/server-tavily --help &>/dev/null && log_success "Tavily réparé" || log_error "Échec réparation Tavily"
fi

# Test Fetch
log_info "Test du serveur Fetch..."
if timeout 10 npx -y @modelcontextprotocol/server-fetch --help &>/dev/null; then
    log_success "Serveur Fetch accessible"
else
    log_warning "Problème avec le serveur Fetch"
fi

# 3. Vérification de la configuration MCP
echo ""
log_info "3. VÉRIFICATION CONFIGURATION MCP"
echo "----------------------------------"

MCP_CONFIG="/tmp/vscode-user/User/settings.json"
if [ -f "$MCP_CONFIG" ]; then
    log_success "Fichier de configuration MCP trouvé"
    
    # Vérifier la syntaxe JSON
    if python3 -m json.tool "$MCP_CONFIG" &>/dev/null; then
        log_success "Syntaxe JSON valide"
    else
        log_error "Syntaxe JSON invalide!"
    fi
else
    log_warning "Fichier de configuration MCP non trouvé"
fi

# 4. Test de connectivité réseau
echo ""
log_info "4. TEST CONNECTIVITÉ RÉSEAU"
echo "----------------------------"

# Test API Tavily
log_info "Test de l'API Tavily..."
API_KEY="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"
RESPONSE=$(curl -s -w "%{http_code}" -X POST "https://api.tavily.com/search" \
  -H "Content-Type: application/json" \
  -d "{\"api_key\":\"$API_KEY\",\"query\":\"test\",\"max_results\":1}" -o /dev/null)

if [ "$RESPONSE" = "200" ]; then
    log_success "API Tavily accessible (HTTP 200)"
elif [ "$RESPONSE" = "401" ]; then
    log_error "Clé API Tavily invalide (HTTP 401)"
elif [ "$RESPONSE" = "000" ]; then
    log_error "Pas de connexion réseau"
else
    log_warning "API Tavily répond avec code: $RESPONSE"
fi

# 5. Diagnostic des processus
echo ""
log_info "5. DIAGNOSTIC DES PROCESSUS"
echo "---------------------------"

# Rechercher des processus MCP
MCP_PROCESSES=$(ps aux | grep -E "(tavily|@modelcontextprotocol)" | grep -v grep | wc -l)
if [ $MCP_PROCESSES -gt 0 ]; then
    log_success "$MCP_PROCESSES processus MCP en cours"
    ps aux | grep -E "(tavily|@modelcontextprotocol)" | grep -v grep
else
    log_warning "Aucun processus MCP détecté"
fi

# 6. Solutions automatiques
echo ""
log_info "6. APPLICATION DES SOLUTIONS"
echo "-----------------------------"

# Nettoyer le cache npm
log_info "Nettoyage du cache npm..."
npm cache clean --force
log_success "Cache npm nettoyé"

# Précharger les serveurs MCP
log_info "Préchargement des serveurs MCP..."
timeout 30 npx -y @modelcontextprotocol/server-tavily --version &>/dev/null &
timeout 30 npx -y @modelcontextprotocol/server-fetch --version &>/dev/null &
timeout 30 npx -y @modelcontextprotocol/server-filesystem --version &>/dev/null &
timeout 30 npx -y @modelcontextprotocol/server-memory --version &>/dev/null &

wait
log_success "Serveurs MCP préchargés"

# 7. Instructions finales
echo ""
log_info "7. INSTRUCTIONS FINALES"
echo "-----------------------"
echo "Pour activer MCP Tavily:"
echo "1. Sauvegardez le fichier mcp.json (Ctrl+S)"
echo "2. Rechargez VS Code (Ctrl+Shift+P → 'Developer: Reload Window')"
echo "3. Attendez 30 secondes pour le démarrage des serveurs"
echo "4. Testez avec: 'Search Tavily: test de fonctionnement'"
echo ""
log_success "Script de diagnostic terminé!"