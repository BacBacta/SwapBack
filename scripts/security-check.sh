#!/bin/bash

# Script de vérification de sécurité locale pour SwapBack
# Utilise CodeQL CLI pour analyser le code

set -e

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}======================================${NC}"
echo -e "${YELLOW}  SwapBack - Vérification Sécurité   ${NC}"
echo -e "${YELLOW}======================================${NC}"
echo ""

# Vérifier si CodeQL CLI est installé
if ! command -v codeql &> /dev/null; then
    echo -e "${RED}❌ CodeQL CLI n'est pas installé${NC}"
    echo ""
    echo "Pour installer CodeQL CLI :"
    echo "  1. Téléchargez depuis: https://github.com/github/codeql-cli-binaries/releases"
    echo "  2. Extrayez l'archive"
    echo "  3. Ajoutez le répertoire au PATH"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ CodeQL CLI détecté${NC}"
CODEQL_VERSION=$(codeql --version | head -n 1)
echo "   Version: $CODEQL_VERSION"
echo ""

# Créer le répertoire de sortie
OUTPUT_DIR="/tmp/swapback-security"
mkdir -p "$OUTPUT_DIR"

# Fonction pour analyser JavaScript/TypeScript
analyze_js() {
    echo -e "${YELLOW}📦 Analyse JavaScript/TypeScript...${NC}"
    
    if [ -d "$OUTPUT_DIR/swapback-js-db" ]; then
        echo "   Suppression de l'ancienne base de données..."
        rm -rf "$OUTPUT_DIR/swapback-js-db"
    fi
    
    echo "   Création de la base de données CodeQL..."
    codeql database create "$OUTPUT_DIR/swapback-js-db" \
        --language=javascript \
        --source-root=/workspaces/SwapBack \
        --overwrite \
        2>&1 | grep -v "Finalizing database"
    
    echo "   Analyse du code..."
    codeql database analyze "$OUTPUT_DIR/swapback-js-db" \
        javascript-security-and-quality.qls \
        --format=sarif-latest \
        --output="$OUTPUT_DIR/js-results.sarif" \
        2>&1 | tail -5
    
    # Convertir en CSV pour lecture facile
    codeql sarif-to-csv "$OUTPUT_DIR/js-results.sarif" \
        --output="$OUTPUT_DIR/js-results.csv"
    
    # Compter les alertes
    ALERT_COUNT=$(grep -c "^" "$OUTPUT_DIR/js-results.csv" 2>/dev/null || echo "1")
    ALERT_COUNT=$((ALERT_COUNT - 1)) # Retirer la ligne d'en-tête
    
    if [ "$ALERT_COUNT" -gt 0 ]; then
        echo -e "${RED}   ⚠️  $ALERT_COUNT alertes trouvées${NC}"
        echo "   Résultats: $OUTPUT_DIR/js-results.csv"
    else
        echo -e "${GREEN}   ✅ Aucune alerte${NC}"
    fi
    echo ""
}

# Fonction pour analyser Rust
analyze_rust() {
    echo -e "${YELLOW}🦀 Analyse Rust...${NC}"
    
    if [ -d "$OUTPUT_DIR/swapback-rust-db" ]; then
        echo "   Suppression de l'ancienne base de données..."
        rm -rf "$OUTPUT_DIR/swapback-rust-db"
    fi
    
    echo "   Création de la base de données CodeQL..."
    codeql database create "$OUTPUT_DIR/swapback-rust-db" \
        --language=rust \
        --source-root=/workspaces/SwapBack \
        --overwrite \
        --command="cargo build --release" \
        2>&1 | grep -v "Finalizing database"
    
    echo "   Analyse du code..."
    codeql database analyze "$OUTPUT_DIR/swapback-rust-db" \
        rust-security-and-quality.qls \
        --format=sarif-latest \
        --output="$OUTPUT_DIR/rust-results.sarif" \
        2>&1 | tail -5
    
    # Convertir en CSV
    codeql sarif-to-csv "$OUTPUT_DIR/rust-results.sarif" \
        --output="$OUTPUT_DIR/rust-results.csv"
    
    # Compter les alertes
    ALERT_COUNT=$(grep -c "^" "$OUTPUT_DIR/rust-results.csv" 2>/dev/null || echo "1")
    ALERT_COUNT=$((ALERT_COUNT - 1))
    
    if [ "$ALERT_COUNT" -gt 0 ]; then
        echo -e "${RED}   ⚠️  $ALERT_COUNT alertes trouvées${NC}"
        echo "   Résultats: $OUTPUT_DIR/rust-results.csv"
    else
        echo -e "${GREEN}   ✅ Aucune alerte${NC}"
    fi
    echo ""
}

# Exécuter les analyses
if [ "$1" == "js" ] || [ -z "$1" ]; then
    analyze_js
fi

if [ "$1" == "rust" ] || [ -z "$1" ]; then
    analyze_rust
fi

echo -e "${YELLOW}======================================${NC}"
echo -e "${YELLOW}         Analyse Terminée            ${NC}"
echo -e "${YELLOW}======================================${NC}"
echo ""
echo "Résultats disponibles dans : $OUTPUT_DIR"
echo ""
echo "Pour voir les détails :"
echo "  cat $OUTPUT_DIR/js-results.csv"
echo "  cat $OUTPUT_DIR/rust-results.csv"
echo ""
