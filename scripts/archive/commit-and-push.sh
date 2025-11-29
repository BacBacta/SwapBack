#!/usr/bin/env bash
set -e

cd /workspaces/SwapBack

echo "📝 Staging changes..."
git add programs/swapback_cnft/src/lib.rs
git add Anchor.toml
git add app/.env.local
git add app/src/idl/swapback_cnft.json
git add compile-cnft.sh
git add rust-toolchain.toml

echo "💾 Committing..."
git commit -m "fix: Update CNFT program ID to match keypair (CzxpYBeKbcA6AJH7yz8ggkJ1cWen3ejKUuikE6stHEaF)

- Update declare_id in programs/swapback_cnft/src/lib.rs
- Update Anchor.toml devnet configuration
- Update app/.env.local NEXT_PUBLIC_CNFT_PROGRAM_ID
- Update app/src/idl/swapback_cnft.json address
- Reason: Program DHfa77Z9yCtVtg9GivhbjF1od25PWfwNBCm7ws5eXpzf does not exist on devnet
- Solution: Use actual keypair address from target/deploy/swapback_cnft-keypair.json"

echo "🚀 Pushing to GitHub..."
git push origin main

echo "✅ Changes pushed! Now trigger GitHub Actions workflow to build and deploy."
echo "Go to: https://github.com/BacBacta/SwapBack/actions/workflows/build-and-deploy-cnft.yml"
