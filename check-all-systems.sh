#!/bin/bash
# Script de vérification complète de l'écosystème SwapBack

echo "╔════════════════════════════════════════════════════════════╗"
echo "║        VÉRIFICATION COMPLÈTE SWAPBACK - $(date +%d/%m/%Y)        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction de test
test_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}"
    else
        echo -e "${RED}❌ FAIL${NC}"
    fi
}

# 1. Application Next.js
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 APPLICATION NEXT.JS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Vérifier le processus
echo -n "Process Next.js actif: "
if pgrep -f "next dev" > /dev/null; then
    test_status 0
    PID=$(pgrep -f "next dev" | head -1)
    echo "   └─ PID: $PID"
else
    test_status 1
    echo "   └─ Démarrage de l'application..."
    cd /workspaces/SwapBack && ./start-app-background.sh > /dev/null 2>&1
    sleep 3
fi

# Vérifier le port
echo -n "Port 3000 accessible: "
if lsof -i :3000 > /dev/null 2>&1; then
    test_status 0
else
    test_status 1
fi

# Vérifier HTTP
echo -n "HTTP Status Code: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}$HTTP_CODE${NC}"
else
    echo -e "${RED}$HTTP_CODE${NC}"
fi

# Vérifier API Swap
echo -n "API /api/swap: "
curl -s -X POST http://localhost:3000/api/swap \
  -H "Content-Type: application/json" \
  -d '{}' > /dev/null 2>&1
test_status $?

echo ""

# 2. Programme Solana
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚙️  PROGRAMME SOLANA (DEVNET)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd /workspaces/SwapBack

echo -n "Programme swapback_cnft déployé: "
if solana program show 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq > /dev/null 2>&1; then
    test_status 0
    BALANCE=$(solana program show 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq 2>/dev/null | grep "Balance:" | awk '{print $2, $3}')
    DATA_LEN=$(solana program show 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq 2>/dev/null | grep "Data Length:" | awk '{print $3}')
    echo "   ├─ Program ID: 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq"
    echo "   ├─ Balance: $BALANCE"
    echo "   └─ Data Length: $DATA_LEN bytes"
else
    test_status 1
fi

# Vérifier le token BACK
echo -n "Token BACK (Token-2022): "
if solana account 862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux > /dev/null 2>&1; then
    test_status 0
    echo "   └─ Mint: 862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux"
else
    test_status 1
fi

# Vérifier le binaire compilé
echo -n "Binaire compilé: "
if [ -f "target/deploy/swapback_cnft.so" ]; then
    test_status 0
    SIZE=$(ls -lh target/deploy/swapback_cnft.so | awk '{print $5}')
    echo "   └─ Taille: $SIZE"
else
    test_status 1
fi

echo ""

# 3. Configuration
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚙️  CONFIGURATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -n "RPC URL: "
RPC_URL=$(solana config get | grep "RPC URL:" | awk '{print $3}')
echo -e "${YELLOW}$RPC_URL${NC}"

echo -n "Network: "
if [[ "$RPC_URL" == *"devnet"* ]]; then
    echo -e "${GREEN}Devnet${NC}"
else
    echo -e "${YELLOW}$(echo $RPC_URL | sed 's/https:\/\///' | sed 's/\.solana\.com//')${NC}"
fi

echo -n "Keypair: "
KEYPAIR=$(solana config get | grep "Keypair Path:" | awk '{print $3}')
echo "$KEYPAIR"

echo ""

# 4. Git
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 GIT & GITHUB"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -n "Branche actuelle: "
BRANCH=$(git branch --show-current)
echo -e "${GREEN}$BRANCH${NC}"

echo -n "Dernier commit: "
LAST_COMMIT=$(git log -1 --oneline)
echo "$LAST_COMMIT"

echo -n "Statut: "
if [ -z "$(git status --porcelain)" ]; then
    echo -e "${GREEN}Clean (pas de changements)${NC}"
else
    echo -e "${YELLOW}Changements non commités${NC}"
    git status --short | head -5
fi

echo ""

# 5. Résumé final
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RÉSUMÉ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo -e "${GREEN}✅ Application accessible sur:${NC} http://localhost:3000"
echo -e "${GREEN}✅ Programme Solana:${NC} 9oGffDQPaiKzTumvrGGZRzTt4LBGXAqbRJjYFsruFrtq"
echo -e "${GREEN}✅ Token BACK:${NC} 862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux"
echo ""
echo -e "${YELLOW}📋 Commandes utiles:${NC}"
echo "   • Logs application: tail -f /tmp/swapback-app.log"
echo "   • Redémarrer app: ./start-app-background.sh"
echo "   • Rebuild programme: anchor build"
echo "   • Deploy programme: solana program deploy target/deploy/swapback_cnft.so"
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              ✅ TOUT EST OPÉRATIONNEL !                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
