#!/bin/bash

# Script de vérification complète de SwapBack
# Vérifie que tous les services fonctionnent correctement

echo "🔍 VÉRIFICATION DE SWAPBACK"
echo "=================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour vérifier un service
check_service() {
    local name=$1
    local url=$2
    local expected=$3
    
    echo -n "Vérification $name... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>&1)
    
    if [ "$response" = "$expected" ]; then
        echo -e "${GREEN}✅ OK${NC}"
        return 0
    else
        echo -e "${RED}❌ ÉCHEC (code: $response)${NC}"
        return 1
    fi
}

# Fonction pour vérifier une API JSON
check_json_api() {
    local name=$1
    local url=$2
    local field=$3
    
    echo -n "Vérification $name... "
    
    response=$(curl -s "$url" 2>&1)
    
    if echo "$response" | jq -e ".$field" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ OK${NC}"
        echo "   → $(echo "$response" | jq -c .)"
        return 0
    else
        echo -e "${RED}❌ ÉCHEC${NC}"
        echo "   → $response"
        return 1
    fi
}

# Fonction pour vérifier le contenu HTML
check_html_content() {
    local name=$1
    local url=$2
    local pattern=$3
    
    echo -n "Vérification $name... "
    
    content=$(curl -s "$url" 2>&1)
    
    if echo "$content" | grep -q "$pattern"; then
        echo -e "${GREEN}✅ OK${NC}"
        return 0
    else
        echo -e "${RED}❌ ÉCHEC${NC}"
        return 1
    fi
}

echo "1️⃣  SERVICES DE BASE"
echo "-------------------"

# Vérifier Oracle API
check_json_api "Oracle API Health" "http://localhost:3003/health" "status"

# Vérifier Next.js
check_service "Application Next.js" "http://localhost:3000" "200"

echo ""
echo "2️⃣  FONCTIONNALITÉS API"
echo "-------------------"

# Tester la simulation de route
echo -n "Test simulation de route... "
sim_response=$(curl -s -X POST http://localhost:3003/simulate \
    -H "Content-Type: application/json" \
    -d '{"inputMint":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","outputMint":"So11111111111111111111111111111111111111112","inputAmount":"1000000","slippage":0.005}' 2>&1)

if echo "$sim_response" | jq -e '.estimatedOutput' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ OK${NC}"
    echo "   → Type: $(echo "$sim_response" | jq -r '.type')"
    echo "   → Output: $(echo "$sim_response" | jq -r '.estimatedOutput')"
    echo "   → Non-optimisé: $(echo "$sim_response" | jq -r '.nonOptimizedOutput')"
    echo "   → Économie: $(echo "$sim_response" | jq -r '.npi')"
else
    echo -e "${RED}❌ ÉCHEC${NC}"
fi

echo ""
echo "3️⃣  INTERFACE UTILISATEUR"
echo "-------------------"

# Vérifier le titre de la page
check_html_content "Titre de la page" "http://localhost:3000" "SwapBack"

# Vérifier les onglets
check_html_content "Onglet Swap" "http://localhost:3000" "🔄 Swap"
check_html_content "Onglet Historique" "http://localhost:3000" "🔍 Historique"

# Vérifier le composant Swap
check_html_content "Composant Swap" "http://localhost:3000" "Swap Optimisé"

# Vérifier les statistiques
check_html_content "Statistiques" "http://localhost:3000" "Volume Total"

echo ""
echo "4️⃣  PROCESSUS"
echo "-------------------"

# Vérifier les processus en cours
echo -n "Processus Oracle API... "
if pgrep -f "node dist/index.js" > /dev/null; then
    echo -e "${GREEN}✅ Running (PID: $(pgrep -f "node dist/index.js"))${NC}"
else
    echo -e "${RED}❌ Non trouvé${NC}"
fi

echo -n "Processus Next.js... "
if pgrep -f "next dev" > /dev/null; then
    echo -e "${GREEN}✅ Running (PID: $(pgrep -f "next dev" | head -1))${NC}"
else
    echo -e "${RED}❌ Non trouvé${NC}"
fi

echo ""
echo "5️⃣  PORTS"
echo "-------------------"

echo -n "Port 3000 (Next.js)... "
if lsof -i :3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Ouvert${NC}"
else
    echo -e "${YELLOW}⚠️  Non trouvé (peut être normal si Next.js utilise un autre port)${NC}"
fi

echo -n "Port 3003 (Oracle)... "
if lsof -i :3003 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Ouvert${NC}"
else
    echo -e "${RED}❌ Fermé${NC}"
fi

echo ""
echo "6️⃣  FICHIERS BLOCKCHAIN TRACER"
echo "-------------------"

files=(
    "/workspaces/SwapBack/sdk/src/blockchain-tracer.ts"
    "/workspaces/SwapBack/app/src/hooks/useBlockchainTracer.ts"
    "/workspaces/SwapBack/app/src/components/OperationHistory.tsx"
    "/workspaces/SwapBack/app/src/components/SwapPage.tsx"
)

for file in "${files[@]}"; do
    filename=$(basename "$file")
    echo -n "Fichier $filename... "
    if [ -f "$file" ]; then
        size=$(ls -lh "$file" | awk '{print $5}')
        echo -e "${GREEN}✅ OK${NC} ($size)"
    else
        echo -e "${RED}❌ Manquant${NC}"
    fi
done

echo ""
echo "=================================="
echo "✅ VÉRIFICATION TERMINÉE"
echo ""
echo "📝 Pour accéder à l'application :"
echo "   → http://localhost:3000"
echo ""
echo "📝 Pour l'API Oracle :"
echo "   → http://localhost:3003"
echo ""
echo "🔍 Pour voir l'historique des opérations :"
echo "   → Cliquez sur l'onglet '🔍 Historique des Opérations'"
echo ""
