#!/bin/bash
# Commandes rapides CodeQL pour SwapBack

CODEQL="/home/codespace/.vscode-remote/data/User/globalStorage/github.vscode-codeql/distribution1/codeql/codeql"

# Alias
alias codeql="$CODEQL"

echo "🔐 CodeQL Quick Commands pour SwapBack"
echo ""
echo "Commandes disponibles :"
echo "  1. Vérifier la version     : codeql version"
echo "  2. Lister les packs        : codeql resolve packs"
echo "  3. Lister les langages     : codeql resolve languages"
echo "  4. Analyse rapide JS/TS    : ./quick-codeql-scan.sh"
echo "  5. Analyse complète        : ./run-codeql-analysis.sh"
echo ""
echo "Chemins importants :"
echo "  - CodeQL CLI     : $CODEQL"
echo "  - Bases de données: .codeql-databases/"
echo "  - Résultats      : .codeql-results/"
echo ""
echo "Documentation :"
echo "  - Guide complet : CODEQL_GUIDE.md"
echo "  - Configuration : CODEQL_SETUP_COMPLETE.md"
echo ""

# Fonction helper
codeql_help() {
    cat << 'EOF'
╔══════════════════════════════════════════════════════════╗
║             CodeQL Helper - SwapBack                      ║
╚══════════════════════════════════════════════════════════╝

Commandes rapides :

  📊 ANALYSE
    ./quick-codeql-scan.sh              # JS/TS rapide (3-5 min)
    ./run-codeql-analysis.sh            # Complète (10-20 min)
    ./run-codeql-analysis.sh --clean    # Avec nettoyage

  🔍 INSPECTION
    codeql resolve packs                # Voir les packs disponibles
    codeql resolve languages            # Voir les langages supportés
    codeql database info <db-path>      # Info sur une base de données

  📄 RÉSULTATS
    ls -lh .codeql-results/             # Lister les fichiers de résultats
    cat .codeql-results/*.sarif | jq    # Voir les résultats (JSON)
    cat .codeql-results/*.csv           # Voir les résultats (CSV)

  🔧 MAINTENANCE
    rm -rf .codeql-databases/           # Nettoyer les bases de données
    rm -rf .codeql-results/             # Nettoyer les résultats

  📚 DOCUMENTATION
    cat CODEQL_GUIDE.md                 # Guide complet
    cat CODEQL_SETUP_COMPLETE.md        # Configuration

Exemples :

  # Créer une base de données JavaScript
  codeql database create .codeql-databases/js-db \
    --language=javascript \
    --source-root=/workspaces/SwapBack

  # Analyser avec des requêtes de sécurité
  codeql database analyze .codeql-databases/js-db \
    --format=sarif-latest \
    --output=results.sarif \
    codeql/javascript-queries:codeql-suites/javascript-security-extended.qls

  # Voir les résultats
  cat results.sarif | jq '.runs[0].results | length'

EOF
}

# Export de la fonction
export -f codeql_help

echo "💡 Tapez 'codeql_help' pour voir toutes les commandes"
