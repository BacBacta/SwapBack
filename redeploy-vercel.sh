#!/bin/bash

# 🚀 Script de redéploiement Vercel avec nouvelles variables d'environnement
# Ce script force un redéploiement sur Vercel pour appliquer les nouvelles env vars

set -e

echo "🔧 Redéploiement de SwapBack sur Vercel..."
echo ""
echo "📋 Nouvelles variables d'environnement :"
echo "  - NEXT_PUBLIC_SOLANA_NETWORK=devnet"
echo "  - NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com"
echo "  - NEXT_PUBLIC_BACK_MINT=8sQq53Up7KooCTygi8Dk3Gt8XDeUN5BVLNi5h6Skz43P"
echo ""
echo "⚠️  IMPORTANT : Avant d'exécuter ce script, vous DEVEZ :"
echo "  1. Aller sur https://vercel.com/dashboard"
echo "  2. Sélectionner votre projet SwapBack"
echo "  3. Aller dans Settings → Environment Variables"
echo "  4. Mettre à jour les 3 variables ci-dessus"
echo ""
read -p "Avez-vous mis à jour les variables sur Vercel ? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Annulé. Mettez d'abord à jour les variables sur Vercel."
    exit 1
fi

echo ""
echo "🚀 Déclenchement du redéploiement..."
echo ""

# Commit vide pour déclencher le déploiement
git commit --allow-empty -m "trigger: redeploy with new token \$BACK (8sQq53Up7KooCTygi8Dk3Gt8XDeUN5BVLNi5h6Skz43P)"

echo "✅ Commit créé"
echo ""

# Push vers GitHub (déclenche le déploiement Vercel automatiquement)
echo "📤 Push vers GitHub..."
git push origin main

echo ""
echo "✅ Redéploiement déclenché !"
echo ""
echo "📊 Vérification :"
echo "  1. Allez sur https://vercel.com/dashboard"
echo "  2. Vérifiez que le déploiement est en cours"
echo "  3. Attendez 2-3 minutes que le déploiement se termine"
echo "  4. Testez votre site : connectez votre wallet et vérifiez le solde"
echo ""
echo "🎯 Votre solde devrait afficher : 100,000 \$BACK"
echo ""
