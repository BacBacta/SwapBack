#!/bin/bash
set -e

echo "=============================================="
echo "🚀 BUILD & DEPLOY COMPLET"
echo "=============================================="
echo ""

# Exécuter les scripts dans l'ordre
echo "📋 Étape 1/3: Build du programme..."
./scripts/3-build-program.sh

echo ""
echo "📋 Étape 2/3: Déploiement sur devnet..."
./scripts/4-deploy-devnet.sh

echo ""
echo "=============================================="
echo "✅ BUILD & DEPLOY TERMINÉS !"
echo "=============================================="
