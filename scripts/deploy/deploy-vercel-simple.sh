#!/bin/bash

# Déploiement Vercel SIMPLE sans boucles

cd /workspaces/SwapBack/app

echo "🚀 Déploiement Vercel Preview"
echo ""
echo "📁 Répertoire: $(pwd)"
echo ""

# Répondre automatiquement aux questions
vercel --yes

echo ""
echo "✅ Terminé"
