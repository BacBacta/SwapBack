# Script de déploiement généré automatiquement
# Programme Buyback avec support Token-2022
# Date: 2025-10-31T14:46:23.677Z

echo "🚀 Déploiement programme buyback Token-2022"
echo "=========================================="

# 1. Installer Solana CLI (si pas déjà fait)
echo "📦 Installation Solana CLI..."
if ! command -v solana &> /dev/null; then
    echo "Installation de Solana CLI..."
    sh -c "$(curl -sSfL https://release.solana.com/v1.18.22/install)"
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
else
    echo "Solana CLI déjà installé"
fi

# 2. Configuration pour devnet
echo "🌐 Configuration Solana devnet..."
solana config set --url https://api.devnet.solana.com
solana config set --commitment confirmed

# 3. Créer un wallet si nécessaire
echo "👛 Configuration wallet..."
if [ ! -f ~/.config/solana/id.json ]; then
    echo "Création d'un nouveau wallet..."
    solana-keygen new --no-passphrase
else
    echo "Wallet existant trouvé"
fi

echo "Adresse wallet: $(solana address)"
echo "Solde actuel: $(solana balance)"

# 4. Obtenir des SOL si nécessaire
BALANCE=$(solana balance | awk '{print $1}' | sed 's/SOL//')
if (( $(echo "$BALANCE < 5" | bc -l 2>/dev/null || echo "5") )); then
    echo "💰 Obtention d'airdrop (5 SOL)..."
    solana airdrop 5
    echo "Nouveau solde: $(solana balance)"
fi

# 5. Créer les fichiers de déploiement
echo "📁 Préparation des fichiers..."
mkdir -p ~/swapback-deployment

# Copiez ces fichiers depuis votre workspace:
# - target/deploy/swapback_buyback-keypair.json → ~/swapback-deployment/
# - target/deploy/swapback_buyback.so → ~/swapback-deployment/

cat > ~/swapback-deployment/deploy.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Déploiement du programme buyback..."

# Chemins des fichiers (à ajuster selon votre copie)
PROGRAM_KEYPAIR="swapback_buyback-keypair.json"
PROGRAM_BINARY="swapback_buyback.so"
PROGRAM_ID="9KTkQyjDYHF4vemLZjYQM1XE74peviEi1tSXaYMSyZHT"

# Vérifier les fichiers
if [ ! -f "$PROGRAM_KEYPAIR" ]; then
    echo "❌ Keypair manquante: $PROGRAM_KEYPAIR"
    echo "Copiez target/deploy/swapback_buyback-keypair.json ici"
    exit 1
fi

if [ ! -f "$PROGRAM_BINARY" ]; then
    echo "❌ Binaire manquant: $PROGRAM_BINARY"
    echo "Copiez target/deploy/swapback_buyback.so ici"
    exit 1
fi

echo "Fichiers vérifiés ✅"

# Déployer le programme
echo "📦 Déploiement en cours..."
solana program deploy \
    --program-id "$PROGRAM_KEYPAIR" \
    "$PROGRAM_BINARY"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ DÉPLOIEMENT RÉUSSI!"
    echo "======================"
    echo "Programme ID: $PROGRAM_ID"
    echo "Support Token-2022: ✅ Activé"
    echo ""
    echo "🎯 Prochaines étapes:"
    echo "1. Vérifier: solana program show $PROGRAM_ID"
    echo "2. Tester la compatibilité Token-2022"
    echo "3. Initialiser les états buyback"
else
    echo ""
    echo "❌ ÉCHEC DU DÉPLOIEMENT"
    echo "Vérifiez les logs ci-dessus"
fi
EOF

chmod +x ~/swapback-deployment/deploy.sh

echo ""
echo "📋 INSTRUCTIONS:"
echo "==============="
echo ""
echo "1. Copiez les fichiers suivants dans ~/swapback-deployment/ :"
echo "   - target/deploy/swapback_buyback-keypair.json"
echo "   - target/deploy/swapback_buyback.so"
echo ""
echo "2. Allez dans le répertoire:"
echo "   cd ~/swapback-deployment"
echo ""
echo "3. Exécutez le déploiement:"
echo "   ./deploy.sh"
echo ""
echo "4. Vérifiez le déploiement:"
echo "   solana program show 9KTkQyjDYHF4vemLZjYQM1XE74peviEi1tSXaYMSyZHT"
echo ""
echo "🎯 Programme ID cible: 9KTkQyjDYHF4vemLZjYQM1XE74peviEi1tSXaYMSyZHT"
echo "🔗 Devnet RPC: https://api.devnet.solana.com"
