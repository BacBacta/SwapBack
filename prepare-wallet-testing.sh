#!/bin/bash

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  🚀 PRÉPARATION POUR TESTS AVEC WALLET                       ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

echo "📋 OPTIONS DE DÉPLOIEMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Le dev container a un problème DNS qui empêche les tests avec wallet."
echo "Voici vos options :"
echo ""
echo "1️⃣  VERCEL DEPLOYMENT (Recommandé)"
echo "   → DNS fonctionne normalement"
echo "   → Déploiement en 2 minutes"
echo "   → URL publique HTTPS (requis pour wallets)"
echo ""
echo "2️⃣  LOCAL TESTING (Hors container)"
echo "   → Cloner le repo sur votre machine locale"
echo "   → npm install && npm run dev"
echo "   → Tester sur http://localhost:3001"
echo ""
echo "3️⃣  CLOUDFLARE TUNNEL"
echo "   → Créer un tunnel depuis le container"
echo "   → URL publique temporaire"
echo "   → Contourne le problème DNS"
echo ""

read -p "Choisissez une option (1, 2 ou 3) : " choice

case $choice in
  1)
    echo ""
    echo "🚀 DÉPLOIEMENT VERCEL"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Créer .env.production
    echo "✅ Création de .env.production..."
    cat > /workspaces/SwapBack/app/.env.production << 'EOF'
# Production Environment Variables
NEXT_PUBLIC_NETWORK=devnet
NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com
USE_MOCK_QUOTES=false

# Program IDs
NEXT_PUBLIC_ROUTER_PROGRAM_ID=AbCdEfGhIjKlMnOpQrStUvWxYz1234567890ABC
NEXT_PUBLIC_BUYBACK_PROGRAM_ID=XyZ1234567890ABCdEfGhIjKlMnOpQrStUvWx
NEXT_PUBLIC_CNFT_PROGRAM_ID=1234567890ABCdEfGhIjKlMnOpQrStUvWxYz

# Wallet Configuration
NEXT_PUBLIC_WALLET_ADAPTER_NETWORK=devnet
EOF
    
    echo "✅ .env.production créé"
    echo ""
    
    # Vérifier si vercel CLI est installé
    if ! command -v vercel &> /dev/null; then
        echo "📦 Installation de Vercel CLI..."
        npm install -g vercel
    fi
    
    echo ""
    echo "📝 PROCHAINES ÉTAPES :"
    echo ""
    echo "1. Commit les changements :"
    echo "   cd /workspaces/SwapBack"
    echo "   git add ."
    echo "   git commit -m 'feat: Complete swap interface ready for deployment'"
    echo "   git push"
    echo ""
    echo "2. Déployer sur Vercel :"
    echo "   cd app"
    echo "   vercel login"
    echo "   vercel --prod"
    echo ""
    echo "3. Configurer les variables d'env sur Vercel Dashboard"
    echo ""
    echo "4. Tester avec wallet sur l'URL Vercel"
    echo ""
    
    read -p "Voulez-vous déployer maintenant ? (y/n) : " deploy
    if [ "$deploy" = "y" ]; then
        cd /workspaces/SwapBack
        git add .
        git commit -m "feat: Complete swap interface with all advanced features" || true
        git push
        
        cd app
        vercel --prod
    fi
    ;;
    
  2)
    echo ""
    echo "💻 CONFIGURATION LOCAL"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📝 Exécutez ces commandes sur votre machine locale :"
    echo ""
    echo "1. Cloner le repo :"
    echo "   git clone https://github.com/BacBacta/SwapBack.git"
    echo "   cd SwapBack/app"
    echo ""
    echo "2. Installer les dépendances :"
    echo "   npm install"
    echo ""
    echo "3. Créer .env.local :"
    echo "   cat > .env.local << 'EOF'"
    echo "NEXT_PUBLIC_NETWORK=devnet"
    echo "NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com"
    echo "USE_MOCK_QUOTES=false"
    echo "EOF"
    echo ""
    echo "4. Lancer le serveur :"
    echo "   PORT=3001 npm run dev"
    echo ""
    echo "5. Ouvrir http://localhost:3001 et connecter votre wallet"
    echo ""
    ;;
    
  3)
    echo ""
    echo "🌐 CLOUDFLARE TUNNEL"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Installer cloudflared si nécessaire
    if ! command -v cloudflared &> /dev/null; then
        echo "📦 Installation de cloudflared..."
        wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
        sudo dpkg -i cloudflared-linux-amd64.deb
        rm cloudflared-linux-amd64.deb
    fi
    
    # Désactiver le mode MOCK pour le tunnel
    echo "✅ Désactivation du mode MOCK..."
    sed -i 's/USE_MOCK_QUOTES=true/USE_MOCK_QUOTES=false/' /workspaces/SwapBack/app/.env.local
    
    # Redémarrer le serveur
    echo "✅ Redémarrage du serveur..."
    pkill -9 -f "next dev"
    sleep 2
    /workspaces/SwapBack/start-server.sh
    
    echo ""
    echo "✅ Serveur prêt"
    echo ""
    echo "🌐 Création du tunnel Cloudflare..."
    echo "   (Appuyez sur Ctrl+C pour arrêter)"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    cloudflared tunnel --url http://localhost:3001
    ;;
    
  *)
    echo ""
    echo "❌ Option invalide"
    echo ""
    exit 1
    ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📚 Pour plus de détails, consultez :"
echo "   /workspaces/SwapBack/WALLET_TESTING_GUIDE.md"
echo ""
