#!/bin/bash
# Solution rapide: installer CodeQL CLI avec token GitHub

set -e

echo "📦 Installation de CodeQL CLI"
echo "=============================="
echo ""

# Vérifier si le token est défini
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ GITHUB_TOKEN non défini"
    echo "Définissez: export GITHUB_TOKEN='votre_token'"
    exit 1
fi

# Vérifier si CodeQL est déjà installé
if command -v codeql &> /dev/null; then
    echo "✅ CodeQL CLI déjà installé"
    codeql --version
    exit 0
fi

echo "Téléchargement de CodeQL CLI..."
echo ""

# Créer un répertoire pour CodeQL
mkdir -p ~/.local/bin

# Télécharger avec le token (pour augmenter rate limit)
cd ~/.local/bin

# Récupérer la dernière version
LATEST_RELEASE=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
    https://api.github.com/repos/github/codeql-cli-binaries/releases/latest \
    | grep -o '"download_url":"[^"]*linux64.zip' | cut -d'"' -f4)

if [ -z "$LATEST_RELEASE" ]; then
    echo "❌ Impossible de récupérer la dernière version"
    echo "URL de base: https://github.com/github/codeql-cli-binaries/releases"
    exit 1
fi

echo "URL trouvée: $LATEST_RELEASE"
echo ""

# Télécharger
wget -q --show-progress \
    -H "Authorization: token $GITHUB_TOKEN" \
    -O codeql-linux64.zip \
    "$LATEST_RELEASE"

echo "Extraction..."
unzip -q codeql-linux64.zip

# Vérifier
if codeql/codeql --version; then
    echo ""
    echo "✅ CodeQL CLI installé avec succès"
    echo ""
    echo "Pour utiliser CodeQL:"
    echo "  1. Ajouter au PATH: export PATH=\"\$PATH:\$HOME/.local/bin/codeql\""
    echo "  2. Ou créer un symlink: ln -s ~/.local/bin/codeql/codeql /usr/local/bin/codeql"
    echo ""
    echo "Ensuite: codeql --version"
else
    echo "❌ Installation échouée"
    exit 1
fi
