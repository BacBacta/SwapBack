#!/bin/bash
# 🔧 Script pour désactiver les extensions gourmandes et libérer la mémoire
# SonarLint consomme 440MB+ et cause les déconnexions
# Usage: bash .devcontainer/disable-heavy-extensions.sh

set -e

echo "🔧 Désactivation des extensions gourmandes..."
echo ""

# Chemins importants
SETTINGS_FILE="$HOME/.config/Code/User/settings.json"
VSCODE_REMOTE_SETTINGS="$HOME/.vscode-remote/data/Machine/settings.json"

# Créer les dossiers s'ils n'existent pas
mkdir -p "$(dirname "$SETTINGS_FILE")" 2>/dev/null || true
mkdir -p "$(dirname "$VSCODE_REMOTE_SETTINGS")" 2>/dev/null || true

# Fonction pour ajouter une configuration
add_config() {
    local config_file=$1
    local key=$2
    local value=$3
    
    if [ -f "$config_file" ]; then
        # Vérifier si la clé existe déjà
        if jq ".$key" "$config_file" > /dev/null 2>&1; then
            echo "✓ $key déjà configurée"
        else
            # Ajouter la nouvelle clé
            jq ".$key = $value" "$config_file" > "$config_file.tmp" && mv "$config_file.tmp" "$config_file"
            echo "✅ $key ajoutée"
        fi
    else
        # Créer le fichier JSON
        echo "{}" | jq ".$key = $value" > "$config_file"
        echo "✅ Fichier créé avec $key"
    fi
}

echo "1️⃣ Désactivation de SonarLint..."
# Ajouter à la configuration locale VS Code (Workspace)
add_config "$SETTINGS_FILE" '"[sonarlint] disabled"' 'true'

echo ""
echo "2️⃣ Optimisation de rust-analyzer..."
# Réduire la consommation mémoire de rust-analyzer
add_config "$SETTINGS_FILE" '"rust-analyzer.checkOnSave"' 'false'
add_config "$SETTINGS_FILE" '"rust-analyzer.procMacro.enable"' 'false'
add_config "$SETTINGS_FILE" '"rust-analyzer.cargo.loadOutDirsFromCheck"' 'false'

echo ""
echo "3️⃣ Optimisation générale VS Code..."
# Optimisations globales
add_config "$SETTINGS_FILE" '"editor.bracketPairColorization.enabled"' 'false'
add_config "$SETTINGS_FILE" '"python.linting.enabled"' 'false'
add_config "$SETTINGS_FILE" '"extensions.autoCheckUpdates"' 'false'
add_config "$SETTINGS_FILE" '"extensions.autoUpdate"' 'false'

echo ""
echo "✅ Extensions optimisées !"
echo ""
echo "📋 Prochaines étapes:"
echo "  1. Rechargez VS Code: Cmd/Ctrl + R"
echo "  2. Attendez 30 secondes pour les changements"
echo "  3. Vérifiez la mémoire: free -h"
echo ""
echo "🔍 Vérification de la mémoire en direct:"
free -h
echo ""
echo "📊 Processus gourmands:"
ps aux --sort=-%mem | head -6
