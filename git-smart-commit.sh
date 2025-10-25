#!/bin/bash

# Script de commit intelligent avec options
# Usage: 
#   ./git-smart-commit.sh "message"           # Commit avec tests
#   ./git-smart-commit.sh "message" --skip    # Commit sans tests
#   ./git-smart-commit.sh "message" --push    # Commit et push

set -e

if [ -z "$1" ]; then
  echo "❌ Usage: ./git-smart-commit.sh 'message' [--skip|--push|--skip-push]"
  echo ""
  echo "Options:"
  echo "  --skip       Skip pre-commit tests (faster)"
  echo "  --push       Push after commit"
  echo "  --skip-push  Skip tests AND push"
  exit 1
fi

COMMIT_MESSAGE="$1"
SKIP_TESTS=false
DO_PUSH=false

# Parse options
for arg in "$@"; do
  case $arg in
    --skip|--skip-tests)
      SKIP_TESTS=true
      ;;
    --push)
      DO_PUSH=true
      ;;
    --skip-push)
      SKIP_TESTS=true
      DO_PUSH=true
      ;;
  esac
done

echo "🚀 Smart Commit"
echo "📝 Message: $COMMIT_MESSAGE"
echo "🧪 Tests: $([ "$SKIP_TESTS" = true ] && echo "SKIPPED ⏭️" || echo "ENABLED ✅")"
echo "🔼 Push: $([ "$DO_PUSH" = true ] && echo "YES" || echo "NO")"
echo ""

# Stage files
echo "📦 Staging files..."
git add -A

# Show status
echo "📊 Fichiers modifiés:"
git status --short | head -10
TOTAL_FILES=$(git diff --cached --name-only | wc -l)
if [ $TOTAL_FILES -gt 10 ]; then
  echo "   ... et $((TOTAL_FILES - 10)) autres fichiers"
fi
echo ""

# Commit
if [ "$SKIP_TESTS" = true ]; then
  echo "💾 Commit (tests skipped)..."
  SKIP_PRECOMMIT_TESTS=1 git commit -m "$COMMIT_MESSAGE"
else
  echo "💾 Commit (with tests)..."
  git commit -m "$COMMIT_MESSAGE"
fi

echo "✅ Commit réussi!"
echo ""

# Push if requested
if [ "$DO_PUSH" = true ]; then
  BRANCH=$(git branch --show-current)
  echo "⬆️  Push vers origin/$BRANCH..."
  git push origin "$BRANCH"
  echo "✅ Push réussi!"
else
  echo "💡 Pour push: git push origin $(git branch --show-current)"
fi

echo ""
echo "✨ Done!"
