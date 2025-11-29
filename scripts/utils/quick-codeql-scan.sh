#!/bin/bash
# Analyse CodeQL rapide pour JavaScript/TypeScript uniquement

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CODEQL="/home/codespace/.vscode-remote/data/User/globalStorage/github.vscode-codeql/distribution1/codeql/codeql"
WORKSPACE_DIR="/workspaces/SwapBack"
DATABASE_DIR="${WORKSPACE_DIR}/.codeql-databases/js-db"
RESULTS_DIR="${WORKSPACE_DIR}/.codeql-results"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  SwapBack - Analyse CodeQL JavaScript/TypeScript Rapide    ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Nettoyer et créer les répertoires
rm -rf "${DATABASE_DIR}"
mkdir -p "${DATABASE_DIR}"
mkdir -p "${RESULTS_DIR}"

# Créer la base de données
echo -e "${YELLOW}🔍 Création de la base de données...${NC}"
"${CODEQL}" database create "${DATABASE_DIR}" \
    --language=javascript \
    --source-root="${WORKSPACE_DIR}" \
    --overwrite

echo -e "${GREEN}✅ Base de données créée${NC}"
echo ""

# Lister les query packs disponibles
echo -e "${YELLOW}📦 Query packs disponibles:${NC}"
"${CODEQL}" resolve queries javascript-security-extended.qls || \
"${CODEQL}" resolve packs | grep javascript

echo ""
echo -e "${YELLOW}🔎 Analyse en cours...${NC}"

# Analyser avec les requêtes de sécurité
"${CODEQL}" database analyze "${DATABASE_DIR}" \
    --format=sarif-latest \
    --output="${RESULTS_DIR}/javascript-security.sarif" \
    codeql/javascript-queries:codeql-suites/javascript-security-extended.qls

echo ""
echo -e "${GREEN}✅ Analyse terminée !${NC}"
echo -e "${BLUE}📄 Résultats: ${RESULTS_DIR}/javascript-security.sarif${NC}"
echo ""

# Afficher un résumé
if command -v jq &> /dev/null; then
    ISSUES_COUNT=$(jq '.runs[0].results | length' "${RESULTS_DIR}/javascript-security.sarif" 2>/dev/null || echo "?")
    echo -e "${YELLOW}📊 ${ISSUES_COUNT} problème(s) de sécurité détecté(s)${NC}"
fi
