#!/bin/bash

echo ""
echo "🔍 COMPARAISON DES ADRESSES $BACK TOKEN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Deux adresses trouvées dans le code
MINT1="3v3xneRUmsHY3UAyZDXZgVZwVeJwXVDwx5ZRsRAxuaLn"
MINT2="862PQyzjqhN4ztaqLC4kozwZCUTug7DRz1oyiuQYn7Ux"

echo "📋 Adresse #1 (dans .env.local et TokenSelector):"
echo "   $MINT1"
echo ""
echo "📋 Adresse #2 (fallback dans LockInterface):"
echo "   $MINT2"
echo ""

RPC_URL="https://api.devnet.solana.com"

echo "🌐 Vérification sur devnet..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

check_mint() {
    local mint=$1
    local name=$2
    
    echo "🔸 $name:"
    
    # Vérifier si le compte existe
    local result=$(curl -s -X POST $RPC_URL \
        -H "Content-Type: application/json" \
        -d "{
            \"jsonrpc\": \"2.0\",
            \"id\": 1,
            \"method\": \"getAccountInfo\",
            \"params\": [
                \"$mint\",
                {\"encoding\": \"jsonParsed\"}
            ]
        }" | jq -r '.result.value')
    
    if [ "$result" = "null" ]; then
        echo "   ❌ N'EXISTE PAS sur devnet"
    else
        echo "   ✅ EXISTE sur devnet"
        
        # Essayer d'obtenir plus d'infos via spl-token
        if command -v spl-token &> /dev/null; then
            echo "   📊 Détails:"
            spl-token display "$mint" --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb 2>/dev/null | grep -E "Address|Decimals|Supply" | sed 's/^/      /'
        fi
    fi
    echo ""
}

check_mint "$MINT1" "Adresse #1 (3v3xne...)"
check_mint "$MINT2" "Adresse #2 (862PQy...)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 CONCLUSION:"
echo "   La bonne adresse à utiliser est celle qui EXISTE sur devnet."
echo "   Mettez à jour .env.local avec la bonne adresse:"
echo ""
echo "   NEXT_PUBLIC_BACK_MINT=<ADRESSE_QUI_EXISTE>"
echo ""
echo "💡 IMPORTANT:"
echo "   Si aucune des deux n'existe, vous devez créer un nouveau token"
echo "   $BACK sur devnet avec Token-2022."
echo ""
