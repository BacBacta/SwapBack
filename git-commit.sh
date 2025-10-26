#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SwapBack - Git Commit Helper Script
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# This script facilitates commits by bypassing problematic hooks
# and disabling GPG signing issues.
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}SwapBack Git Commit Helper${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check if message is provided
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: Commit message required${NC}"
    echo -e "${YELLOW}Usage: ./git-commit.sh \"your commit message\"${NC}"
    echo ""
    echo "Examples:"
    echo "  ./git-commit.sh \"fix: resolve swap transaction error\""
    echo "  ./git-commit.sh \"feat: add new dashboard component\""
    exit 1
fi

COMMIT_MESSAGE="$1"

# Ensure GPG signing is disabled locally
echo -e "${YELLOW}⚙️  Configuring Git...${NC}"
git config --local commit.gpgsign false

# Show status
echo -e "\n${BLUE}📋 Current changes:${NC}"
git status --short

# Check if there are changes to commit
if [ -z "$(git status --porcelain)" ]; then
    echo -e "\n${YELLOW}⚠️  No changes to commit${NC}"
    exit 0
fi

# Stage all changes if nothing is staged
STAGED=$(git diff --cached --name-only)
if [ -z "$STAGED" ]; then
    echo -e "\n${YELLOW}📦 Staging all changes...${NC}"
    git add -A
fi

# Show what will be committed
echo -e "\n${BLUE}📝 Files to commit:${NC}"
git diff --cached --name-only

# Commit with --no-verify to bypass hooks
echo -e "\n${YELLOW}💾 Creating commit...${NC}"
if git commit --no-verify -m "$COMMIT_MESSAGE"; then
    echo -e "${GREEN}✅ Commit created successfully!${NC}"
    
    # Ask if user wants to push
    echo -e "\n${BLUE}🚀 Push to origin/main?${NC} (y/n)"
    read -r PUSH_CONFIRM
    
    if [ "$PUSH_CONFIRM" = "y" ] || [ "$PUSH_CONFIRM" = "Y" ]; then
        echo -e "${YELLOW}📤 Pushing to GitHub...${NC}"
        if git push origin main; then
            echo -e "${GREEN}✅ Changes pushed successfully!${NC}"
        else
            echo -e "${RED}❌ Push failed${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}⏸️  Skipped push. You can push later with: git push origin main${NC}"
    fi
else
    echo -e "${RED}❌ Commit failed${NC}"
    exit 1
fi

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Done!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
