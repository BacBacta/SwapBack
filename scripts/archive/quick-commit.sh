#!/bin/bash
# Quick commit and push script for SwapBack

# Usage: ./quick-commit.sh "commit message"

if [ -z "$1" ]; then
    echo "❌ Error: Commit message required"
    echo "Usage: ./quick-commit.sh \"your commit message\""
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SwapBack Quick Commit"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Configure Git
git config --local commit.gpgsign false

# Stage and commit
git add -A
git commit --no-verify -m "$1"

# Push
git push origin main

echo "✅ Done!"
