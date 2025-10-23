#!/bin/bash
# Solution pour l'erreur CodeQL 403 rate limit exceeded

set -e

echo "🔧 Résolution du problème GitHub API Rate Limit CodeQL"
echo "======================================================"
echo ""

# 1. Vérifier si un token est configuré
echo "1️⃣ Vérification du token GitHub..."
if [ -z "$GITHUB_TOKEN" ]; then
    echo "⚠️  GITHUB_TOKEN non défini"
    echo ""
    echo "Solutions :"
    echo ""
    echo "Option A: Créer un Personal Access Token (PAT)"
    echo "  1. Allez sur: https://github.com/settings/tokens/new"
    echo "  2. Scopes requis: repo, workflow, read:packages"
    echo "  3. Copiez le token"
    echo "  4. Définissez: export GITHUB_TOKEN='votre_token'"
    echo ""
    echo "Option B: Utiliser le token Codespaces (plus simple)"
    echo "  export GITHUB_TOKEN=\${{ secrets.GITHUB_TOKEN }}"
    echo ""
    echo "Option C: Désactiver CodeQL CLI (si non critique)"
    echo "  # Commentez la ligne dans votre script"
    exit 1
else
    echo "✅ GITHUB_TOKEN défini"
    TOKEN_PREVIEW=$(echo "$GITHUB_TOKEN" | cut -c 1-10)...
    echo "   Token: $TOKEN_PREVIEW (longueur: ${#GITHUB_TOKEN})"
fi

echo ""

# 2. Tester la limite d'API
echo "2️⃣ Vérification des limites API GitHub..."
RATE_LIMIT=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
    https://api.github.com/rate_limit | grep -o '"limit":[0-9]*' | head -1)

if [ -z "$RATE_LIMIT" ]; then
    echo "❌ Impossible de récupérer le rate limit"
    echo "   Vérifiez votre token"
else
    echo "✅ $RATE_LIMIT requests par heure"
fi

echo ""

# 3. Option: Ajouter au .bashrc / .zshrc
echo "3️⃣ Configuration persistante..."
SHELL_RC=""
if [ -f ~/.zshrc ]; then
    SHELL_RC=~/.zshrc
elif [ -f ~/.bashrc ]; then
    SHELL_RC=~/.bashrc
fi

if [ -n "$SHELL_RC" ] && ! grep -q "GITHUB_TOKEN" "$SHELL_RC" 2>/dev/null; then
    echo "Ajouter au $SHELL_RC :"
    echo ""
    echo "cat >> $SHELL_RC << 'EOF'"
    echo "# GitHub Token pour éviter les rate limits"
    echo "export GITHUB_TOKEN='votre_token_ici'"
    echo "EOF"
    echo ""
else
    echo "✓ Configuration déjà présente ou shell non trouvé"
fi

echo ""

# 4. Ajouter aux secrets Codespaces
echo "4️⃣ Configuration recommandée pour Codespaces..."
echo "Dans GitHub Settings → Codespaces → Secrets:"
echo "  Créer un secret 'GITHUB_TOKEN' avec votre token"
echo "  Cela l'auto-injecte dans tous les Codespaces"

echo ""
echo "======================================================"
echo "✅ Guide complet appliqué"
echo ""
echo "Pour tester immédiatement:"
echo "  export GITHUB_TOKEN='votre_token'"
echo "  bash scripts/security-check.sh"
