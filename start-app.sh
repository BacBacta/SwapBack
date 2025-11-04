#!/bin/bash

echo "🚀 Démarrage de l'application SwapBack..."
echo ""

cd /workspaces/SwapBack/app

# Vérifier si node_modules existe
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
fi

echo "🌐 Lancement du serveur de développement..."
echo "📍 L'application sera disponible sur http://localhost:3000"
echo ""

npm run dev
