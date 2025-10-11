#!/bin/bash

# Script pour recréer le projet Anchor proprement et résoudre le problème de build
# Solution au problème Cargo.lock v4

set -e

echo "🚀 Reconstruction propre du projet SwapBack"
echo "==========================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step() { echo -e "${BLUE}▶ $1${NC}"; }
success() { echo -e "${GREEN}✓ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
error() { echo -e "${RED}✗ $1${NC}"; }

# Charger l'environnement
step "Chargement de l'environnement..."
source "$HOME/.cargo/env"
export PATH="/home/codespace/.local/share/solana/install/active_release/bin:$PATH"

# Vérifier les outils
step "Vérification des outils..."
anchor --version || { error "Anchor non installé"; exit 1; }
solana --version || { error "Solana non installé"; exit 1; }
success "Outils vérifiés"

# Sauvegarder le code actuel
step "Sauvegarde du code actuel..."
BACKUP_DIR="/tmp/swapback_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r programs "$BACKUP_DIR/"
cp -r app "$BACKUP_DIR/"
cp -r sdk "$BACKUP_DIR/"
cp -r oracle "$BACKUP_DIR/"
cp -r tests "$BACKUP_DIR/"
cp .env "$BACKUP_DIR/" 2>/dev/null || true
cp Anchor.toml "$BACKUP_DIR/"
success "Code sauvegardé dans: $BACKUP_DIR"

# Créer un nouveau projet propre
step "Création d'un nouveau projet Anchor propre..."
cd /tmp
rm -rf swapback_clean
anchor init swapback_clean --no-git
cd swapback_clean

# Supprimer le programme par défaut
rm -rf programs/swapback_clean

# Créer les deux programmes
step "Création des programmes swapback_router et swapback_buyback..."
cd programs
anchor new swapback_router
anchor new swapback_buyback
cd ..

# Copier le code depuis la sauvegarde
step "Copie du code source..."
cp "$BACKUP_DIR/programs/swapback_router/src/lib.rs" programs/swapback_router/src/
cp "$BACKUP_DIR/programs/swapback_buyback/src/lib.rs" programs/swapback_buyback/src/
success "Code source copié"

# Mettre à jour Anchor.toml
step "Configuration de Anchor.toml..."
cat > Anchor.toml << 'EOF'
[toolchain]
anchor_version = "0.32.1"
solana_version = "1.18.22"

[features]
resolution = true
skip-lint = false

[programs.localnet]
swapback_router = "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"
swapback_buyback = "Hn7cLGf4hYNd8F1RqYNdqxqLKxqVMiEUPPbRKZJd3zKx"

[programs.devnet]
swapback_router = "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"
swapback_buyback = "Hn7cLGf4hYNd8F1RqYNdqxqLKxqVMiEUPPbRKZJd3zKx"

[programs.mainnet]
swapback_router = "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"
swapback_buyback = "Hn7cLGf4hYNd8F1RqYNdqxqLKxqVMiEUPPbRKZJd3zKx"

[registry]
url = "https://api.apr.dev"

[provider]
cluster = "Localnet"
wallet = "~/.config/solana/id.json"

[scripts]
test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"

[test]
startup_wait = 10000

[[test.genesis]]
address = "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"
program = "target/deploy/swapback_router.so"

[[test.genesis]]
address = "Hn7cLGf4hYNd8F1RqYNdqxqLKxqVMiEUPPbRKZJd3zKx"
program = "target/deploy/swapback_buyback.so"
EOF
success "Anchor.toml configuré"

# Essayer de build
step "Premier essai de build..."
if anchor build 2>&1 | tee /tmp/build.log; then
    success "Build réussi ! ✅"
    echo ""
    echo "🎉 Le projet a été reconstruit avec succès !"
    echo ""
    echo "📁 Nouveau projet : /tmp/swapback_clean"
    echo "💾 Sauvegarde    : $BACKUP_DIR"
    echo ""
    echo "🎯 Prochaines étapes :"
    echo "  1. cd /tmp/swapback_clean"
    echo "  2. Copier app/, sdk/, oracle/, tests/ depuis la sauvegarde"
    echo "  3. anchor test"
    echo "  4. anchor deploy --provider.cluster devnet"
    echo ""
else
    warning "Build échoué. Voir les logs dans /tmp/build.log"
    echo ""
    echo "📋 Diagnostics :"
    tail -50 /tmp/build.log
    echo ""
    echo "💡 Suggestions :"
    echo "  1. Vérifier les erreurs de compilation dans lib.rs"
    echo "  2. Vérifier les dépendances dans Cargo.toml"
    echo "  3. Consulter docs/BUILD.md"
    echo ""
fi

echo ""
echo "📂 Fichiers créés :"
ls -la /tmp/swapback_clean/
echo ""
echo "📝 Pour utiliser le nouveau projet :"
echo "  cd /tmp/swapback_clean"
echo "  anchor build"
