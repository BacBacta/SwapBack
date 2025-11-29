#!/bin/bash
# Script pour exécuter une analyse CodeQL complète sur SwapBack

set -e

# Couleurs pour l'affichage
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Chemin vers CodeQL CLI
CODEQL="/home/codespace/.vscode-remote/data/User/globalStorage/github.vscode-codeql/distribution1/codeql/codeql"

# Répertoires
WORKSPACE_DIR="/workspaces/SwapBack"
DATABASE_DIR="${WORKSPACE_DIR}/.codeql-databases"
RESULTS_DIR="${WORKSPACE_DIR}/.codeql-results"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         SwapBack CodeQL Security Analysis                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Nettoyer les anciennes bases de données si demandé
if [ "$1" = "--clean" ]; then
    echo -e "${YELLOW}🧹 Nettoyage des anciennes analyses...${NC}"
    rm -rf "${DATABASE_DIR}"
    rm -rf "${RESULTS_DIR}"
fi

# Créer les répertoires nécessaires
mkdir -p "${DATABASE_DIR}"
mkdir -p "${RESULTS_DIR}"

# Fonction pour créer et analyser une base de données
analyze_language() {
    local lang=$1
    local lang_name=$2
    
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}📊 Analyse ${lang_name}...${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    
    local db_path="${DATABASE_DIR}/${lang}-db"
    
    # Créer la base de données
    echo -e "${YELLOW}🔍 Création de la base de données ${lang_name}...${NC}"
    
    if [ "${lang}" = "javascript" ]; then
        # Pour JavaScript/TypeScript
        if ! "${CODEQL}" database create "${db_path}" \
            --language="${lang}" \
            --source-root="${WORKSPACE_DIR}" \
            --overwrite 2>&1; then
            echo -e "${RED}❌ Erreur lors de la création de la base de données ${lang_name}${NC}"
            return 1
        fi
    elif [ "${lang}" = "rust" ]; then
        # Pour Rust - nécessite une compilation
        echo -e "${YELLOW}⚙️  Compilation des programmes Rust...${NC}"
        if ! "${CODEQL}" database create "${db_path}" \
            --language="${lang}" \
            --source-root="${WORKSPACE_DIR}" \
            --command="cargo build --release" \
            --overwrite 2>&1; then
            echo -e "${RED}❌ Erreur lors de la création de la base de données ${lang_name}${NC}"
            return 1
        fi
    fi
    
    echo -e "${GREEN}✅ Base de données ${lang_name} créée avec succès${NC}"
    
    # Analyser la base de données
    echo -e "${YELLOW}🔎 Analyse de sécurité ${lang_name}...${NC}"
    
    local results_file="${RESULTS_DIR}/${lang}-results.sarif"
    
    if ! "${CODEQL}" database analyze "${db_path}" \
        --format=sarif-latest \
        --output="${results_file}" \
        --sarif-category="${lang}" \
        --sarif-add-baseline-file-info \
        --threads=0 \
        -- \
        "${lang}-security-extended.qls" \
        "${lang}-security-and-quality.qls" 2>&1; then
        echo -e "${RED}❌ Erreur lors de l'analyse ${lang_name}${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ Analyse ${lang_name} terminée${NC}"
    
    # Générer un rapport lisible
    echo -e "${YELLOW}📄 Génération du rapport ${lang_name}...${NC}"
    
    local csv_file="${RESULTS_DIR}/${lang}-results.csv"
    
    if ! "${CODEQL}" database analyze "${db_path}" \
        --format=csv \
        --output="${csv_file}" \
        -- \
        "${lang}-security-extended.qls" \
        "${lang}-security-and-quality.qls" 2>&1; then
        echo -e "${YELLOW}⚠️  Impossible de générer le rapport CSV${NC}"
    else
        echo -e "${GREEN}✅ Rapport CSV généré: ${csv_file}${NC}"
    fi
}

# Analyser JavaScript/TypeScript
if analyze_language "javascript" "JavaScript/TypeScript"; then
    echo -e "${GREEN}✅ Analyse JavaScript/TypeScript complète${NC}"
else
    echo -e "${RED}❌ Échec de l'analyse JavaScript/TypeScript${NC}"
fi

# Analyser Rust
echo ""
echo -e "${YELLOW}Note: L'analyse Rust peut prendre plusieurs minutes...${NC}"
if analyze_language "rust" "Rust"; then
    echo -e "${GREEN}✅ Analyse Rust complète${NC}"
else
    echo -e "${RED}❌ Échec de l'analyse Rust${NC}"
fi

# Résumé final
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                  Analyse Terminée                           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}📁 Résultats disponibles dans: ${RESULTS_DIR}${NC}"
echo ""
echo -e "${YELLOW}Pour afficher les résultats:${NC}"
echo -e "  - SARIF (pour GitHub): ${RESULTS_DIR}/*-results.sarif"
echo -e "  - CSV (lisible): ${RESULTS_DIR}/*-results.csv"
echo ""
echo -e "${YELLOW}Pour interpréter les résultats:${NC}"
echo -e "  ${CODEQL} bqrs interpret --format=sarif-latest <database>/<query>.bqrs"
echo ""

# Compter les problèmes détectés
echo -e "${BLUE}📊 Résumé des vulnérabilités:${NC}"
for sarif_file in "${RESULTS_DIR}"/*-results.sarif; do
    if [ -f "${sarif_file}" ]; then
        local lang=$(basename "${sarif_file}" -results.sarif)
        local count=$(jq '.runs[0].results | length' "${sarif_file}" 2>/dev/null || echo "?")
        echo -e "  ${lang}: ${count} problème(s) détecté(s)"
    fi
done

echo ""
echo -e "${GREEN}✨ Analyse de sécurité CodeQL terminée avec succès !${NC}"
