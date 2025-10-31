#!/bin/bash

# Script de finalisation du déploiement buyback Token-2022
# Ce script crée un package complet pour permettre le déploiement sur n'importe quelle machine

set -e

echo "📦 Création package de déploiement buyback Token-2022"
echo "===================================================="

# Créer le répertoire de package
PACKAGE_DIR="buyback-deployment-package"
mkdir -p "$PACKAGE_DIR"

# Copier les fichiers essentiels
echo "📁 Copie des fichiers..."
cp target/deploy/swapback_buyback-keypair-new.json "$PACKAGE_DIR/program-keypair.json"
cp target/deploy/swapback_buyback.so "$PACKAGE_DIR/program.so"
cp DEPLOYMENT_SUCCESS_BUYBACK.md "$PACKAGE_DIR/README.md"
cp deployment-commands.sh "$PACKAGE_DIR/deploy.sh"
chmod +x "$PACKAGE_DIR/deploy.sh"

# Créer un script d'installation simple
cat > "$PACKAGE_DIR/quick-deploy.sh" << 'EOF'
#!/bin/bash

echo "🚀 Déploiement rapide Programme Buyback Token-2022"
echo "=================================================="

# Installation Solana CLI
if ! command -v solana &> /dev/null; then
    echo "📦 Installation Solana CLI..."
    curl -L http://release.anza.xyz/v1.18.22/install | sh
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
fi

# Configuration
solana config set --url https://api.devnet.solana.com
solana config set --commitment confirmed

# Vérifier wallet
if [ ! -f ~/.config/solana/id.json ]; then
    echo "👛 Création wallet..."
    solana-keygen new --no-passphrase
fi

echo "💰 Solde: $(solana balance)"
echo "📍 Adresse: $(solana address)"

# Déployer
echo "🚀 Déploiement..."
solana program deploy --program-id program-keypair.json program.so

echo "✅ Déploiement terminé!"
echo "Programme ID: 92znK8METYTFW5dGDJUnHUMqubVGnPBTyjZ4HzjWQzir"
EOF

chmod +x "$PACKAGE_DIR/quick-deploy.sh"

# Créer le fichier d'info
cat > "$PACKAGE_DIR/INFO.txt" << EOF
SwapBack Buyback Programme - Token-2022 Support
================================================

Programme ID: 92znK8METYTFW5dGDJUnHUMqubVGnPBTyjZ4HzjWQzir
Réseau: Solana Devnet
Date: $(date)
Support Token-2022: ✅ Activé

Fichiers inclus:
- program-keypair.json : Keypair du programme
- program.so : Binaire compilé (368 KB)
- quick-deploy.sh : Script de déploiement rapide
- deploy.sh : Script de déploiement complet
- README.md : Documentation détaillée

Déploiement rapide:
  ./quick-deploy.sh

Plus d'informations:
  Voir README.md
EOF

# Créer archive
echo "📦 Création archive..."
tar -czf buyback-deployment-package.tar.gz "$PACKAGE_DIR"

echo ""
echo "✅ Package créé avec succès!"
echo "📦 Archive: buyback-deployment-package.tar.gz"
echo "📁 Dossier: $PACKAGE_DIR/"
echo ""
echo "🎯 Pour déployer sur une autre machine:"
echo "1. Copiez buyback-deployment-package.tar.gz"
echo "2. Extrayez: tar -xzf buyback-deployment-package.tar.gz"
echo "3. Allez dans le dossier: cd $PACKAGE_DIR"
echo "4. Exécutez: ./quick-deploy.sh"
echo ""
echo "📊 Contenu du package:"
ls -lh "$PACKAGE_DIR"