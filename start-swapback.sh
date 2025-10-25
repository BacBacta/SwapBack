#!/bin/bash

echo "🚀 Démarrage de SwapBack..."
echo ""

# Fonction pour vérifier si un port est utilisé
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Arrêter les processus existants
echo "🔄 Nettoyage des processus existants..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "node dist/index.js" 2>/dev/null || true
sleep 2

# Démarrer Oracle API
echo "🔧 Démarrage de l'Oracle API..."
cd /workspaces/SwapBack/oracle
npm run build > /dev/null 2>&1
nohup npm start > /tmp/oracle.log 2>&1 &
sleep 3

# Démarrer l'application Next.js
echo "🌐 Démarrage de l'application Next.js..."
cd /workspaces/SwapBack/app
nohup npm run dev > /tmp/app.log 2>&1 &
sleep 3

# Vérifier les services
echo ""
echo "✅ Vérification des services..."
if check_port 3003; then
    echo "  ✅ Oracle API: http://localhost:3003 - ACTIF"
else
    echo "  ❌ Oracle API: ERREUR"
fi

if check_port 3001; then
    echo "  ✅ Application: http://localhost:3001 - ACTIF"
elif check_port 3000; then
    echo "  ✅ Application: http://localhost:3000 - ACTIF"
else
    echo "  ❌ Application: ERREUR"
fi

echo ""
echo "🎉 SwapBack est prêt !"
echo "   📱 Ouvrez l'application dans votre navigateur"
echo "   🔗 Navigation: Swap | DCA | Dashboard"
echo ""