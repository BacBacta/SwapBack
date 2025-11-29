#!/bin/bash

echo "🔍 Test rapide de l'application locale"
echo "======================================"
echo ""

# Vérifier si le serveur tourne déjà
if pgrep -f "next dev" > /dev/null; then
    echo "✅ Serveur Next.js déjà en cours d'exécution"
    PORT=3000
    
    # Vérifier quel port est utilisé
    if lsof -i :3000 > /dev/null 2>&1; then
        PORT=3000
    elif lsof -i :3001 > /dev/null 2>&1; then
        PORT=3001
    fi
    
    echo "📍 Port détecté: $PORT"
else
    echo "❌ Serveur Next.js non démarré"
    echo "💡 Démarrez-le avec: cd app && npm run dev"
    exit 1
fi

echo ""
echo "🧪 Test 1: Vérifier que le serveur répond..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT" --max-time 5)

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Serveur répond (HTTP $HTTP_CODE)"
elif [ "$HTTP_CODE" = "000" ]; then
    echo "   ❌ Timeout - Le serveur ne répond pas (peut être en boucle)"
    exit 1
else
    echo "   ⚠️  Réponse inattendue (HTTP $HTTP_CODE)"
fi

echo ""
echo "🧪 Test 2: Vérifier le contenu HTML..."
HTML=$(curl -s "http://localhost:$PORT" --max-time 5 | head -c 500)

if echo "$HTML" | grep -q "Application error"; then
    echo "   ❌ ERREUR: 'Application error' détecté"
    echo ""
    echo "📋 Début du HTML:"
    echo "$HTML"
elif echo "$HTML" | grep -q "SWAPBACK"; then
    echo "   ✅ Application se charge correctement"
else
    echo "   ⚠️  Contenu HTML inattendu:"
    echo "$HTML"
fi

echo ""
echo "======================================"
echo "✅ Test terminé"
