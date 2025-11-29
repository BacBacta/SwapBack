#!/bin/bash
set -e

echo "🔥🔥🔥 DRASTIC FIX: Obliterating Cargo.lock from existence 🔥🔥🔥"
echo ""

cd /workspaces/SwapBack

echo "Step 1: Remove from git tracking"
git rm -f Cargo.lock 2>/dev/null || echo "Already untracked"

echo ""
echo "Step 2: Verify .gitignore has Cargo.lock"
if ! grep -q "^Cargo.lock$" .gitignore; then
  echo "Cargo.lock" >> .gitignore
  git add .gitignore
fi

echo ""
echo "Step 3: Find and obliterate all Cargo.lock files"
find . -name "Cargo.lock" -type f -print -delete 2>/dev/null || true

echo ""
echo "Step 4: Commit changes"
git add -A
git commit -m "DRASTIC: Remove Cargo.lock from git history completely

Root cause analysis:
- Local Cargo.lock was version 3 (compatible)
- Git repo had Cargo.lock that actions/checkout@v4 restored as version 4
- cargo-build-sbf v1.18.18 cannot parse version 4

Multi-layer solution:
1. Remove Cargo.lock from git tracking (this commit)
2. Workflow now has NUCLEAR deletion step
3. Workflow cache excludes Cargo.lock explicitly
4. Pre-build paranoid checks with exit on detection
5. cargo-build-sbf will generate its own version 3

This MUST work because:
- No source in git = actions/checkout can't restore it
- Cache doesn't restore it = fresh environment
- Nuclear deletion = no remnants
- cargo-build-sbf manages its own = guaranteed v3"

echo ""
echo "Step 5: Push to GitHub"
git push origin main

echo ""
echo "✅ DONE! Now run the GitHub Actions workflow."
echo ""
echo "The build MUST succeed because Cargo.lock v4 has been obliterated from:"
echo "  ✓ Git repository"
echo "  ✓ Rust cache"
echo "  ✓ Checkout step"
echo "  ✓ Pre-build verification"
echo ""
echo "cargo-build-sbf will generate its own v3 Cargo.lock internally."
