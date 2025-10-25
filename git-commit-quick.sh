#!/bin/bash

# Script de commit rapide avec bypass des hooks
# Usage: ./git-commit-quick.sh "message de commit"

set -e

if [ -z "$1" ]; then
  echo "❌ Usage: ./git-commit-quick.sh 'message de commit'"
  exit 1
fi

COMMIT_MESSAGE="$1"

echo "🚀 Commit rapide avec bypass des tests..."
echo "📝 Message: $COMMIT_MESSAGE"
echo ""

# Ajouter tous les fichiers modifiés
echo "📦 Staging des fichiers..."
git add -A

# Commit avec --no-verify pour bypass pre-commit hooks
echo "💾 Commit en cours..."
git commit -m "$COMMIT_MESSAGE" --no-verify

# Push si demandé
read -p "🔼 Push vers origin? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "⬆️  Push en cours..."
  git push origin $(git branch --show-current)
  echo "✅ Push réussi!"
else
  echo "⏸️  Pas de push. Utilisez: git push"
fi

echo ""
echo "✅ Commit terminé!"
echo "⚠️  RAPPEL: Les tests ont été bypass. Pensez à les fixer plus tard."
